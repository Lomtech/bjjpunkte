/**
 * Smoke-Test: Inkasso/Mahnungs-Pipeline
 *
 * Endpoints:
 *   GET  /api/members/[id]/dunning              — History aller Aktionen
 *   POST /api/members/[id]/dunning              — Neue Aktion (note/reminder/...)
 *   GET  /api/members/[id]/dunning/pdf          — Mahnungs-PDF (level=1|2|3)
 *   GET  /api/members/[id]/dunning/handoff-pdf  — Inkasso-Übergabe-PDF
 *
 * WICHTIG: Tests dürfen NUR `note`-Aktionen erzeugen, niemals echte
 * Mahn-Eskalationen — `note` löst weder Mail-Versand noch Level-Änderung aus.
 *
 * Auth: Dual-Auth (Bearer-Token ODER Cookie-Session) wie bei contract-PDF.
 */

import {
  api,
  apiHead,
  assert,
  getAuthToken,
  getMemberIdForTests,
  runTest,
  section,
  skip,
} from './helpers'

interface DunningHistoryResponse {
  actions?: Array<{
    id: string
    action_type: string
    amount_cents: number | null
    notes: string | null
    performed_at: string
  }>
  error?: string
}

interface DunningPostResponse {
  ok?: boolean
  mail_sent?: boolean
  mail_error?: string
  error?: string
}

export async function runDunningTests() {
  section('Dunning / Inkasso-Pipeline')

  const dummyId = '00000000-0000-0000-0000-000000000000'

  // ── a) GET History ohne Auth → 401 ────────────────────────────────────────
  await runTest('GET /members/[id]/dunning ohne Auth → 401', async () => {
    const { status } = await api<DunningHistoryResponse>(`/api/members/${dummyId}/dunning`)
    assert(status === 401, `Erwartet 401 ohne Auth, bekam ${status}`)
  })

  // ── c) POST ohne Auth → 401 ODER 403 (CSRF-Schutz blockt Cross-Origin-POST)
  await runTest('POST /members/[id]/dunning ohne Auth → 401/403', async () => {
    const { status } = await api<DunningPostResponse>(`/api/members/${dummyId}/dunning`, {
      method: 'POST',
      body: JSON.stringify({ action_type: 'note', notes: 'smoke-test' }),
    })
    // 401 = Auth-Reject, 403 = CSRF-Reject (vor Auth) — beide korrektes Schutzverhalten
    assert(status === 401 || status === 403, `Erwartet 401 oder 403 ohne Auth, bekam ${status}`)
  })

  // ── f) GET PDF ohne Auth → 401 ────────────────────────────────────────────
  await runTest('GET /members/[id]/dunning/pdf ohne Auth → 401', async () => {
    const { status } = await apiHead(`/api/members/${dummyId}/dunning/pdf`)
    assert(status === 401, `Erwartet 401 ohne Auth, bekam ${status}`)
  })

  // ── h) GET Handoff-PDF ohne Auth → 401 (ODER 404 falls noch nicht deployed)
  await runTest('GET /members/[id]/dunning/handoff-pdf ohne Auth → 401', async () => {
    const { status } = await apiHead(`/api/members/${dummyId}/dunning/handoff-pdf`)
    // 401 = Endpoint deployed + Auth-Check; 404 = Endpoint noch nicht in Production
    assert(status === 401 || status === 404, `Erwartet 401 (oder 404 vor Deploy), bekam ${status}`)
  })

  // ── Auth-abhängige Tests ──────────────────────────────────────────────────
  const token = await getAuthToken()
  const memberId = getMemberIdForTests()

  if (!token) {
    skip('GET /members/[id]/dunning mit Auth → 200 mit actions[]',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    skip('POST /members/[id]/dunning mit invalid action_type → 400',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    skip('POST /members/[id]/dunning mit action_type=note → 200, mail_sent=false',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    skip('GET /members/[id]/dunning/pdf?level=1 mit Auth → application/pdf',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    skip('GET /members/[id]/dunning/pdf?level=2 mit Auth → application/pdf',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    skip('GET /members/[id]/dunning/pdf?level=3 mit Auth → application/pdf',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    skip('GET /members/[id]/dunning/handoff-pdf mit Auth → application/pdf',
      'TEST_OWNER_EMAIL/PASSWORD nicht gesetzt')
    return
  }

  if (!memberId) {
    skip('GET /members/[id]/dunning mit Auth → 200 mit actions[]',
      'TEST_MEMBER_ID nicht gesetzt')
    skip('POST /members/[id]/dunning mit action_type=note → 200, mail_sent=false',
      'TEST_MEMBER_ID nicht gesetzt')
    skip('GET /members/[id]/dunning/pdf?level=1 mit Auth → application/pdf',
      'TEST_MEMBER_ID nicht gesetzt')
    skip('GET /members/[id]/dunning/pdf?level=2 mit Auth → application/pdf',
      'TEST_MEMBER_ID nicht gesetzt')
    skip('GET /members/[id]/dunning/pdf?level=3 mit Auth → application/pdf',
      'TEST_MEMBER_ID nicht gesetzt')
    skip('GET /members/[id]/dunning/handoff-pdf mit Auth → application/pdf',
      'TEST_MEMBER_ID nicht gesetzt')
    // POST mit invalid action_type kann auch ohne Member-ID laufen (Validierung
    // greift vor DB-Lookup), siehe unten.
  }

  // ── b) GET History mit Auth → 200, actions array ──────────────────────────
  if (memberId) {
    await runTest('GET /members/[id]/dunning mit Auth → 200 mit actions[]', async () => {
      const { status, body } = await api<DunningHistoryResponse>(
        `/api/members/${memberId}/dunning`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      assert(status === 200, `Erwartet 200, bekam ${status} — body: ${JSON.stringify(body).slice(0, 200)}`)
      assert(Array.isArray(body.actions),
        `actions fehlt oder kein Array: ${JSON.stringify(body).slice(0, 200)}`)
    })
  }

  // ── d) POST mit invalid action_type → 400 (Validierung VOR DB) ────────────
  // Läuft auch ohne TEST_MEMBER_ID, weil action-Validierung vor Member-Lookup
  // greift. Wir nutzen dummyId — Auth + Validierung sind das, was getestet wird.
  await runTest('POST /members/[id]/dunning mit invalid action_type → 400', async () => {
    const { status, body } = await api<DunningPostResponse>(
      `/api/members/${dummyId}/dunning`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action_type: 'invalid', notes: 'smoke-test' }),
      },
    )
    assert(status === 400, `Erwartet 400 für invalid action_type, bekam ${status}`)
    const errMsg = (body?.error ?? '').toLowerCase()
    assert(errMsg.includes('ungültige') || errMsg.includes('ungultige') || errMsg.includes('aktion'),
      `Fehler-Message sollte „Ungültige Aktion" enthalten: "${body?.error}"`)
  })

  // ── e) POST action_type=note + Auth → 200, mail_sent=false ────────────────
  // Note-Aktionen lösen KEINE Mail aus (kind ist nicht in MAIL_ACTIONS).
  // Das ist die einzige Aktion, die wir gefahrlos in Production triggern können.
  if (memberId) {
    await runTest('POST /members/[id]/dunning mit action_type=note → 200, mail_sent=false', async () => {
      const { status, body } = await api<DunningPostResponse>(
        `/api/members/${memberId}/dunning`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action_type: 'note',
            notes: `smoke-test ${new Date().toISOString()}`,
          }),
        },
      )
      assert(status === 200, `Erwartet 200, bekam ${status} — body: ${JSON.stringify(body).slice(0, 200)}`)
      assert(body.ok === true, `Erwartet ok=true, bekam ${JSON.stringify(body).slice(0, 200)}`)
      // mail_sent muss false oder undefined sein — note darf nie Mail auslösen
      assert(body.mail_sent === false || body.mail_sent === undefined,
        `Note-Aktion darf KEINE Mail auslösen, bekam mail_sent=${body.mail_sent}`)
    })
  }

  // ── g) GET PDF mit Auth → application/pdf für level=1|2|3 ─────────────────
  if (memberId) {
    for (const level of [1, 2, 3] as const) {
      await runTest(`GET /members/[id]/dunning/pdf?level=${level} mit Auth → application/pdf`, async () => {
        const { status, headers } = await apiHead(
          `/api/members/${memberId}/dunning/pdf?level=${level}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        assert(status === 200, `Erwartet 200 für level=${level}, bekam ${status}`)
        const contentType = headers.get('content-type') ?? ''
        assert(contentType.toLowerCase().startsWith('application/pdf'),
          `Erwartet Content-Type application/pdf, bekam "${contentType}"`)
        const lenStr = headers.get('content-length')
        // Content-Length ist bei streamed Response oft nicht gesetzt — dann
        // nicht prüfen; wenn gesetzt, muss er > 1000 sein (kleinste sinnvolle PDF).
        if (lenStr !== null) {
          const len = Number(lenStr)
          assert(Number.isFinite(len) && len > 1000,
            `Erwartet Content-Length > 1000 für level=${level}, bekam ${lenStr}`)
        }
      })
    }
  }

  // ── i) GET Handoff-PDF mit Auth → application/pdf ─────────────────────────
  if (memberId) {
    await runTest('GET /members/[id]/dunning/handoff-pdf mit Auth → application/pdf', async () => {
      const { status, headers } = await apiHead(
        `/api/members/${memberId}/dunning/handoff-pdf`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      assert(status === 200, `Erwartet 200, bekam ${status}`)
      const contentType = headers.get('content-type') ?? ''
      assert(contentType.toLowerCase().startsWith('application/pdf'),
        `Erwartet Content-Type application/pdf, bekam "${contentType}"`)
      const lenStr = headers.get('content-length')
      if (lenStr !== null) {
        const len = Number(lenStr)
        assert(Number.isFinite(len) && len > 1000,
          `Erwartet Content-Length > 1000, bekam ${lenStr}`)
      }
    })
  }
}

// Standalone-Run-Support: `tsx tests/smoke/dunning.test.ts`
if (process.argv[1] && process.argv[1].endsWith('dunning.test.ts')) {
  runDunningTests().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
