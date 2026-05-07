/**
 * Smoke-Test: PDF-Vertrags-Export
 *
 * Endpoints:
 *   GET /api/members/[id]/contract?kind=membership|wellpass|trial
 *
 * Auth: Bearer-Token (Owner)
 */

import {
  apiHead,
  assert,
  getAuthToken,
  getMemberIdForTests,
  runTest,
  section,
  skip,
} from './helpers'

export async function runPdfExportTests() {
  section('PDF-Export')

  // 1) Ohne Auth → 401 (kein 5xx, kein Durchlauf)
  await runTest('GET /members/[id]/contract ohne Auth → 401', async () => {
    // Dummy-UUID — entscheidend ist nur die Auth-Prüfung VOR DB-Lookup
    const dummyId = '00000000-0000-0000-0000-000000000000'
    const { status } = await apiHead(`/api/members/${dummyId}/contract`)
    assert(status === 401, `Erwartet 401 ohne Auth, bekam ${status}`)
  })

  const token = await getAuthToken()
  const memberId = getMemberIdForTests()

  if (!token) {
    skip('GET /members/[id]/contract mit Bearer-Token → application/pdf',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    skip('GET /members/[id]/contract?kind=membership → application/pdf',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    skip('GET /members/[id]/contract?kind=wellpass → application/pdf',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    skip('GET /members/[id]/contract?kind=trial → application/pdf',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    return
  }
  if (!memberId) {
    skip('GET /members/[id]/contract?kind=membership → application/pdf',
      'TEST_MEMBER_ID nicht gesetzt')
    skip('GET /members/[id]/contract?kind=wellpass → application/pdf',
      'TEST_MEMBER_ID nicht gesetzt')
    skip('GET /members/[id]/contract?kind=trial → application/pdf',
      'TEST_MEMBER_ID nicht gesetzt')
    return
  }

  // 2-4) Alle 3 kinds → Content-Type application/pdf
  for (const kind of ['membership', 'wellpass', 'trial'] as const) {
    await runTest(`GET /members/[id]/contract?kind=${kind} → application/pdf`, async () => {
      const { status, headers } = await apiHead(
        `/api/members/${memberId}/contract?kind=${kind}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      assert(status === 200, `Erwartet 200 für kind=${kind}, bekam ${status}`)
      const contentType = headers.get('content-type') ?? ''
      assert(contentType.toLowerCase().startsWith('application/pdf'),
        `Erwartet Content-Type application/pdf, bekam "${contentType}"`)
    })
  }
}

if (process.argv[1] && process.argv[1].endsWith('pdf-export.test.ts')) {
  runPdfExportTests().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
