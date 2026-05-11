import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'
import { withApiHandler } from '@/lib/api/with-error-handler'

export const dynamic = 'force-dynamic'

// GET /api/admin/leads/stats?range=today|7d|30d|all (default 7d)
//
// Aggregations:
// - activitiesByKind: { call: 12, email: 5, demo: 1, ... }
// - callsByOutcome:   { answered: 4, no_answer: 6, voicemail: 2, ... }
// - pipeline:         { new: 30, contacted: 8, qualified: 3, won: 1, ... }
// - conversion:       { contactRate, qualifyRate, demoRate, winRate }
// - byDay:            { '2026-05-01': 5, '2026-05-02': 8, ... } (calls per day)
// - topCities:        [{ city: 'München', count: 18 }, ...]
export const GET = withApiHandler('admin.leads.stats.get', async (req: Request) => {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const url = new URL(req.url)
  const range = url.searchParams.get('range') ?? '7d'

  const now = new Date()
  let since: Date | null = null
  if (range === 'today') {
    since = new Date(); since.setHours(0, 0, 0, 0)
  } else if (range === '7d') {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else if (range === '30d') {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  } // 'all' → since stays null

  const supabase = createServiceClient()

  // Activities in range
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let actQ: any = supabase
    .from('sales_activities')
    .select('kind, outcome, occurred_at')
  if (since) actQ = actQ.gte('occurred_at', since.toISOString())
  actQ = actQ.limit(50000)
  const { data: acts } = await actQ

  const activitiesByKind: Record<string, number> = {}
  const callsByOutcome:   Record<string, number> = {}
  const byDay:            Record<string, number> = {}

  for (const a of (acts ?? []) as Array<{ kind: string; outcome: string | null; occurred_at: string }>) {
    activitiesByKind[a.kind] = (activitiesByKind[a.kind] ?? 0) + 1
    if (a.kind === 'call') {
      const out = a.outcome ?? 'unknown'
      callsByOutcome[out] = (callsByOutcome[out] ?? 0) + 1
      const day = a.occurred_at.slice(0, 10)
      byDay[day] = (byDay[day] ?? 0) + 1
    }
  }

  // Pipeline counts (always all-time, since pipeline state isn't time-bound)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pipeRows } = await (supabase.from('sales_leads') as any)
    .select('status, city, contact_count')
    .limit(50000)

  const pipeline: Record<string, number> = {}
  const cityCounts: Record<string, number> = {}
  let totalContactCount = 0
  let leadsWithContact = 0

  for (const r of (pipeRows ?? []) as Array<{ status: string; city: string | null; contact_count: number }>) {
    pipeline[r.status] = (pipeline[r.status] ?? 0) + 1
    if (r.city) cityCounts[r.city] = (cityCounts[r.city] ?? 0) + 1
    totalContactCount += r.contact_count
    if (r.contact_count > 0) leadsWithContact++
  }

  const total = (pipeRows ?? []).length
  // Conversion: how many of "ever contacted" reach each next stage
  const everContacted   = leadsWithContact
  const reachedQualified = (pipeline['qualified'] ?? 0) + (pipeline['demo_scheduled'] ?? 0) + (pipeline['demo_done'] ?? 0) + (pipeline['negotiating'] ?? 0) + (pipeline['won'] ?? 0)
  const reachedDemo      = (pipeline['demo_scheduled'] ?? 0) + (pipeline['demo_done'] ?? 0) + (pipeline['negotiating'] ?? 0) + (pipeline['won'] ?? 0)
  const won              = pipeline['won'] ?? 0

  const conversion = {
    contactRate:  total > 0 ? +(everContacted / total * 100).toFixed(1) : 0,
    qualifyRate:  everContacted > 0 ? +(reachedQualified / everContacted * 100).toFixed(1) : 0,
    demoRate:     reachedQualified > 0 ? +(reachedDemo / reachedQualified * 100).toFixed(1) : 0,
    winRate:      reachedDemo > 0 ? +(won / reachedDemo * 100).toFixed(1) : 0,
    overallWinRate: total > 0 ? +(won / total * 100).toFixed(2) : 0,
  }

  const topCities = Object.entries(cityCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([city, count]) => ({ city, count }))

  // Call success rate
  const totalCalls = activitiesByKind['call'] ?? 0
  const successfulCalls =
    (callsByOutcome['answered'] ?? 0) +
    (callsByOutcome['interested'] ?? 0) +
    (callsByOutcome['call_back'] ?? 0)
  const callSuccessRate = totalCalls > 0 ? +(successfulCalls / totalCalls * 100).toFixed(1) : 0

  return NextResponse.json({
    range,
    since: since?.toISOString() ?? null,
    activitiesByKind,
    callsByOutcome,
    byDay,
    totalCalls,
    successfulCalls,
    callSuccessRate,
    pipeline,
    conversion,
    topCities,
    totalLeads: total,
    avgContactsPerLead: leadsWithContact > 0 ? +(totalContactCount / leadsWithContact).toFixed(1) : 0,
  })
})
