/**
 * Unit-Tests für `src/lib/encryption.ts`.
 *
 * AES-256-GCM Round-Trip-Tests + negative Pfade.
 * Failure hier = klartext-IBANs auf der Festplatte oder Daten-Verlust.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Mock-Key MUSS gesetzt sein bevor das Modul (über getKey()) den Schlüssel liest.
// Da getKey() bei jedem encrypt/decrypt-Call gerufen wird, reicht ein
// process.env.IBAN_ENCRYPTION_KEY = ... vor dem ersten Aufruf.
const MOCK_KEY = '0'.repeat(64)

beforeEach(() => {
  process.env.IBAN_ENCRYPTION_KEY = MOCK_KEY
})

// Lazy-Import damit wir process.env vor dem Modul-Eval nicht setzen müssen
// (das Modul liest den Key erst beim Aufruf, nicht beim Import — siehe getKey).
import { encryptIban, decryptIban, getIbanFromGym } from '@/lib/encryption'

// ── Round-Trip ───────────────────────────────────────────────────────────────
describe('encryptIban / decryptIban: Round-Trip', () => {
  it('verschlüsselt und entschlüsselt eine DE-IBAN', () => {
    const iban = 'DE89370400440532013000'
    const enc = encryptIban(iban)
    expect(decryptIban(enc)).toBe(iban)
  })

  it('round-trippt formattierte IBAN (mit Spaces)', () => {
    const iban = 'DE89 3704 0044 0532 0130 00'
    expect(decryptIban(encryptIban(iban))).toBe(iban)
  })

  it('round-trippt AT-IBAN', () => {
    const iban = 'AT611904300234573201'
    expect(decryptIban(encryptIban(iban))).toBe(iban)
  })

  it('round-trippt CH-IBAN', () => {
    const iban = 'CH9300762011623852957'
    expect(decryptIban(encryptIban(iban))).toBe(iban)
  })

  it('round-trippt einen kurzen String (kein IBAN-Format gefordert)', () => {
    expect(decryptIban(encryptIban('hi'))).toBe('hi')
  })

  it('round-trippt einen langen Unicode-String', () => {
    const s = 'IBAN: DE89 3704 — Kontoinhaber: Müller & Söhne GmbH ✉'
    expect(decryptIban(encryptIban(s))).toBe(s)
  })
})

// ── Nicht-Determinismus (random IV) ──────────────────────────────────────────
describe('encryptIban: liefert pro Aufruf anderes Ciphertext (random IV)', () => {
  it('zwei encrypt-Calls mit gleichem Plaintext ergeben unterschiedliche Ciphertexts', () => {
    const iban = 'DE89370400440532013000'
    const a = encryptIban(iban)
    const b = encryptIban(iban)
    expect(a).not.toBe(b)
    // Aber beide entschlüsseln zum gleichen Wert
    expect(decryptIban(a)).toBe(iban)
    expect(decryptIban(b)).toBe(iban)
  })

  it('produziert base64 (nur a-z, A-Z, 0-9, +, /, =)', () => {
    const enc = encryptIban('DE89370400440532013000')
    expect(enc).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('produziert mindestens IV (12B) + AuthTag (16B) + 1B Ciphertext = 29B → base64 >= 40 Zeichen', () => {
    const enc = encryptIban('a')
    const decoded = Buffer.from(enc, 'base64')
    expect(decoded.length).toBeGreaterThanOrEqual(12 + 16 + 1)
  })
})

// ── encryptIban: Fehler-Pfade ────────────────────────────────────────────────
describe('encryptIban: Input-Validierung', () => {
  it('throws bei leerem String', () => {
    expect(() => encryptIban('')).toThrow(/nicht-leer/i)
  })

  it('throws bei nicht-string Input', () => {
    // @ts-expect-error testet Runtime-Robustheit
    expect(() => encryptIban(null)).toThrow()
    // @ts-expect-error testet Runtime-Robustheit
    expect(() => encryptIban(undefined)).toThrow()
    // @ts-expect-error testet Runtime-Robustheit
    expect(() => encryptIban(123)).toThrow()
  })
})

// ── decryptIban: Fehler-Pfade ────────────────────────────────────────────────
describe('decryptIban: Input-Validierung & corruptes Ciphertext', () => {
  it('returns null für null', () => {
    expect(decryptIban(null)).toBeNull()
  })

  it('returns null für undefined', () => {
    expect(decryptIban(undefined)).toBeNull()
  })

  it('returns null für leeren String', () => {
    expect(decryptIban('')).toBeNull()
  })

  it('throws bei zu kurzem Ciphertext', () => {
    // 5 Bytes — nicht genug für IV (12) + AuthTag (16) + min 1B ct
    const tooShort = Buffer.from([1, 2, 3, 4, 5]).toString('base64')
    expect(() => decryptIban(tooShort)).toThrow(/zu kurz/i)
  })

  it('throws bei AuthTag-Mismatch (manipuliertes Ciphertext)', () => {
    const enc = encryptIban('DE89370400440532013000')
    // Letztes Byte flippen → AuthTag stimmt nicht mehr
    const buf = Buffer.from(enc, 'base64')
    buf[buf.length - 1] ^= 0xff
    const tampered = buf.toString('base64')
    expect(() => decryptIban(tampered)).toThrow()
  })

  it('throws bei AuthTag-Mismatch wenn das Ciphertext gewechselt wurde', () => {
    const enc = encryptIban('DE89370400440532013000')
    const buf = Buffer.from(enc, 'base64')
    // Mittleres Byte flippen → ändert ct → AuthTag stimmt nicht
    const middle = Math.floor(buf.length / 2)
    buf[middle] ^= 0xff
    const tampered = buf.toString('base64')
    expect(() => decryptIban(tampered)).toThrow()
  })

  it('throws bei komplett falschem base64 (Garbage)', () => {
    expect(() => decryptIban('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toThrow()
  })
})

// ── Key-Validierung ──────────────────────────────────────────────────────────
describe('Key-Validierung (über getKey via encryptIban)', () => {
  it('throws wenn Key nicht gesetzt ist', () => {
    delete process.env.IBAN_ENCRYPTION_KEY
    expect(() => encryptIban('DE89370400440532013000')).toThrow(/nicht gesetzt/i)
  })

  it('throws bei zu kurzem Key', () => {
    process.env.IBAN_ENCRYPTION_KEY = 'abc'
    expect(() => encryptIban('DE89370400440532013000')).toThrow(/64 Hex/i)
  })

  it('throws bei zu langem Key', () => {
    process.env.IBAN_ENCRYPTION_KEY = '0'.repeat(65)
    expect(() => encryptIban('DE89370400440532013000')).toThrow(/64 Hex/i)
  })

  it('throws bei nicht-Hex-Key', () => {
    process.env.IBAN_ENCRYPTION_KEY = 'z'.repeat(64)
    expect(() => encryptIban('DE89370400440532013000')).toThrow(/64 Hex/i)
  })

  it('akzeptiert lowercase 64-Hex-Key', () => {
    process.env.IBAN_ENCRYPTION_KEY = 'a'.repeat(64)
    expect(() => encryptIban('test')).not.toThrow()
  })

  it('akzeptiert uppercase 64-Hex-Key', () => {
    process.env.IBAN_ENCRYPTION_KEY = 'F'.repeat(64)
    expect(() => encryptIban('test')).not.toThrow()
  })

  it('akzeptiert mixed-case 64-Hex-Key', () => {
    process.env.IBAN_ENCRYPTION_KEY = 'aF'.repeat(32)
    expect(() => encryptIban('test')).not.toThrow()
  })

  it('decryptIban mit anderem Key als encrypt → throws', () => {
    process.env.IBAN_ENCRYPTION_KEY = 'a'.repeat(64)
    const enc = encryptIban('DE89370400440532013000')
    process.env.IBAN_ENCRYPTION_KEY = 'b'.repeat(64)
    expect(() => decryptIban(enc)).toThrow()
  })
})

// ── getIbanFromGym ───────────────────────────────────────────────────────────
// Die Library wurde DSGVO-fest umgebaut: bank_iban (Plaintext) wird IGNORIERT.
// Nur bank_iban_enc liefert eine IBAN. Korruption wirft (kein silent fallback).
describe('getIbanFromGym', () => {
  it('returns null für null/undefined gym', () => {
    expect(getIbanFromGym(null)).toBeNull()
    expect(getIbanFromGym(undefined)).toBeNull()
  })

  it('returns decrypted IBAN wenn bank_iban_enc gesetzt', () => {
    const iban = 'DE89370400440532013000'
    const enc = encryptIban(iban)
    expect(getIbanFromGym({ bank_iban_enc: enc })).toBe(iban)
  })

  it('IGNORIERT bank_iban (Plaintext) komplett — DSGVO Art. 32', () => {
    // Wichtig: kein Plaintext-Fallback. Wenn enc fehlt → null, egal was bank_iban sagt.
    expect(getIbanFromGym({ bank_iban: 'DE12345' })).toBeNull()
    expect(getIbanFromGym({ bank_iban_enc: null, bank_iban: 'DE12345' })).toBeNull()
  })

  it('returns enc-IBAN auch wenn bank_iban-Plaintext anders ist (enc gewinnt)', () => {
    const iban = 'DE89370400440532013000'
    const enc = encryptIban(iban)
    expect(getIbanFromGym({ bank_iban_enc: enc, bank_iban: 'OLD-PLAINTEXT' })).toBe(iban)
  })

  it('throws wenn Decryption fehlschlägt (Key-Rotation) — kein silent fallback', () => {
    const iban = 'DE89370400440532013000'
    const enc = encryptIban(iban)
    // Key wechseln → enc von oben kann nicht mehr decrypted werden
    process.env.IBAN_ENCRYPTION_KEY = 'b'.repeat(64)
    expect(() => getIbanFromGym({ bank_iban_enc: enc, bank_iban: 'plaintext' })).toThrow(
      /entschlüsselung.*fehlgeschlagen/i,
    )
  })

  it('returns null wenn beide Felder leer/null', () => {
    expect(getIbanFromGym({})).toBeNull()
    expect(getIbanFromGym({ bank_iban_enc: null, bank_iban: null })).toBeNull()
    expect(getIbanFromGym({ bank_iban_enc: '', bank_iban: '' })).toBeNull()
  })
})
