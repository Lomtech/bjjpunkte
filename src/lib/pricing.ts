/**
 * Central pricing source-of-truth for the Osss SaaS subscription.
 *
 * Why one file:
 *   The same pricing is rendered on the marketing landing page, on
 *   the dedicated pricing page, on the dashboard's upgrade banner, and
 *   shipped to Stripe Checkout. When marketing copy and Checkout drift,
 *   customers see one price and pay another — the worst kind of bug.
 *
 *   This module owns the canonical pricing definitions. UI components import
 *   the constants instead of re-declaring them.
 *
 * 2026-05 single-tier realignment:
 *   Old model: Free / Starter 49 / Grow 89 / Pro 149  (4 tiers, member-count-gated)
 *   New model: Standard 49€/Mo monthly · 39€/Mo annual · 14-day trial · unlimited
 *
 *   Rationale:
 *     - Decision-paralysis reduction (MAAT-style single price)
 *     - 0 % Plattformgebühr remains the structural differentiator vs. MAAT (1 %)
 *     - Trial replaces Free-tier as low-friction entry path
 *     - "Unlimited members" matches MAAT's offer one-to-one but undercuts on
 *       transaction-fee structure (0 % vs. 1 %).
 */

export type PlanKey = 'standard'

export type PricingTier = {
  /** Stable machine identifier — must match the API contract in
   *  src/app/api/stripe/owner-checkout/route.ts. */
  planKey: PlanKey
  /** User-facing tier name, identical in DE and EN. */
  name: string
  /** Monthly price in cents (EUR) when billed monthly. */
  monthlyCents: number
  /** Effective monthly price in cents (EUR) when billed annually upfront. */
  annualMonthlyCents: number
  /** Inclusive lower bound of the active-member window for this tier. */
  membersFrom: number
  /** Inclusive upper bound, or null for "unlimited". */
  membersTo: number | null
  /** Whether to render the POPULAR badge. */
  highlight: boolean
}

/**
 * Single-tier definition.
 *
 * Annual billing: customer pays 39 € × 12 = 468 € upfront, gets 12 months access.
 *   Annual saving vs monthly: (49 - 39) × 12 = 120 € per year (matches MAAT exactly).
 */
export const STANDARD_TIER: PricingTier = {
  planKey: 'standard',
  name: 'Standard',
  monthlyCents: 4900,         // 49 €/month, billed monthly
  annualMonthlyCents: 3900,   // 39 €/month equivalent when billed annually
  membersFrom: 0,
  membersTo: null,            // unlimited members
  highlight: true,
}

/**
 * Backwards-compatible array form. The pricing page and rechner used to
 * iterate over `PRICING_TIERS` for tier-by-tier rendering. With a single
 * tier we expose the array form too so existing code keeps working.
 */
export const PRICING_TIERS: readonly PricingTier[] = [STANDARD_TIER]

/**
 * Free trial — replaces the previous "Free up to 30 members" entry tier.
 * Studio gets full access for 14 days, Stripe Checkout marks trial period
 * via `subscription_data.trial_period_days`. No credit card required during
 * trial via `payment_method_collection: 'if_required'`.
 */
export const FREE_TRIAL_DAYS = 14

/**
 * Loyalty mechanic for the first 10 paying studios ("Lifetime-Pilot-Pricing").
 * They lock in 60 % of the standard price for life as compensation for taking
 * the risk on an unproven product.
 *
 * 0.6 means: pilot pays 60 %, saves 40 %.
 *
 * Concrete pilot prices:
 *   Standard monthly  49 € → 29.40 €/month
 *   Standard annual   39 € → 23.40 €/month  (= 280.80 €/year)
 *
 * Implementation note:
 *   Pilot status is granted via a 40 %-off Stripe Coupon attached to the
 *   subscription at first checkout. The coupon's `duration` is `forever`.
 *   See compliance/sales/pricing-rationale.md for the operational steps.
 */
export const LIFETIME_PILOT_DISCOUNT = 0.6

/** Fixed cap for the pilot programme. After 10 paying studios the offer is closed. */
export const LIFETIME_PILOT_SLOTS = 10

/**
 * Promotion code displayed publicly on the pricing page. Studios enter this
 * at Stripe Checkout to redeem the LIFETIME_PILOT_DISCOUNT.
 *
 * The code itself, the 10-redemption cap, and the "forever" duration are
 * configured in the Stripe Dashboard — Stripe enforces all of those, the
 * frontend only displays the string.
 *
 * Update both places when changing it (Stripe Dashboard → Promotion Code,
 * AND this constant). Otherwise customers paste a code Stripe rejects.
 */
export const LIFETIME_PILOT_PROMO_CODE = 'PILOT10'

/**
 * Format a Euro price stored in cents into a localised display string.
 *
 *   formatPriceEUR(4900, 'de')  → "49,00 €"
 *   formatPriceEUR(4900, 'en')  → "€49.00"
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
 * Compact Euro formatting without decimals — used in the hero card where
 * the price is always a whole-Euro amount and decimals just add visual noise.
 *
 *   formatPriceEURShort(4900, 'de') → "49 €"
 *   formatPriceEURShort(4900, 'en') → "€49"
 */
export function formatPriceEURShort(cents: number, lang: 'de' | 'en'): string {
  const value = Math.round(cents / 100)
  return lang === 'de' ? `${value} €` : `€${value}`
}

/**
 * The single-tier model has only one tier — this helper is preserved for
 * backwards compatibility (rechner + dashboard imports). It always returns
 * STANDARD_TIER regardless of member count, since members are unlimited.
 */
export function getTierForMemberCount(_count: number): PricingTier {
  return STANDARD_TIER
}

/**
 * Compute the annual subscription total (cents) for the standard tier.
 *   annualPriceCents() → 46800 (= 468 €/year)
 *
 * Note: signature kept compatible with the old `(monthlyCents) => number`
 * shape used by the Stripe checkout, but we now use the dedicated
 * annualMonthlyCents internally to compute the right total.
 */
export function annualPriceCents(_monthlyCents?: number): number {
  return STANDARD_TIER.annualMonthlyCents * 12
}

/**
 * Compute the absolute Euro saving when switching from monthly to annual.
 *   savingsAnnualEUR() → 120 (= 120 €/year saved)
 */
export function savingsAnnualEUR(_monthlyCents?: number): number {
  return Math.round(((STANDARD_TIER.monthlyCents - STANDARD_TIER.annualMonthlyCents) * 12) / 100)
}
