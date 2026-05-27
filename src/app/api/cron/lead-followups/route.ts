import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cronGuard } from '@/lib/cron-guard'
import { getAppUrl } from '@/lib/app-url'
import { withCronSentry } from '@/lib/cron/with-sentry'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Cron: täglich 7:00 UTC = 8:00/9:00 MEZ — vercel.json registrieren.
//
// Spiegel zu /api/cron/sales-followups, aber:
//   - Multi-Tenant (pro Gym getrennt)
//   - Owner-Mail an gym.owner_id → auth.users.email
//   - Lead-Pipeline für Gym→Mitglied (nicht osss.pro→Gym)
//
// ZWEI Aufgaben pro Run:
//   1. Auto-Sequence-Stepping (5 Rules) — Pipeline-Voranschritt ohne Owner-Klick
//   2. Tages-Reminder-Mail je Gym mit fälligen Aktionen

const LOOKAHEAD_HOURS = 36
const REMIND_COOLDOWN_HOURS = 20

type LeadRow = {
  id: string
  gym_id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  email: string | null
  status: string
  notes: string | null
  next_action: string | null
  next_action_at: string | null
  last_contacted_at: string | null
  contact_count: number | null
  trial_date: string | null
}

type GymWithOwner = {
  id: string
  slug: string | null
  name: string
  owner_email: string | null
}

export const GET = withCronSentry('lead-followups', async (req: Request) => {
  const guard = cronGuard(req)
  if (guard) return guard

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createServiceClient()
  const now = new Date()

  // ─── PHASE 1: Auto-Sequence ──────────────────────────────────────────
  const sequenced = await runAutoSequence(supabase, now)

  // ─── PHASE 2: Reminder-Mail je Gym ───────────────────────────────────
  const resendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
  if (!resendConfigured) {
    return NextResponse.json({ ok: true, sequenced, mailSkipped: 'Resend not configured' })
  }

  const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000).toISOString()
  const cooldownCutoff = new Date(now.getTime() - REMIND_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()

  // Alle fälligen Leads quer durch alle Gyms (Service-Role-Client: RLS umgangen).
  // Wir gruppieren danach pro gym_id im Code, weil eine Postgres-Aggregation
  // mit Email-Lookup hier zu komplex wäre für minimalen Speedup.
  const dueRes = await supabase.from('leads')
    .select('id, gym_id, first_name, last_name, phone, email, status, notes, next_action, next_action_at, last_contacted_at, contact_count, trial_date')
    .lte('next_action_at', horizon)
    .not('next_action_at', 'is', null)
    .not('status', 'in', '(converted,lost)')
    .or(`followup_reminded_at.is.null,followup_reminded_at.lt.${cooldownCutoff}`)
    .order('next_action_at', { ascending: true })
    .limit(1000)

  if (dueRes.error) {
    return NextResponse.json({ error: dueRes.error.message, sequenced }, { status: 500 })
  }

  const due = (dueRes.data ?? []) as LeadRow[]
  if (due.length === 0) {
    return NextResponse.json({ ok: true, sequenced, due: 0 })
  }

  // Owner-Email pro Gym lookup
  const gymIds = Array.from(new Set(due.map(l => l.gym_id)))
  const gymsRes = await supabase.from('gyms')
    .select('id, slug, name, owner_id')
    .in('id', gymIds)
  if (gymsRes.error) {
    return NextResponse.json({ error: gymsRes.error.message, sequenced }, { status: 500 })
  }

  // auth.users.email für owner_id auflösen — Service-Role hat Zugriff
  type GymRow = { id: string; slug: string | null; name: string; owner_id: string }
  const gymRows = (gymsRes.data ?? []) as GymRow[]
  const ownerIds = Array.from(new Set(gymRows.map(g => g.owner_id)))
  const usersRes = await supabase.schema('auth').from('users').select('id, email').in('id', ownerIds)
  const ownerEmailById = new Map<string, string | null>()
  type UserRow = { id: string; email: string | null }
  for (const u of (usersRes.data ?? []) as UserRow[]) {
    ownerEmailById.set(u.id, u.email)
  }

  const gymById = new Map<string, GymWithOwner>()
  for (const g of gymRows) {
    gymById.set(g.id, {
      id: g.id,
      slug: g.slug,
      name: g.name,
      owner_email: ownerEmailById.get(g.owner_id) ?? null,
    })
  }

  // Gruppieren pro Gym
  const byGym = new Map<string, LeadRow[]>()
  for (const l of due) {
    const arr = byGym.get(l.gym_id) ?? []
    arr.push(l)
    byGym.set(l.gym_id, arr)
  }

  const appUrl = getAppUrl()
  const sendErrors: string[] = []
  let mailsSent = 0
  const remindedIds: string[] = []

  for (const [gymId, leads] of byGym) {
    const gym = gymById.get(gymId)
    if (!gym || !gym.owner_email) {
      sendErrors.push(`gym ${gymId}: no owner email`)
      continue
    }

    const overdue: LeadRow[] = []
    const today: LeadRow[] = []
    const tomorrow: LeadRow[] = []
    for (const l of leads) {
      if (!l.next_action_at) continue
      const d = new Date(l.next_action_at)
      if (d <= now) overdue.push(l)
      else if (d.toDateString() === now.toDateString()) today.push(l)
      else tomorrow.push(l)
    }

    const html = renderEmail({ gym, overdue, today, tomorrow, appUrl })
    const subject = overdue.length > 0
      ? `🔴 ${gym.name}: ${overdue.length} überfällige Lead-Aktionen + ${today.length + tomorrow.length} kommende`
      : `📞 ${gym.name}: ${today.length} Lead-Aktion${today.length !== 1 ? 'en' : ''} heute · ${tomorrow.length} morgen`

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: gym.owner_email,
          subject,
          html,
        }),
      })
      if (res.ok) {
        mailsSent++
        for (const l of leads) remindedIds.push(l.id)
      } else {
        sendErrors.push(`${gym.owner_email}: HTTP ${res.status}`)
      }
    } catch (err) {
      sendErrors.push(`${gym.owner_email}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Mark als gerade erinnert (Cooldown)
  if (remindedIds.length > 0) {
    const updRes = await supabase.from('leads')
      .update({ followup_reminded_at: now.toISOString() })
      .in('id', remindedIds)
    if (updRes.error) {
      console.error('[cron/lead-followups] failed to mark leads as reminded:', updRes.error.message)
    }
  }

  return NextResponse.json({
    ok: sendErrors.length === 0,
    sequenced,
    due: due.length,
    gymsNotified: mailsSent,
    errors: sendErrors.length > 0 ? sendErrors : undefined,
  })
})

// ───── Auto-Sequence — schiebt Leads ohne Owner-Klick weiter ────────────
//
// 5 Rules. Idempotent: setzt next_action nur wenn null oder klar überschreibbar.
// Performance: ein Read + ein Update pro Rule — OK bei <50k Leads/Gym.
async function runAutoSequence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  now: Date,
) {
  const counters = {
    new_to_first_contact: 0,
    contacted_to_followup: 0,
    contacted_to_lost: 0,
    trial_scheduled_to_no_show: 0,
    trial_done_to_followup: 0,
  }

  const oneDayAgo = new Date(now.getTime() - 1 * 86400_000).toISOString()
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400_000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000).toISOString()
  const twentyOneDaysAgo = new Date(now.getTime() - 21 * 86400_000).toISOString()
  const todayDate = now.toISOString().slice(0, 10)
  const nowIso = now.toISOString()

  // Rule 1: new + >1d alt + kein next_action → first_contact fällig
  const r1 = await supabase.from('leads')
    .select('id')
    .eq('status', 'new')
    .lte('created_at', oneDayAgo)
    .is('next_action', null)
    .limit(500)
  const r1Ids = ((r1.data ?? []) as Array<{ id: string }>).map(l => l.id)
  if (r1Ids.length > 0) {
    await supabase.from('leads')
      .update({ next_action: 'first_contact', next_action_at: nowIso })
      .in('id', r1Ids)
    counters.new_to_first_contact = r1Ids.length
  }

  // Rule 2 (zuerst! — Lost-Marker hat Vorrang): contacted + last_contacted > 21d → lost
  const r2 = await supabase.from('leads')
    .select('id')
    .eq('status', 'contacted')
    .not('last_contacted_at', 'is', null)
    .lte('last_contacted_at', twentyOneDaysAgo)
    .limit(500)
  const r2Ids = ((r2.data ?? []) as Array<{ id: string }>).map(l => l.id)
  if (r2Ids.length > 0) {
    await supabase.from('leads')
      .update({
        status: 'lost',
        lost_reason: 'no_response_21d',
        next_action: null,
        next_action_at: null,
      })
      .in('id', r2Ids)
    counters.contacted_to_lost = r2Ids.length
  }

  // Rule 3: contacted + last_contacted zw. 7-21d + kein next_action → followup
  const r3 = await supabase.from('leads')
    .select('id')
    .eq('status', 'contacted')
    .not('last_contacted_at', 'is', null)
    .lte('last_contacted_at', sevenDaysAgo)
    .gt('last_contacted_at', twentyOneDaysAgo)
    .is('next_action', null)
    .limit(500)
  const r3Ids = ((r3.data ?? []) as Array<{ id: string }>).map(l => l.id)
  if (r3Ids.length > 0) {
    await supabase.from('leads')
      .update({ next_action: 'followup', next_action_at: nowIso })
      .in('id', r3Ids)
    counters.contacted_to_followup = r3Ids.length
  }

  // Rule 4: trial_scheduled mit trial_date < heute → trial_no_show
  // (Owner kann das per Quick-Action "Hat Probetraining gemacht" überschreiben;
  //  bis dahin ist die safere Annahme "nicht erschienen".)
  const r4 = await supabase.from('leads')
    .select('id')
    .eq('status', 'trial_scheduled')
    .not('trial_date', 'is', null)
    .lt('trial_date', todayDate)
    .limit(500)
  const r4Ids = ((r4.data ?? []) as Array<{ id: string }>).map(l => l.id)
  if (r4Ids.length > 0) {
    await supabase.from('leads')
      .update({
        status: 'trial_no_show',
        next_action: 'no_show_followup',
        next_action_at: nowIso,
      })
      .in('id', r4Ids)
    counters.trial_scheduled_to_no_show = r4Ids.length
  }

  // Rule 5: trial_done + last_contacted > 3d + kein next_action → post_trial_followup
  const r5 = await supabase.from('leads')
    .select('id')
    .eq('status', 'trial_done')
    .not('last_contacted_at', 'is', null)
    .lte('last_contacted_at', threeDaysAgo)
    .is('next_action', null)
    .limit(500)
  const r5Ids = ((r5.data ?? []) as Array<{ id: string }>).map(l => l.id)
  if (r5Ids.length > 0) {
    await supabase.from('leads')
      .update({ next_action: 'post_trial_followup', next_action_at: nowIso })
      .in('id', r5Ids)
    counters.trial_done_to_followup = r5Ids.length
  }

  return counters
}

function actionLabel(a: string | null): string {
  if (!a) return 'Aktion offen'
  switch (a) {
    case 'first_contact':       return '☎️ Erstkontakt'
    case 'followup':            return '✉ Follow-up senden'
    case 'schedule_trial':      return '📅 Probetraining vereinbaren'
    case 'trial_reminder':      return '⏰ Probetraining-Reminder'
    case 'check_trial_date':    return '❓ Probetraining-Datum klären'
    case 'post_trial_followup': return '💬 Nach-Probe Follow-up'
    case 'no_show_followup':    return '🔁 No-Show: nochmal versuchen'
    default:                    return a
  }
}

function leadName(l: LeadRow): string {
  const n = `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim()
  return n || l.email || l.phone || 'Unbekannter Lead'
}

function renderEmail({ gym, overdue, today, tomorrow, appUrl }: {
  gym: GymWithOwner
  overdue: LeadRow[]
  today: LeadRow[]
  tomorrow: LeadRow[]
  appUrl: string
}) {
  const renderLead = (l: LeadRow, kind: 'overdue' | 'today' | 'tomorrow') => {
    const dt = l.next_action_at ? new Date(l.next_action_at) : new Date()
    const time = dt.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    const tone = kind === 'overdue' ? '#dc2626' : kind === 'today' ? '#d97706' : '#475569'
    const cta = `${appUrl}/dashboard/leads?lead=${l.id}`
    const phoneLine = l.phone
      ? `<div style="margin-top:4px;font-size:13px"><a href="tel:${l.phone}" style="color:#0f172a;text-decoration:none">📞 ${l.phone}</a></div>`
      : ''
    const emailLine = l.email
      ? `<div style="margin-top:2px;font-size:13px"><a href="mailto:${l.email}" style="color:#0f172a;text-decoration:none">✉ ${l.email}</a></div>`
      : ''
    const noteLine = l.notes
      ? `<div style="margin-top:6px;font-size:12px;color:#64748b;font-style:italic">"${escapeHtml(l.notes.slice(0, 200))}${l.notes.length > 200 ? '…' : ''}"</div>`
      : ''
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border-left:3px solid ${tone};background:#fafafa;border-radius:0 8px 8px 0">
        <tr><td style="padding:12px 16px">
          <div style="font-weight:700;font-size:15px;color:#0f172a">${escapeHtml(leadName(l))}</div>
          <div style="font-size:13px;color:${tone};margin-top:2px;font-weight:600">${actionLabel(l.next_action)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">
            ${time} · <span style="color:${tone}">${kind === 'overdue' ? 'überfällig' : kind === 'today' ? 'heute' : 'morgen'}</span> · Status: ${l.status} · ${l.contact_count ?? 0}× kontaktiert
          </div>
          ${phoneLine}${emailLine}${noteLine}
          <div style="margin-top:10px"><a href="${cta}" style="display:inline-block;padding:6px 12px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600">In der Pipeline öffnen →</a></div>
        </td></tr>
      </table>`
  }

  const section = (title: string, items: LeadRow[], kind: 'overdue' | 'today' | 'tomorrow') => {
    if (items.length === 0) return ''
    return `
      <div style="margin-top:24px">
        <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a">${title} (${items.length})</h2>
        ${items.map(l => renderLead(l, kind)).join('')}
      </div>`
  }

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px">
        <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:20px 24px">
          <p style="margin:0;color:#fbbf24;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase">${escapeHtml(gym.name)} · Lead-Pipeline</p>
          <h1 style="margin:6px 0 0;color:#fff;font-size:18px;font-weight:700">Tagesübersicht — fällige Aktionen</h1>
        </td></tr>
        <tr><td style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
          ${section('🔴 Überfällig', overdue, 'overdue')}
          ${section('📞 Heute', today, 'today')}
          ${section('📅 Morgen', tomorrow, 'tomorrow')}
          <p style="font-size:11px;color:#9ca3af;margin:24px 0 0;border-top:1px solid #f1f5f9;padding-top:12px">
            Diese Erinnerung wird täglich verschickt für alle Leads mit fälliger next_action in den nächsten ${LOOKAHEAD_HOURS}h.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!)
}
