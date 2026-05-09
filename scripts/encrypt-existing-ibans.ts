/**
 * Backfill-Skript: verschlüsselt alle Plaintext-IBANs in `gyms.bank_iban`
 * und schreibt das Ergebnis in `gyms.bank_iban_enc`.
 *
 * Idempotent: läuft nur über Zeilen wo `bank_iban_enc IS NULL` und `bank_iban`
 * gesetzt ist. Schon verschlüsselte Datensätze werden übersprungen. Nach
 * erfolgreicher Verschlüsselung wird `bank_iban` auf NULL gesetzt damit kein
 * Plaintext-Rest in der DB liegt.
 *
 * **Lebensende dieses Skripts**: nur relevant solange die Klartext-Spalte
 * `bank_iban` in der DB existiert. Sobald migration 0010 applyed ist, ist die
 * Spalte weg und dieses Skript wirft Postgres-Fehler. Der Workflow ist:
 *   1. Skript laufen lassen (verschlüsselt, was zu verschlüsseln ist)
 *   2. `scripts/check-iban-migration.ts` muss "OK" zurückgeben
 *   3. migration 0010 applyen
 *   4. Skript kann gelöscht werden (oder als Notfall-Tool für DB-Restores stehen bleiben)
 *
 * **Achtung Type-Bypass**: `bank_iban` ist NICHT mehr in `Database`-Types,
 * weil der Code-Pfad post-migration aussieht. Hier brauchen wir die Spalte
 * trotzdem — also any-Cast. Vor Apply der Migration ist das in der DB safe.
 *
 * Voraussetzungen:
 *  - ENV: `IBAN_ENCRYPTION_KEY` (32-byte hex, gleich wie in der App)
 *  - ENV: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
 *
 * Aufruf:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/encrypt-existing-ibans.ts
 *
 * Dry-Run (zeigt nur was passieren würde):
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/encrypt-existing-ibans.ts --dry
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'
import { encryptIban } from '../src/lib/encryption'

const DRY_RUN = process.argv.includes('--dry')

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein. ' +
      'Tipp: `npx dotenv-cli -e .env.local -- npx tsx scripts/encrypt-existing-ibans.ts`',
    )
  }
  // Wirft sofort wenn IBAN_ENCRYPTION_KEY fehlt — besser jetzt als nach
  // dem ersten DB-Read.
  encryptIban('DE89370400440532013000')

  const supabase = createClient<Database>(url, key)

  // Alle Gyms mit Plaintext-IBAN ohne verschlüsselte Version.
  // bank_iban ist nicht mehr im Database-Type → any-Cast (siehe File-Header).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (supabase.from('gyms') as any)
    .select('id, bank_iban, bank_iban_enc')
    .is('bank_iban_enc', null)
    .not('bank_iban', 'is', null)

  if (error) {
    console.error('SELECT fehlgeschlagen:', error.message)
    process.exit(1)
  }

  type LegacyRow = { id: string; bank_iban: string | null; bank_iban_enc: string | null }
  const candidates = ((rows ?? []) as LegacyRow[]).filter((r) => {
    const v = r.bank_iban?.trim()
    return v && v.length > 0
  })

  console.log(`Gefunden: ${candidates.length} Gyms mit Plaintext-IBAN ohne Encryption.`)

  if (DRY_RUN) {
    for (const r of candidates) {
      console.log(`  [dry] gym=${r.id} iban-prefix=${r.bank_iban?.slice(0, 6)}…`)
    }
    console.log('Dry-Run beendet — keine Änderungen geschrieben.')
    return
  }

  let ok = 0
  let fail = 0

  for (const r of candidates) {
    const plaintext = (r.bank_iban ?? '').replace(/[\s-]/g, '').toUpperCase()
    if (!plaintext) {
      fail++
      continue
    }
    try {
      const ciphertext = encryptIban(plaintext)
      // Plaintext-Spalte gleichzeitig auf null setzen → kein Rest mehr.
      // bank_iban ist nicht mehr im Database-Type → any-Cast für die UPDATE-Payload.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upErr } = await (supabase.from('gyms') as any)
        .update({ bank_iban_enc: ciphertext, bank_iban: null })
        .eq('id', r.id)
      if (upErr) {
        console.error(`  FEHLER gym=${r.id}: ${upErr.message}`)
        fail++
      } else {
        ok++
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  FEHLER gym=${r.id}: ${msg}`)
      fail++
    }
  }

  console.log(`Fertig. Verschlüsselt: ${ok}, Fehler: ${fail}`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error('Backfill abgebrochen:', e)
  process.exit(1)
})
