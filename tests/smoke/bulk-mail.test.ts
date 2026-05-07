/**
 * Smoke-Test: Bulk-Mail Vorbereitung
 *
 * Endpoints:
 *   GET  /api/gym-mail/recipients   — Empfänger-Count
 *   POST /api/gym-mail/send         — NUR Validierung (KEIN echter Versand!)
 *
 * WICHTIG: KEIN echter Mail-Versand. Wir testen nur, dass die Validierung
 * 400 zurückgibt, wenn Felder fehlen — wir senden niemals einen
 * vollständigen, gültigen Body.
 */

import {
  api,
  assert,
  getAuthToken,
  runTest,
  section,
  skip,
} from './helpers'

interface RecipientsResponse {
  audience?: string
  filter?: string
  member_count?: number
  lead_count?: number
  total?: number
  gym_name?: string
  error?: string
}

interface SendResponse {
  ok?: boolean
  error?: string
}

export async function runBulkMailTests() {
  section('Bulk-Mail')

  // 1) Recipients ohne Auth → 401
  await runTest('GET /gym-mail/recipients ohne Auth → 401', async () => {
    const { status } = await api<RecipientsResponse>(
      '/api/gym-mail/recipients?audience=members&filter=active',
    )
    assert(status === 401, `Erwartet 401 ohne Auth, bekam ${status}`)
  })

  const token = await getAuthToken()

  if (!token) {
    skip('GET /gym-mail/recipients mit Auth → 200 mit member_count',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    skip('POST /gym-mail/send ohne subject → 400',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    return
  }

  // 2) Recipients mit Auth → 200 + member_count Number
  await runTest('GET /gym-mail/recipients mit Auth → 200 mit member_count', async () => {
    const { status, body } = await api<RecipientsResponse>(
      '/api/gym-mail/recipients?audience=members&filter=active',
      { headers: { Authorization: `Bearer ${token}` } },
    )
    assert(status === 200, `Erwartet 200, bekam ${status} — body: ${JSON.stringify(body).slice(0, 200)}`)
    assert(typeof body.member_count === 'number',
      `member_count fehlt oder kein Number: ${JSON.stringify(body).slice(0, 200)}`)
  })

  // 3) POST /gym-mail/send ohne subject → 400 (KEIN echter Versand!)
  // Wir senden bewusst einen unvollständigen Body, damit Validierung
  // VOR dem Resend-Aufruf greift.
  await runTest('POST /gym-mail/send ohne subject → 400', async () => {
    const { status } = await api<SendResponse>('/api/gym-mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        // subject absichtlich fehlt
        audience: 'members',
        filter: 'active',
        html: 'Smoke-Test-Body soll niemals versendet werden',
      }),
    })
    assert(status === 400, `Erwartet 400 ohne subject, bekam ${status}`)
  })
}

if (process.argv[1] && process.argv[1].endsWith('bulk-mail.test.ts')) {
  runBulkMailTests().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
