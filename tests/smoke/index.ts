#!/usr/bin/env npx tsx
/**
 * Smoke-Test Master-Runner
 *
 * Führt alle Smoke-Tests sequentiell aus. Stil orientiert sich an
 * `tests/osss-test.ts` (Header, Counter, Exit-Code).
 *
 * Verwendung:
 *   npm run test:smoke           → gegen TEST_API_BASE oder default https://www.osss.pro
 *   npm run test:smoke:prod      → explizit gegen https://www.osss.pro
 *
 * Optionale ENV-Vars:
 *   TEST_API_BASE                   API-Base-URL (default https://www.osss.pro)
 *   TEST_GYM_SLUG                   Gym-Slug für Public-Tests (default cscffb)
 *   TEST_OWNER_EMAIL                Supabase-Owner-Email (für Auth-Tests)
 *   TEST_OWNER_PASSWORD             Supabase-Owner-Password (für Auth-Tests)
 *   TEST_MEMBER_ID                  Member-UUID für PDF/Dunning-Tests
 *   TEST_CRON_SECRET                Cron-Bearer-Secret für Cron-Endpoint (Auth-Test)
 *   TEST_CRON_TRIGGER_ALLOWED=1     Opt-in: erlaubt 200-Trigger-Aufruf (gefährlich!)
 */

import {
  c,
  counter,
  getApiBase,
  getAuthToken,
  getMemberIdForTests,
  getTestSlug,
} from './helpers'
import { runBulkMailTests } from './bulk-mail.test'
import { runCronTests } from './cron.test'
import { runDunningTests } from './dunning.test'
import { runPdfExportTests } from './pdf-export.test'
import { runPortalHardeningTests } from './portal-hardening.test'
import { runSalesPipelineTests } from './sales-pipeline.test'
import { runTrialBookingTests } from './trial-booking.test'
import { runWellpassOnboardingTests } from './wellpass-onboarding.test'

async function main() {
  const start = Date.now()

  console.log(c.bold(`\n  Osss Smoke-Tests`))
  console.log(c.dim(`  API-Base:    ${getApiBase()}`))
  console.log(c.dim(`  Gym-Slug:    ${getTestSlug()}`))

  const token = await getAuthToken()
  console.log(c.dim(`  Auth:        ${token ? 'OK (Bearer-Token geholt)' : 'kein Token (Auth-Tests werden geskippt)'}`))
  console.log(c.dim(`  Member-ID:   ${getMemberIdForTests() ?? '(nicht gesetzt — PDF-Auth-Tests werden geskippt)'}`))
  console.log(c.dim(`  Start:       ${new Date().toLocaleString('de-DE')}\n`))

  // Sequenziell ausführen (Tests sind unabhängig, aber Output bleibt linear)
  await runWellpassOnboardingTests()
  await runTrialBookingTests()
  await runPdfExportTests()
  await runBulkMailTests()
  await runDunningTests()
  await runCronTests()
  await runSalesPipelineTests()
  await runPortalHardeningTests()

  // ── Final Summary ──────────────────────────────────────────────────────────
  const passed  = counter.entries.filter(e => e.status === 'pass').length
  const failed  = counter.entries.filter(e => e.status === 'fail').length
  const skipped = counter.entries.filter(e => e.status === 'skip').length
  const totalMs = Date.now() - start

  console.log('\n' + c.dim('  ' + '─'.repeat(60)))
  console.log(
    `  ${c.bold('Ergebnis:')}  ` +
    c.green(`${passed} passed`) +
    `  ${failed > 0 ? c.red(`${failed} failed`) : c.dim('0 failed')}` +
    `  ${skipped > 0 ? c.yellow(`${skipped} skipped`) : c.dim('0 skipped')}` +
    c.dim(`   (${(totalMs / 1000).toFixed(1)}s)`)
  )

  if (failed > 0) {
    console.log(c.bold(c.red('\n  Fehlgeschlagene Tests:')))
    for (const e of counter.entries.filter(x => x.status === 'fail')) {
      console.log(`  ${c.red('✗')} ${e.name}`)
      if (e.error) console.log(`    ${c.dim(e.error)}`)
    }
    console.log()
    process.exit(1)
  }

  console.log(c.green(`\n  Alle ${passed} Tests bestanden${skipped > 0 ? ` (${skipped} skipped)` : ''}.\n`))
  process.exit(0)
}

main().catch(err => {
  console.error(c.red(`\n  Fatal: ${err instanceof Error ? err.message : String(err)}\n`))
  if (err instanceof Error && err.stack) console.error(c.dim(err.stack))
  process.exit(1)
})
