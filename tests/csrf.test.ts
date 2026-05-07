#!/usr/bin/env npx tsx
/**
 * CSRF Protection Tests
 *
 * Testet die `checkCsrf()` und `safeOrigin()` Helper aus `src/proxy.ts`
 * mit minimal gemockten NextRequest-ähnlichen Objekten.
 *
 * Usage:
 *   npx tsx tests/csrf.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { checkCsrf, safeOrigin, type CsrfRequest } from '../src/proxy'

// ── Mock NextRequest ──────────────────────────────────────────────────────────

interface MockOpts {
  method: string
  pathname: string
  headers?: Record<string, string>
}

function mockRequest(opts: MockOpts): CsrfRequest {
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    lower[k.toLowerCase()] = v
  }
  return {
    method: opts.method,
    nextUrl: { pathname: opts.pathname },
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
  }
}

// ── safeOrigin() ──────────────────────────────────────────────────────────────

test('safeOrigin: extrahiert origin aus URL', () => {
  assert.equal(safeOrigin('https://www.osss.pro/foo/bar?x=1'), 'https://www.osss.pro')
})

test('safeOrigin: invalide URL → null', () => {
  assert.equal(safeOrigin('not-a-url'), null)
  assert.equal(safeOrigin(''), null)
  assert.equal(safeOrigin(null), null)
  assert.equal(safeOrigin(undefined), null)
})

// ── checkCsrf() ───────────────────────────────────────────────────────────────

test('Test 1: GET → durchgelassen', () => {
  const result = checkCsrf(mockRequest({
    method: 'GET',
    pathname: '/api/members',
  }))
  assert.equal(result, null, 'GET sollte durchgelassen werden')
})

test('Test 1b: HEAD → durchgelassen', () => {
  assert.equal(checkCsrf(mockRequest({ method: 'HEAD', pathname: '/api/members' })), null)
})

test('Test 1c: OPTIONS → durchgelassen', () => {
  assert.equal(checkCsrf(mockRequest({ method: 'OPTIONS', pathname: '/api/members' })), null)
})

test('Test 2: POST mit Origin: https://evil.com → 403', async () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/members',
    headers: { Origin: 'https://evil.com' },
  }))
  assert.notEqual(result, null, 'evil.com sollte abgelehnt werden')
  assert.equal(result!.status, 403, 'Status sollte 403 sein')
  const body = await result!.json()
  assert.match(body.error, /origin mismatch/i)
})

test('Test 3: POST mit Origin: https://www.osss.pro → durchgelassen', () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/members',
    headers: { Origin: 'https://www.osss.pro' },
  }))
  assert.equal(result, null, 'osss.pro sollte durchgelassen werden')
})

test('Test 3b: POST mit Origin: http://localhost:3000 → durchgelassen', () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/members',
    headers: { Origin: 'http://localhost:3000' },
  }))
  assert.equal(result, null)
})

test('Test 3c: POST nur mit Referer (kein Origin) → durchgelassen wenn allowed', () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/members',
    headers: { Referer: 'https://www.osss.pro/dashboard' },
  }))
  assert.equal(result, null, 'Referer-Fallback sollte funktionieren')
})

test('Test 4: POST /api/stripe/webhook mit beliebigem Origin → durchgelassen (whitelisted)', () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/stripe/webhook',
    headers: { Origin: 'https://api.stripe.com' },
  }))
  assert.equal(result, null, 'Stripe webhook sollte whitelisted sein')
})

test('Test 4b: POST /api/stripe/webhook ohne jegliche Header → durchgelassen', () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/stripe/webhook',
  }))
  assert.equal(result, null)
})

test('Test 5: POST /api/public/foo → durchgelassen (whitelisted)', () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/public/foo',
    headers: { Origin: 'https://anywhere.example' },
  }))
  assert.equal(result, null)
})

test('Test 5b: POST /api/cron/birthday → durchgelassen (whitelisted)', () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/cron/birthday',
  }))
  assert.equal(result, null)
})

test('Test 6: POST mit Authorization: Bearer xxx ohne Origin → durchgelassen (Bearer-Bypass)', () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/members',
    headers: { Authorization: 'Bearer eyJhbGc.test.token' },
  }))
  assert.equal(result, null, 'Bearer-Auth sollte CSRF-Check bypassen')
})

test('Test 6b: POST mit Bearer und Evil-Origin → durchgelassen (Bearer schlägt durch)', () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/members',
    headers: {
      Authorization: 'Bearer xxx.yyy.zzz',
      Origin: 'https://evil.com',
    },
  }))
  assert.equal(result, null, 'Bearer-Routes sind nicht CSRF-anfällig')
})

test('Test 7: POST ohne Origin und ohne Bearer → 403', async () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/members',
  }))
  assert.notEqual(result, null)
  assert.equal(result!.status, 403)
})

test('Test 7b: PUT mit Evil-Origin → 403', () => {
  const result = checkCsrf(mockRequest({
    method: 'PUT',
    pathname: '/api/leads/abc',
    headers: { Origin: 'https://attacker.example' },
  }))
  assert.notEqual(result, null)
  assert.equal(result!.status, 403)
})

test('Test 7c: DELETE mit Evil-Origin → 403', () => {
  const result = checkCsrf(mockRequest({
    method: 'DELETE',
    pathname: '/api/leads/abc',
    headers: { Origin: 'https://attacker.example' },
  }))
  assert.notEqual(result, null)
  assert.equal(result!.status, 403)
})

test('Non-API-Pfade werden nicht von checkCsrf belangt', () => {
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/dashboard',
    headers: { Origin: 'https://evil.com' },
  }))
  assert.equal(result, null, 'Nicht-API-POST sollten nicht hier blockiert werden')
})

test('Bearer mit kleinem b oder Basic → kein Bypass', () => {
  // Basic Auth ist nicht der typische Bearer-Token-Flow
  const result = checkCsrf(mockRequest({
    method: 'POST',
    pathname: '/api/members',
    headers: { Authorization: 'Basic dXNlcjpwYXNz' },
  }))
  assert.notEqual(result, null, 'Basic-Auth sollte CSRF-Check NICHT bypassen')
  assert.equal(result!.status, 403)
})
