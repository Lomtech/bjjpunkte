/**
 * Smoke-Test: Cron-Endpoints (Inkasso-Eskalation)
 *
 * Endpoints:
 *   GET /api/cron/dunning-escalation    — Auto-Eskalation L1→L2 / L2→L3
 *
 * Auth: Bearer ${CRON_SECRET} (cronGuard).
 *
 * GEFAHR:
 *   Ein erfolgreicher Aufruf gegen Production löst echte Mahn-Eskalationen
 *   inkl. Mail-Versand aus. Daher:
 *
 *   - Default: NUR Auth-Tests (kein-Token / falscher-Token → 401).
 *   - Opt-in: Setze TEST_CRON_TRIGGER_ALLOWED=1, um den 200-Aufruf zu testen.
 *     Idempotenz: 2× kurz hintereinander → 1. Aufruf normal, 2. Aufruf
 *     {skipped: true} (UNIQUE constraint cron_runs).
 */

import {
  api,
  assert,
  runTest,
  section,
  skip,
} from './helpers'

interface CronResponse {
  ok?: boolean
  date?: string
  escalated_to_level_2?: number
  escalated_to_level_3?: number
  errors?: string[]
  skipped?: boolean
  reason?: string
  error?: string
}

// Inline-Helper (helpers.ts wird parallel von anderem Agent gepflegt).
function getCronSecret(): string | null {
  const v = process.env.TEST_CRON_SECRET
  return v && v.length >= 16 ? v : null
}

function isTriggerAllowed(): boolean {
  return process.env.TEST_CRON_TRIGGER_ALLOWED === '1'
}

export async function runCronTests() {
  section('Cron / Dunning-Escalation')

  // ── a) Ohne Auth → 401 (oder 403, akzeptiere beide) ───────────────────────
  await runTest('GET /cron/dunning-escalation ohne Auth → 401/403', async () => {
    const { status } = await api<CronResponse>('/api/cron/dunning-escalation')
    assert(status === 401 || status === 403,
      `Erwartet 401/403 ohne Auth, bekam ${status}`)
  })

  // ── c) Mit falschem Bearer → 401/403 ──────────────────────────────────────
  await runTest('GET /cron/dunning-escalation mit falschem Bearer → 401/403', async () => {
    const { status } = await api<CronResponse>('/api/cron/dunning-escalation', {
      headers: { Authorization: 'Bearer wrong-secret-with-min-16-chars' },
    })
    assert(status === 401 || status === 403,
      `Erwartet 401/403 bei falschem Bearer, bekam ${status}`)
  })

  // ── b) Mit gültigem Bearer → 200 ──────────────────────────────────────────
  // GEFAHR: Echte Eskalationen auf Production. Daher Default = Skip,
  // Opt-in via TEST_CRON_TRIGGER_ALLOWED=1.
  const cronSecret = getCronSecret()
  if (!cronSecret) {
    skip('GET /cron/dunning-escalation mit gültigem Bearer → 200',
      'TEST_CRON_SECRET nicht gesetzt')
    skip('GET /cron/dunning-escalation 2. Aufruf → {skipped: true} (Idempotenz)',
      'TEST_CRON_SECRET nicht gesetzt')
    return
  }

  if (!isTriggerAllowed()) {
    skip('GET /cron/dunning-escalation mit gültigem Bearer → 200',
      'TEST_CRON_TRIGGER_ALLOWED!=1 (würde echte Eskalationen auslösen)')
    skip('GET /cron/dunning-escalation 2. Aufruf → {skipped: true} (Idempotenz)',
      'TEST_CRON_TRIGGER_ALLOWED!=1 (würde echte Eskalationen auslösen)')
    return
  }

  // 1. Aufruf — entweder erfolgreicher Run oder {skipped: true}, falls heute
  // schon gelaufen.
  let firstWasSkipped = false
  await runTest('GET /cron/dunning-escalation mit gültigem Bearer → 200', async () => {
    const { status, body } = await api<CronResponse>('/api/cron/dunning-escalation', {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    assert(status === 200, `Erwartet 200, bekam ${status} — body: ${JSON.stringify(body).slice(0, 300)}`)
    if (body.skipped === true) {
      // Heute wurde der Cron schon getriggert — das ist OK.
      firstWasSkipped = true
      return
    }
    assert(body.ok === true, `Erwartet ok=true, bekam ${JSON.stringify(body).slice(0, 300)}`)
    assert(typeof body.escalated_to_level_2 === 'number',
      `escalated_to_level_2 fehlt: ${JSON.stringify(body).slice(0, 300)}`)
    assert(typeof body.escalated_to_level_3 === 'number',
      `escalated_to_level_3 fehlt: ${JSON.stringify(body).slice(0, 300)}`)
  })

  // 2. Aufruf — wenn 1. nicht schon „skipped" war, MUSS dieser jetzt skipped
  // sein (UNIQUE-Constraint auf cron_runs). Wenn 1. schon skipped war, bleibt
  // der 2. natürlich auch skipped.
  await runTest('GET /cron/dunning-escalation 2. Aufruf → {skipped: true} (Idempotenz)', async () => {
    const { status, body } = await api<CronResponse>('/api/cron/dunning-escalation', {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    assert(status === 200, `Erwartet 200, bekam ${status} — body: ${JSON.stringify(body).slice(0, 300)}`)
    assert(body.skipped === true,
      `Erwartet skipped=true beim 2. Aufruf, bekam: ${JSON.stringify(body).slice(0, 300)}` +
      (firstWasSkipped ? ' (1. Aufruf war ebenfalls skipped, OK)' : ''))
  })
}

// Standalone-Run-Support: `tsx tests/smoke/cron.test.ts`
if (process.argv[1] && process.argv[1].endsWith('cron.test.ts')) {
  runCronTests().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
