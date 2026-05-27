import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/members/confirm-email?token={token}
 *
 * Public endpoint — kein Auth nötig. Token kommt aus der Confirmation-Email
 * die nach Member-Signup verschickt wurde.
 *
 * Token-TTL: 7 Tage ab email_confirmation_sent_at.
 *
 * Erfolgsfall: redirect auf /portal/{portal_token}?confirmed=1
 * Fehlerfall:  HTML-Seite mit Fehlerbeschreibung (kein JSON, weil User-facing).
 */

export const dynamic = 'force-dynamic'

function htmlResponse(title: string, message: string, status: number, color: string = '#0f172a') {
  return new NextResponse(
    `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
  <div style="max-width:460px;background:#fff;border-radius:16px;padding:32px;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <h1 style="margin:0 0 12px;color:${color};font-size:20px;font-weight:700">${title}</h1>
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.6">${message}</p>
  </div>
</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token || token.length < 16 || token.length > 256 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return htmlResponse('Ungültiger Link', 'Der Bestätigungs-Link ist ungültig oder beschädigt. Bitte fordere eine neue Bestätigungs-Email beim Studio an.', 400, '#dc2626')
  }

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member, error } = await (supabase.from('members') as any)
    .select('id, gym_id, portal_token, email_confirmed_at, email_confirmation_sent_at, first_name')
    .eq('email_confirmation_token', token)
    .maybeSingle()

  if (error || !member) {
    return htmlResponse('Link nicht gefunden', 'Dieser Bestätigungs-Link existiert nicht oder wurde bereits genutzt. Wenn du dich gerade angemeldet hast, prüfe das Postfach auf eine neuere Email.', 404, '#dc2626')
  }

  // Idempotent: schon confirmed → freundliche Meldung
  if (member.email_confirmed_at) {
    const portalUrl = member.portal_token ? `/portal/${member.portal_token}` : null
    return htmlResponse(
      'Bereits bestätigt ✓',
      `Hallo ${member.first_name ?? ''}, deine Email-Adresse war bereits bestätigt. ${portalUrl ? `<br><br><a href="${portalUrl}" style="color:#0f172a;font-weight:600">→ Zum Mitglieder-Portal</a>` : ''}`,
      200,
      '#0f172a',
    )
  }

  // Token-TTL prüfen (7 Tage)
  const sentAt = member.email_confirmation_sent_at ? new Date(member.email_confirmation_sent_at) : null
  if (sentAt && Date.now() - sentAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
    return htmlResponse(
      'Link abgelaufen',
      'Dieser Bestätigungs-Link ist älter als 7 Tage und nicht mehr gültig. Bitte fordere eine neue Bestätigungs-Email beim Studio an.',
      410,
      '#d97706',
    )
  }

  // Bestätigen + Token verbrauchen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upErr } = await (supabase.from('members') as any)
    .update({
      email_confirmed_at: new Date().toISOString(),
      email_confirmation_token: null, // verbraucht
    })
    .eq('id', member.id)

  if (upErr) {
    return htmlResponse('Fehler', 'Beim Bestätigen ist ein Fehler aufgetreten. Bitte versuche es später erneut oder kontaktiere das Studio.', 500, '#dc2626')
  }

  // Erfolg: redirect zum Portal
  if (member.portal_token) {
    return NextResponse.redirect(new URL(`/portal/${member.portal_token}?confirmed=1`, req.url), 303)
  }

  return htmlResponse(
    'Email bestätigt ✓',
    `Vielen Dank, ${member.first_name ?? ''}! Deine Mitgliedschaft ist jetzt aktiv. Das Studio meldet sich bei dir mit den nächsten Schritten.`,
    200,
    '#059669',
  )
}
