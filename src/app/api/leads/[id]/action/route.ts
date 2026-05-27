import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/leads/[id]/action
//   { action_type: 'mark_done' | 'contacted' | 'qualified' | 'trial_scheduled'
//                | 'trial_done' | 'trial_no_show' | 'second_trial_scheduled'
//                | 'converted' | 'lost' | 'snooze',
//     notes?: string,
//     reason?: string,           // for 'lost'
//     trial_at?: string,         // ISO for trial_scheduled / second_trial_scheduled
//     snooze_days?: number }     // for 'snooze' (default 7)
//
// Spiegelt das /api/admin/sales/leads/[id]-Pattern (Lom's eigene Sales-Pipeline)
// auf die Gym-Owner-Lead-Pipeline. Eine API für alle Pipeline-Übergänge —
// der Gym-Owner klickt z.B. "Hat Probetraining gemacht" und der Endpoint
// setzt status='trial_done', planet post_trial_followup in 2 Tagen, bumpt
// die Activity-Spur (last_contacted_at + last_action_kind).
//
// Auth: Bearer-Token vom Frontend, RLS auf leads (owner_id-basiert via gyms).
// Wir validieren zusätzlich gym-ownership explizit — RLS würde alleine ein
// PGRST-Error bei Cross-Gym-Edits werfen, aber wir wollen einen sauberen 404.

const ACTIONS = new Set([
  'mark_done', 'contacted', 'qualified', 'trial_scheduled',
  'trial_done', 'trial_no_show', 'second_trial_scheduled',
  'converted', 'lost', 'snooze',
])

const NEXT_AFTER_CONTACT_DAYS = 3
const NEXT_AFTER_TRIAL_DONE_DAYS = 2
const NEXT_AFTER_NO_SHOW_DAYS = 1
const DEFAULT_SNOOZE_DAYS = 7

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = getSupabase(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 401 })

  // Lead holen — RLS filtert auf das Gym des Owners, plus explizite gym_id-Prüfung
  // damit Frontend-Bugs (z.B. veraltete IDs) als 404 zurückkommen statt 500.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead } = await (supabase.from('leads') as any)
    .select('id, gym_id, status, next_action, contact_count, notes')
    .eq('id', id)
    .maybeSingle()
  if (!lead || lead.gym_id !== gym.id) {
    return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 })
  }

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
  const trialAt = typeof body.trial_at === 'string' ? body.trial_at : null

  const nowIso = new Date().toISOString()
  const update: Record<string, unknown> = {}

  switch (action_type) {
    case 'mark_done': {
      // Aktuelle next_action abhaken, sonst nichts ändern.
      update.next_action = null
      update.next_action_at = null
      update.last_action_kind = (lead.next_action as string | null) ?? 'task'
      break
    }
    case 'contacted': {
      // Erstkontakt (oder Folge-Kontakt) erfasst. Nächste Aktion: Follow-up in 3 Tagen.
      update.status = 'contacted'
      update.last_contacted_at = nowIso
      update.contacted_at = nowIso // legacy field — bleibt synchron
      update.contact_count = ((lead.contact_count as number | null) ?? 0) + 1
      const next = new Date(); next.setDate(next.getDate() + NEXT_AFTER_CONTACT_DAYS)
      update.next_action = 'followup'
      update.next_action_at = next.toISOString()
      update.last_action_kind = 'contact'
      break
    }
    case 'qualified': {
      // Lead ist passend (Alter, Erfahrung, Wohnort) — als Match eingestuft.
      update.status = 'qualified'
      update.last_contacted_at = nowIso
      update.next_action = 'schedule_trial'
      update.next_action_at = nowIso
      update.last_action_kind = 'qualified'
      break
    }
    case 'trial_scheduled': {
      // Probetraining vereinbart. Wenn trial_at gegeben: Reminder am Tag selbst.
      update.status = 'trial_scheduled'
      if (trialAt) {
        update.trial_date = trialAt.slice(0, 10)
        update.next_action = 'trial_reminder'
        update.next_action_at = trialAt
      } else {
        // Datum offen — in 3 Tagen prüfen
        update.next_action = 'check_trial_date'
        const next = new Date(); next.setDate(next.getDate() + 3)
        update.next_action_at = next.toISOString()
      }
      update.last_action_kind = 'trial_scheduled'
      break
    }
    case 'trial_done': {
      // Lead war im Probetraining. Post-Trial-Follow-up in 2 Tagen.
      update.status = 'trial_done'
      update.last_contacted_at = nowIso
      const next = new Date(); next.setDate(next.getDate() + NEXT_AFTER_TRIAL_DONE_DAYS)
      update.next_action = 'post_trial_followup'
      update.next_action_at = next.toISOString()
      update.last_action_kind = 'trial_done'
      break
    }
    case 'trial_no_show': {
      // Probetraining war geplant, Lead nicht erschienen.
      update.status = 'trial_no_show'
      const next = new Date(); next.setDate(next.getDate() + NEXT_AFTER_NO_SHOW_DAYS)
      update.next_action = 'no_show_followup'
      update.next_action_at = next.toISOString()
      update.last_action_kind = 'no_show'
      break
    }
    case 'second_trial_scheduled': {
      update.status = 'second_trial_scheduled'
      if (trialAt) {
        update.trial_date = trialAt.slice(0, 10)
        update.next_action = 'trial_reminder'
        update.next_action_at = trialAt
      } else {
        update.next_action = 'check_trial_date'
        const next = new Date(); next.setDate(next.getDate() + 3)
        update.next_action_at = next.toISOString()
      }
      update.last_action_kind = 'second_trial_scheduled'
      break
    }
    case 'converted': {
      // Lead wurde Mitglied. Pipeline-Ende, kein next_action.
      update.status = 'converted'
      update.converted_at = nowIso
      update.next_action = null
      update.next_action_at = null
      update.last_action_kind = 'converted'
      break
    }
    case 'lost': {
      update.status = 'lost'
      update.lost_reason = reason
      update.next_action = null
      update.next_action_at = null
      update.last_action_kind = 'lost'
      break
    }
    case 'snooze': {
      // Reminder pausieren — Status bleibt, next_action_at wird nach hinten geschoben.
      const days = snoozeDays ?? DEFAULT_SNOOZE_DAYS
      const next = new Date(); next.setDate(next.getDate() + days)
      update.next_action_at = next.toISOString()
      break
    }
  }

  // notes anhängen (nicht überschreiben) — Owner-Eingabe ist additiv
  if (notes) {
    const existing = (lead.notes as string | null) ?? ''
    const stamp = new Date().toLocaleString('de-DE')
    update.notes = existing
      ? `${existing}\n\n[${stamp}] ${notes}`
      : `[${stamp}] ${notes}`
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: upErr } = await (supabase.from('leads') as any)
    .update(update).eq('id', id).select().maybeSingle()
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ lead: updated })
}
