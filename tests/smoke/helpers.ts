/**
 * Smoke-Test Helpers
 *
 * Geteilte Utilities für die Smoke-Test-Suite. Stil orientiert sich an
 * `tests/osss-test.ts` (Pass/Fail-Counter, Farb-Output, .env.local-Loader).
 *
 * ENV-Vars:
 *   TEST_API_BASE         Default https://www.osss.pro
 *   TEST_GYM_SLUG         Default cscffb
 *   TEST_OWNER_EMAIL      Optional — für Auth-Tests
 *   TEST_OWNER_PASSWORD   Optional — für Auth-Tests
 *   TEST_MEMBER_ID        Optional — für PDF-Tests (UUID)
 */

import fs from 'node:fs'
import path from 'node:path'

// ── .env.local-Loader (analog osss-test.ts) ──────────────────────────────────
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
    const val = rawVal.replace(/^["']|["']$/g, '')
    if (key && val && !process.env[key]) process.env[key] = val
  }
}
loadEnvLocal()

// ── Colors ───────────────────────────────────────────────────────────────────
export const c = {
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
}

// ── Config-Reader ────────────────────────────────────────────────────────────
export function getApiBase(): string {
  return process.env.TEST_API_BASE ?? 'https://www.osss.pro'
}

export function getTestSlug(): string {
  return process.env.TEST_GYM_SLUG ?? 'cscffb'
}

export function getMemberIdForTests(): string | null {
  const id = process.env.TEST_MEMBER_ID
  return id && id.length > 5 ? id : null
}

// ── Counter (shared across all test files) ───────────────────────────────────
export interface CounterEntry { name: string; status: 'pass' | 'fail' | 'skip'; ms?: number; error?: string; reason?: string }
export const counter: { entries: CounterEntry[] } = { entries: [] }

export function pass(name: string, ms = 0) {
  counter.entries.push({ name, status: 'pass', ms })
  console.log(`  ${c.green('✓')} ${name}${ms ? c.dim(` (${ms}ms)`) : ''}`)
}

export function fail(name: string, err: unknown, ms = 0) {
  const msg = err instanceof Error ? err.message : String(err)
  counter.entries.push({ name, status: 'fail', ms, error: msg })
  console.log(`  ${c.red('✗')} ${name}${ms ? c.dim(` (${ms}ms)`) : ''}`)
  console.log(`    ${c.dim('→')} ${c.red(msg)}`)
}

export function skip(name: string, reason: string) {
  counter.entries.push({ name, status: 'skip', reason })
  console.log(`  ${c.yellow('○')} ${name} ${c.dim(`(skipped: ${reason})`)}`)
}

// ── Test Runner ──────────────────────────────────────────────────────────────
export async function runTest(name: string, fn: () => Promise<void>) {
  const start = Date.now()
  try {
    await fn()
    pass(name, Date.now() - start)
  } catch (err) {
    fail(name, err, Date.now() - start)
  }
}

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

// ── HTTP-Client ──────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  status: number
  body: T
  headers: Headers
  raw: string
}

export async function api<T = unknown>(
  pathOrUrl: string,
  opts: RequestInit = {},
): Promise<ApiResponse<T>> {
  const base = getApiBase()
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${base}${pathOrUrl}`
  const headers: Record<string, string> = {}
  // Default Content-Type only if body is set and no override given
  const hasBody = opts.body !== undefined && opts.body !== null
  if (hasBody && !(opts.headers && (opts.headers as Record<string, string>)['Content-Type'])) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, {
    ...opts,
    headers: { ...headers, ...(opts.headers as Record<string, string> | undefined) },
  })
  const raw = await res.text()
  let body: unknown = raw
  try { body = JSON.parse(raw) } catch { /* keep as string (e.g. PDF binary as text) */ }
  return { status: res.status, body: body as T, headers: res.headers, raw }
}

// ── HEAD-like Request that doesn't parse the body (for binary endpoints) ────
export async function apiHead(
  pathOrUrl: string,
  opts: RequestInit = {},
): Promise<{ status: number; headers: Headers }> {
  const base = getApiBase()
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${base}${pathOrUrl}`
  const res = await fetch(url, opts)
  // Drain body to free socket
  await res.arrayBuffer().catch(() => {})
  return { status: res.status, headers: res.headers }
}

// ── Auth Token via Supabase REST (kein neues npm-Dep) ────────────────────────
let cachedAuthToken: string | null | undefined = undefined

export async function getAuthToken(): Promise<string | null> {
  if (cachedAuthToken !== undefined) return cachedAuthToken

  const email = process.env.TEST_OWNER_EMAIL
  const password = process.env.TEST_OWNER_PASSWORD
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!email || !password) {
    cachedAuthToken = null
    return null
  }
  if (!supabaseUrl || !supabaseAnon) {
    cachedAuthToken = null
    return null
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnon,
      },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      cachedAuthToken = null
      return null
    }
    const data = await res.json() as { access_token?: string }
    cachedAuthToken = data.access_token ?? null
    return cachedAuthToken
  } catch {
    cachedAuthToken = null
    return null
  }
}

// ── Helper: Section-Header drucken ───────────────────────────────────────────
export function section(label: string) {
  console.log(c.cyan(`\n  ── ${label}`))
}

// ── Unique-Test-Email (kollisionsfrei) ───────────────────────────────────────
export function uniqueTestEmail(prefix = 'smoke'): string {
  const now = Date.now()
  const rnd = Math.random().toString(36).slice(2, 8)
  return `${prefix}+${now}-${rnd}@osss-smoke.dev`
}
