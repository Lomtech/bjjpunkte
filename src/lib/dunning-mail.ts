/**
 * Mahnungs-Mail-Versand an Mitglieder mit PDF-Anhang.
 *
 * Wird aus `api/members/[id]/dunning/route.ts` aufgerufen, wenn der Owner
 * eine Mahnungs-Aktion (1./2./Letzte Mahnung) erfasst. Der Versand ist
 * "best-effort": Fehler werden zurückgegeben statt geworfen, damit die
 * eigentliche Action-Erfassung in der DB nicht zurückgerollt wird.
 *
 * DSGVO-Rechtsgrundlage:
 *  Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) — Mahnungen sind transactional,
 *  KEIN Marketing → kein gesonderter Consent nötig, KEIN Unsubscribe-Link.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getIbanFromGym } from '@/lib/encryption'
import { renderDunningPdf, type DunningKind } from '@/lib/dunning-pdf'

export interface DunningMailResult {
  ok: boolean
  /** True wenn Mail tatsächlich an Resend übergeben + akzeptiert wurde. */
  emailSent: boolean
  /** Optional: Grund warum Mail nicht versendet wurde. */
  error?: string
  /** Optional: Diagnostik für Logs. */
  reason?: 'no_email' | 'no_member' | 'no_gym' | 'resend_disabled' | 'http_error' | 'exception'
}

/** HTML-Escape für sicheres Einbetten in das Mail-Template. */
function escHtml(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function levelToKind(level: number): DunningKind {
  if (level >= 3) return 'final_warning'
  if (level === 2) return 'second_reminder'
  return 'first_reminder' // 1 und Default
}

function subjectFor(kind: DunningKind): string {
  switch (kind) {
    case 'first_reminder':
      return '1. Mahnung — offener Betrag'
    case 'second_reminder':
      return '2. Mahnung'
    case 'final_warning':
      return 'Letzte Mahnung vor Inkasso'
  }
}

function feeForKind(kind: DunningKind, lateFeeCents: number): number {
  // Pauschale Mahngebühr (in Cent) aus Gym-Settings.
  // Höhe ist § 288 Abs. 4 BGB / Rspr.-konform (üblich: 5–10 EUR pauschal).
  // Default 1000 (= 10 €) wird vom Aufrufer durchgereicht.
  if (kind === 'second_reminder') return lateFeeCents // 1× Mahngebühr
  if (kind === 'final_warning') return lateFeeCents * 2 // 2× kumulativ
  return 0
}

interface ResendAttachment {
  filename: string
  content: string // base64
}

async function sendViaResend(args: {
  fromName: string
  toEmail: string
  subject: string
  html: string
  attachments?: ResendAttachment[]
}): Promise<{ ok: boolean; status: number; bodyText?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !fromEmail) {
    return { ok: false, status: 0, bodyText: 'RESEND_API_KEY/FROM nicht gesetzt' }
  }

  // Resend erwartet "Display Name <email@domain>" oder nur "email@domain"
  const fromHeader = `${args.fromName} <${fromEmail}>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromHeader,
      to: args.toEmail,
      subject: args.subject,
      html: args.html,
      attachments: args.attachments,
      // Mahnungen sind transactional (Art. 6(1)(b) DSGVO Vertragserfüllung).
      // KEIN List-Unsubscribe — Mitglied kann sich nicht aus seiner
      // Vertragspflicht abmelden.
    }),
  })
  if (res.ok) return { ok: true, status: res.status }
  const bodyText = await res.text().catch(() => '')
  return { ok: false, status: res.status, bodyText }
}

/**
 * Sendet die Mahnung an das Mitglied.
 *
 * @param memberId    UUID des Mitglieds
 * @param level       Aktuelle Mahnstufe (1, 2, 3)
 * @param amountCents Offener Hauptbetrag in Cent
 * @param opts        Optional: dueDate (default = heute + 14 Tage)
 */
export async function sendDunningMail(
  memberId: string,
  level: number,
  amountCents: number,
  opts?: { dueDate?: Date },
): Promise<DunningMailResult> {
  // Edge-Case: Level außerhalb 1..3 → Default auf 1 (defensiv)
  const safeLevel = Math.max(1, Math.min(3, Math.round(level)))
  const kind = levelToKind(safeLevel)

  // Edge-Case: Negativ-Betrag → 0
  const safeAmountCents = Math.max(0, Math.round(amountCents || 0))

  const supabase = createServiceClient()

  // Member laden
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member, error: memberErr } = await (supabase.from('members') as any)
    .select(
      'id, gym_id, first_name, last_name, email, address, dunning_started_at',
    )
    .eq('id', memberId)
    .maybeSingle()

  if (memberErr || !member) {
    return {
      ok: false,
      emailSent: false,
      reason: 'no_member',
      error: memberErr?.message ?? 'Mitglied nicht gefunden',
    }
  }

  // Gym laden (für Briefkopf, Absender-Adresse, IBAN, Inkasso-Config).
  // dunning_late_fee_cents/days_to_level_2/3 werden hier mitgelesen,
  // um die Mahngebühr im PDF gym-spezifisch zu berechnen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gym, error: gymErr } = await (supabase.from('gyms') as any)
    .select(
      'name, address, email, bank_iban_enc, bank_iban, dunning_late_fee_cents, dunning_days_to_level_2, dunning_days_to_level_3',
    )
    .eq('id', member.gym_id)
    .maybeSingle()

  if (gymErr || !gym) {
    return {
      ok: false,
      emailSent: false,
      reason: 'no_gym',
      error: gymErr?.message ?? 'Gym nicht gefunden',
    }
  }

  // Wenn Mitglied keine Email hat: still erfolgreich, aber nichts versendet
  if (!member.email) {
    return { ok: true, emailSent: false, reason: 'no_email' }
  }

  // PDF rendern
  const issuedAt = new Date()
  const dueDate =
    opts?.dueDate ??
    new Date(issuedAt.getTime() + 14 * 24 * 60 * 60 * 1000)
  // Mahngebühr aus Gym-Config (Default 1000 = 10 €) — defensiv gegen NULL,
  // obwohl die Spalte NOT NULL DEFAULT 1000 ist.
  const lateFeeCents =
    typeof gym.dunning_late_fee_cents === 'number' && gym.dunning_late_fee_cents >= 0
      ? gym.dunning_late_fee_cents
      : 1000
  const feeCents = feeForKind(kind, lateFeeCents)

  let pdfBuffer: Buffer
  try {
    const stream = await renderDunningPdf({
      member: {
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        email: member.email,
        address: member.address,
      },
      gym: {
        name: gym.name,
        address: gym.address,
        email: gym.email,
        iban: getIbanFromGym(gym),
        dunning_late_fee_cents: lateFeeCents,
      },
      dunning: {
        amount_cents: safeAmountCents,
        started_at: member.dunning_started_at ?? null,
        issued_at: issuedAt,
        due_date: dueDate,
        fee_cents: feeCents,
      },
      kind,
    })

    const chunks: Buffer[] = []
    for await (const chunk of stream as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    pdfBuffer = Buffer.concat(chunks)
  } catch (err) {
    return {
      ok: false,
      emailSent: false,
      reason: 'exception',
      error: `PDF-Rendering fehlgeschlagen: ${String(err)}`,
    }
  }

  // Mail-Body
  const studioName = gym.name ?? 'Ihr Studio'
  const firstName = member.first_name ?? ''
  const subject = subjectFor(kind)
  const filename = `Mahnung_${kind === 'first_reminder' ? '1' : kind === 'second_reminder' ? '2' : '3'}.pdf`

  const amountFmt = (safeAmountCents / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  })
  const dueFmt = dueDate.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const introByKind: Record<DunningKind, string> = {
    first_reminder:
      'unsere Buchhaltung weist die unten genannte Forderung als noch nicht ausgeglichen aus. ' +
      'Möglicherweise ist Ihnen das entgangen — bitte prüfen Sie das im Anhang beigefügte Mahnschreiben.',
    second_reminder:
      'leider liegt für die unten genannte Forderung trotz unserer ersten Erinnerung noch kein Zahlungseingang vor. ' +
      'Wir mahnen daher hiermit zum zweiten Mal — Details entnehmen Sie bitte dem PDF im Anhang.',
    final_warning:
      'trotz mehrfacher Aufforderung steht die unten genannte Forderung weiterhin offen. ' +
      'Mit dem beigefügten Schreiben fordern wir Sie ein letztes Mal zur Zahlung auf, bevor wir den Vorgang an ein Inkassobüro übergeben.',
  }

  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
        <tr><td style="padding:24px 32px;background:#0f172a">
          <p style="margin:0;color:#fbbf24;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">${escHtml(studioName)}</p>
          <p style="margin:6px 0 0;color:#fff;font-size:18px;font-weight:700">${escHtml(subject)}</p>
        </td></tr>
        <tr><td style="padding:28px 32px;font-size:15px;line-height:1.6;color:#1f2937">
          <p style="margin:0 0 14px">Sehr geehrte/r ${escHtml(firstName)},</p>
          <p style="margin:0 0 14px">${escHtml(introByKind[kind])}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr>
              <td style="padding:8px 0;color:#64748b">Offener Betrag</td>
              <td style="padding:8px 0;font-weight:700;text-align:right">${escHtml(amountFmt)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0">Zahlungsfrist</td>
              <td style="padding:8px 0;font-weight:700;text-align:right;border-top:1px solid #e2e8f0">${escHtml(dueFmt)}</td>
            </tr>
          </table>
          <p style="margin:14px 0 0;font-size:13px;color:#475569">
            Die vollständigen Zahlungsdetails (IBAN, Verwendungszweck, Aktenzeichen) finden Sie im PDF-Anhang.
          </p>
          <p style="margin:18px 0 0;font-size:13px;color:#475569">
            Falls Sie zwischenzeitlich bereits gezahlt haben oder eine Ratenzahlung vereinbaren möchten, melden Sie sich bitte zeitnah bei uns${gym.email ? ` unter <a href="mailto:${escHtml(gym.email)}" style="color:#0f172a">${escHtml(gym.email)}</a>` : ''}.
          </p>
          <p style="margin:24px 0 0">Mit freundlichen Grüßen<br/><strong>${escHtml(studioName)}</strong></p>
        </td></tr>
        <tr><td style="padding:14px 32px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0">
          Diese Nachricht ist eine vertragsbezogene Mitteilung und wurde automatisch erstellt.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  // Versand
  try {
    const send = await sendViaResend({
      fromName: studioName,
      toEmail: member.email,
      subject,
      html,
      attachments: [
        {
          filename,
          content: pdfBuffer.toString('base64'),
        },
      ],
    })

    if (!send.ok) {
      const detail =
        send.status === 0
          ? send.bodyText ?? 'Resend nicht konfiguriert'
          : `HTTP ${send.status}: ${send.bodyText ?? ''}`
      console.error('[dunning-mail] Resend-Fehler:', detail)
      return {
        ok: false,
        emailSent: false,
        reason: send.status === 0 ? 'resend_disabled' : 'http_error',
        error: detail,
      }
    }

    return { ok: true, emailSent: true }
  } catch (err) {
    console.error('[dunning-mail] Exception:', err)
    return {
      ok: false,
      emailSent: false,
      reason: 'exception',
      error: String(err),
    }
  }
}
