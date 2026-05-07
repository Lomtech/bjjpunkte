/**
 * Smoke-Test: Trial-Booking (Probetraining-Lead)
 *
 * Endpoints:
 *   GET  /api/public/gym/[slug]                  — trialContract muss da sein
 *   POST /api/public/gym/[slug]/lead             — Validierung + Erfolg
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
  trialContract?: string
  classes?: Array<{ id: string }>
}

interface LeadResponse {
  success?: boolean
  portalUrl?: string | null
  error?: string
}

export async function runTrialBookingTests() {
  section('Trial-Booking')

  const slug = getTestSlug()

  // 1) GET → trialContract muss vorhanden sein
  await runTest('GET /api/public/gym/[slug] → 200 mit trialContract', async () => {
    const { status, body } = await api<PublicGymResponse>(`/api/public/gym/${slug}`)
    assert(status === 200, `Erwartet 200, bekam ${status}`)
    assert(typeof body.trialContract === 'string' && body.trialContract.length > 0,
      'trialContract fehlt oder leer')
  })

  // 2) POST ohne first_name → 400
  await runTest('POST /lead ohne first_name → 400', async () => {
    const { status } = await api<LeadResponse>(`/api/public/gym/${slug}/lead`, {
      method: 'POST',
      body: JSON.stringify({
        last_name: 'TestNachname',
        email: uniqueTestEmail('trial-no-first'),
        trial_consent_accepted: true,
      }),
    })
    assert(status === 400, `Erwartet 400 ohne first_name, bekam ${status}`)
  })

  // 3) POST mit allen Pflichtfeldern → 200/201
  await runTest('POST /lead mit valid Daten → 2xx', async () => {
    const { status, body } = await api<LeadResponse>(`/api/public/gym/${slug}/lead`, {
      method: 'POST',
      body: JSON.stringify({
        first_name: 'Smoke',
        last_name: 'Lead',
        email: uniqueTestEmail('trial-valid'),
        phone: '+49 89 0000000',
        message: 'Smoke-Test Probetraining-Anfrage',
        trial_consent_accepted: true,
        trial_consent_text: 'Hausordnung gelesen',
      }),
    })
    const ok = status === 200 || status === 201
    assert(ok,
      `Erwartet 2xx, bekam ${status} — body: ${JSON.stringify(body).slice(0, 300)}`)
  })
}

if (process.argv[1] && process.argv[1].endsWith('trial-booking.test.ts')) {
  runTrialBookingTests().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
