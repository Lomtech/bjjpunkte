import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Redis-based rate limiting (Upstash) with in-memory fallback
let ratelimiter: { limit: (key: string) => Promise<{ success: boolean }> } | null = null

function getRatelimiter() {
  if (ratelimiter) return ratelimiter

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (url && token) {
    // Dynamic import to avoid build errors when package not installed
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Redis } = require('@upstash/redis')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Ratelimit } = require('@upstash/ratelimit')
      const redis = new Redis({ url, token })
      ratelimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '60 s'),
        analytics: false,
      })
    } catch {
      console.warn('[proxy] @upstash/ratelimit not available, using in-memory fallback')
      ratelimiter = createInMemoryLimiter()
    }
  } else {
    console.warn('[proxy] UPSTASH_REDIS_REST_URL not set, using in-memory rate limiting (not suitable for production)')
    ratelimiter = createInMemoryLimiter()
  }

  return ratelimiter
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
    const rl = getRatelimiter()!
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

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
