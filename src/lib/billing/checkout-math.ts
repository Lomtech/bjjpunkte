// checkout-math.ts — pure money-logic extracted from the Stripe/billing routes
// so it can be unit-tested in isolation (the routes themselves are integration
// orchestration around Stripe + Supabase). Each function notes its origin route.
//
// Tested in tests/unit/checkout-math.test.ts. Keep these pure (no I/O).

import { STANDARD_TIER } from '@/lib/pricing'

/**
 * Validate a charge amount in cents. Used by:
 *  - /api/stripe/create-checkout (min 50 = 0,50 €)
 *  - /api/stripe/subscribe       (min 100 = 1,00 €)
 * Must be an integer number of cents at or above the route's minimum.
 */
export function isValidAmountCents(value: unknown, minCents: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= minCents
}

/**
 * Parse STRIPE_PLATFORM_FEE_PERCENT into a safe non-negative number.
 * NaN / negative / missing → 0 (the 0 %-platform-fee default = USP vs MAAT).
 * Used by /api/stripe/create-checkout and /api/stripe/subscribe.
 */
export function normalizeFeePercent(raw: string | undefined): number {
  const n = parseFloat(raw ?? '0')
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

/**
 * Platform fee in cents for a given amount + percent. Used by
 * /api/stripe/create-checkout. Never negative; 0 when percent ≤ 0.
 */
export function platformFeeCents(amountCents: number, percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0) return 0
  return Math.round((amountCents * percent) / 100)
}

/**
 * Owner-plan price in cents from the single source of truth (pricing.ts).
 * Used by /api/stripe/owner-checkout. Annual = 39 €/mo × 12 charged upfront.
 */
export function ownerPlanPriceCents(annual: boolean): number {
  return annual ? STANDARD_TIER.annualMonthlyCents * 12 : STANDARD_TIER.monthlyCents
}

/** Quote statuses that may be converted to an invoice (/api/quotes/[id]/convert). */
export const CONVERTIBLE_QUOTE_STATUSES = ['draft', 'sent', 'accepted'] as const

export function isConvertibleQuoteStatus(status: string): boolean {
  return (CONVERTIBLE_QUOTE_STATUSES as readonly string[]).includes(status)
}

/**
 * Invoice number `YYYY-NNNN` (4-digit zero-padded counter). Used by
 * /api/quotes/[id]/convert. Counter defaults to 1 when null/undefined.
 */
export function formatInvoiceNumber(year: number, counter: number | null | undefined): string {
  return `${year}-${String(counter ?? 1).padStart(4, '0')}`
}

/** Invoice due date (date-only ISO, `YYYY-MM-DD`) `days` after `fromMs`. */
export function invoiceDueDateISO(fromMs: number, days: number): string {
  return new Date(fromMs + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Contract-end as a unix timestamp (seconds) for Stripe `cancel_at`.
 * From /api/stripe/subscribe: snap to the 1st, add `months`. Returns
 * undefined when months ≤ 0 (open-ended subscription).
 */
export function contractEndUnixSeconds(from: Date, months: number | null | undefined): number | undefined {
  if (!months || months <= 0) return undefined
  const end = new Date(from)
  end.setDate(1)
  end.setMonth(end.getMonth() + months)
  return Math.floor(end.getTime() / 1000)
}

/**
 * Composite dedup key for a Stripe payment, from /api/stripe/sync-payments.
 * Prefers payment_intent; falls back to identity+amount+minute (SEPA invoices
 * have no PI until settled). The minute-truncation (slice 0,16) is the dedup
 * window — two charges for the same member+amount within a minute collapse.
 */
export function dedupKey(
  piId: string | null,
  identity: string,
  amountCents: number,
  paidAt: string,
): string {
  if (piId) return `pi:${piId}`
  return `m:${identity}:${amountCents}:${paidAt.slice(0, 16)}`
}

/**
 * CTA url + label for the payment-reminder email (/api/cron/payment-reminders).
 * Prefer a direct checkout link ("Jetzt bezahlen"); fall back to the member
 * portal ("Zum Mitgliederportal"); empty string if neither exists.
 */
export function reminderCta(
  checkoutUrl: string | null,
  portalUrl: string | null,
): { url: string; label: string } {
  return {
    url: checkoutUrl ?? portalUrl ?? '',
    label: checkoutUrl ? 'Jetzt bezahlen' : 'Zum Mitgliederportal',
  }
}
