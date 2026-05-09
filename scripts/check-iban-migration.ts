/**
 * Pre-flight-Check für `supabase/migrations/0010_drop_legacy_bank_iban.sql`.
 *
 * Was prüft das Skript?
 *   Existiert noch ein Datensatz mit bank_iban (Klartext) gesetzt
 *   ABER bank_iban_enc IS NULL? Wenn ja, würde der DROP COLUMN dauerhaft
 *   IBAN-Daten verlieren.
 *
 * Exit-Codes:
 *   0  → safe to apply migration (keine unverschlüsselten IBANs mehr).
 *   1  → BLOCKER. Erst `scripts/encrypt-existing-ibans.ts` laufen lassen.
 *   2  → Skript-Fehler (Env, DB-Verbindung, …).
 *
 * Aufruf:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/check-iban-migration.ts
 *
 * Voraussetzungen (ENV):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY  (RLS-Bypass nötig, da `gyms` per Owner gefiltert ist)
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error(
      'NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein. ' +
      'Tipp: `npx dotenv-cli -e .env.local -- npx tsx scripts/check-iban-migration.ts`',
    )
    process.exit(2)
  }

  const supabase = createClient<Database>(url, key)

  // SELECT id, bank_iban-Prefix für Logging.
  // bank_iban (Klartext) lebt noch als Spalte in der DB — die DB-Typen weisen
  // sie aber dank dieser Task nicht mehr aus. Daher: any-Cast für die Query.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('gyms') as any)
    .select('id, bank_iban')
    .is('bank_iban_enc', null)
    .not('bank_iban', 'is', null)

  if (error) {
    console.error('SELECT fehlgeschlagen:', error.message)
    process.exit(2)
  }

  // Edge case: bank_iban kann mit Whitespace gefüllt sein → real auch leer.
  type Row = { id: string; bank_iban: string | null }
  const rows = (data ?? []) as Row[]
  const blocking = rows.filter((r) => {
    const v = (r.bank_iban ?? '').trim()
    return v.length > 0
  })

  if (blocking.length === 0) {
    console.log('OK — keine unverschlüsselten IBANs mehr. Migration 0010 ist safe.')
    process.exit(0)
  }

  console.error(
    `BLOCKER: ${blocking.length} gym(s) haben bank_iban (Klartext) ohne bank_iban_enc.`,
  )
  console.error('Diese würden beim DROP COLUMN dauerhaft verloren gehen:')
  for (const r of blocking) {
    console.error(`  gym=${r.id}`)
  }
  console.error('')
  console.error('Bevor du die Migration applyst:')
  console.error('  1) npx dotenv-cli -e .env.local -- npx tsx scripts/encrypt-existing-ibans.ts --dry')
  console.error('  2) Output prüfen.')
  console.error('  3) Ohne --dry erneut laufen lassen.')
  console.error('  4) Diesen Check nochmal ausführen — muss "OK" zurückgeben.')
  process.exit(1)
}

main().catch((e) => {
  console.error('Pre-flight abgebrochen:', e)
  process.exit(2)
})
