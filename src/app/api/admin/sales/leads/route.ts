import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'
import type { SalesLead } from '@/types/database'

export const dynamic = 'force-dynamic'

// GET /api/admin/sales/leads
//   Returns leads grouped into the 4 Pipeline-Spalten ("Heute", "Diese Woche",
//   "Demo-Phase", "Geschlossen") plus a Tagesbericht with daily/weekly counters.
//
//   Query params:
//     ?martial=true|false  → only martial-arts (default: true, like /admin/leads)
//     ?city=München        → optional city filter
//     ?limit=200           → cap per bucket (default 200)
//
//   The bucketing is computed server-side so we can keep the client tiny:
//   all the date math sits here, the UI just renders.
const PIPELINE_BUCKET_LIMIT = 200

const DEMO_PHASE_STATUSES = new Set(['demo_scheduled','demo_done','negotiating'])
const CLOSED_STATUSES = new Set(['won','lost','do_not_contact','not_a_fit'])
const ACTIVE_STATUSES = ['new','researching','contacted','callback','qualified']

type Bucket = 'today' | 'this_week' | 'demo' | 'closed'

/**
 * Escape Postgres ILIKE wildcards in user input.
 *
 * Without this, an admin typing `_` matches any single character, `%` matches
 * everything, and `\` confuses the pattern parser. Not a security hole (Supabase
 * still parametrises the value), but search results become surprising.
 */
function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&')
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const url = new URL(req.url)
  const martial = url.searchParams.get('martial')
  const city    = url.searchParams.get('city')?.trim()
  const limit   = Math.min(PIPELINE_BUCKET_LIMIT, Math.max(20,
    parseInt(url.searchParams.get('limit') ?? '200', 10) || 200))

  const supabase = createServiceClient()
  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  const endOfWeek = new Date(now)
  endOfWeek.setDate(endOfWeek.getDate() + 7)
  endOfWeek.setHours(23, 59, 59, 999)
  const closedSince = new Date(now)
  closedSince.setDate(closedSince.getDate() - 30)

  // We fetch in 3 parallel queries — keeps the response < 100ms even with 1000+ leads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let baseQ: any = supabase.from('sales_leads').select('*')
  if (martial === 'true' || martial === null)  baseQ = baseQ.eq('is_martial_arts', true)
  if (martial === 'false') baseQ = baseQ.eq('is_martial_arts', false)
  if (city) baseQ = baseQ.ilike('city', `%${escapeIlike(city)}%`)

  // Bucket 1+2: Active leads with next_action_at set (today / this week).
  // We grab anything due in the next 7 days at once and split client-side here.
  const dueQ = baseQ.in('status', ACTIVE_STATUSES)
    .not('next_action_at', 'is', null)
    .lte('next_action_at', endOfWeek.toISOString())
    .order('next_action_at', { ascending: true })
    .limit(limit)

  // Bucket 3: Demo phase — sort by next_action_at if set, else by updated_at.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let demoQ: any = supabase.from('sales_leads').select('*')
    .in('status', Array.from(DEMO_PHASE_STATUSES))
  if (martial === 'true' || martial === null) demoQ = demoQ.eq('is_martial_arts', true)
  if (martial === 'false') demoQ = demoQ.eq('is_martial_arts', false)
  if (city) demoQ = demoQ.ilike('city', `%${escapeIlike(city)}%`)
  demoQ = demoQ.order('updated_at', { ascending: false }).limit(limit)

  // Bucket 4: Closed in last 30 days.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let closedQ: any = supabase.from('sales_leads').select('*')
    .in('status', Array.from(CLOSED_STATUSES))
    .gte('updated_at', closedSince.toISOString())
  if (martial === 'true' || martial === null) closedQ = closedQ.eq('is_martial_arts', true)
  if (martial === 'false') closedQ = closedQ.eq('is_martial_arts', false)
  if (city) closedQ = closedQ.ilike('city', `%${escapeIlike(city)}%`)
  closedQ = closedQ.order('updated_at', { ascending: false }).limit(limit)

  const [dueRes, demoRes, closedRes] = await Promise.all([dueQ, demoQ, closedQ])

  if (dueRes.error)    return NextResponse.json({ error: dueRes.error.message }, { status: 500 })
  if (demoRes.error)   return NextResponse.json({ error: demoRes.error.message }, { status: 500 })
  if (closedRes.error) return NextResponse.json({ error: closedRes.error.message }, { status: 500 })

  const due = (dueRes.data ?? []) as SalesLead[]
  const today: SalesLead[] = []
  const thisWeek: SalesLead[] = []
  for (const l of due) {
    if (!l.next_action_at) continue
    const t = new Date(l.next_action_at).getTime()
    if (t <= endOfToday.getTime()) today.push(l)
    else thisWeek.push(l)
  }

  // Tagesbericht — Aktion-Counts für heute, plus week-stats.
  const todayCounts: Record<string, number> = {}
  for (const l of today) {
    const k = l.next_action ?? 'unknown'
    todayCounts[k] = (todayCounts[k] ?? 0) + 1
  }

  const startOfWeek = new Date(now)
  startOfWeek.setDate(startOfWeek.getDate() - 7)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: weekStatsRows } = await (supabase.from('sales_leads') as any)
    .select('status, created_at, updated_at')
    .gte('updated_at', startOfWeek.toISOString())
    .limit(2000)

  const weekStats = {
    new_leads: 0,
    demos_scheduled: 0,
    won: 0,
    lost: 0,
  }
  for (const r of (weekStatsRows ?? []) as Array<{ status: string; created_at: string; updated_at: string }>) {
    if (new Date(r.created_at).getTime() >= startOfWeek.getTime()) weekStats.new_leads++
    if (r.status === 'demo_scheduled') weekStats.demos_scheduled++
    if (r.status === 'won')  weekStats.won++
    if (r.status === 'lost') weekStats.lost++
  }

  return NextResponse.json({
    buckets: {
      today,
      this_week: thisWeek,
      demo: (demoRes.data ?? []) as SalesLead[],
      closed: (closedRes.data ?? []) as SalesLead[],
    },
    daily: {
      total_due_today: today.length,
      counts: todayCounts,
    },
    weekly: weekStats,
    generated_at: now.toISOString(),
  })
}

// Type re-export for client convenience
export type { Bucket }
