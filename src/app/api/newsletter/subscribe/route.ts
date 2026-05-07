import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNewsletterConfirmEmail } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/newsletter/subscribe
 * Body: { email: string, source?: string }
 *
 * Startet Double-Opt-In:
 * 1. Email-Validierung
 * 2. Eintrag mit status='pending' anlegen (oder existing token erneuern)
 * 3. Bestätigungs-Mail mit confirm_token senden
 *
 * Reagiert IDEMPOTENT — gleicher Anmelder bekommt erneut DOI-Mail, kein Duplicate-Error.
 */
export async function POST(req: Request) {
  let body: { email?: string; source?: string } = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const source = (body.source ?? 'unknown').slice(0, 50)

  // Email-Validierung — RFC-light
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || null

  const supabase = createServiceClient()
  const confirmToken = randomBytes(24).toString('hex')

  // Existiert schon?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('newsletter_subscribers') as any)
    .select('id, status')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'confirmed') {
      // Bereits bestätigt → keine Aktion, aber freundliche Antwort
      return NextResponse.json({ ok: true, already_confirmed: true })
    }
    if (existing.status === 'unsubscribed') {
      // Re-aktivieren mit neuem Token
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('newsletter_subscribers') as any)
        .update({
          status: 'pending',
          confirm_token: confirmToken,
          source,
          ip_address: ip,
          user_agent: userAgent,
          subscribed_at: new Date().toISOString(),
          unsubscribed_at: null,
          unsubscribe_reason: null,
        })
        .eq('id', existing.id)
    } else {
      // pending → Token erneuern (alte DOI-Mail evtl. verloren)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('newsletter_subscribers') as any)
        .update({ confirm_token: confirmToken, source, ip_address: ip, user_agent: userAgent })
        .eq('id', existing.id)
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('newsletter_subscribers') as any).insert({
      email,
      confirm_token: confirmToken,
      source,
      ip_address: ip,
      user_agent: userAgent,
    })
    if (error) {
      console.error('[newsletter] insert failed', error.message)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }
  }

  // DOI-Mail schicken (silent fail — Status ist trotzdem in DB)
  try {
    await sendNewsletterConfirmEmail(email, confirmToken)
  } catch (e) {
    console.error('[newsletter] email send failed', e)
    // Trotzdem 200 zurückgeben — User soll nicht denken, sein Eintrag sei verloren.
  }

  return NextResponse.json({ ok: true, doi_sent: true })
}
