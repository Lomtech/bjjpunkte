/**
 * Portal-Hardening Smoke-Tests
 *
 * Verifiziert die Härtungen aus dem Service-Client-Audit (2026-05-09):
 *   1. Token-Length-Floor von 32 Zeichen
 *   2. is_active=true-Filter (abgemeldete Members → 404)
 *   3. /api/track Sanity (kein Body → 400, Bot-UA → 200 ohne Insert)
 *
 * Lauft gegen TEST_API_BASE (Default https://www.osss.pro). Read-only —
 * keine destruktiven Operationen.
 *
 * Eingebunden in `tests/smoke/index.ts` via runPortalHardeningTests().
 */

import { api, runTest, section } from './helpers'

export async function runPortalHardeningTests() {
  section('Portal / Service-Client-Hardening')

  // ── Test 1: Token < 32 Zeichen → 400 ──────────────────────────────────
  // Vorher: Token >= 20 wurde akzeptiert und in DB nachgeschlagen (404 wenn
  // nicht gefunden, 200 wenn 20-Zeichen-Token zufällig matcht).
  // Neu: < 32 Zeichen → 400 sofort, Brute-Force-Schutz.
  await runTest('GET /api/portal/[token<32] → 400 (Length-Floor)', async () => {
    // 30 Zeichen, gültige Char-Class — sollte trotzdem als zu kurz abgelehnt
    // werden (vorher 200/404, jetzt 400).
    const shortToken = 'abc123ABC456_-abcdefghijABCDEF' // exakt 30 Zeichen
    if (shortToken.length !== 30) {
      throw new Error(`Test-Setup defekt: shortToken.length=${shortToken.length}, erwartet 30`)
    }
    const res = await api(`/api/portal/${shortToken}`)
    if (res.status !== 400) {
      throw new Error(
        `Erwartet 400 für ${shortToken.length}-Zeichen-Token, bekam ${res.status}. ` +
        `Body: ${JSON.stringify(res.body).slice(0, 200)}`
      )
    }
  })

  // ── Test 1b: Token mit 32 Zeichen → 400 oder 404 ──────────────────────
  // Edge-case: genau 32 Zeichen passieren die Length-Validation, aber wir
  // erwarten 404 (Token existiert in DB nicht) — NICHT 400.
  await runTest('GET /api/portal/[token=32] → 404 (Length OK, nicht in DB)', async () => {
    const validLengthToken = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' // 32 Zeichen
    if (validLengthToken.length !== 32) {
      throw new Error(`Test-Setup defekt: token.length=${validLengthToken.length}, erwartet 32`)
    }
    const res = await api(`/api/portal/${validLengthToken}`)
    // 404 (nicht in DB) ist der erwartete Fall. 400 wäre Length-Bug.
    if (res.status === 400) {
      throw new Error('32-Zeichen-Token wurde fälschlich mit 400 abgelehnt — Length-Floor zu hoch?')
    }
    if (res.status !== 404 && res.status !== 401) {
      throw new Error(
        `Erwartet 404 für unbekannten 32-Zeichen-Token, bekam ${res.status}. ` +
        `Body: ${JSON.stringify(res.body).slice(0, 200)}`
      )
    }
  })

  // ── Test 2: Token gültig aber is_active=false → 404 ───────────────────
  // Hängt davon ab, dass TEST_INACTIVE_PORTAL_TOKEN in der env gesetzt ist
  // (ein Member in der Test-Gym mit is_active=false). Sonst skipped — der
  // Test ist wertvoll, aber kein Blocker.
  const inactiveToken = process.env.TEST_INACTIVE_PORTAL_TOKEN
  if (inactiveToken && inactiveToken.length >= 32) {
    await runTest('GET /api/portal/[token mit is_active=false] → 404', async () => {
      const res = await api(`/api/portal/${inactiveToken}`)
      if (res.status !== 404) {
        throw new Error(
          `Inaktive Members müssen 404 bekommen (vorher 200 mit Daten). ` +
          `Bekam ${res.status} — Body: ${JSON.stringify(res.body).slice(0, 200)}`
        )
      }
    })
  } else {
    console.log(`  ${'\x1b[33m'}○${'\x1b[0m'} GET /api/portal/[token is_active=false] → 404 ${'\x1b[2m'}(skipped: TEST_INACTIVE_PORTAL_TOKEN nicht gesetzt oder < 32 Zeichen)${'\x1b[0m'}`)
  }

  // ── Test 3: GET /api/track → 405 (nur POST erlaubt) ───────────────────
  // Sanity-Check: /api/track nimmt nur POST entgegen. GET muss 405 zurück­
  // geben (Next.js default für undefinierte Method-Handler). Wenn das auf
  // einmal 200 wäre, hätten wir ein Routing-Bug.
  await runTest('GET /api/track → 405 (nur POST erlaubt)', async () => {
    const res = await api('/api/track')
    // Next.js 16 gibt für undefinierte Methods 405 zurück. Toleranter Match
    // (404 wäre auch OK falls Routing das so einordnet).
    if (res.status !== 405 && res.status !== 404) {
      throw new Error(
        `Erwartet 405/404 für GET /api/track, bekam ${res.status}. ` +
        `/api/track sollte nur POST erlauben.`
      )
    }
  })

  // ── Test 4: POST /api/track ohne Body → 200 mit ok:false (silent reject) ──
  // /api/track ist absichtlich "silent" — POST ohne Body / mit invalidem
  // JSON gibt 200 zurück (damit Bots kein Feedback bekommen, dass sie
  // erkannt wurden), aber das Body-Feld `ok:false` markiert den Reject.
  // Origin-Header nötig: /api/track ist NICHT in der CSRF-Whitelist (nur
  // /api/public/*, /api/cron/*, Stripe-Webhook). Ein POST ohne Origin würde
  // im Proxy mit 403 abgewiesen — das ist beabsichtigt für DDoS-Schutz.
  await runTest('POST /api/track ohne Body → 200, ok:false', async () => {
    const apiBase = process.env.TEST_API_BASE ?? 'https://www.osss.pro'
    const res = await api<{ ok?: boolean; reason?: string; skipped?: string }>(
      '/api/track',
      {
        method: 'POST',
        // explizit kein Body
        headers: {
          'Content-Type': 'application/json',
          Origin: apiBase,
        },
      }
    )
    if (res.status !== 200) {
      throw new Error(`Erwartet 200 (silent reject), bekam ${res.status}`)
    }
    // Body sollte ok:false haben (kein Path angegeben)
    if (res.body && typeof res.body === 'object' && res.body.ok !== false) {
      throw new Error(
        `/api/track ohne Body sollte ok:false zurückgeben, bekam: ${JSON.stringify(res.body).slice(0, 200)}`
      )
    }
  })

  // ── Test 5: POST /api/track mit Bot-UA → 200, skipped:'bot' ───────────
  // Audit 2026-05-09: Bot-UA → silent reject ohne Insert. Vorher wurde
  // is_bot=true gespeichert; jetzt antworten wir 200 OK aber INSERTen NICHT.
  // Greift erst, wenn der neue Code deployed ist — gegen Prod-vor-Deploy
  // kann dieser Test scheitern (das ist beabsichtigt; er soll nach Deploy grün).
  await runTest('POST /api/track mit Bot-UA → 200, skipped:bot', async () => {
    const apiBase = process.env.TEST_API_BASE ?? 'https://www.osss.pro'
    const res = await api<{ ok?: boolean; skipped?: string }>(
      '/api/track',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          Origin: apiBase,
        },
        body: JSON.stringify({ path: '/test-bot' }),
      }
    )
    if (res.status !== 200) {
      throw new Error(`Erwartet 200 (silent bot-reject), bekam ${res.status}`)
    }
    if (res.body && typeof res.body === 'object' && res.body.skipped !== 'bot') {
      throw new Error(
        `Bot-UA sollte skipped:'bot' zurückgeben (statt INSERTen), bekam: ${JSON.stringify(res.body).slice(0, 200)}`
      )
    }
  })
}

// Stand-alone-Run-Mode: `npx tsx tests/smoke/portal-hardening.test.ts`
// — wird vom Master-Runner (index.ts) aber via Import gerufen.
if (
  // CommonJS-Style ist nicht verfügbar, aber import.meta-URL-Check geht.
  typeof process !== 'undefined' &&
  typeof process.argv !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].endsWith('portal-hardening.test.ts')
) {
  runPortalHardeningTests().then(() => {
    console.log('\n  Stand-alone-Run komplett.')
  }).catch(err => {
    console.error(err)
    process.exit(1)
  })
}
