import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/public/contact
 * Body: { name, email, phone?, subject?, message, hp?: string }
 *
 * Öffentliches Kontakt-Formular für die osss.pro Landing-Page.
 * Sendet eine Mail an oss@osss.pro (CONTACT_FORM_TO override möglich).
 *
 * Spam-Schutz:
 *  1. Honeypot-Feld `hp` — wenn ausgefüllt → silent 200 (Bot fühlt sich erfolgreich)
 *  2. Rate-Limit über Proxy (`/api/public/*` ist whitelisted für Rate-Limit
 *     in src/proxy.ts, Pfad startet mit /api/public/)
 *  3. Min/Max Längen für Felder
 *  4. CSRF: Same-Origin-Check via Proxy (whitelisted für /api/public/)
 *     → 403 wenn Origin/Referer nicht passt
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  // Honeypot: ein hidden field das echte User leer lassen, Bots aber ausfüllen
  const honeypot = typeof body.hp === 'string' ? body.hp.trim() : ''
  if (honeypot.length > 0) {
    // Bot — vortäuschen erfolgreich, aber nichts senden
    return NextResponse.json({ ok: true })
  }

  const name      = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
  const email     = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
  const phone     = typeof body.phone === 'string' ? body.phone.trim().slice(0, 50) : ''
  const subject   = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : ''
  const message   = typeof body.message === 'string' ? body.message.trim() : ''

  // Validation
  if (name.length < 2)    return NextResponse.json({ error: 'Name fehlt' },   { status: 400 })
  if (!email.includes('@')) return NextResponse.json({ error: 'Gültige E-Mail erforderlich' }, { status: 400 })
  if (message.length < 10) return NextResponse.json({ error: 'Nachricht zu kurz (mindestens 10 Zeichen)' }, { status: 400 })
  if (message.length > 10000) return NextResponse.json({ error: 'Nachricht zu lang (max 10.000 Zeichen)' }, { status: 400 })

  // Resend-Konfig
  const apiKey   = process.env.RESEND_API_KEY
  const fromAddr = process.env.RESEND_FROM_EMAIL
  const toAddr   = process.env.CONTACT_FORM_TO ?? 'oss@osss.pro'
  if (!apiKey || !fromAddr) {
    return NextResponse.json({ error: 'E-Mail-Versand nicht konfiguriert' }, { status: 503 })
  }

  // Audit-Daten
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.headers.get('x-real-ip') ?? 'unknown')
  const ua = req.headers.get('user-agent') ?? 'unknown'

  // Escape für Sicherheit
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const safeMessage = esc(message).replace(/\n/g, '<br/>')

  const html = `<!DOCTYPE html><html lang="de"><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px"><tr><td align="center">
  <table width="100%" style="max-width:560px;background:#fff;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden">
    <tr><td style="padding:24px 36px 12px;border-bottom:1px solid #f4f4f5">
      <p style="margin:0;color:#fbbf24;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase">Osss · Kontakt-Formular</p>
      <p style="margin:6px 0 0;color:#18181b;font-size:18px;font-weight:800">${subject ? esc(subject) : 'Anfrage über osss.pro'}</p>
    </td></tr>
    <tr><td style="padding:20px 36px;font-size:14px;line-height:1.6;color:#3f3f46">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#52525b">
        <tr><td style="padding:4px 0;color:#71717a;width:90px">Name</td><td style="padding:4px 0;font-weight:600">${esc(name)}</td></tr>
        <tr><td style="padding:4px 0;color:#71717a">E-Mail</td><td style="padding:4px 0"><a href="mailto:${esc(email)}" style="color:#d97706">${esc(email)}</a></td></tr>
        ${phone ? `<tr><td style="padding:4px 0;color:#71717a">Telefon</td><td style="padding:4px 0"><a href="tel:${esc(phone)}" style="color:#d97706">${esc(phone)}</a></td></tr>` : ''}
      </table>
      <hr style="border:none;border-top:1px solid #f4f4f5;margin:16px 0" />
      <p style="margin:0 0 6px;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">Nachricht</p>
      <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:14px;color:#27272a">
        ${safeMessage}
      </div>
    </td></tr>
    <tr><td style="padding:14px 36px;background:#fafafa;border-top:1px solid #f4f4f5">
      <p style="margin:0;color:#a1a1aa;font-size:10px;line-height:1.4">
        Empfangen ${new Date().toLocaleString('de-DE')} · IP: ${esc(ip)} · UA: ${esc(ua.slice(0, 80))}
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from:     `Osss Kontakt <${fromAddr}>`,
        to:       toAddr,
        replyTo:  email,  // Reply-To = Absender, damit Owner direkt antworten kann
        subject:  subject ? `[Kontakt] ${subject}` : `[Kontakt] Anfrage von ${name}`,
        html,
      }),
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      return NextResponse.json({ error: `Versand fehlgeschlagen (Resend HTTP ${res.status}): ${errBody.slice(0, 200)}` }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({
      error: 'Versand fehlgeschlagen: ' + (err instanceof Error ? err.message : 'unknown'),
    }, { status: 500 })
  }
}
