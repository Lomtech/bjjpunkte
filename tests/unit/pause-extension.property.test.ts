/**
 * Property-based Tests fuer Pause-Vertragsverlaengerung.
 *
 * Sprint Phase-2 (2026-05-31). Geschaeftslogik (in SQL-RPC close_contract_pause):
 * Wenn extends_contract=true, wird contract_end_date um die Pause-Dauer
 * (paused_until - paused_from + 1) verlaengert.
 *
 * Diese Tests verifizieren die Dauer-Berechnungs-Invariante.
 */

import { describe, test, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Berechnet die Tagesanzahl zwischen zwei ISO-Date-Strings (YYYY-MM-DD).
 * Pause-Tage werden INKLUSIV gezaehlt — d.h. pause 2026-01-01 bis 2026-01-01
 * ist 1 Tag, nicht 0.
 *
 * Diese Funktion repliziert das SQL `paused_until - paused_from + 1`.
 */
function pauseDays(pausedFrom: string, pausedUntil: string): number {
  const from = new Date(pausedFrom + 'T00:00:00Z').getTime()
  const until = new Date(pausedUntil + 'T00:00:00Z').getTime()
  return Math.floor((until - from) / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Addiert n Tage zu einem ISO-Date-String.
 */
function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Stabilere Arbitrary: generiere Tag-Offset von einem fixen Anker, statt
// fc.date() das in v4 manchmal Invalid Date emittiert.
const ANCHOR_MS = Date.UTC(2020, 0, 1)
const ONE_DAY_MS = 86_400_000
const MAX_DAYS = 16 * 365 // ~2020 → 2036

const dateArb = fc.integer({ min: 0, max: MAX_DAYS })
  .map(n => new Date(ANCHOR_MS + n * ONE_DAY_MS).toISOString().slice(0, 10))

describe('pause-extension — property-based', () => {
  test('pauseDays ist NIE negativ wenn until >= from', () => {
    fc.assert(fc.property(
      dateArb, dateArb,
      (a, b) => {
        const from = a < b ? a : b
        const until = a < b ? b : a
        return pauseDays(from, until) >= 1
      }
    ), { numRuns: 500 })
  })

  test('pauseDays ist ganzzahlig', () => {
    fc.assert(fc.property(
      dateArb, dateArb,
      (a, b) => {
        const from = a < b ? a : b
        const until = a < b ? b : a
        return Number.isInteger(pauseDays(from, until))
      }
    ), { numRuns: 500 })
  })

  test('Pause am gleichen Tag = 1 Tag', () => {
    fc.assert(fc.property(
      dateArb,
      (day) => pauseDays(day, day) === 1
    ), { numRuns: 100 })
  })

  test('Vertragsverlaengerung: contract_end + pauseDays funktioniert symmetrisch', () => {
    fc.assert(fc.property(
      dateArb, dateArb, dateArb,
      (contractEnd, pauseA, pauseB) => {
        const from = pauseA < pauseB ? pauseA : pauseB
        const until = pauseA < pauseB ? pauseB : pauseA
        const days = pauseDays(from, until)
        const newEnd = addDays(contractEnd, days)
        // Wenn wir die Verlaengerung wieder abziehen, sollten wir den
        // alten contract_end_date wieder bekommen
        return addDays(newEnd, -days) === contractEnd
      }
    ), { numRuns: 500 })
  })

  test('Bekanntes Beispiel: 7-Tage-Pause verlaengert um 7 Tage', () => {
    const days = pauseDays('2026-06-01', '2026-06-07')
    expect(days).toBe(7)
    expect(addDays('2026-12-31', days)).toBe('2027-01-07')
  })

  test('Schaltjahr: Pause ueber Februar funktioniert', () => {
    // 2024 ist Schaltjahr, 2026 nicht
    const days2024 = pauseDays('2024-02-01', '2024-03-01')  // 30 Tage (1.+...+29.+1.3.)
    const days2026 = pauseDays('2026-02-01', '2026-03-01')  // 29 Tage
    expect(days2024).toBe(30)
    expect(days2026).toBe(29)
  })

  test('Vertragsende ist immer >= alter Vertragsende', () => {
    fc.assert(fc.property(
      dateArb, dateArb, dateArb,
      (contractEnd, pauseA, pauseB) => {
        const from = pauseA < pauseB ? pauseA : pauseB
        const until = pauseA < pauseB ? pauseB : pauseA
        const newEnd = addDays(contractEnd, pauseDays(from, until))
        return newEnd >= contractEnd
      }
    ), { numRuns: 500 })
  })
})
