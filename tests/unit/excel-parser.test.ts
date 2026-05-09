/**
 * Unit-Tests für `src/lib/excel-parser.ts`.
 *
 * Diese Funktionen entscheiden, welche Geburtsdaten/Adressen/Beiträge in
 * die DB landen — ein Bug hier verschickt falsche Mahnungen, falsche
 * Lastschrift-Beträge oder verfälscht 90k+ Datensätze. Coverage muss
 * dicht sein.
 */

import { describe, it, expect } from 'vitest'

import {
  parseDate,
  parseFeeToCents,
  parseStripes,
  parseEmail,
} from '@/lib/excel-parser'

// ── parseDate ────────────────────────────────────────────────────────────────
describe('parseDate', () => {
  describe('ISO format', () => {
    it('akzeptiert YYYY-MM-DD', () => {
      expect(parseDate('2024-01-15')).toBe('2024-01-15')
    })

    it('akzeptiert YYYY/MM/DD', () => {
      expect(parseDate('2024/01/15')).toBe('2024-01-15')
    })

    it('paddet einstellige Monate/Tage', () => {
      expect(parseDate('2024-1-5')).toBe('2024-01-05')
    })
  })

  describe('Deutsches Format', () => {
    it('akzeptiert DD.MM.YYYY', () => {
      expect(parseDate('15.01.2024')).toBe('2024-01-15')
    })

    it('akzeptiert DD-MM-YYYY (Excel-Style)', () => {
      expect(parseDate('15-01-2024')).toBe('2024-01-15')
    })

    it('akzeptiert DD/MM/YYYY', () => {
      expect(parseDate('15/01/2024')).toBe('2024-01-15')
    })

    it('paddet einstellige Tage und Monate', () => {
      expect(parseDate('5.1.2024')).toBe('2024-01-05')
    })
  })

  describe('Zwei-stelliges Jahr (Pivot 50)', () => {
    it('mappt < 50 auf 20xx', () => {
      expect(parseDate('15.01.20')).toBe('2020-01-15')
    })

    it('mappt < 50 auf 20xx (auch 49)', () => {
      expect(parseDate('15.01.49')).toBe('2049-01-15')
    })

    it('mappt >= 50 auf 19xx', () => {
      expect(parseDate('15.01.65')).toBe('1965-01-15')
    })

    it('mappt 99 auf 1999', () => {
      expect(parseDate('15.01.99')).toBe('1999-01-15')
    })

    it('mappt 50 auf 1950 (Grenze inklusiv)', () => {
      expect(parseDate('15.01.50')).toBe('1950-01-15')
    })
  })

  describe('Edge-Cases', () => {
    it('returns null für leeren String', () => {
      expect(parseDate('')).toBeNull()
    })

    it('returns null für nur Whitespace', () => {
      expect(parseDate('   ')).toBeNull()
    })

    it('returns null für Garbage', () => {
      expect(parseDate('not-a-date')).toBeNull()
      expect(parseDate('garbage')).toBeNull()
      expect(parseDate('15')).toBeNull()
    })

    it('returns null für ungültige Tage (Feb 30)', () => {
      expect(parseDate('30.02.2024')).toBeNull()
      expect(parseDate('2024-02-30')).toBeNull()
    })

    it('returns null für Tag 32', () => {
      expect(parseDate('32.01.2024')).toBeNull()
    })

    it('returns null für Monat 13', () => {
      expect(parseDate('15.13.2024')).toBeNull()
    })

    it('returns null für Jahr außerhalb 1900-2100', () => {
      expect(parseDate('15.01.1899')).toBeNull()
      expect(parseDate('15.01.2101')).toBeNull()
    })

    it('akzeptiert Schalttag (29.02.2024)', () => {
      expect(parseDate('29.02.2024')).toBe('2024-02-29')
    })

    it('lehnt 29.02 in Nicht-Schaltjahren ab', () => {
      expect(parseDate('29.02.2023')).toBeNull()
    })

    it('trimmt Whitespace', () => {
      expect(parseDate('  15.01.2024  ')).toBe('2024-01-15')
    })
  })
})

// ── parseFeeToCents ──────────────────────────────────────────────────────────
describe('parseFeeToCents', () => {
  describe('Deutsches Format', () => {
    it('parst "89,50" → 8950', () => {
      expect(parseFeeToCents('89,50')).toBe(8950)
    })

    it('parst "1.234,56" → 123456', () => {
      expect(parseFeeToCents('1.234,56')).toBe(123456)
    })

    it('parst "1.234.567,89" → 123456789', () => {
      expect(parseFeeToCents('1.234.567,89')).toBe(123456789)
    })

    it('parst "89,5" → 8950 (nur 1 Nachkomma)', () => {
      expect(parseFeeToCents('89,5')).toBe(8950)
    })
  })

  describe('Englisches Format', () => {
    it('parst "89.50" → 8950', () => {
      expect(parseFeeToCents('89.50')).toBe(8950)
    })

    it('parst "1,234.56" → 123456', () => {
      expect(parseFeeToCents('1,234.56')).toBe(123456)
    })
  })

  describe('Nur-Punkt als Tausender-Separator (DE-Excel-Bug)', () => {
    it('parst "1.234" → 123400 — heute gefixter Bug', () => {
      // Wenn nur ein Punkt da ist und NICHT genau 2 Stellen folgen,
      // ist es ein Tausender-Separator (German Excel ohne Decimal-Spalte).
      expect(parseFeeToCents('1.234')).toBe(123400)
    })

    it('parst "1.000.000" → 100000000', () => {
      expect(parseFeeToCents('1.000.000')).toBe(100000000)
    })

    it('parst "89.5" → 8950 (1 Nachkomma → trotzdem decimal)', () => {
      // Die Heuristik ist: tail length === 2 → decimal.
      // tail length 1 → kein decimal. Beide Interpretationen sind defensiv.
      // 89.5 mit tailLen=1 → Punkt entfernen → 895 → 89500 cents.
      expect(parseFeeToCents('89.5')).toBe(89500)
    })
  })

  describe('Mit Symbolen / Whitespace', () => {
    it('parst "89,00 €" → 8900', () => {
      expect(parseFeeToCents('89,00 €')).toBe(8900)
    })

    it('parst "EUR 89.50" → 8950', () => {
      expect(parseFeeToCents('EUR 89.50')).toBe(8950)
    })

    it('parst "€ 1.234,56" → 123456', () => {
      expect(parseFeeToCents('€ 1.234,56')).toBe(123456)
    })

    it('parst "  89,00  " → 8900 (Whitespace)', () => {
      expect(parseFeeToCents('  89,00  ')).toBe(8900)
    })
  })

  describe('Edge-Cases', () => {
    it('returns null für leeren String', () => {
      expect(parseFeeToCents('')).toBeNull()
    })

    it('returns null für Garbage', () => {
      expect(parseFeeToCents('abc')).toBeNull()
      expect(parseFeeToCents('not-a-number')).toBeNull()
    })

    it('returns null für ASCII-Minus "-5"', () => {
      expect(parseFeeToCents('-5')).toBeNull()
    })

    it('returns null für Unicode-Minus "−5" (U+2212) — Bug-Fix', () => {
      // Vor dem Fix: U+2212 wurde gestrippt → "5" → 500 cents.
      // Das ist eine silent corruption: Negativbeträge würden positiv landen.
      // Nach dem Fix erkennt die Library auch Unicode-Minus und gibt null.
      expect(parseFeeToCents('−5')).toBeNull()
    })

    it('returns null für En-Dash "–5" (U+2013)', () => {
      expect(parseFeeToCents('–5')).toBeNull()
    })

    it('returns null für Em-Dash "—5" (U+2014)', () => {
      expect(parseFeeToCents('—5')).toBeNull()
    })

    it('parst "0" → 0', () => {
      expect(parseFeeToCents('0')).toBe(0)
    })

    it('parst "0,00" → 0', () => {
      expect(parseFeeToCents('0,00')).toBe(0)
    })

    it('parst "89" (ohne Nachkomma) → 8900', () => {
      expect(parseFeeToCents('89')).toBe(8900)
    })
  })
})

// ── parseStripes ─────────────────────────────────────────────────────────────
describe('parseStripes', () => {
  it('parst "0" → 0', () => {
    expect(parseStripes('0')).toBe(0)
  })

  it('parst "4" → 4 (Maximum)', () => {
    expect(parseStripes('4')).toBe(4)
  })

  it('parst "5" → 4 (über Maximum geclippt)', () => {
    expect(parseStripes('5')).toBe(4)
  })

  it('parst "10" → 4 (geclippt)', () => {
    expect(parseStripes('10')).toBe(4)
  })

  it('parst "-1" → 0 (unter 0 geclippt)', () => {
    expect(parseStripes('-1')).toBe(0)
  })

  it('parst "abc" → 0 (NaN-Fallback)', () => {
    expect(parseStripes('abc')).toBe(0)
  })

  it('parst "" → 0', () => {
    expect(parseStripes('')).toBe(0)
  })

  it('parst "2" → 2', () => {
    expect(parseStripes('2')).toBe(2)
  })

  it('trimt Whitespace', () => {
    expect(parseStripes('  3  ')).toBe(3)
  })
})

// ── parseEmail ───────────────────────────────────────────────────────────────
describe('parseEmail', () => {
  it('akzeptiert "foo@bar.de" → "foo@bar.de"', () => {
    expect(parseEmail('foo@bar.de')).toBe('foo@bar.de')
  })

  it('lowercased "FOO@BAR.DE" → "foo@bar.de"', () => {
    expect(parseEmail('FOO@BAR.DE')).toBe('foo@bar.de')
  })

  it('returns null für "invalid" (kein @)', () => {
    expect(parseEmail('invalid')).toBeNull()
  })

  it('returns null für leeren String', () => {
    expect(parseEmail('')).toBeNull()
  })

  it('returns null für nur Whitespace', () => {
    expect(parseEmail('   ')).toBeNull()
  })

  it('returns null für "@bar.de" (kein local part)', () => {
    expect(parseEmail('@bar.de')).toBeNull()
  })

  it('returns null für "foo@" (kein domain)', () => {
    expect(parseEmail('foo@')).toBeNull()
  })

  it('returns null für "foo@bar" (kein TLD)', () => {
    expect(parseEmail('foo@bar')).toBeNull()
  })

  it('trimt Whitespace', () => {
    expect(parseEmail('  foo@bar.de  ')).toBe('foo@bar.de')
  })

  it('akzeptiert Plus-Adressen', () => {
    expect(parseEmail('foo+tag@bar.de')).toBe('foo+tag@bar.de')
  })

  it('akzeptiert Subdomains', () => {
    expect(parseEmail('foo@mail.bar.de')).toBe('foo@mail.bar.de')
  })
})
