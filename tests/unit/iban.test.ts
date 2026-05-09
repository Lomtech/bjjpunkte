/**
 * Unit-Tests für `src/lib/iban.ts`.
 *
 * Falsche IBAN auf einer Lastschrift = Geld geht an die falsche Bank.
 * Wir testen Mod-97-Prüfsumme, Längen-Checks, Whitespace-Robustheit.
 */

import { describe, it, expect } from 'vitest'

import { validateIBAN, isValidIBAN } from '@/lib/iban'

// ── validateIBAN — Happy Path ────────────────────────────────────────────────
describe('validateIBAN: gültige IBANs', () => {
  it('akzeptiert kanonische DE-IBAN (mit Spaces)', () => {
    const r = validateIBAN('DE89 3704 0044 0532 0130 00')
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.country).toBe('DE')
      expect(r.formatted).toBe('DE89 3704 0044 0532 0130 00')
    }
  })

  it('akzeptiert dieselbe IBAN ohne Spaces', () => {
    const r = validateIBAN('DE89370400440532013000')
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.country).toBe('DE')
      expect(r.formatted).toBe('DE89 3704 0044 0532 0130 00')
    }
  })

  it('akzeptiert lowercase IBAN nach Normalisierung', () => {
    const r = validateIBAN('de89370400440532013000')
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.country).toBe('DE')
    }
  })

  it('akzeptiert mixed-case IBAN', () => {
    const r = validateIBAN('De89 3704 0044 0532 0130 00')
    expect(r.valid).toBe(true)
  })

  it('akzeptiert IBAN mit Bindestrichen', () => {
    const r = validateIBAN('DE89-3704-0044-0532-0130-00')
    expect(r.valid).toBe(true)
  })

  it('akzeptiert AT-IBAN (20 Zeichen)', () => {
    // GIRO Online Validator-getestet: AT 611904300234573201 ist valide
    const r = validateIBAN('AT611904300234573201')
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.country).toBe('AT')
    }
  })

  it('akzeptiert CH-IBAN (21 Zeichen)', () => {
    const r = validateIBAN('CH9300762011623852957')
    expect(r.valid).toBe(true)
    if (r.valid) {
      expect(r.country).toBe('CH')
    }
  })
})

// ── validateIBAN — Fehler-Pfade ──────────────────────────────────────────────
describe('validateIBAN: ungültige IBANs', () => {
  it('lehnt leeren String ab', () => {
    const r = validateIBAN('')
    expect(r.valid).toBe(false)
  })

  it('lehnt null-artige Inputs ab', () => {
    // @ts-expect-error testet Runtime-Robustheit
    expect(validateIBAN(null).valid).toBe(false)
    // @ts-expect-error testet Runtime-Robustheit
    expect(validateIBAN(undefined).valid).toBe(false)
  })

  it('lehnt ungültige Prüfziffer ab (DE99...)', () => {
    // Letzte Ziffer geändert → bricht Mod-97
    const r = validateIBAN('DE89370400440532013001')
    expect(r.valid).toBe(false)
    if (!r.valid) {
      expect(r.reason).toMatch(/prüfsumme/i)
    }
  })

  it('lehnt zu kurze IBAN ab', () => {
    const r = validateIBAN('DE893704004405320130')
    expect(r.valid).toBe(false)
    if (!r.valid) {
      expect(r.reason).toMatch(/länge|format/i)
    }
  })

  it('lehnt zu lange IBAN ab', () => {
    const r = validateIBAN('DE893704004405320130001234')
    expect(r.valid).toBe(false)
  })

  it('lehnt unbekanntes Länder-Kürzel ab', () => {
    // ZZ ist nicht im Registry. Länge 22 (DE-Länge), Mod-97-konform ist
    // hier irrelevant — wir wollen die "unknown country" Branch testen.
    const r = validateIBAN('ZZ89370400440532013000')
    expect(r.valid).toBe(false)
    if (!r.valid) {
      expect(r.reason).toMatch(/länder|kürzel|unknown/i)
    }
  })

  it('lehnt Sonderzeichen im Alphanumeric-Teil ab', () => {
    const r = validateIBAN('DE89!704004405320130 00')
    expect(r.valid).toBe(false)
  })

  it('lehnt Format ohne Länder-Code ab', () => {
    const r = validateIBAN('1234567890123456789012')
    expect(r.valid).toBe(false)
  })

  it('lehnt Garbage ab', () => {
    expect(validateIBAN('not-an-iban').valid).toBe(false)
    expect(validateIBAN('XXXX').valid).toBe(false)
  })

  it('toleriert beliebigen Whitespace', () => {
    const r = validateIBAN('DE89  3704  0044  0532  0130  00')
    expect(r.valid).toBe(true)
  })

  it('toleriert Tabs und Newlines', () => {
    const r = validateIBAN('DE89\t3704\n0044 0532 0130 00')
    expect(r.valid).toBe(true)
  })
})

// ── isValidIBAN — Boolean-Wrapper ────────────────────────────────────────────
describe('isValidIBAN', () => {
  it('returns true für gültige IBAN', () => {
    expect(isValidIBAN('DE89 3704 0044 0532 0130 00')).toBe(true)
  })

  it('returns false für ungültige IBAN', () => {
    expect(isValidIBAN('DE89 3704 0044 0532 0130 01')).toBe(false)
  })

  it('returns false für leeren String', () => {
    expect(isValidIBAN('')).toBe(false)
  })
})
