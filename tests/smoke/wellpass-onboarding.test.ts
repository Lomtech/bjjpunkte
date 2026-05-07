/**
 * Smoke-Test: Wellpass-Onboarding
 *
 * Testet den kritischen Pfad GET → POST für Anbieter-Mitglieder
 * (Wellpass / Hansefit / EGYM / Urban Sports Club).
 *
 * Endpoints:
 *   GET  /api/public/gym/[slug]
 *   POST /api/public/gym/[slug]/wellpass
 */

import {
  api,
  assert,
  getTestSlug,
  runTest,
  section,
  uniqueTestEmail,
} from './helpers'

interface PublicGymResponse {
  gym?: { id?: string; name?: string }
  wellpassContract?: string
  trialContract?: string
}

interface WellpassResponse {
  success?: boolean
  memberId?: string
  error?: string
}

export async function runWellpassOnboardingTests() {
  section('Wellpass-Onboarding')

  const slug = getTestSlug()

  // 1) GET /api/public/gym/[slug] → 200, Felder vorhanden
  await runTest('GET /api/public/gym/[slug] → 200 mit wellpassContract & gym.name', async () => {
    const { status, body } = await api<PublicGymResponse>(`/api/public/gym/${slug}`)
    assert(status === 200, `Erwartet 200, bekam ${status}`)
    assert(typeof body === 'object' && body !== null, 'Body kein Objekt')
    assert(typeof body.gym?.name === 'string' && body.gym.name.length > 0, 'gym.name fehlt')
    assert(typeof body.wellpassContract === 'string' && body.wellpassContract.length > 0,
      'wellpassContract fehlt oder leer')
  })

  // 2) POST mit ungültiger source → 400
  await runTest('POST /wellpass mit invalid source → 400', async () => {
    const { status } = await api<WellpassResponse>(`/api/public/gym/${slug}/wellpass`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'invalid',
        first_name: 'Smoke',
        last_name: 'Test',
        email: uniqueTestEmail('wellpass-invalid'),
        date_of_birth: '1990-01-01',
        contract_accepted: true,
      }),
    })
    assert(status === 400, `Erwartet 400 für ungültige source, bekam ${status}`)
  })

  // 3) POST mit Minderjährigem → 400 + „Erwachsene"-Begriff
  await runTest('POST /wellpass mit Minderjährigem → 400 mit „Erwachsene"', async () => {
    const { status, body } = await api<WellpassResponse>(`/api/public/gym/${slug}/wellpass`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'wellpass',
        first_name: 'Minor',
        last_name: 'Test',
        email: uniqueTestEmail('wellpass-minor'),
        date_of_birth: '2020-01-01',
        contract_accepted: true,
      }),
    })
    assert(status === 400, `Erwartet 400 bei Minderjährigem, bekam ${status}`)
    const errMsg = (body?.error ?? '').toLowerCase()
    assert(errMsg.includes('erwachsene'),
      `Fehler-Message sollte „Erwachsene" enthalten: "${body?.error}"`)
  })

  // 4) POST mit valid Adult → 200/201 ODER 409 (Duplicate ist auch OK)
  // ACHTUNG: Test darf KEIN echtes Mitglied erzeugen → Email mit Timestamp +
  // Random, akzeptiert Erfolg ODER 409 als Pass. Live-Production legt im
  // Erfolgsfall eine echte Member-Reihe an — das ist von der Aufgabe so
  // erlaubt (eindeutige Test-Email, daher kein Konflikt mit echten Members).
  await runTest('POST /wellpass mit valid Adult → 2xx oder 409', async () => {
    const { status, body } = await api<WellpassResponse>(`/api/public/gym/${slug}/wellpass`, {
      method: 'POST',
      body: JSON.stringify({
        source: 'wellpass',
        first_name: 'Smoke',
        last_name: 'Adult',
        email: uniqueTestEmail('wellpass-adult'),
        phone: '+49 89 0000000',
        date_of_birth: '1990-06-15',
        contract_accepted: true,
        contract_text: 'Wellpass-Testvertrag',
      }),
    })
    const ok = status === 200 || status === 201 || status === 409
    assert(ok,
      `Erwartet 200/201/409, bekam ${status} — body: ${JSON.stringify(body).slice(0, 300)}`)
  })
}

// Standalone-Run-Support: `tsx tests/smoke/wellpass-onboarding.test.ts`
if (process.argv[1] && process.argv[1].endsWith('wellpass-onboarding.test.ts')) {
  runWellpassOnboardingTests().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
