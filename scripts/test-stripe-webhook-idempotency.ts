#!/usr/bin/env npx tsx
/**
 * Stripe-Webhook-Idempotenz Smoke-Test
 *
 * Verifiziert, dass die UNIQUE-Constraint auf stripe_events.event_id
 * korrekt 23505 (unique_violation) wirft, wenn dasselbe Event 2× eingefügt wird.
 * Das ist die DB-Garantie hinter der Webhook-Route — ohne sie könnten
 * Stripe-Retries jede Side-Effect-Kette doppelt ausführen
 * (Subscription doppelt aktiv, Mail 2× gesendet, …).
 *
 * Benötigt (in .env.local oder als Umgebungsvariablen):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Verwendung:
 *   TEST_RUN=1 tsx scripts/test-stripe-webhook-idempotency.ts
 *
 * Exit-Codes:
 *   0  alle Assertions passiert
 *   1  Idempotenz-Verletzung oder Setup-Fehler
 *   2  ENV unvollständig (Test übersprungen)
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

// .env.local laden (falls vorhanden)
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const rawVal = trimmed.slice(eqIdx + 1).trim()
    const val = rawVal.replace(/^["']|["']$/g, '')
    if (key && val && !process.env[key]) process.env[key] = val
  }
}
loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!process.env.TEST_RUN) {
  console.error('Bitte mit TEST_RUN=1 ausführen, z.B.:')
  console.error('  TEST_RUN=1 tsx scripts/test-stripe-webhook-idempotency.ts')
  process.exit(2)
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlen — Test übersprungen.')
  process.exit(2)
}

const service = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Eindeutige Event-ID, damit parallele Test-Runs sich nicht stören.
const TEST_EVENT_ID = `test_idempotency_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const TEST_EVENT_TYPE = 'test.idempotency.synthetic'

let exitCode = 0
function ok(msg: string)   { console.log(`  ok  - ${msg}`) }
function fail(msg: string) { console.error(`  FAIL - ${msg}`); exitCode = 1 }

async function cleanup() {
  const { error } = await service.from('stripe_events').delete().eq('event_id', TEST_EVENT_ID)
  if (error) console.error('Cleanup-Warnung:', error.message)
}

async function main() {
  console.log(`\nStripe-Webhook-Idempotenz-Test`)
  console.log(`  event_id: ${TEST_EVENT_ID}\n`)

  // Vorher aufräumen, falls ein vorheriger Lauf abgebrochen ist
  await cleanup()

  // 1) Erster Insert sollte erfolgreich sein
  const { data: first, error: firstErr } = await service
    .from('stripe_events')
    .insert({ event_id: TEST_EVENT_ID, type: TEST_EVENT_TYPE })
    .select('id')
    .maybeSingle()

  if (firstErr) {
    fail(`Erster Insert fehlgeschlagen: ${firstErr.message} (code=${(firstErr as { code?: string }).code})`)
    await cleanup()
    process.exit(exitCode)
  }
  if (!first?.id) {
    fail('Erster Insert lieferte keine row zurück.')
    await cleanup()
    process.exit(exitCode)
  }
  ok(`Insert #1 erstellt (row.id=${first.id})`)

  // 2) Zweiter Insert mit gleicher event_id → unique_violation 23505
  const { error: secondErr } = await service
    .from('stripe_events')
    .insert({ event_id: TEST_EVENT_ID, type: TEST_EVENT_TYPE })
    .select('id')
    .maybeSingle()

  if (!secondErr) {
    fail('Insert #2 hat KEINEN Fehler geworfen — UNIQUE-Constraint fehlt oder greift nicht!')
  } else {
    const code = (secondErr as { code?: string }).code
    if (code === '23505') {
      ok(`Insert #2 wurde wie erwartet mit 23505 (unique_violation) abgelehnt`)
    } else {
      fail(`Insert #2 hat unerwarteten Fehler-Code geworfen: ${code} / ${secondErr.message}`)
    }
  }

  // 3) Verifizieren, dass nur EINE Zeile existiert
  const { data: rows, error: countErr } = await service
    .from('stripe_events')
    .select('id, event_id, type')
    .eq('event_id', TEST_EVENT_ID)
  if (countErr) {
    fail(`Read-back fehlgeschlagen: ${countErr.message}`)
  } else if (!rows || rows.length !== 1) {
    fail(`Erwarte genau 1 row, gefunden: ${rows?.length ?? 0}`)
  } else {
    ok(`Genau 1 row für event_id existiert (type=${rows[0].type})`)
  }

  await cleanup()
  ok('Cleanup ausgeführt')

  if (exitCode === 0) {
    console.log('\nAlle Idempotenz-Assertions passiert.\n')
  } else {
    console.error('\nIdempotenz-Test fehlgeschlagen — Webhook-Route ist nicht safe gegen Stripe-Retries!\n')
  }
  process.exit(exitCode)
}

main().catch(async err => {
  console.error('Unerwarteter Fehler:', err)
  await cleanup()
  process.exit(1)
})
