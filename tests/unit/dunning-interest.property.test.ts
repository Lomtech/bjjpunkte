/**
 * Property-based Tests fuer Verzugszinsen-Berechnung (§§ 247, 288 BGB).
 *
 * Sprint Phase-2 (2026-05-31). fast-check generiert 1000 zufaellige Inputs
 * pro Property und prueft Invarianten — findet Edge-Cases die Beispiel-
 * basierte Tests verpassen (Overflow, Floating-Point-Drift, Negative-Zeiten).
 */

import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import { calculateInterestCents } from '@/lib/dunning-interest'

describe('calculateInterestCents — property-based', () => {
  test('Verzugszinsen sind NIE negativ', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 100_000_000_00 }),     // amountCents bis 1Mio EUR
      fc.integer({ min: -1000, max: 100_000 }),         // daysOverdue inkl. negativ
      fc.float({ min: 0, max: 25, noNaN: true }),       // basisratePct 0-25%
      fc.float({ min: 0, max: 15, noNaN: true }),       // surchargePct 0-15%
      (amount, days, basis, surcharge) => {
        const r = calculateInterestCents({
          amountCents: amount,
          daysOverdue: days,
          basisratePct: basis,
          surchargePct: surcharge,
        })
        return r.interestCents >= 0
      }
    ), { numRuns: 1000 })
  })

  test('Verzugszinsen sind ganze Cents (kein Float)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 100_000_000_00 }),
      fc.integer({ min: 0, max: 100_000 }),
      fc.float({ min: 0, max: 25, noNaN: true }),
      fc.float({ min: 0, max: 15, noNaN: true }),
      (amount, days, basis, surcharge) => {
        const r = calculateInterestCents({
          amountCents: amount,
          daysOverdue: days,
          basisratePct: basis,
          surchargePct: surcharge,
        })
        return Number.isInteger(r.interestCents) && Number.isFinite(r.interestCents)
      }
    ), { numRuns: 1000 })
  })

  test('Verzugszinsen wachsen monoton mit Dauer (mehr Tage = mehr Zinsen, ceteris paribus)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 10_000, max: 100_000_000 }),    // sinnvolle Forderung
      fc.integer({ min: 1, max: 1000 }),                 // days1
      fc.integer({ min: 1, max: 1000 }),                 // days2
      fc.float({ min: 1, max: 10, noNaN: true }),
      fc.float({ min: 5, max: 9, noNaN: true }),
      (amount, d1, d2, basis, surcharge) => {
        const r1 = calculateInterestCents({ amountCents: amount, daysOverdue: Math.min(d1, d2), basisratePct: basis, surchargePct: surcharge })
        const r2 = calculateInterestCents({ amountCents: amount, daysOverdue: Math.max(d1, d2), basisratePct: basis, surchargePct: surcharge })
        return r1.interestCents <= r2.interestCents
      }
    ), { numRuns: 500 })
  })

  test('Verzugszinsen wachsen monoton mit Forderung (mehr Betrag = mehr Zinsen)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 100, max: 100_000_000 }),
      fc.integer({ min: 100, max: 100_000_000 }),
      fc.integer({ min: 1, max: 365 }),
      fc.float({ min: 1, max: 10, noNaN: true }),
      fc.float({ min: 5, max: 9, noNaN: true }),
      (a1, a2, days, basis, surcharge) => {
        const r1 = calculateInterestCents({ amountCents: Math.min(a1, a2), daysOverdue: days, basisratePct: basis, surchargePct: surcharge })
        const r2 = calculateInterestCents({ amountCents: Math.max(a1, a2), daysOverdue: days, basisratePct: basis, surchargePct: surcharge })
        return r1.interestCents <= r2.interestCents
      }
    ), { numRuns: 500 })
  })

  test('Bei daysOverdue=0 oder amount=0 sind Zinsen IMMER 0', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 100_000_000_00 }),
      fc.float({ min: 0, max: 25, noNaN: true }),
      fc.float({ min: 0, max: 15, noNaN: true }),
      (amount, basis, surcharge) => {
        const r = calculateInterestCents({ amountCents: amount, daysOverdue: 0, basisratePct: basis, surchargePct: surcharge })
        return r.interestCents === 0
      }
    ), { numRuns: 200 })

    fc.assert(fc.property(
      fc.integer({ min: 0, max: 100_000 }),
      fc.float({ min: 0, max: 25, noNaN: true }),
      fc.float({ min: 0, max: 15, noNaN: true }),
      (days, basis, surcharge) => {
        const r = calculateInterestCents({ amountCents: 0, daysOverdue: days, basisratePct: basis, surchargePct: surcharge })
        return r.interestCents === 0
      }
    ), { numRuns: 200 })
  })

  test('Bekannte Beispiele aus § 288 BGB sind korrekt', () => {
    // 1000 EUR Forderung, 30 Tage Verzug, 2,27% Basis + 5% (Verbraucher)
    // = 1000 × 7,27% × 30/365 = 5,97 EUR = 597 Cents
    const r = calculateInterestCents({
      amountCents: 100_000,        // 1000 EUR
      daysOverdue: 30,
      basisratePct: 2.27,
      surchargePct: 5.0,
    })
    expect(r.effectiveRatePct).toBeCloseTo(7.27, 2)
    expect(r.interestCents).toBe(598) // 5,975... → round to 598 Cent = 5,98 EUR
  })
})
