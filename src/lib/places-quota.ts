import type { SupabaseClient } from '@supabase/supabase-js'

// Google Places API (New) — Pricing 2024
// ──────────────────────────────────────────────────────────────────────
// Free tier: 10.000 Calls/Monat GRATIS für Pro-SKU Endpoints (Text Search,
// Place Details, Nearby Search etc.). Plus $200 monthly Cloud-Credit on top.
// → Realistisch: du wirst nie zahlen wenn du <10k/Monat bleibst.
//
// Nach Free Tier: ~$0.025/call (Essentials+Contact+Atmosphere SKU).
// Wir nutzen exakt diese Field-Mask (id, displayName, address, location,
// rating, userRatingCount, phone, website, types).
//
// Override mit env vars:
//   PLACES_COST_PER_CALL_USD=0.025
//   PLACES_FREE_CALLS_PER_MONTH=10000
//   PLACES_DAILY_LIMIT=300
// ──────────────────────────────────────────────────────────────────────

function envFloat(key: string, fallback: number): number {
  const n = parseFloat(process.env[key] ?? '')
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function envInt(key: string, fallback: number): number {
  const n = parseInt(process.env[key] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const COST_PER_CALL_USD       = envFloat('PLACES_COST_PER_CALL_USD', 0.025)
export const FREE_CALLS_PER_MONTH    = envInt('PLACES_FREE_CALLS_PER_MONTH', 10_000)

export function getDailyLimit(): number {
  // Default: 300/day = ~9k/month → comfortably under free tier even if you go
  // hard every single day. Override mit PLACES_DAILY_LIMIT.
  return envInt('PLACES_DAILY_LIMIT', 300)
}

export type QuotaSnapshot = {
  todayPagesCalled: number
  todaySearches: number
  todayInserted: number
  todayCostUsd: number              // effective cost (after free tier)
  monthPagesCalled: number
  monthSearches: number
  monthInserted: number
  monthCostUsd: number              // effective cost (after free tier)
  dailyLimit: number
  remainingToday: number
  pctUsed: number
  freeCallsPerMonth: number
  freeRemaining: number
  freePctUsed: number
  costPerCallUsd: number
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

  // Effective cost = only calls BEYOND free tier cost money
  const monthBilledCalls = Math.max(0, monthPages - FREE_CALLS_PER_MONTH)
  // Today's billable share is proportional — only kicks in once we've blown
  // through this month's 10k free calls. Almost always 0 for normal usage.
  const todayBilledCalls = monthBilledCalls > 0
    ? Math.min(todayPages, monthBilledCalls)
    : 0
  const freeRemaining = Math.max(0, FREE_CALLS_PER_MONTH - monthPages)
  const freePctUsed = FREE_CALLS_PER_MONTH > 0
    ? Math.min(100, (monthPages / FREE_CALLS_PER_MONTH) * 100)
    : 0

  return {
    todayPagesCalled: todayPages,
    todaySearches,
    todayInserted,
    todayCostUsd: +(todayBilledCalls * COST_PER_CALL_USD).toFixed(2),
    monthPagesCalled: monthPages,
    monthSearches,
    monthInserted,
    monthCostUsd: +(monthBilledCalls * COST_PER_CALL_USD).toFixed(2),
    dailyLimit,
    remainingToday,
    pctUsed: +pctUsed.toFixed(1),
    freeCallsPerMonth: FREE_CALLS_PER_MONTH,
    freeRemaining,
    freePctUsed: +freePctUsed.toFixed(1),
    costPerCallUsd: COST_PER_CALL_USD,
  }
}
