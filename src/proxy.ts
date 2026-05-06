import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

const RATE_LIMITED = /^\/(api\/portal|api\/public|api\/signup|api\/auth\/delete-account|api\/staff\/accept|api\/staff\/link)\//

export async function proxy(request: NextRequest) {
  if (RATE_LIMITED.test(request.nextUrl.pathname)) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const rl = await getRatelimiter()
    const { success } = await rl.limit(`rl:${ip}`)
    if (!success) {
      return NextResponse.json(
        { error: 'Zu viele Anfragen. Bitte kurz warten.' },
        { status: 429 }
      )
    }
  }

  // Sync Supabase session into cookies so server components can read it
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

// Pass 22: matcher excludes /api/public/*, /api/portal/*, /api/signup, /api/sentry-example-api
// from middleware altogether. Middleware was crashing on all GET requests to these paths
// (proven by /api/public/ping with no Supabase imports also returning 500). The Supabase
// session sync + Upstash dynamic import in proxy.ts is incompatible with these routes
// in Vercel's Edge runtime. Public routes don't need Supabase session anyway — they use
// service role for DB access.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/public|api/portal|api/signup|api/sentry-example-api|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
