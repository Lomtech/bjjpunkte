import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendDunningMail } from '@/lib/dunning-mail'

// PDF-Rendering (via dunning-mail) braucht Node-Runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAIL_ACTIONS = new Set(['first_reminder', 'second_reminder', 'final_warning'])

const VALID_ACTIONS = new Set([
  'first_reminder',
  'second_reminder',
  'final_warning',
  'collection_handoff',
  'payment_received',
  'note',
])

const ACTION_TO_LEVEL: Record<string, number> = {
  first_reminder: 1,
  second_reminder: 2,
  final_warning: 3,
  collection_handoff: 3,
  payment_received: 0,  // Reset
  note: -1,             // -1 = no change
}

/**
 * GET /api/members/[id]/dunning
 * → History aller Mahnungs-Aktionen für ein Mitglied (chronologisch).
 *
 * POST /api/members/[id]/dunning
 *   Body: { action_type, amount_cents?, notes? }
 * → Neue Aktion hinzufügen + Member-dunning_level updaten.
 */

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Verify member belongs to user's gym
  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Kein Gym' }, { status: 404 })

  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actions, error } = await (service.from('dunning_actions') as any)
    .select('id, action_type, amount_cents, notes, performed_by, performed_at')
    .eq('member_id', memberId)
    .eq('gym_id', gym.id)
    .order('performed_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ actions: actions ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const actionType = typeof body.action_type === 'string' ? body.action_type : ''
  const amountCents = typeof body.amount_cents === 'number' ? body.amount_cents : null
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null

  if (!VALID_ACTIONS.has(actionType)) {
    return NextResponse.json({ error: 'Ungültige Aktion' }, { status: 400 })
  }

  // Verify member belongs to user's gym
  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Kein Gym' }, { status: 404 })

  const service = createServiceClient()

  // Insert action
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: actionErr } = await (service.from('dunning_actions') as any).insert({
    member_id: memberId,
    gym_id: gym.id,
    action_type: actionType,
    amount_cents: amountCents,
    notes,
    performed_by: user.id,
  })
  if (actionErr) return NextResponse.json({ error: actionErr.message }, { status: 500 })

  // Update member dunning state
  const newLevel = ACTION_TO_LEVEL[actionType]
  if (newLevel >= 0) {
    const update: Record<string, unknown> = {
      dunning_level: newLevel,
      dunning_last_action_at: new Date().toISOString(),
    }
    if (newLevel === 0) {
      // Reset
      update.dunning_amount_cents = 0
      update.dunning_started_at = null
    } else {
      if (amountCents !== null) update.dunning_amount_cents = amountCents
      if (newLevel === 1) update.dunning_started_at = new Date().toISOString()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service.from('members') as any)
      .update(update)
      .eq('id', memberId)
      .eq('gym_id', gym.id)
  }

  // Bei Mahnungs-Aktionen: PDF generieren und an Mitglied per Mail schicken.
  // Versand ist best-effort — Fehler darf den 200er nicht kippen, weil die
  // DB-Action bereits geschrieben wurde (degraded-Modus).
  let mailSent = false
  let mailError: string | undefined
  if (MAIL_ACTIONS.has(actionType) && newLevel >= 1) {
    try {
      // Aktuelle Höhe = entweder explizit übergeben, sonst der gespeicherte Stand.
      let mailAmountCents = amountCents
      if (mailAmountCents === null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: m } = await (service.from('members') as any)
          .select('dunning_amount_cents')
          .eq('id', memberId)
          .maybeSingle()
        mailAmountCents = Math.max(0, Number(m?.dunning_amount_cents ?? 0)) || 0
      }
      const result = await sendDunningMail(memberId, newLevel, mailAmountCents)
      mailSent = result.emailSent
      if (!result.ok) {
        mailError = result.error ?? `Versand-Problem (${result.reason ?? 'unbekannt'})`
        console.error('[dunning] Mail-Versand-Fehler:', mailError)
      }
    } catch (err) {
      mailError = String(err)
      console.error('[dunning] Mail-Versand-Exception:', err)
    }
  }

  return NextResponse.json({ ok: true, mail_sent: mailSent, ...(mailError ? { mail_error: mailError } : {}) })
}
