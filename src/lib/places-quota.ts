import type { SupabaseClient } from '@supabase/supabase-js'

// Google Places API (New) — Text Search Pricing
// ──────────────────────────────────────────────────────────────────────
// Source: https://developers.google.com/maps/billing-and-pricing/pricing
// (Stand März 2025 — der alte $200 monthly credit wurde abgeschafft und
// ersetzt durch "free calls per SKU monthly")
//
// 3 Text-Search SKUs, basierend auf welche Felder die Field-Mask abruft:
//
//   SKU            | Free/Monat | Cost danach (Tier 1, ab 10k bis 500k)
//   ───────────────┼────────────┼─────────────────────────────────────────
//   Essentials     |  10.000    | $2.27 / 1000 calls = $0.00227/call
//   Pro            |   5.000    | $32.00 / 1000 calls = $0.032/call
//   Enterprise     |   1.000    | $35.00 / 1000 calls = $0.035/call
//
// Welche SKU wir treffen: Unsere Field-Mask in google-places.ts holt
//   - Essentials: id, displayName, formattedAddress, location, types, googleMapsUri
//   - Pro fields: rating, userRatingCount, nationalPhoneNumber, websiteUri,
//                 businessStatus, addressComponents
// → Wir werden als **Pro-SKU** abgerechnet = 5.000 Free/Monat, $0.032/Call.
//
// Daily Limit Default: 150/Tag = ~4.500/Monat → sicher unter 5k Free-Tier.
//
// Override per Vercel env vars:
//   PLACES_COST_PER_CALL_USD=0.032
//   PLACES_FREE_CALLS_PER_MONTH=5000
//   PLACES_DAILY_LIMIT=150
// ──────────────────────────────────────────────────────────────────────

function envFloat(key: string, fallback: number): number {
  const n = parseFloat(process.env[key] ?? '')
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function envInt(key: string, fallback: number): number {
  const n = parseInt(process.env[key] ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const COST_PER_CALL_USD       = envFloat('PLACES_COST_PER_CALL_USD', 0.032)   // Pro SKU tier 1
export const FREE_CALLS_PER_MONTH    = envInt('PLACES_FREE_CALLS_PER_MONTH', 5_000)  // Pro SKU monthly free

export function getDailyLimit(): number {
  // Default: 150/day = ~4.500/month → bleibt sicher unter 5k Pro-SKU Free-Tier.
  // Override mit PLACES_DAILY_LIMIT.
  return envInt('PLACES_DAILY_LIMIT', 150)
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
