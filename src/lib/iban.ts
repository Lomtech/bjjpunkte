/**
 * Offline IBAN/BIC-Validation für DACH-Markt.
 *
 * Keine externe API, keine Netzwerk-Calls. Nur Format-Check + Mod-97-Prüfziffer
 * gemäß ISO 13616. Funktioniert in Edge-Runtime + Node-Runtime gleichermaßen.
 *
 * Was geprüft wird:
 *  ✓ Länge je Land (DE=22, AT=20, CH=21, LI=21, LU=20, ...)
 *  ✓ Format (Land-Code + Prüfziffer + BBAN)
 *  ✓ Mod-97 Prüfsumme
 *
 * Was NICHT geprüft wird:
 *  ✗ Existiert das Konto wirklich? (geht nur via Bank-API gegen Gebühr)
 *  ✗ Ist Konto gedeckt? (nur beim ersten Einzug feststellbar)
 *
 * → Für CSV-Import-Validation reicht das. Echte Existenz-Prüfung passiert
 *   sowieso erst beim Stripe-SEPA-Mandat-Setup.
 */

// IBAN-Längen pro Land (ISO 13616 Registry, DACH + EU-Major)
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22,
  BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
  GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26,
  IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
  LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18,
  NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24,
  SC: 31, SE: 24, SI: 19, SK: 24, SM: 27, ST: 25, SV: 28, TL: 23, TN: 24,
  TR: 26, UA: 29, VG: 24, XK: 20,
}

export type IbanCheckResult =
  | { valid: true; country: string; formatted: string }
  | { valid: false; reason: string }

/**
 * Bereinigt + validiert eine IBAN. Whitespace und Bindestriche werden ignoriert.
 */
export function validateIBAN(input: string): IbanCheckResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, reason: 'IBAN fehlt oder ist kein Text' }
  }

  // Normalisierung: Whitespace + Bindestriche raus, Großbuchstaben
  const cleaned = input.replace(/[\s-]/g, '').toUpperCase()

  // Grobes Format
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(cleaned)) {
    return { valid: false, reason: 'Format ungültig (erwartet: 2 Buchstaben, 2 Ziffern, dann alphanumerisch)' }
  }

  const country = cleaned.slice(0, 2)
  const expectedLength = IBAN_LENGTHS[country]
  if (!expectedLength) {
    return { valid: false, reason: `Unbekanntes Länder-Kürzel "${country}"` }
  }

  if (cleaned.length !== expectedLength) {
    return {
      valid: false,
      reason: `Falsche Länge für ${country} — erwartet ${expectedLength} Zeichen, hat ${cleaned.length}`,
    }
  }

  // Mod-97 Prüfsumme nach ISO 13616
  // 1. Erste 4 Zeichen ans Ende verschieben
  // 2. Buchstaben in Zahlen umwandeln (A=10, B=11, ..., Z=35)
  // 3. Resultat mod 97 muss == 1 sein
  const reordered = cleaned.slice(4) + cleaned.slice(0, 4)
  let numericString = ''
  for (const ch of reordered) {
    const code = ch.charCodeAt(0)
    numericString += code >= 65 && code <= 90 ? String(code - 55) : ch
  }

  // Mod-97 für sehr lange Zahlen (kann nicht in JS-Number gerechnet werden)
  let remainder = 0
  for (const digit of numericString) {
    remainder = (remainder * 10 + Number(digit)) % 97
  }

  if (remainder !== 1) {
    return { valid: false, reason: 'Prüfsumme ungültig (möglicher Tippfehler)' }
  }

  // Schöne Formatierung mit Vierergruppen
  const formatted = cleaned.match(/.{1,4}/g)?.join(' ') ?? cleaned
  return { valid: true, country, formatted }
}

/**
 * Vereinfachter Boolean-Wrapper für Form-Validation.
 */
export function isValidIBAN(input: string): boolean {
  return validateIBAN(input).valid
}

/**
 * Prüft mehrere IBANs auf einmal — für CSV-Bulk-Import.
 */
export interface BulkIbanRow {
  index: number      // Zeilennummer in der CSV (für UX-Anzeige)
  raw: string        // Original-Wert
  result: IbanCheckResult
}

export function validateIBANs(rows: { iban: string; index: number }[]): BulkIbanRow[] {
  return rows.map(r => ({
    index: r.index,
    raw: r.iban,
    result: validateIBAN(r.iban),
  }))
}
