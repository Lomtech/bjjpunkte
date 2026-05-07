import { createServiceClient } from '@/lib/supabase/service'
import { toE164 } from '@/lib/whatsapp'

/**
 * HTML-Escape für User-Input in Mail-Templates.
 * KRITISCH: ohne dieses wird ein Studio-Name wie `<img src=x onerror=...>`
 * als HTML im Mail-Postfach des Empfängers ausgeführt → XSS via Mail.
 */
function escHtml(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * Attribut-Escape für href/src — verhindert Attribute-Injection.
 * Zusätzlich javascript:-URLs blockieren, damit ein gespoofter URL-Wert
 * nicht in einen <a href="javascript:..."> umgewandelt wird.
 */
function escAttr(s: string | null | undefined): string {
  if (s == null) return ''
  const v = String(s).trim()
  if (/^javascript:/i.test(v) || /^data:/i.test(v)) return '#'
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, attempt * 1000)) // 1s, 2s backoff
      }
    }
  }
  throw lastError
}

interface NotifyPayload {
  gymId: string
  subject: string
  html: string
  whatsappText?: string
}

interface NotifyResult {
  emailSent: boolean
  whatsappSent: boolean
  emailError?: string
}

export async function notifyGym({ gymId, subject, html, whatsappText }: NotifyPayload): Promise<NotifyResult> {
  const supabase = createServiceClient()
  const { data: gym } = await supabase
    .from('gyms')
    .select('name, email, phone, callmebot_api_key')
    .eq('id', gymId)
    .single()

  const result: NotifyResult = { emailSent: false, whatsappSent: false }
  if (!gym) return result

  // ── Email via Resend ─────────────────────────────────────────────────────
  if (gym.email && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    try {
      const res = await withRetry(() => fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to:   gym.email,
          subject,
          html: wrapEmail(gym.name, html),
        }),
      }))
      if (res.ok) {
        result.emailSent = true
      } else {
        const body = await res.text().catch(() => '')
        result.emailError = `HTTP ${res.status}: ${body}`
        console.error('[notify] Email failed:', result.emailError)
      }
    } catch (err) {
      result.emailError = String(err)
      console.error('[notify] Email error:', err)
    }
  }

  // ── WhatsApp via CallMeBot ───────────────────────────────────────────────
  if (whatsappText && gym.callmebot_api_key && gym.phone) {
    const phone = toE164(gym.phone)
    if (phone) {
      try {
        const params = new URLSearchParams({
          phone,
          text: whatsappText,
          apikey: gym.callmebot_api_key,
        })
        const res = await fetch(`https://api.callmebot.com/whatsapp.php?${params}`)
        result.whatsappSent = res.ok
        if (!res.ok) console.error('[notify] CallMeBot failed:', res.status, await res.text().catch(() => ''))
      } catch (err) {
        console.error('[notify] CallMeBot error:', err)
      }
    }
  }

  return result
}

export async function sendMemberPaymentFailedEmail(
  ownerEmail: string,
  memberName: string,
  gymName: string,
  amountCents: number,
  memberDashboardUrl: string,
) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return
  const amountFormatted = (amountCents / 100).toFixed(2).replace('.', ',')
  return withRetry(() => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? 'noreply@osss.pro',
      to: ownerEmail,
      subject: `Zahlung fehlgeschlagen – ${escHtml(memberName)}`,
      headers: { 'List-Unsubscribe': `<mailto:unsubscribe@osss.pro?subject=unsubscribe>` },
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#18181b;margin-bottom:8px">Zahlung fehlgeschlagen</h2>
      <p style="color:#52525b">Die automatische Zahlung für <strong>${escHtml(memberName)}</strong> in <strong>${escHtml(gymName)}</strong> konnte nicht eingezogen werden.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#71717a;font-size:14px">Mitglied</td><td style="padding:6px 0;font-weight:600">${escHtml(memberName)}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a;font-size:14px">Betrag</td><td style="padding:6px 0;font-weight:600">€${amountFormatted}</td></tr>
        <tr><td style="padding:6px 0;color:#71717a;font-size:14px">Status</td><td style="padding:6px 0;color:#dc2626;font-weight:600">Fehlgeschlagen</td></tr>
      </table>
      <p style="color:#52525b;font-size:14px">Stripe wird die Zahlung automatisch erneut versuchen.</p>
      <a href="${escAttr(memberDashboardUrl)}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#fbbf24;color:#18181b;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">Mitglied anzeigen →</a>
      <p style="color:#a1a1aa;font-size:11px;margin-top:24px">Osss – automatische Benachrichtigung</p>
    </div>`,
    }),
  }))
}

// ─── Newsletter (Double-Opt-In) ─────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.osss.pro'

/**
 * Sendet die Bestätigungs-Mail für Newsletter-Anmeldung (DOI Pflicht nach § 7 UWG).
 */
export async function sendNewsletterConfirmEmail(email: string, confirmToken: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return

  const confirmUrl = `${APP_URL}/api/newsletter/confirm/${confirmToken}`

  return withRetry(() => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: 'Bitte bestätige deine Anmeldung beim Osss-Newsletter',
      html: wrapNewsletter(`
        <h1 style="margin:0 0 16px;color:#18181b;font-size:24px;font-weight:800;letter-spacing:-0.02em">Fast geschafft.</h1>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6">
          Klick einfach auf den Button, um deine E-Mail-Adresse zu bestätigen — danach bekommst du Praxis-Tipps für Kampfsport-Vereine: DSGVO, DATEV, SEPA, Mitgliederverwaltung. Höchstens 1× pro Woche, sofort abbestellbar.
        </p>
        <p style="margin:24px 0;text-align:center">
          <a href="${confirmUrl}" style="display:inline-block;padding:14px 28px;background:#fbbf24;color:#18181b;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px">Anmeldung bestätigen</a>
        </p>
        <p style="margin:0 0 8px;color:#71717a;font-size:13px;line-height:1.5">
          Funktioniert der Button nicht? Kopiere diesen Link in deinen Browser:
        </p>
        <p style="margin:0 0 24px;word-break:break-all">
          <a href="${confirmUrl}" style="color:#d97706;font-size:12px">${confirmUrl}</a>
        </p>
        <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;border-top:1px solid #e4e4e7;padding-top:16px">
          Wenn du dich nicht angemeldet hast, kannst du diese Mail einfach löschen — wir speichern deine Adresse erst nach Bestätigung dauerhaft.
        </p>
      `),
    }),
  }))
}

/**
 * Welcome-Mail nach erfolgreicher DOI-Bestätigung.
 */
export async function sendNewsletterWelcomeEmail(email: string, unsubscribeToken: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return

  const unsubscribeUrl = `${APP_URL}/api/newsletter/unsubscribe/${unsubscribeToken}`

  return withRetry(() => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      // List-Unsubscribe Header für 1-Klick-Abmeldung (RFC 8058)
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: 'Willkommen bei Osss — los geht\'s',
      html: wrapNewsletter(`
        <h1 style="margin:0 0 16px;color:#18181b;font-size:24px;font-weight:800;letter-spacing:-0.02em">Willkommen!</h1>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6">
          Du bist drin. Hier kommen Praxis-Tipps für Kampfsport-Gym-Inhaber — direkt von einem Solo-Entwickler, der selbst trainiert.
        </p>
        <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6">
          <strong>Die nächsten Themen:</strong>
        </p>
        <ul style="margin:0 0 16px;padding-left:20px;color:#3f3f46;font-size:15px;line-height:1.7">
          <li>DSGVO-Pflichtcheck für Vereine (was brauchst du wirklich?)</li>
          <li>Stripe-SEPA-Lastschrift in 4 Schritten einrichten</li>
          <li>DATEV-Export für Steuerberater — ohne Excel-Hölle</li>
          <li>Belt-Tracking digitalisieren (BJJ, Karate, Judo)</li>
        </ul>
        <p style="margin:24px 0;text-align:center">
          <a href="${APP_URL}/blog" style="display:inline-block;padding:12px 24px;background:#fbbf24;color:#18181b;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">Zum Blog →</a>
        </p>
        <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;border-top:1px solid #e4e4e7;padding-top:16px">
          Du willst keine Mails mehr? <a href="${unsubscribeUrl}" style="color:#71717a">Hier abmelden</a> — 1 Klick reicht.
        </p>
      `),
    }),
  }))
}

// ─── Gym Bulk-Mail (an Mitglieder + Leads) ─────────────────────────────────

interface BulkRecipient {
  email: string
  firstName?: string | null
  unsubscribeToken: string
}

/**
 * Sendet eine Bulk-Mail an mehrere Empfänger via Resend.
 * Versendet einzeln (nicht Resend-Batch) damit jeder Empfänger einen
 * personalisierten Unsubscribe-Link bekommt + List-Unsubscribe-Header.
 */
export async function sendGymBulkEmail({
  gymName, fromEmail, recipients, subject, htmlBody, audience,
  kind = 'announcement', coverUrl = null,
}: {
  gymName: string
  fromEmail: string
  recipients: BulkRecipient[]
  subject: string
  htmlBody: string
  audience: 'members' | 'leads' | 'both'
  /** 'announcement' (kurz, schlank) oder 'post' (mit Cover-Bild + Banner). Default: 'announcement'. */
  kind?: 'announcement' | 'post'
  /** Bei kind='post' optional verfügbar — wird oben als Banner gerendert. */
  coverUrl?: string | null
}): Promise<{ sent: number; failed: number }> {
  if (!process.env.RESEND_API_KEY) return { sent: 0, failed: recipients.length }

  let sent = 0
  let failed = 0
  // 5er-Batches parallel — bleibt unter Resend-Rate-Limit (100 RPS)
  const BATCH_SIZE = 5
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(batch.map(r => {
      const unsubscribeUrl = `${APP_URL}/api/gym-mail/unsubscribe/${r.unsubscribeToken}?audience=${audience === 'leads' ? 'lead' : 'member'}`
      const personalizedBody = htmlBody.replace(/\{\{first_name\}\}/g, r.firstName?.trim() || 'Hallo')
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: r.email,
          subject,
          html: wrapGymMail({ gymName, body: personalizedBody, unsubscribeUrl, kind, coverUrl, subject }),
        }),
      })
    }))
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.ok) sent++
      else failed++
    }
  }
  return { sent, failed }
}

/**
 * HTML-Wrapper mit zwei Varianten:
 *  - kind='announcement' → schlanker Mail-Look (kurz, ohne Cover)
 *  - kind='post'         → Newsletter-Look mit optionalem Cover-Bild + Headline
 */
function wrapGymMail({
  gymName, body, unsubscribeUrl, kind, coverUrl, subject,
}: {
  gymName: string
  body: string
  unsubscribeUrl: string
  kind: 'announcement' | 'post'
  coverUrl: string | null
  subject: string
}) {
  // Cover-Banner nur bei 'post' und valider URL
  const safeCover = (kind === 'post' && coverUrl && /^https?:\/\//i.test(coverUrl)) ? coverUrl : null
  const coverBlock = safeCover
    ? `<tr><td style="padding:0;border-radius:14px 14px 0 0;overflow:hidden">
         <img src="${safeCover}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:14px 14px 0 0" />
       </td></tr>`
    : ''

  // Headline-Block nur bei 'post'
  const headlineBlock = kind === 'post'
    ? `<tr><td style="padding:28px 36px 8px 36px;background:#fff;${safeCover ? '' : 'border-radius:14px 14px 0 0;'}">
         <p style="margin:0;color:#fbbf24;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase">Neuer Beitrag</p>
         <h1 style="margin:6px 0 0 0;color:#18181b;font-size:22px;font-weight:800;letter-spacing:-0.015em;line-height:1.25">${escapeHtml(subject)}</h1>
       </td></tr>`
    : ''

  // Card-Border-Radius variiert je nach ob Cover/Headline davor war
  const bodyTopRadius = (kind === 'post' && (safeCover || headlineBlock)) ? '0' : '14px 14px 0 0'

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden">
        <tr><td style="padding:8px 0 24px;text-align:center;background:#fafafa">
          <p style="margin:0;color:#18181b;font-size:18px;font-weight:800;letter-spacing:-0.01em">${escapeHtml(gymName)}</p>
        </td></tr>
        ${coverBlock}
        ${headlineBlock}
        <tr><td style="background:#fff;padding:${kind === 'post' ? '12px' : '36px'} 36px 36px 36px;font-size:15px;line-height:1.6;color:#3f3f46;border-radius:${bodyTopRadius} 14px 14px;">
          ${body}
        </td></tr>
        <tr><td style="padding:16px 0;text-align:center;background:#fafafa">
          <p style="margin:0;color:#a1a1aa;font-size:11px;line-height:1.5">
            Du bekommst diese Mail von <strong>${escapeHtml(gymName)}</strong>.<br/>
            Keine Lust mehr? <a href="${unsubscribeUrl}" style="color:#71717a">Hier abmelden</a> — 1 Klick reicht.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function wrapNewsletter(body: string) {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px">
        <tr><td style="padding:8px 0 24px">
          <p style="margin:0;color:#fbbf24;font-size:14px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase">Osss</p>
        </td></tr>
        <tr><td style="background:#fff;padding:36px;border:1px solid #e4e4e7;border-radius:14px">
          ${body}
        </td></tr>
        <tr><td style="padding:16px 0;text-align:center">
          <p style="margin:0;color:#a1a1aa;font-size:11px">Osss · Lom-Ali Imadaev · Adelshofen, Deutschland</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ────────────────────────────────────────────────────────────────────────────

function wrapEmail(gymName: string, body: string) {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px">
        <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:24px 32px;text-align:center">
          <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">${gymName}</p>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px">
          ${body}
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Diese Nachricht wurde automatisch von osss.pro gesendet.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
