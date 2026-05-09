/**
 * Handler-side rate limiter for routes that are excluded from the proxy
 * middleware. Public, portal, signup, track, and admin routes don't run
 * through the middleware (Edge-Runtime compatibility — see src/proxy.ts
 * matcher config). To still protect them from DDoS, call `applyRateLimit`
 * inside the route handler.
 *
 * Usage:
 *   export async function POST(req: Request) {
 *     const limited = await applyRateLimit(req, { kind: 'track', limit: 60, windowSec: 60 })
 *     if (limited) return limited
 *     // …rest of handler
 *   }
 *
 * Storage strategy:
 *   - If UPSTASH_REDIS_REST_URL + TOKEN are set: use Upstash sliding-window
 *     (distributed, accurate across Vercel function instances).
 *   - Otherwise: in-memory fallback per Node-process. NOT distributed —
 *     Vercel can spawn multiple instances per region — but it caps the
 *     worst-case single-instance abuse. Production should set Upstash.
 */
import { NextResponse } from 'next/server'

type Limiter = { limit: (key: string) => Promise<{ success: boolean }> }
let ratelimiter: Limiter | null = null
let ratelimiterPromise: Promise<Limiter> | null = null

function buildInMemoryLimiter(maxReqs: number, windowMs: number): Limiter {
  const CLEANUP_INTERVAL_MS = 5 * 60_000
  const store = new Map<string, { n: number; reset: number }>()
  let lastCleanup = Date.now()

  return {
    limit: async (key: string) => {
      const now = Date.now()
      if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
        lastCleanup = now
        for (const [k, e] of store) { if (now > e.reset) store.delete(k) }
      }
      const e = store.get(key)
      if (!e || now > e.reset) {
        store.set(key, { n: 1, reset: now + windowMs })
        return { success: true }
      }
      e.n++
      return { success: e.n <= maxReqs }
    },
  }
}

async function getLimiter(maxReqs: number, windowSec: number): Promise<Limiter> {
  if (ratelimiter) return ratelimiter
  if (ratelimiterPromise) return ratelimiterPromise

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    ratelimiter = buildInMemoryLimiter(maxReqs, windowSec * 1000)
    return ratelimiter
  }

  ratelimiterPromise = (async () => {
    try {
      const [{ Redis }, { Ratelimit }] = await Promise.all([
        import('@upstash/redis'),
        import('@upstash/ratelimit'),
      ])
      const redis = new Redis({ url, token })
      const rl = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxReqs, `${windowSec} s`),
        analytics: false,
      }) as unknown as Limiter
      ratelimiter = rl
      return rl
    } catch (err) {
      console.warn('[rate-limit-handler] Upstash unavailable, using in-memory fallback:', err)
      ratelimiter = buildInMemoryLimiter(maxReqs, windowSec * 1000)
      return ratelimiter
    }
  })()
  return ratelimiterPromise
}

export interface RateLimitOptions {
  /** Logical bucket name — included in the rate-limit key for namespacing. */
  kind: string
  /** Max requests per window. Default: 30 */
  limit?: number
  /** Window size in seconds. Default: 60 */
  windowSec?: number
}

/**
 * Apply rate limit to a request. Returns a 429 NextResponse if exceeded,
 * otherwise null (caller should continue handling the request).
 *
 * Identifier preference: x-forwarded-for → x-real-ip → 'unknown'.
 */
export async function applyRateLimit(
  req: Request,
  opts: RateLimitOptions,
): Promise<NextResponse | null> {
  const limit = opts.limit ?? 30
  const windowSec = opts.windowSec ?? 60

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  try {
    const rl = await getLimiter(limit, windowSec)
    const { success } = await rl.limit(`rl:${opts.kind}:${ip}`)
    if (!success) {
      return NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte kurz warten.' },
        { status: 429 },
      )
    }
    return null
  } catch (err) {
    // Never let rate-limit errors block legitimate traffic — log and pass.
    console.error('[rate-limit-handler] limiter failed, passing through:', err)
    return null
  }
}
