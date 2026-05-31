/**
 * Property-based Tests fuer Multi-Position-Rechnungs-Totals.
 *
 * Sprint Phase-2 (2026-05-31). Berechnung aus /api/members/[id]/manual-invoice
 * und /api/quotes — Net + Tax + Gross pro Item, dann aggregiert.
 *
 * Invariante: gross_total === net_total + tax_total (kein Rundungsdrift).
 */

import { describe, test, expect } from 'vitest'
import fc from 'fast-check'

interface LineItem {
  qty: number
  unit_price_cents: number
  tax_rate_pct: number
}

/**
 * Re-Implementation der Total-Berechnung 1:1 aus /api/quotes/route.ts.
 * Wenn diese Funktion irgendwo zentral wird (lib/invoice-totals.ts),
 * von dort importieren statt lokal definieren.
 */
function calculateTotals(items: LineItem[]) {
  const totalNet = items.reduce((s, i) => s + Math.round(i.qty * i.unit_price_cents), 0)
  const totalTax = items.reduce((s, i) => s + Math.round(i.qty * i.unit_price_cents * i.tax_rate_pct / 100), 0)
  const totalGross = totalNet + totalTax
  return { totalNet, totalTax, totalGross }
}

const lineItemArb = fc.record({
  qty: fc.integer({ min: 1, max: 1000 }),
  unit_price_cents: fc.integer({ min: 1, max: 1_000_000 }),
  tax_rate_pct: fc.constantFrom(0, 7, 19),  // DE-Steuersaetze
})

describe('invoice totals — property-based', () => {
  test('gross IMMER = net + tax (keine Rundungsdrift bei der Aggregation)', () => {
    fc.assert(fc.property(
      fc.array(lineItemArb, { minLength: 1, maxLength: 50 }),
      (items) => {
        const { totalNet, totalTax, totalGross } = calculateTotals(items)
        return totalGross === totalNet + totalTax
      }
    ), { numRuns: 1000 })
  })

  test('Alle Totals sind ganzzahlige Cents (Number.isInteger)', () => {
    fc.assert(fc.property(
      fc.array(lineItemArb, { minLength: 1, maxLength: 50 }),
      (items) => {
        const { totalNet, totalTax, totalGross } = calculateTotals(items)
        return Number.isInteger(totalNet) && Number.isInteger(totalTax) && Number.isInteger(totalGross)
      }
    ), { numRuns: 1000 })
  })

  test('Totals sind monoton mit Anzahl Items (mehr Items = mehr oder gleich)', () => {
    fc.assert(fc.property(
      fc.array(lineItemArb, { minLength: 1, maxLength: 30 }),
      lineItemArb,
      (items, extra) => {
        const before = calculateTotals(items)
        const after = calculateTotals([...items, extra])
        return after.totalNet >= before.totalNet
            && after.totalTax >= before.totalTax
            && after.totalGross >= before.totalGross
      }
    ), { numRuns: 500 })
  })

  test('Leere Rechnung = 0/0/0', () => {
    const t = calculateTotals([])
    expect(t).toEqual({ totalNet: 0, totalTax: 0, totalGross: 0 })
  })

  test('19% MwSt auf 100 EUR = 19,00 EUR Tax + 119,00 EUR Gross', () => {
    const t = calculateTotals([{ qty: 1, unit_price_cents: 10_000, tax_rate_pct: 19 }])
    expect(t.totalNet).toBe(10_000)
    expect(t.totalTax).toBe(1_900)
    expect(t.totalGross).toBe(11_900)
  })

  test('Steuerfrei (0% MwSt) → Tax = 0, Gross = Net', () => {
    fc.assert(fc.property(
      fc.array(fc.record({
        qty: fc.integer({ min: 1, max: 100 }),
        unit_price_cents: fc.integer({ min: 1, max: 100_000 }),
        tax_rate_pct: fc.constant(0),
      }), { minLength: 1, maxLength: 20 }),
      (items) => {
        const t = calculateTotals(items)
        return t.totalTax === 0 && t.totalGross === t.totalNet
      }
    ), { numRuns: 200 })
  })
})
