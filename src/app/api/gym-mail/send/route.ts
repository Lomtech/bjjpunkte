import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendGymBulkEmail } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/gym-mail/send
 * Body: { audience: 'members'|'leads'|'both', filter: 'active'|'all'|'recent', subject, html }
 *
 * Sendet eine Bulk-Mail an alle Mitglieder (Art. 6(1)(f) berechtigtes
 * Interesse, da Bestandskunden) bzw. Leads (nur mit marketing_email_consent).
 *
 * Loggt jeden Versand in gym_bulk_mails (Audit) für GDPR-Nachweis.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const audience = (typeof body.audience === 'string' ? body.audience : 'members') as 'members' | 'leads' | 'both'
  const filter = typeof body.filter === 'string' ? body.filter : 'active'
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : ''
  const html = typeof body.html === 'string' ? body.html.trim() : ''

  if (!subject) return NextResponse.json({ error: 'Betreff fehlt' }, { status: 400 })
  if (!html || html.length < 20) return NextResponse.json({ error: 'Inhalt zu kurz' }, { status: 400 })
  if (html.length > 50000) return NextResponse.json({ error: 'Inhalt zu lang (max 50.000 Zeichen)' }, { status: 400 })

  // Belongs-to check
  const { data: gym } = await supabase
    .from('gyms')
    .select('id, name, email')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Kein Gym gefunden' }, { status: 404 })

  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!fromEmail) return NextResponse.json({ error: 'E-Mail-Versand nicht konfiguriert' }, { status: 503 })

  // Resend benötigt verifizierte Domain — daher From immer Osss-Domain
  // mit Reply-To = Gym-Email
  const fromDisplay = `${gym.name} <${fromEmail}>`

  const service = createServiceClient()

  // Sammle Empfänger
  const recipients: { email: string; firstName?: string | null; unsubscribeToken: string }[] = []

  if (audience === 'members' || audience === 'both') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mq: any = service.from('members')
      .select('email, first_name, marketing_unsubscribe_token')
      .eq('gym_id', gym.id)
      .not('email', 'is', null)
    if (filter === 'active') mq = mq.eq('is_active', true)
    const { data: ms } = await mq
    for (const m of (ms ?? []) as Array<{ email: string; first_name: string | null; marketing_unsubscribe_token: string | null }>) {
      if (!m.email || !m.marketing_unsubscribe_token) continue
      recipients.push({ email: m.email, firstName: m.first_name, unsubscribeToken: m.marketing_unsubscribe_token })
    }
  }

  if (audience === 'leads' || audience === 'both') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lq: any = service.from('leads')
      .select('email, first_name, marketing_unsubscribe_token')
      .eq('gym_id', gym.id)
      .eq('marketing_email_consent', true)
      .not('email', 'is', null)
    if (filter === 'recent') {
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString()
      lq = lq.gte('created_at', sixMonthsAgo)
    }
    const { data: ls } = await lq
    for (const l of (ls ?? []) as Array<{ email: string; first_name: string | null; marketing_unsubscribe_token: string | null }>) {
      if (!l.email || !l.marketing_unsubscribe_token) continue
      recipients.push({ email: l.email, firstName: l.first_name, unsubscribeToken: l.marketing_unsubscribe_token })
    }
  }

  // Dedupe by email
  const seen = new Set<string>()
  const unique = recipients.filter(r => {
    const key = r.email.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (unique.length === 0) {
    return NextResponse.json({ error: 'Keine Empfänger gefunden' }, { status: 400 })
  }

  // Audit-Log VOR dem Versand schreiben (so wissen wir auch wenn was crasht)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: auditRow } = await (service.from('gym_bulk_mails') as any).insert({
    gym_id: gym.id,
    sent_by: user.id,
    subject,
    body_preview: html.slice(0, 500),
    audience,
    filter_status: filter,
    recipients_count: unique.length,
    sent_count: 0,
    failed_count: 0,
  }).select().single()

  // Versand
  const { sent, failed } = await sendGymBulkEmail({
    gymName: gym.name ?? 'Dein Gym',
    fromEmail: fromDisplay,
    recipients: unique,
    subject,
    htmlBody: html,
    audience,
  })

  // Audit-Log nach Versand updaten
  if (auditRow?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service.from('gym_bulk_mails') as any).update({
      sent_count: sent,
      failed_count: failed,
    }).eq('id', auditRow.id)
  }

  return NextResponse.json({
    ok: true,
    recipients: unique.length,
    sent,
    failed,
  })
}
