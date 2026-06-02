import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─────────────────────────────────────────────────────────────────────────────
// CSRF Protection
// ─────────────────────────────────────────────────────────────────────────────
//
// Supabase-Auth nutzt HttpOnly-Cookies, daher sind Cookie-authentifizierte
// state-mutating API-Routes prinzipiell CSRF-anfällig (externe Site könnte
// Cross-Site `<form>` POST mit User-Cookie abschicken). Lösung:
// Origin/Referer-Header-Check im Proxy. Bearer-Token-Routes sind nicht
// CSRF-anfällig (Browser sendet keinen Authorization-Header automatisch
// bei Cross-Site-Requests) und werden gebypasst.

const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Pfade, bei denen CSRF-Check NICHT greift:
// - /api/stripe/webhook: Stripe prüft eigene HMAC-Signatur
// - /api/public/*:       Öffentliche Endpoints, oft Klicks von externen Sites
// - /api/cron/*:         Cron-Jobs (Bearer-Auth via CRON_SECRET)
// - /api/inngest:        Inngest-Serve-Handler — HMAC-Auth via X-Inngest-Signature
//                        (Sync-PUT + Invocation-POST aus Inngest-Cloud)
const CSRF_WHITELIST_PREFIXES = [
  '/api/stripe/webhook',
  '/api/public/',
  '/api/cron/',
  '/api/inngest',
]

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>([
    'https://www.osss.pro',
    'https://osss.pro',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ])
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const o = safeOrigin(process.env.NEXT_PUBLIC_APP_URL)
    if (o) origins.add(o)
  }
  if (process.env.CSRF_ALLOWED_ORIGINS) {
    for (const raw of process.env.CSRF_ALLOWED_ORIGINS.split(',')) {
      const o = safeOrigin(raw.trim())
      if (o) origins.add(o)
    }
  }
  return origins
}

const ALLOWED_ORIGINS = buildAllowedOrigins()

/**
 * Extrahiert den Origin (`scheme://host[:port]`) aus einer URL/Referer-Wert.
 * Gibt `null` bei invaliden URLs zurück.
 */
export function safeOrigin(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export interface CsrfRequest {
  method: string
  nextUrl: { pathname: string }
  headers: { get(name: string): string | null }
}

/**
 * Prüft ob ein Request CSRF-blockiert werden muss.
 * Gibt `null` zurück wenn der Request durchgelassen werden soll,
 * ansonsten eine `NextResponse` mit 403.
 */
export function checkCsrf(request: CsrfRequest): NextResponse | null {
  const method = request.method.toUpperCase()
  if (!CSRF_METHODS.has(method)) return null

  const path = request.nextUrl.pathname
  if (!path.startsWith('/api/')) return null

  for (const prefix of CSRF_WHITELIST_PREFIXES) {
    if (path === prefix || path.startsWith(prefix)) return null
  }

  // Bearer-Auth ist nicht CSRF-anfällig (Browser sendet keine
  // Authorization-Header automatisch bei Cross-Site-Requests).
  const auth = request.headers.get('Authorization') ?? request.headers.get('authorization')
  if (auth && auth.startsWith('Bearer ')) return null

  const origin  = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const reqOrigin = origin ?? (referer ? safeOrigin(referer) : null)

  if (!reqOrigin || !ALLOWED_ORIGINS.has(reqOrigin)) {
    console.warn('[csrf] reject', { method, path, origin, referer })
    return NextResponse.json({ error: 'Forbidden: origin mismatch' }, { status: 403 })
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────────────────────────────

// Redis-based rate limiting (Upstash) with in-memory fallback
type Limiter = { limit: (key: string) => Promise<{ success: boolean }> }
let ratelimiter: Limiter | null = null
let ratelimiterPromise: Promise<Limiter> | null = null

async function getRatelimiter(): Promise<Limiter> {
  if (ratelimiter) return ratelimiter
  if (ratelimiterPromise) return ratelimiterPromise

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    ratelimiter = createInMemoryLimiter()
    return ratelimiter
  }

  // Edge runtime forbids require(); use dynamic ESM import.
  ratelimiterPromise = (async () => {
    try {
      const [{ Redis }, { Ratelimit }] = await Promise.all([
        import('@upstash/redis'),
        import('@upstash/ratelimit'),
      ])
      const redis = new Redis({ url, token })
      const rl = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '60 s'),
        analytics: false,
      }) as unknown as Limiter
      ratelimiter = rl
      return rl
    } catch {
      ratelimiter = createInMemoryLimiter()
      return ratelimiter
    }
  })()
  return ratelimiterPromise
}

// In-memory fallback (per-process, not distributed)
function createInMemoryLimiter() {
  const WINDOW_MS = 60_000
  const MAX_REQS  = 30
  const CLEANUP_INTERVAL = 5 * 60_000
  const store = new Map<string, { n: number; reset: number }>()
  let lastCleanup = Date.now()

  return {
    limit: async (key: string) => {
      const now = Date.now()
      if (now - lastCleanup > CLEANUP_INTERVAL) {
        lastCleanup = now
        for (const [k, e] of store) { if (now > e.reset) store.delete(k) }
      }
      const e = store.get(key)
      if (!e || now > e.reset) {
        store.set(key, { n: 1, reset: now + WINDOW_MS })
        return { success: true }
      }
      e.n++
      return { success: e.n <= MAX_REQS }
    }
  }
}

// Rate-Limit in Middleware: NUR für Pfade die mit dem Edge-Runtime-Session-Sync
// vertragen — sprich, NICHT die Pfade die im Matcher ausgeschlossen sind.
// Public/Portal/Signup/Track werden separat durch den `applyRateLimit`-Helper
// in den jeweiligen Route-Handlern geschützt (Node-Runtime, sicherer Pfad).
const RATE_LIMITED = /^\/(api\/auth\/delete-account|api\/staff\/accept|api\/staff\/link|api\/avv|api\/newsletter)\//

export async function proxy(request: NextRequest) {
  // CSRF-Check VOR Rate-Limit (günstiger, blockt Bot-Attacks früher)
  const csrfReject = checkCsrf(request)
  if (csrfReject) return csrfReject

  if (RATE_LIMITED.test(request.nextUrl.pathname)) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    // Audit 2026-05-11: rl.limit() KANN zur Runtime werfen (Upstash WRONGPASS bei
    // abgelaufenem Token, Netzwerk-Fehler etc.). Ohne try/catch propagiert das
    // bis ins Edge-Runtime → Vercel returnt generic Plain-Text 500 ohne Body.
    // Genau das hat /api/avv/* in Production gekillt. Fail-open: lieber 1 Request
    // durchwinken als das ganze Endpoint crashen.
    try {
      const rl = await getRatelimiter()
      const { success } = await rl.limit(`rl:${ip}`)
      if (!success) {
        return NextResponse.json(
          { error: 'Zu viele Anfragen. Bitte kurz warten.' },
          { status: 429 }
        )
      }
    } catch (err) {
      console.error('[proxy] rate-limit check failed, passing through:', err)
    }
  }

  // Sync Supabase session into cookies so server components can read it.
  // Public/Portal/Signup/Track/Admin/Sentry-Example sind im Matcher
  // ausgeschlossen — diese Funktion läuft für sie gar nicht erst.
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  await supabase.auth.getUser()

  return response
}

// Pass 22-revisited: Matcher excludes /api/public/*, /api/portal/*, /api/signup,
// /api/track, /api/sentry-example-api, /api/admin/* from the middleware.
// Reason: the Supabase session-sync via @supabase/ssr is incompatible with
// some Vercel Edge-Runtime invocations on these paths (proven empirically —
// /api/public/ping with no Supabase imports STILL returned 500 when running
// through this middleware). /api/admin/* uses Bearer-token auth via
// requireAdmin() and doesn't need cookie sync.
//
// Rate-Limit for the excluded paths happens IN the route handlers via
// `applyRateLimit()` in src/lib/rate-limit-handler.ts (Node-Runtime, safe).
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/public|api/portal|api/signup|api/track|api/admin|api/sentry-example-api|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
