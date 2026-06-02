/**
 * Unit tests for the pure money-logic extracted from the six money-flow routes
 * flagged by osss-audit `testing` (no automated test → regression risk):
 *
 *   - src/app/api/stripe/create-checkout/route.ts   (amount, platform fee)
 *   - src/app/api/stripe/subscribe/route.ts          (amount, fee clamp, contract end)
 *   - src/app/api/stripe/owner-checkout/route.ts      (plan price from pricing.ts)
 *   - src/app/api/quotes/[id]/convert/route.ts        (invoice no, status, due date)
 *   - src/app/api/stripe/sync-payments/route.ts       (dedup key)
 *   - src/app/api/cron/payment-reminders/route.ts     (CTA selection)
 *
 * The routes now import these helpers, so a regression in the money math fails
 * here in CI instead of silently shipping. Integration around Stripe/Supabase
 * is covered separately by tests/smoke.
 */

import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import {
  isValidAmountCents,
  normalizeFeePercent,
  platformFeeCents,
  ownerPlanPriceCents,
  isConvertibleQuoteStatus,
  CONVERTIBLE_QUOTE_STATUSES,
  formatInvoiceNumber,
  invoiceDueDateISO,
  contractEndUnixSeconds,
  dedupKey,
  reminderCta,
} from '@/lib/billing/checkout-math'
import { STANDARD_TIER } from '@/lib/pricing'

describe('create-checkout / subscribe — isValidAmountCents', () => {
  test('rejects non-numbers, non-integers, and below-minimum', () => {
    expect(isValidAmountCents('50', 50)).toBe(false)
    expect(isValidAmountCents(undefined, 50)).toBe(false)
    expect(isValidAmountCents(NaN, 50)).toBe(false)
    expect(isValidAmountCents(49.5, 50)).toBe(false)
    expect(isValidAmountCents(49, 50)).toBe(false)
  })
  test('accepts integer cents at/above the route minimum', () => {
    expect(isValidAmountCents(50, 50)).toBe(true)   // create-checkout min 0,50 €
    expect(isValidAmountCents(100, 100)).toBe(true) // subscribe min 1,00 €
    expect(isValidAmountCents(99, 100)).toBe(false) // subscribe rejects 0,99 €
  })
  test('property: integers pass iff ≥ min', () => {
    fc.assert(fc.property(
      fc.integer({ min: -10_000, max: 1_000_000 }),
      fc.integer({ min: 0, max: 1000 }),
      // return an explicit boolean — fast-check treats a returned value as the
      // verdict (expect() would return undefined and mask a real mismatch).
      (v, min) => isValidAmountCents(v, min) === (v >= min),
    ))
  })
})

describe('create-checkout / subscribe — normalizeFeePercent', () => {
  test('0 % default (the USP vs MAAT) for missing / NaN / negative', () => {
    expect(normalizeFeePercent(undefined)).toBe(0)
    expect(normalizeFeePercent('')).toBe(0)
    expect(normalizeFeePercent('abc')).toBe(0)
    expect(normalizeFeePercent('-5')).toBe(0)
  })
  test('parses a positive percent', () => {
    expect(normalizeFeePercent('1.5')).toBe(1.5)
    expect(normalizeFeePercent('2')).toBe(2)
  })
})

describe('create-checkout — platformFeeCents', () => {
  test('0 % → 0 fee (default)', () => {
    expect(platformFeeCents(10_000, 0)).toBe(0)
    expect(platformFeeCents(10_000, -1)).toBe(0)
  })
  test('rounds to whole cents', () => {
    expect(platformFeeCents(10_000, 1)).toBe(100)  // 1 % of 100 €
    expect(platformFeeCents(333, 1.5)).toBe(5)      // 4.995 → 5
  })
  test('property: fee is non-negative and never exceeds the amount for percent ≤ 100', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 100_000_000 }),
      fc.float({ min: 0, max: 100, noNaN: true }),
      (amount, pct) => {
        const fee = platformFeeCents(amount, pct)
        expect(fee).toBeGreaterThanOrEqual(0)
        expect(fee).toBeLessThanOrEqual(amount)
      },
    ))
  })
})

describe('owner-checkout — ownerPlanPriceCents (from pricing.ts)', () => {
  test('monthly matches STANDARD_TIER', () => {
    expect(ownerPlanPriceCents(false)).toBe(STANDARD_TIER.monthlyCents)
  })
  test('annual = annualMonthly × 12 charged upfront', () => {
    expect(ownerPlanPriceCents(true)).toBe(STANDARD_TIER.annualMonthlyCents * 12)
  })
  test('current single-tier values (49 € / 468 € upfront) — guards against price drift into Stripe', () => {
    expect(ownerPlanPriceCents(false)).toBe(4900)
    expect(ownerPlanPriceCents(true)).toBe(46800)
  })
})

describe('quote-convert — status + invoice number + due date', () => {
  test('only draft/sent/accepted are convertible', () => {
    expect(CONVERTIBLE_QUOTE_STATUSES).toEqual(['draft', 'sent', 'accepted'])
    for (const s of ['draft', 'sent', 'accepted']) expect(isConvertibleQuoteStatus(s)).toBe(true)
    for (const s of ['converted', 'expired', 'cancelled', '']) expect(isConvertibleQuoteStatus(s)).toBe(false)
  })
  test('invoice number is YYYY-NNNN, zero-padded, defaults counter to 1', () => {
    expect(formatInvoiceNumber(2026, 1)).toBe('2026-0001')
    expect(formatInvoiceNumber(2026, 42)).toBe('2026-0042')
    expect(formatInvoiceNumber(2026, 1234)).toBe('2026-1234')
    expect(formatInvoiceNumber(2026, null)).toBe('2026-0001')
    expect(formatInvoiceNumber(2026, undefined)).toBe('2026-0001')
  })
  test('due date is date-only ISO, exactly +14 days', () => {
    // 2026-06-02T10:00:00Z + 14d = 2026-06-16
    const from = Date.UTC(2026, 5, 2, 10, 0, 0)
    expect(invoiceDueDateISO(from, 14)).toBe('2026-06-16')
    expect(invoiceDueDateISO(from, 0)).toBe('2026-06-02')
  })
})

describe('subscribe — contractEndUnixSeconds', () => {
  test('undefined for open-ended (months ≤ 0 / null)', () => {
    expect(contractEndUnixSeconds(new Date(), 0)).toBeUndefined()
    expect(contractEndUnixSeconds(new Date(), null)).toBeUndefined()
    expect(contractEndUnixSeconds(new Date(), -3)).toBeUndefined()
  })
  test('snaps to the 1st and adds N months (unix seconds)', () => {
    const from = new Date(Date.UTC(2026, 5, 17, 12, 0, 0)) // 2026-06-17
    const ts = contractEndUnixSeconds(from, 12)!
    const d = new Date(ts * 1000)
    expect(d.getUTCDate()).toBe(1)
    // 12 months from June → next June
    expect(d.getUTCFullYear()).toBe(2027)
    expect(Number.isInteger(ts)).toBe(true)
  })
})

describe('sync-payments — dedupKey', () => {
  test('prefers payment_intent when present', () => {
    expect(dedupKey('pi_123', 'member-x', 5000, '2026-06-02T10:30:00Z')).toBe('pi:pi_123')
  })
  test('falls back to identity+amount+minute (SEPA without PI)', () => {
    expect(dedupKey(null, 'member-x', 5000, '2026-06-02T10:30:45Z'))
      .toBe('m:member-x:5000:2026-06-02T10:30')
  })
  test('same member+amount within the same minute collapses; different minute does not', () => {
    const a = dedupKey(null, 'm1', 5000, '2026-06-02T10:30:10Z')
    const b = dedupKey(null, 'm1', 5000, '2026-06-02T10:30:55Z')
    const c = dedupKey(null, 'm1', 5000, '2026-06-02T10:31:00Z')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('payment-reminders — reminderCta', () => {
  test('prefers direct checkout link', () => {
    expect(reminderCta('https://pay', 'https://portal')).toEqual({ url: 'https://pay', label: 'Jetzt bezahlen' })
  })
  test('falls back to portal', () => {
    expect(reminderCta(null, 'https://portal')).toEqual({ url: 'https://portal', label: 'Zum Mitgliederportal' })
  })
  test('empty url when neither exists', () => {
    expect(reminderCta(null, null)).toEqual({ url: '', label: 'Zum Mitgliederportal' })
  })
})
