/**
 * AES-256-GCM Encryption für sensible Felder (DSGVO Art. 32).
 *
 * Verwendet `node:crypto` — läuft NUR in Node-Runtime (nicht Edge!).
 * API-Routes / Skripte müssen `export const runtime = 'nodejs'` setzen
 * (Default in Next.js 16, aber explizit besser).
 *
 * Format des Outputs:
 *   base64( iv (12B) || ciphertext (variable) || authTag (16B) )
 *
 * Key-Setup:
 *   Einmalig 32-byte Key generieren: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
 *   In `.env`: `IBAN_ENCRYPTION_KEY=<64-hex-Zeichen>`
 *
 * Falls Key rotiert: Spalte `bank_iban_enc` muss neu befüllt werden
 * (alter Ciphertext kann dann nicht mehr entschlüsselt werden).
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12      // GCM Standard: 12 Bytes
const AUTH_TAG_LENGTH = 16 // GCM Standard: 16 Bytes

/**
 * Lädt + validiert den 32-byte Key aus der Umgebung.
 * Wirft eine hilfreiche Error-Message falls fehlt oder falsches Format.
 */
function getKey(): Buffer {
  const hex = process.env.IBAN_ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      'IBAN_ENCRYPTION_KEY ist nicht gesetzt. ' +
      'Generiere einen mit: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" ' +
      'und setze ihn in der .env (lokal) bzw. Vercel Project Settings (prod).',
    )
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'IBAN_ENCRYPTION_KEY hat ungültiges Format — erwartet exakt 64 Hex-Zeichen (= 32 Bytes).',
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Verschlüsselt einen Plaintext-IBAN-String mit AES-256-GCM.
 *
 * @returns base64 von `iv || ciphertext || authTag`
 */
export function encryptIban(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptIban: plaintext muss ein nicht-leerer String sein')
  }
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, encrypted, authTag]).toString('base64')
}

/**
 * Entschlüsselt einen base64-string der von `encryptIban` produziert wurde.
 * Robust gegen null/undefined/leere Strings → returns null.
 *
 * Wirft NUR bei falschem Format oder authTag-Mismatch (= Manipulation oder
 * falscher Key). Saubere null-Inputs sind kein Fehler.
 */
export function decryptIban(encrypted: string | null | undefined): string | null {
  if (!encrypted || typeof encrypted !== 'string') return null

  const key = getKey()
  const buf = Buffer.from(encrypted, 'base64')

  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('decryptIban: Ciphertext zu kurz — ist das wirklich ein verschlüsselter Wert?')
  }

  const iv = buf.subarray(0, IV_LENGTH)
  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Liest die IBAN aus einem gym-Datensatz.
 *
 * Bevorzugt die verschlüsselte Spalte `bank_iban_enc` (entschlüsselt sie).
 * Fallback auf das alte `bank_iban` Plaintext-Feld solange Backfill läuft.
 *
 * Sobald alle Datensätze migriert sind, kann `bank_iban` aus der DB entfernt
 * werden — dann liefert dieser Helper immer noch die korrekte IBAN.
 */
export function getIbanFromGym(
  gym: { bank_iban_enc?: string | null; bank_iban?: string | null } | null | undefined,
): string | null {
  if (!gym) return null
  if (gym.bank_iban_enc) {
    try {
      return decryptIban(gym.bank_iban_enc)
    } catch {
      // Falls Entschlüsselung scheitert: lieber Plaintext-Fallback als 500-Fehler.
      // Das passiert nur wenn der Key rotiert wurde ohne Backfill.
      return gym.bank_iban ?? null
    }
  }
  return gym.bank_iban ?? null
}
