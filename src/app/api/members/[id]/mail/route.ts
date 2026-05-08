import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/members/[id]/mail
 * Body: { subject, body }
 *
 * Schickt eine 1-zu-1 Mail vom Owner an EIN spezifisches Mitglied.
 * Im Gegensatz zum Bulk-Mail-Tool (/api/gym-mail/send): keine Audience-Picker,
 * keine Marketing-Consent-Prüfung — das ist eine direkte vertragsbezogene
 * Mitteilung (Art. 6(1)(b) DSGVO Vertragserfüllung).
 *
 * Auth: Dual (Bearer ODER Cookie). Owner-only via gym.owner_id.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params

  // ── Dual-Auth ───────────────────────────────────────────────────────────────
  let userId: string | null = null
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (accessToken) {
    const sb = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )
    const { data } = await sb.auth.getUser(accessToken)
    userId = data.user?.id ?? null
  } else {
    const sb = await createServerClient()
    const { data } = await sb.auth.getUser()
    userId = data.user?.id ?? null
  }
  if (!userId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // ── Body validieren ─────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : ''
  const messageRaw = typeof body.body === 'string' ? body.body.trim() : ''

  if (!subject) return NextResponse.json({ error: 'Betreff fehlt' }, { status: 400 })
  if (!messageRaw || messageRaw.length < 5) return NextResponse.json({ error: 'Nachricht zu kurz' }, { status: 400 })
  if (messageRaw.length > 20000) return NextResponse.json({ error: 'Nachricht zu lang (max 20.000 Zeichen)' }, { status: 400 })

  // ── Ownership-Check + Member laden ──────────────────────────────────────────
  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gym } = await (service.from('gyms') as any)
    .select('id, name')
    .eq('owner_id', userId)
    .maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Kein Gym' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (service.from('members') as any)
    .select('id, first_name, last_name, email')
    .eq('id', memberId)
    .eq('gym_id', gym.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  if (!member.email) return NextResponse.json({ error: 'Mitglied hat keine E-Mail-Adresse' }, { status: 400 })

  // ── Resend-Konfig ───────────────────────────────────────────────────────────
  const apiKey   = process.env.RESEND_API_KEY
  const fromAddr = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !fromAddr) {
    return NextResponse.json({ error: 'E-Mail-Versand nicht konfiguriert' }, { status: 503 })
  }

  // ── HTML escapen (XSS-Defense im Mail-Postfach) ─────────────────────────────
  const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const safeBody = escHtml(messageRaw).replace(/\n/g, '<br/>')
  const safeGymName = escHtml(gym.name ?? 'Dein Gym')
  const safeMemberFirstName = escHtml(member.first_name ?? '')

  const html = `<!DOCTYPE html><html lang="de"><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px"><tr><td align="center">
  <table width="100%" style="max-width:560px;background:#fff;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden">
    <tr><td style="padding:24px 36px 16px;border-bottom:1px solid #f4f4f5">
      <p style="margin:0;color:#18181b;font-size:18px;font-weight:800;letter-spacing:-0.01em">${safeGymName}</p>
    </td></tr>
    <tr><td style="padding:24px 36px;font-size:15px;line-height:1.6;color:#3f3f46">
      ${safeMemberFirstName ? `<p style="margin:0 0 16px">Hallo ${safeMemberFirstName},</p>` : ''}
      ${safeBody}
    </td></tr>
    <tr><td style="padding:16px 36px;background:#fafafa;border-top:1px solid #f4f4f5">
      <p style="margin:0;color:#a1a1aa;font-size:11px;line-height:1.5">
        Diese Nachricht wurde direkt aus dem Mitglieder-Verwaltungssystem von <strong>${safeGymName}</strong> versendet.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`

  // ── Versenden ───────────────────────────────────────────────────────────────
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from:    `${gym.name ?? 'Gym'} <${fromAddr}>`,
        to:      member.email,
        subject,
        html,
      }),
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      return NextResponse.json({ error: `Resend HTTP ${res.status}: ${errBody.slice(0, 200)}` }, { status: 502 })
    }
    return NextResponse.json({ ok: true, sent_to: member.email })
  } catch (err) {
    return NextResponse.json({
      error: 'Versand fehlgeschlagen: ' + (err instanceof Error ? err.message : 'unknown'),
    }, { status: 500 })
  }
}
