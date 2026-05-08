/**
 * Central pricing source-of-truth for the Osss SaaS subscription tiers.
 *
 * Why one file:
 *   The same tier list is rendered on the marketing landing page, on
 *   the dedicated pricing page, on the dashboard's upgrade banner, and
 *   shipped to Stripe Checkout. When marketing copy and Checkout drift,
 *   customers see one price and pay another — the worst kind of bug.
 *
 *   This module owns the canonical tier definitions. UI components import
 *   the constants instead of re-declaring them.
 *
 * What is NOT in this file:
 *   - Stripe Price IDs (those live in Stripe Dashboard / env vars; the
 *     owner-checkout route currently uses ad-hoc `price_data` instead of
 *     fixed Price IDs — see compliance/sales/pricing-rationale.md).
 *   - Studio-side member-plans (those are dynamic gym data, not SaaS tiers).
 */

export type PlanKey = 'free' | 'starter' | 'grow' | 'pro'

export type PricingTier = {
  /** Stable machine identifier — must match the API contract in
   *  src/app/api/stripe/owner-checkout/route.ts. */
  planKey: PlanKey
  /** User-facing tier name, identical in DE and EN. */
  name: string
  /** Monthly price in cents (EUR). 0 for the Free plan. */
  monthlyCents: number
  /** Inclusive lower bound of the active-member window for this tier. */
  membersFrom: number
  /** Inclusive upper bound, or null for "unlimited". */
  membersTo: number | null
  /** Whether to render the POPULAR badge. */
  highlight: boolean
}

/**
 * Canonical tier list — order matches display order on the pricing page.
 *
 * 2026-05 pricing realignment:
 *   Old: 0 / 29 / 49 / 99 EUR
 *   New: 0 / 49 / 89 / 149 EUR  (≈ +69%/82%/51% on the paid tiers)
 *
 *   Rationale lives in compliance/sales/pricing-rationale.md.
 *   Lifetime-Pilot loyalty discount is NOT encoded here — it is granted
 *   per-customer through Stripe coupons, see LIFETIME_PILOT_DISCOUNT below.
 */
export const PRICING_TIERS: readonly PricingTier[] = [
  {
    planKey: 'free',
    name: 'Free',
    monthlyCents: 0,
    membersFrom: 0,
    membersTo: 30,
    highlight: false,
  },
  {
    planKey: 'starter',
    name: 'Starter',
    monthlyCents: 4900,
    membersFrom: 31,
    membersTo: 99,
    highlight: false,
  },
  {
    planKey: 'grow',
    name: 'Grow',
    monthlyCents: 8900,
    membersFrom: 100,
    membersTo: 249,
    highlight: true,
  },
  {
    planKey: 'pro',
    name: 'Pro',
    monthlyCents: 14900,
    membersFrom: 250,
    membersTo: null,
    highlight: false,
  },
]

/**
 * Annual billing model: customer pays for 10 months, gets 12 months access.
 * That is a 16.67% discount vs paying monthly. Marketing communicates this
 * as "2 Monate gratis" / "2 months free" to keep the pitch concrete.
 */
export const ANNUAL_MONTHS_PAID = 10
export const ANNUAL_MONTHS_USED = 12

/**
 * Loyalty mechanic for the first 10 paying studios ("Lifetime-Pilot-Pricing").
 * They lock in 60% of the new tier price for life as compensation for taking
 * the risk on an unproven product.
 *
 * 0.6 means: pilot pays 60%, saves 40%.
 *
 * Concrete example (Starter):
 *   Standard 49 EUR → Pilot 29.40 EUR → rounded to 29 EUR (matches the
 *   number CSC FFB was originally promised, so we honour it as-is).
 *
 * Implementation note:
 *   Pilot status is granted via a 40%-off Stripe Coupon attached to the
 *   subscription at first checkout. The coupon's `duration` is `forever`.
 *   See compliance/sales/pricing-rationale.md for the operational steps.
 */
export const LIFETIME_PILOT_DISCOUNT = 0.6

/** Fixed cap for the pilot programme. After 10 paying studios the offer is closed. */
export const LIFETIME_PILOT_SLOTS = 10

/**
 * Format a Euro price stored in cents into a localised display string.
 *
 *   formatPriceEUR(4900, 'de')  → "49,00 €"
 *   formatPriceEUR(4900, 'en')  → "€49.00"
 *   formatPriceEUR(0,    'de')  → "0,00 €"
 *
 * Rounding: banker's rounding via Intl.NumberFormat — fine for the values
 * we deal with (whole-Euro tier prices, no fractional cents).
 */
export function formatPriceEUR(cents: number, lang: 'de' | 'en'): string {
  const value = cents / 100
  const locale = lang === 'de' ? 'de-DE' : 'en-IE'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Compact Euro formatting without decimals — used in tier cards where the
 * price is always a whole-Euro amount and decimals just add visual noise.
 *
 *   formatPriceEURShort(4900, 'de') → "49 €"
 *   formatPriceEURShort(4900, 'en') → "€49"
 */
export function formatPriceEURShort(cents: number, lang: 'de' | 'en'): string {
  const value = Math.round(cents / 100)
  return lang === 'de' ? `${value} €` : `€${value}`
}

/**
 * Recommend the cheapest tier whose member window covers `count`.
 * Used by the dashboard upgrade nudge and by the rechner (calculator).
 *
 *   getTierForMemberCount(20)  → free
 *   getTierForMemberCount(75)  → starter
 *   getTierForMemberCount(180) → grow
 *   getTierForMemberCount(800) → pro
 */
export function getTierForMemberCount(count: number): PricingTier {
  const safe = Math.max(0, Math.floor(count))
  const match = PRICING_TIERS.find(t => {
    if (safe < t.membersFrom) return false
    if (t.membersTo === null) return true
    return safe <= t.membersTo
  })
  // Defensive: should never happen because Pro is unbounded, but TypeScript
  // does not know that — and in practice we'd rather show the top tier than
  // crash if PRICING_TIERS is ever misconfigured.
  return match ?? PRICING_TIERS[PRICING_TIERS.length - 1]
}

/**
 * Compute the annual price (cents) for a given monthly price (cents).
 * 10 months paid, 12 used → simply monthly × 10.
 */
export function annualPriceCents(monthlyCents: number): number {
  return monthlyCents * ANNUAL_MONTHS_PAID
}

/**
 * Compute the absolute Euro saving when switching from monthly to annual.
 *   savingsAnnualEUR(4900) → 98  (= 2 free months)
 */
export function savingsAnnualEUR(monthlyCents: number): number {
  return Math.round((monthlyCents * (ANNUAL_MONTHS_USED - ANNUAL_MONTHS_PAID)) / 100)
}
