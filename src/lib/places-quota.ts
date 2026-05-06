import type { SupabaseClient } from '@supabase/supabase-js'

// Google Places Text Search "Pro" tier pricing (Stand 2024):
//   $0.035 per call (= $35 / 1000 calls)
// Free tier: $200/month ≈ 5700 calls. Plenty.
// Set PLACES_DAILY_LIMIT in env to cap; default = 100 calls/day = ~$3.50/day.
export const COST_PER_CALL_USD = 0.035

export function getDailyLimit(): number {
  const raw = process.env.PLACES_DAILY_LIMIT
  const n = parseInt(raw ?? '', 10)
  if (Number.isFinite(n) && n > 0) return n
  return 100
}

export type QuotaSnapshot = {
  todayPagesCalled: number
  todaySearches: number
  todayInserted: number
  todayCostUsd: number
  monthPagesCalled: number
  monthSearches: number
  monthInserted: number
  monthCostUsd: number
  dailyLimit: number
  remainingToday: number
  pctUsed: number
}

export async function getPlacesQuota(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
): Promise<QuotaSnapshot> {
  // Day starts at 00:00 UTC — for a German solo dev that's 01:00/02:00 local,
  // close enough. If you want Berlin-day, adjust here.
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase.from('sales_search_history') as any)
    .select('ran_at, pages_called, inserted_count')
    .gte('ran_at', monthStart.toISOString())
    .limit(10000)

  let todayPages = 0, todaySearches = 0, todayInserted = 0
  let monthPages = 0, monthSearches = 0, monthInserted = 0

  for (const r of (rows ?? []) as Array<{ ran_at: string; pages_called: number; inserted_count: number }>) {
    const ts = new Date(r.ran_at).getTime()
    monthPages += r.pages_called ?? 0
    monthInserted += r.inserted_count ?? 0
    monthSearches++
    if (ts >= dayStart.getTime()) {
      todayPages += r.pages_called ?? 0
      todayInserted += r.inserted_count ?? 0
      todaySearches++
    }
  }

  const dailyLimit = getDailyLimit()
  const remainingToday = Math.max(0, dailyLimit - todayPages)
  const pctUsed = dailyLimit > 0 ? Math.min(100, (todayPages / dailyLimit) * 100) : 0

  return {
    todayPagesCalled: todayPages,
    todaySearches,
    todayInserted,
    todayCostUsd: +(todayPages * COST_PER_CALL_USD).toFixed(2),
    monthPagesCalled: monthPages,
    monthSearches,
    monthInserted,
    monthCostUsd: +(monthPages * COST_PER_CALL_USD).toFixed(2),
    dailyLimit,
    remainingToday,
    pctUsed: +pctUsed.toFixed(1),
  }
}
