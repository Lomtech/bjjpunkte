#!/usr/bin/env npx tsx
/**
 * Osss Integration Test Suite
 *
 * Testet alle API-Endpoints gegen einen laufenden Server.
 * Erstellt echte Testdaten, verifiziert DB-Änderungen, räumt danach auf.
 *
 * Benötigt (in .env.local oder als Umgebungsvariablen):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STRIPE_WEBHOOK_SECRET   (optional — Webhook-Tests werden sonst übersprungen)
 *   CRON_SECRET             (optional — Cron-Tests werden sonst übersprungen)
 *
 * Verwendung:
 *   npm test                          → gegen http://localhost:3000
 *   npm test -- --url https://bjjpunkte.vercel.app   → gegen Production
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

// .env.local laden (falls vorhanden) — vor allem anderen
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
    const val = rawVal.replace(/^["']|["']$/g, '') // strip quotes
    if (key && val && !process.env[key]) process.env[key] = val
  }
}
loadEnvLocal()

// ── Config ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const urlFlagIdx = args.indexOf('--url')
const BASE_URL = urlFlagIdx !== -1
  ? args[urlFlagIdx + 1]
  : (process.env.TEST_URL ?? 'http://localhost:3000')

// ── Colors ────────────────────────────────────────────────────────────────────

const c = {
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
}

// ── Test Engine ───────────────────────────────────────────────────────────────

interface TestResult { name: string; passed: boolean; ms: number; error?: string }
const results: TestResult[] = []

async function test(name: string, fn: () => Promise<void>) {
  const start = Date.now()
  try {
    await fn()
    const ms = Date.now() - start
    results.push({ name, passed: true, ms })
    console.log(`  ${c.green('✓')} ${name} ${c.dim(`(${ms}ms)`)}`)
  } catch (err: any) {
    const ms = Date.now() - start
    const msg = err?.message ?? String(err)
    results.push({ name, passed: false, ms, error: msg })
    console.log(`  ${c.red('✗')} ${name} ${c.dim(`(${ms}ms)`)}`)
    console.log(`    ${c.dim('→')} ${c.red(msg)}`)
  }
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

// ── HTTP Client ───────────────────────────────────────────────────────────────

async function api(path: string, opts: RequestInit = {}) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  })
  const text = await res.text()
  let body: any
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body, headers: res.headers }
}

// ── Stripe Webhook Signer ─────────────────────────────────────────────────────

function signWebhook(payload: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000)
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')
  return `t=${t},v1=${sig}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(c.bold(`\n  🥋 Osss Test Suite`))
  console.log(c.dim(`  Ziel: ${BASE_URL}`))
  console.log(c.dim(`  Start: ${new Date().toLocaleString('de-DE')}\n`))

  // ── Env Checks ──────────────────────────────────────────────────────────────

  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey      = process.env.SUPABASE_SERVICE_ROLE_KEY
  const webhookSecret   = process.env.STRIPE_WEBHOOK_SECRET
  const cronSecret      = process.env.CRON_SECRET

  if (!supabaseUrl || !serviceKey) {
    console.log(c.red('  ✗ NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein'))
    console.log(c.dim('    → .env.local kopieren und Werte eintragen'))
    process.exit(1)
  }

  const db = createClient(supabaseUrl, serviceKey)

  // ── Testdaten Setup ─────────────────────────────────────────────────────────

  const runId       = Date.now()
  const testEmail   = `test+${runId}@osss-test.dev`
  const testPass    = 'TestOsss123!'
  let accessToken   = ''
  let userId        = ''
  let gymId         = ''
  let memberId      = ''
  let portalToken   = ''
  let classId       = ''
  let leadId        = ''

  // ── Sektion: Server ─────────────────────────────────────────────────────────

  console.log(c.cyan('  ── Server'))

  await test('Server erreichbar', async () => {
    const { status } = await api('/')
    assert(status < 500, `Server gibt ${status} zurück`)
  })

  // ── Sektion: Auth ───────────────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Auth'))

  await test('User registrieren (Supabase Admin)', async () => {
    const { data, error } = await db.auth.admin.createUser({
      email: testEmail,
      password: testPass,
      email_confirm: true,
    })
    assert(!error, `createUser: ${error?.message}`)
    userId = data.user!.id
  })

  await test('Login → Access Token', async () => {
    const { data, error } = await db.auth.signInWithPassword({ email: testEmail, password: testPass })
    assert(!error, `Login: ${error?.message}`)
    accessToken = data.session?.access_token ?? ''
    assert(accessToken.length > 20, 'Kein gültiger Access Token')
  })

  await test('Auth: kein Token → 401', async () => {
    const { status } = await api('/api/members', { method: 'POST', body: '{}' })
    assert(status === 401, `Erwartet 401, bekam ${status}`)
  })

  // ── Sektion: Gym Setup ──────────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Gym'))

  await test('Gym in DB anlegen', async () => {
    const { data, error } = await db.from('gyms').insert({
      owner_id: userId,
      name: `Test Gym ${runId}`,
      monthly_fee_cents: 8000,
      plan: 'free',
      plan_member_limit: 30,
    }).select('id').single()
    assert(!error, `Gym Insert: ${error?.message}`)
    gymId = (data as any).id
  })

  await test('Gym über API lesbar', async () => {
    // Settings lädt Gym via Supabase-Client direkt — wir prüfen öffentlichen Stundenplan-Endpoint
    const { status, body } = await api(`/api/public/schedule/${gymId}`)
    assert(status === 200, `Erwartet 200, bekam ${status}`)
    assert(Array.isArray(body), 'Erwartet Array als Antwort')
  })

  // ── Sektion: Members ────────────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Members'))

  await test('POST /api/members — Mitglied erstellen', async () => {
    const { status, body } = await api('/api/members', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'Kämpfer',
        email: `member+${runId}@osss-test.dev`,
        phone: '+49 89 123456',
        belt: 'white',
        stripes: 2,
        join_date: new Date().toISOString().split('T')[0],
        notes: 'Automatisch erstellt von Osss Test Suite',
      }),
    })
    assert(status === 201, `Erwartet 201, bekam ${status} — ${JSON.stringify(body)}`)
    memberId = body.id
    assert(memberId?.length > 5, 'Keine gültige Member-ID')
  })

  await test('POST /api/members — Ungültiger Gürtel → 400', async () => {
    const { status } = await api('/api/members', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        first_name: 'Bad', last_name: 'Belt',
        belt: 'rainbow',
        join_date: new Date().toISOString().split('T')[0],
      }),
    })
    assert(status === 400, `Erwartet 400 für ungültigen Gürtel, bekam ${status}`)
  })

  await test('POST /api/members — Fehlender Vorname → 400', async () => {
    const { status } = await api('/api/members', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ last_name: 'Nur Nachname', join_date: '2024-01-01' }),
    })
    assert(status === 400, `Erwartet 400, bekam ${status}`)
  })

  // ── Sektion: Portal ─────────────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Member Portal'))

  await test('Portal-Token aus DB lesen', async () => {
    const { data } = await db.from('members').select('portal_token').eq('id', memberId).single()
    portalToken = (data as any)?.portal_token
    assert(!!portalToken, 'Kein portal_token in DB')
  })

  await test('GET /api/portal/[token] — Profil abrufbar', async () => {
    const { status, body } = await api(`/api/portal/${portalToken}`)
    assert(status === 200, `Erwartet 200, bekam ${status}`)
    assert(body.member?.id === memberId, `Member-ID stimmt nicht: ${body.member?.id} vs ${memberId}`)
    assert(body.gym !== undefined, 'Gym fehlt in Portal-Antwort')
  })

  await test('GET /api/portal/[ungültiger-token] → 4xx', async () => {
    const { status } = await api('/api/portal/00000000-0000-0000-0000-000000000000')
    assert(status >= 400, `Ungültiger Token sollte 4xx geben, bekam ${status}`)
  })

  await test('POST /api/portal/[token]/checkin — Self-Check-in', async () => {
    const { status, body } = await api(`/api/portal/${portalToken}/checkin`, {
      method: 'POST',
      body: JSON.stringify({ classType: 'gi' }),
    })
    assert(status === 200, `Erwartet 200, bekam ${status} — ${JSON.stringify(body)}`)
    assert(body.success === true, `success !== true: ${JSON.stringify(body)}`)
  })

  await test('POST /api/portal/[token]/training-log — Eintrag speichern', async () => {
    const { status, body } = await api(`/api/portal/${portalToken}/training-log`, {
      method: 'POST',
      body: JSON.stringify({ note: 'Armbar von Guard funktioniert heute super', class_type: 'gi' }),
    })
    assert(status === 200 || status === 201, `Erwartet 2xx, bekam ${status} — ${JSON.stringify(body)}`)
  })

  await test('GET /api/portal/[token]/training-log — Einträge laden', async () => {
    const { status, body } = await api(`/api/portal/${portalToken}/training-log`)
    assert(status === 200, `Erwartet 200, bekam ${status}`)
    assert(Array.isArray(body), 'Erwartet Array')
    assert(body.length >= 1, 'Training-Log-Eintrag fehlt')
  })

  // ── Sektion: Stripe Webhook ─────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Stripe Webhook'))

  if (webhookSecret) {

    await test('Webhook: Ungültige Signatur → 400', async () => {
      const { status } = await api('/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'bad-sig', 'Content-Type': 'application/json' },
        body: '{"type":"test"}',
      })
      assert(status === 400, `Erwartet 400, bekam ${status}`)
    })

    // Test 1: Match via stripe_checkout_session_id (neue primäre Logik)
    const csId = `cs_test_${runId}`
    const piId = `pi_test_${runId}`
    await (db.from('payments') as any).insert({
      gym_id: gymId, member_id: memberId,
      stripe_checkout_session_id: csId,
      stripe_payment_intent_id: null, // absichtlich null — sollte trotzdem via session ID matchen
      amount_cents: 8000, status: 'pending',
    })

    await test('Webhook: checkout.session.completed → match via session_id (primär)', async () => {
      const payload = JSON.stringify({
        id: `evt_${runId}`, type: 'checkout.session.completed',
        data: { object: {
          id: csId,
          payment_status: 'paid',
          payment_intent: piId,
          metadata: { memberId },
          customer: null, subscription: null,
        }},
      })
      const { status } = await api('/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': signWebhook(payload, webhookSecret), 'Content-Type': 'application/json' },
        body: payload,
      })
      assert(status === 200, `Webhook: Erwartet 200, bekam ${status}`)
      await new Promise(r => setTimeout(r, 700))
      const { data } = await (db.from('payments') as any).select('status, stripe_payment_intent_id').eq('stripe_checkout_session_id', csId).single()
      assert((data as any)?.status === 'paid', `DB-Status nach Session-ID-Match: "${(data as any)?.status}" statt "paid"`)
      assert((data as any)?.stripe_payment_intent_id === piId, `payment_intent_id nicht gesetzt: ${(data as any)?.stripe_payment_intent_id}`)
    })

    // Test 2: Legacy-Match via payment_intent_id (Fallback für alte Einträge)
    const piLegacyId = `pi_legacy_${runId}`
    await db.from('payments').insert({
      gym_id: gymId, member_id: memberId,
      stripe_payment_intent_id: piLegacyId,
      amount_cents: 8000, status: 'pending',
    })

    await test('Webhook: checkout.session.completed → match via payment_intent (legacy fallback)', async () => {
      const payload = JSON.stringify({
        id: `evt_legacy_${runId}`, type: 'checkout.session.completed',
        data: { object: {
          id: `cs_legacy_${runId}`,
          payment_status: 'paid',
          payment_intent: piLegacyId,
          metadata: { memberId },
          customer: null, subscription: null,
        }},
      })
      const { status } = await api('/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': signWebhook(payload, webhookSecret), 'Content-Type': 'application/json' },
        body: payload,
      })
      assert(status === 200, `Webhook: Erwartet 200, bekam ${status}`)
      await new Promise(r => setTimeout(r, 700))
      const { data } = await db.from('payments').select('status').eq('stripe_payment_intent_id', piLegacyId).single()
      assert((data as any)?.status === 'paid', `DB-Status nach PI-Match: "${(data as any)?.status}" statt "paid"`)
    })

    await test('Webhook: payment_intent.payment_failed → payment = failed (DB-Verifikation)', async () => {
      const piFailId = `pi_fail_${runId}`
      await db.from('payments').insert({
        gym_id: gymId, member_id: memberId,
        stripe_payment_intent_id: piFailId,
        amount_cents: 8000, status: 'pending',
      })

      const payload = JSON.stringify({
        id: `evt_fail_${runId}`, type: 'payment_intent.payment_failed',
        data: { object: { id: piFailId } },
      })
      const { status } = await api('/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': signWebhook(payload, webhookSecret), 'Content-Type': 'application/json' },
        body: payload,
      })
      assert(status === 200, `Webhook: Erwartet 200, bekam ${status}`)

      await new Promise(r => setTimeout(r, 600))
      const { data } = await db.from('payments').select('status').eq('stripe_payment_intent_id', piFailId).single()
      assert((data as any)?.status === 'failed', `DB-Status: "${(data as any)?.status}" statt "failed"`)
    })

  } else {
    console.log(c.yellow('  ⚠ STRIPE_WEBHOOK_SECRET nicht gesetzt — übersprungen'))
  }

  // ── Sektion: Stripe Checkout Endpoints ─────────────────────────────────────

  console.log(c.cyan('\n  ── Stripe Checkout'))

  await test('POST /api/stripe/create-checkout — Auth + Struktur', async () => {
    const { status, body } = await api('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        memberId, gymId,
        memberEmail: `member+${runId}@osss-test.dev`,
        memberName: 'Test Kämpfer',
        amountCents: 8000,
      }),
    })
    // Stripe nicht aktiv in Test → 500/400 OK, aber kein 401
    assert(status !== 401, `Auth-Fehler (401) bei create-checkout`)
    if (status === 200) assert(typeof body.url === 'string', 'URL fehlt in Response')
  })

  await test('POST /api/stripe/bulk-checkout — Auth + Struktur', async () => {
    const { status } = await api('/api/stripe/bulk-checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ gymId, amountCents: 8000 }),
    })
    assert(status !== 401, `Auth-Fehler (401) bei bulk-checkout`)
  })

  // ── Sektion: Stundenplan & Klassen ──────────────────────────────────────────

  console.log(c.cyan('\n  ── Stundenplan'))

  await test('POST /api/classes — Klasse erstellen', async () => {
    const tomorrow = new Date(Date.now() + 86400000)
    const tomorrowEnd = new Date(Date.now() + 86400000 + 5400000)
    const { status, body } = await api('/api/classes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        title: 'Gi Training',
        class_type: 'gi',
        instructor: 'Coach Test',
        starts_at: tomorrow.toISOString(),
        ends_at: tomorrowEnd.toISOString(),
        location: 'Matte 1',
      }),
    })
    assert(status === 200 || status === 201, `Erwartet 2xx, bekam ${status} — ${JSON.stringify(body)}`)
    classId = body.id ?? body.class?.id
  })

  await test('GET /api/public/schedule/[gymId] — Öffentlicher Stundenplan', async () => {
    const { status, body } = await api(`/api/public/schedule/${gymId}`)
    assert(status === 200, `Erwartet 200, bekam ${status}`)
    assert(Array.isArray(body), 'Erwartet Array')
  })

  await test('GET /api/schedule/ical?gymId= — iCal Export', async () => {
    const { status, body } = await api(`/api/schedule/ical?gymId=${gymId}`)
    assert(status === 200, `Erwartet 200, bekam ${status}`)
    assert(typeof body === 'string' && body.includes('BEGIN:VCALENDAR'), `Kein gültiges iCal: ${String(body).slice(0, 100)}`)
  })

  if (classId) {
    await test('POST /api/portal/[token]/book/[classId] — Klasse buchen', async () => {
      const { status, body } = await api(`/api/portal/${portalToken}/book/${classId}`, { method: 'POST' })
      assert(status === 200 || status === 201, `Erwartet 2xx, bekam ${status} — ${JSON.stringify(body)}`)
    })

    await test('DELETE /api/portal/[token]/book/[classId] — Buchung stornieren', async () => {
      const { status } = await api(`/api/portal/${portalToken}/book/${classId}`, { method: 'DELETE' })
      assert(status === 200, `Erwartet 200, bekam ${status}`)
    })
  }

  // ── Sektion: Portal-Checkout ────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Portal Checkout'))

  await test('POST /api/portal/[token]/checkout — Token-Validierung', async () => {
    // Get an attendance record to use as attendanceId
    const { data: att } = await db.from('attendance').select('id').eq('member_id', memberId).limit(1).single()
    if (!att) { console.log(c.dim('    (kein Attendance-Eintrag — übersprungen)')); return }

    const { status, body } = await api(`/api/portal/${portalToken}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ attendanceId: (att as any).id }),
    })
    assert(status === 200, `Erwartet 200, bekam ${status} — ${JSON.stringify(body)}`)
    assert(body.success === true, 'success !== true')
  })

  await test('POST /api/portal/[token]/checkout — Falscher Token → 401', async () => {
    const { status } = await api(`/api/portal/00000000-0000-0000-0000-000000000000/checkout`, {
      method: 'POST',
      body: JSON.stringify({ attendanceId: '00000000-0000-0000-0000-000000000001' }),
    })
    assert(status === 401 || status === 400, `Erwartet 401/400, bekam ${status}`)
  })

  // ── Sektion: Leads ──────────────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Leads'))

  await test('POST /api/leads — Lead erstellen', async () => {
    const { status, body } = await api('/api/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        first_name: 'Max', last_name: 'Interessent',
        email: `lead+${runId}@test.dev`,
        source: 'instagram', status: 'new',
      }),
    })
    assert(status === 200 || status === 201, `Erwartet 2xx, bekam ${status} — ${JSON.stringify(body)}`)
    leadId = body.id
  })

  if (leadId) {
    await test('PUT /api/leads/[id] — Status updaten', async () => {
      const { status } = await api(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status: 'contacted' }),
      })
      assert(status === 200, `Erwartet 200, bekam ${status}`)
    })

    await test('PUT /api/leads/[id] — Mass Assignment blockiert', async () => {
      const { status, body } = await api(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ gym_id: '00000000-0000-0000-0000-000000000000' }),
      })
      // Sollte entweder 400 oder 200 mit unverändertem gym_id sein
      if (status === 200) {
        const { data } = await db.from('leads').select('gym_id').eq('id', leadId).single()
        assert((data as any)?.gym_id === gymId, 'Mass Assignment: gym_id wurde überschrieben!')
      }
    })

    await test('DELETE /api/leads/[id] — Lead löschen', async () => {
      const { status } = await api(`/api/leads/${leadId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      assert(status === 200, `Erwartet 200, bekam ${status}`)
    })
  }

  // ── Sektion: Cron Jobs ──────────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Cron Jobs'))

  if (cronSecret) {
    await test('GET /api/cron/birthday — Korrekte Auth', async () => {
      const { status } = await api('/api/cron/birthday', {
        headers: { authorization: `Bearer ${cronSecret}` },
      })
      assert(status === 200, `Erwartet 200, bekam ${status}`)
    })

    await test('GET /api/cron/birthday — Kein Secret → 401', async () => {
      const { status } = await api('/api/cron/birthday')
      assert(status === 401, `Erwartet 401, bekam ${status}`)
    })

    await test('GET /api/cron/payment-reminders — Korrekte Auth', async () => {
      const { status } = await api('/api/cron/payment-reminders', {
        headers: { authorization: `Bearer ${cronSecret}` },
      })
      assert(status === 200, `Erwartet 200, bekam ${status}`)
    })
  } else {
    console.log(c.yellow('  ⚠ CRON_SECRET nicht gesetzt — übersprungen'))
  }

  // ── Sektion: Invoice ────────────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Rechnungen'))

  await test('GET /api/invoices/[id] — Ohne Auth → 401', async () => {
    const { status } = await api('/api/invoices/00000000-0000-0000-0000-000000000000')
    assert(status === 401, `Erwartet 401 ohne Auth, bekam ${status}`)
  })

  // ── Sektion: Staff ──────────────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Staff'))

  await test('GET /api/staff — Liste laden', async () => {
    const { status, body } = await api('/api/staff', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    assert(status === 200, `Erwartet 200, bekam ${status}`)
    assert(Array.isArray(body), 'Erwartet Array')
  })

  await test('POST /api/staff — Trainer einladen', async () => {
    const { status, body } = await api('/api/staff', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        email: `trainer+${runId}@test.dev`,
        name: 'Test Trainer',
        role: 'trainer',
      }),
    })
    assert(status === 200 || status === 201, `Erwartet 2xx, bekam ${status} — ${JSON.stringify(body)}`)
    assert(!!body.invite_token, 'Kein invite_token in Antwort')

    // Cleanup staff entry
    if (body.id) {
      await api(`/api/staff/${body.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    }
  })

  // ── Sektion: Plan Limits ────────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Plan Limits'))

  await test('Plan-Limit: 30 Mitglieder auf Free', async () => {
    // Set limit to 1 to simulate reached limit
    await db.from('gyms').update({ plan_member_limit: 1 }).eq('id', gymId)

    const { status, body } = await api('/api/members', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        first_name: 'Overflow', last_name: 'Member',
        belt: 'white',
        join_date: new Date().toISOString().split('T')[0],
      }),
    })
    // Restore limit
    await db.from('gyms').update({ plan_member_limit: 30 }).eq('id', gymId)

    assert(status === 403, `Erwartet 403 bei überschrittenem Limit, bekam ${status} — ${JSON.stringify(body)}`)
    assert(body.error === 'PLAN_LIMIT_REACHED', `Erwartet PLAN_LIMIT_REACHED, bekam: ${body.error}`)
  })

  // ── Sektion: Signup (public) ────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Signup Flow'))

  await test('GET /signup/[token] — Seite erreichbar', async () => {
    const { data: gym } = await db.from('gyms').select('signup_token').eq('id', gymId).single()
    const token = (gym as any)?.signup_token
    if (!token) { console.log(c.dim('    (kein signup_token — übersprungen)')); return }

    const { status } = await api(`/signup/${token}`)
    assert(status === 200, `Erwartet 200, bekam ${status}`)
  })

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  console.log(c.cyan('\n  ── Cleanup'))

  await test('Testdaten bereinigen', async () => {
    const errors: string[] = []

    const del = async (table: string, field: string, value: string) => {
      const { error } = await db.from(table).delete().eq(field, value)
      if (error) errors.push(`${table}: ${error.message}`)
    }

    await del('training_logs',   'member_id', memberId)
    await del('attendance',      'member_id', memberId)
    await del('class_bookings',  'member_id', memberId)
    await del('belt_promotions', 'member_id', memberId)
    await del('payments',        'gym_id',    gymId)
    await del('classes',         'gym_id',    gymId)
    await del('gym_staff',       'gym_id',    gymId)
    await del('leads',           'gym_id',    gymId)
    await del('members',         'gym_id',    gymId)
    await del('gyms',            'id',        gymId)

    await db.auth.admin.deleteUser(userId)

    assert(errors.length === 0, `Cleanup-Fehler:\n    ${errors.join('\n    ')}`)

    // Verify
    const { data } = await db.from('gyms').select('id').eq('id', gymId)
    assert(!data || data.length === 0, 'Gym existiert noch nach Cleanup!')
  })

  // ── Report ───────────────────────────────────────────────────────────────────

  const passed  = results.filter(r => r.passed).length
  const failed  = results.filter(r => !r.passed).length
  const totalMs = results.reduce((s, r) => s + r.ms, 0)

  console.log('\n' + c.dim('  ' + '─'.repeat(56)))
  console.log(
    `  ${c.bold('Ergebnis:')}  ` +
    c.green(`${passed} ✓`) +
    (failed > 0 ? `  ${c.red(`${failed} ✗`)}` : '') +
    c.dim(`  (${(totalMs / 1000).toFixed(1)}s)`)
  )

  if (failed > 0) {
    console.log(c.bold(c.red('\n  Fehlgeschlagene Tests:')))
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${c.red('✗')} ${r.name}`)
      if (r.error) console.log(`    ${c.dim(r.error)}`)
    })
    console.log()
    process.exit(1)
  } else {
    console.log(c.green(`\n  ✓ Alle ${passed} Tests bestanden!\n`))
  }
}

main().catch(err => {
  console.error(c.red(`\n  Fatal: ${err?.message ?? err}\n`))
  process.exit(1)
})
