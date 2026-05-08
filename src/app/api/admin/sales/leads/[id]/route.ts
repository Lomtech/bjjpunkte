import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// POST /api/admin/sales/leads/[id]
//   { action_type: 'mark_done' | 'contacted' | 'demo_scheduled' | 'demo_done'
//                | 'won' | 'lost' | 'snooze',
//     notes?: string,
//     reason?: string,            // for 'lost'
//     demo_at?: string,           // for 'demo_scheduled'
//     snooze_days?: number }      // for 'snooze'
//
// One endpoint that handles every Pipeline-Quick-Action. The owner doesn't
// have to know the underlying status enum — clicking "Erledigt" on a card
// does the right thing automatically (logs activity, advances the sequence,
// updates last_contact + next_action).
//
// IMPORTANT: this NEVER overwrites work the cron already did. We only set
// next_action_at when the action implies a clear next step.

const ACTIONS = new Set(['mark_done','contacted','demo_scheduled','demo_done','won','lost','snooze'])

const NEXT_AFTER_CONTACT_DAYS = 3 // first follow-up after a fresh contact

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action_type = typeof body.action_type === 'string' ? body.action_type : ''
  if (!ACTIONS.has(action_type)) {
    return NextResponse.json({ error: 'invalid action_type' }, { status: 400 })
  }

  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 5000) : null
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : null
  const snoozeDays = typeof body.snooze_days === 'number' && body.snooze_days > 0
    ? Math.min(60, Math.floor(body.snooze_days))
    : null
  const demoAt = typeof body.demo_at === 'string' ? body.demo_at : null

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead } = await (supabase.from('sales_leads') as any)
    .select('id, status, next_action, contact_count').eq('id', id).maybeSingle()
  if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 })

  const nowIso = new Date().toISOString()
  const update: Record<string, unknown> = { updated_at: nowIso }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activity: Record<string, any> = {
    lead_id: id,
    user_id: auth.user.id,
    occurred_at: nowIso,
    body: notes,
  }

  switch (action_type) {
    case 'mark_done': {
      // "Aktion ist erledigt" — current next_action wird abgehakt.
      // Wir bumpen last_contacted_at NICHT, weil 'mark_done' auch reines
      // Abhaken einer internen Aufgabe sein kann (z.B. Recherche fertig).
      // Falls das Lead noch new ist, schieben wir auf 'researching'.
      const finished = (lead.next_action as string | null) ?? 'task'
      update.next_action = null
      update.next_action_at = null
      update.last_action_kind = finished
      if (lead.status === 'new') update.status = 'researching'
      activity.kind = 'note'
      activity.subject = `✓ ${finished} erledigt`
      break
    }
    case 'contacted': {
      // Owner hat den Lead in irgendeiner Form kontaktiert (Mail, DM, Anruf).
      // Wir schieben ihn auf 'contacted' und planen den nächsten Touch in 3 Tagen.
      update.status = 'contacted'
      update.last_contacted_at = nowIso
      update.contact_count = ((lead.contact_count as number | null) ?? 0) + 1
      const next = new Date()
      next.setDate(next.getDate() + NEXT_AFTER_CONTACT_DAYS)
      update.next_action = 'followup_mail_2'
      update.next_action_at = next.toISOString()
      update.last_action_kind = 'email'
      activity.kind = 'email'
      activity.subject = 'Kontakt erfasst'
      break
    }
    case 'demo_scheduled': {
      update.status = 'demo_scheduled'
      if (demoAt) {
        update.next_followup_at = demoAt
        update.next_action = 'demo_call'
        update.next_action_at = demoAt
      } else {
        update.next_action = 'demo_followup'
        // wenn kein konkretes Datum: in 7 Tagen erinnern
        const next = new Date()
        next.setDate(next.getDate() + 7)
        update.next_action_at = next.toISOString()
      }
      update.last_action_kind = 'meeting'
      activity.kind = 'meeting'
      activity.subject = demoAt
        ? `Demo-Termin: ${new Date(demoAt).toLocaleString('de-DE')}`
        : 'Demo geplant (Datum offen)'
      break
    }
    case 'demo_done': {
      update.status = 'demo_done'
      update.last_contacted_at = nowIso
      const next = new Date()
      next.setDate(next.getDate() + 2)
      update.next_action = 'demo_followup'
      update.next_action_at = next.toISOString()
      update.last_action_kind = 'demo'
      activity.kind = 'demo'
      activity.subject = 'Demo durchgeführt'
      break
    }
    case 'won': {
      update.status = 'won'
      update.converted_at = nowIso
      const next = new Date()
      next.setDate(next.getDate() + 7)
      update.next_action = 'onboarding_check'
      update.next_action_at = next.toISOString()
      update.last_action_kind = 'note'
      activity.kind = 'status_change'
      activity.subject = `${lead.status} → won`
      break
    }
    case 'lost': {
      update.status = 'lost'
      update.lost_reason = reason
      update.next_action = null
      update.next_action_at = null
      update.last_action_kind = 'note'
      activity.kind = 'status_change'
      activity.subject = `${lead.status} → lost${reason ? ` (${reason})` : ''}`
      break
    }
    case 'snooze': {
      // Reminder pausieren — z.B. wenn Studio sagt "ruf in 2 Wochen wieder an".
      const days = snoozeDays ?? 7
      const next = new Date()
      next.setDate(next.getDate() + days)
      update.next_action_at = next.toISOString()
      // next_action bleibt unverändert (was ansteht, steht weiter an, nur später)
      activity.kind = 'note'
      activity.subject = `Snooze um ${days} Tag${days === 1 ? '' : 'e'}`
      break
    }
  }

  // Apply update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: upErr } = await (supabase.from('sales_leads') as any)
    .update(update).eq('id', id).select().maybeSingle()
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Log activity (best-effort — never block the response)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('sales_activities') as any).insert(activity)

  return NextResponse.json({ lead: updated })
}
