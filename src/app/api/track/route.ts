import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  visitorHash,
  sessionHash,
  classifyDevice,
  extractReferrerDomain,
  isBot,
  categorizeReferrer,
  sanitizeUtm,
} from '@/lib/analytics-hash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ──────────────────────────────────────────────────────────────────────
// Per-IP Hard-Cap für /api/track (Audit 2026-05-09)
//
// Der Proxy-Limiter (src/proxy.ts) deckt bereits 30 req/min/IP für /api/track
// ab. Dieser Limiter greift als zweite Ebene mit 60 inserts/min/IP — falls
// der Proxy-Limit hochgesetzt wird, ohne dass /api/track separat geschützt
// werden muss. Upstash-Redis mit in-memory-Fallback (analog Proxy).
// ──────────────────────────────────────────────────────────────────────
type Limiter = { limit: (key: string) => Promise<{ success: boolean }> }
let trackLimiter: Limiter | null = null
let trackLimiterPromise: Promise<Limiter> | null = null

const TRACK_WINDOW_MS = 60_000
const TRACK_MAX       = 60

function createTrackInMemoryLimiter(): Limiter {
  const store = new Map<string, { n: number; reset: number }>()
  let lastCleanup = Date.now()
  return {
    limit: async (key: string) => {
      const now = Date.now()
      if (now - lastCleanup > 5 * TRACK_WINDOW_MS) {
        lastCleanup = now
        for (const [k, e] of store) { if (now > e.reset) store.delete(k) }
      }
      const e = store.get(key)
      if (!e || now > e.reset) {
        store.set(key, { n: 1, reset: now + TRACK_WINDOW_MS })
        return { success: true }
      }
      e.n++
      return { success: e.n <= TRACK_MAX }
    },
  }
}

async function getTrackLimiter(): Promise<Limiter> {
  if (trackLimiter) return trackLimiter
  if (trackLimiterPromise) return trackLimiterPromise

  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    trackLimiter = createTrackInMemoryLimiter()
    return trackLimiter
  }

  trackLimiterPromise = (async () => {
    try {
      const [{ Redis }, { Ratelimit }] = await Promise.all([
        import('@upstash/redis'),
        import('@upstash/ratelimit'),
      ])
      const redis = new Redis({ url, token })
      const rl = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(TRACK_MAX, '60 s'),
        analytics: false,
        prefix:    'rl:track',
      }) as unknown as Limiter
      trackLimiter = rl
      return rl
    } catch {
      trackLimiter = createTrackInMemoryLimiter()
      return trackLimiter
    }
  })()
  return trackLimiterPromise
}

async function trackInsertLimit(ip: string): Promise<boolean> {
  const rl = await getTrackLimiter()
  const { success } = await rl.limit(`track:${ip}`)
  return success
}

/**
 * POST /api/track
 *
 * DSGVO-anonyme Reichweiten-Messung. Schreibt eine Zeile in `page_views`.
 *
 * KEIN Cookie. KEIN LocalStorage. KEINE IP-Speicherung.
 * visitor_hash + session_hash sind täglich/30min-rotierend gesalzen
 * → kein Personenbezug rekonstruierbar.
 *
 * Body:
 *   { path: string,
 *     referrer?: string,
 *     event_type?: 'page_view' | 'click',
 *     event_target?: string,         // z.B. 'cta_signup' (nur bei click)
 *     utm_source?: string,
 *     utm_medium?: string,
 *     utm_campaign?: string }
 */
export async function POST(req: Request) {
  let body: {
    path?: string
    referrer?: string
    event_type?: string
    event_target?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 200 })
  }

  const path = typeof body.path === 'string' ? body.path.slice(0, 500) : null
  if (!path) return NextResponse.json({ ok: false }, { status: 200 })

  // Eigene Auth-/API-/Admin-Routes nicht tracken — nur Public-Pages
  if (
    path.startsWith('/api/') ||
    path.startsWith('/dashboard/') ||
    path.startsWith('/admin/') ||
    path.startsWith('/auth/') ||
    path.startsWith('/portal/') ||
    path.startsWith('/signup/') ||
    path.startsWith('/staff/') ||
    path === '/dashboard' ||
    path === '/no-track'  // Owner-Opt-Out-Page selbst nicht tracken
  ) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Owner/Admin-Opt-Out via Cookie — wird gesetzt sobald jemand das Dashboard
  // oder /admin/analytics auf einem Gerät öffnet. Funktioniert geräte-übergreifend
  // (jeder Browser bekommt seinen eigenen Cookie nach dem ersten Login).
  // Cookie-Header ist `osss-internal=1`.
  const cookieHeader = req.headers.get('cookie') ?? ''
  if (/(?:^|;\s*)osss-internal=1/.test(cookieHeader)) {
    return NextResponse.json({ ok: true, skipped: 'internal' })
  }

  // IP-Quellen: Vercel/Cloudflare-Header. Falls keine: 'unknown' (Localhost-Dev).
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  const ua = req.headers.get('user-agent') || 'unknown'

  // Country aus Vercel-Edge oder Cloudflare-Header — keine eigene Geo-Lookup
  const country =
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    null

  // Bot-Filter (Audit 2026-05-09): Silent reject statt is_bot-Persist.
  // Bots (Crawler, Monitoring, Scanner) verzerren sonst die Aggregate und
  // verbrauchen unnötig Storage. Antwort 200 OK, damit Bots kein Feedback
  // bekommen, ob sie erkannt wurden — sie sollen nicht ihren UA tunen können.
  if (isBot(ua)) {
    return NextResponse.json({ ok: true, skipped: 'bot' })
  }

  const { device_type, browser } = classifyDevice(ua)
  const referrerDomain = extractReferrerDomain(body.referrer ?? req.headers.get('referer'))

  // Event-Type validieren — nur Whitelist
  const validEventTypes = new Set(['page_view', 'click', 'conversion'])
  const eventType = (typeof body.event_type === 'string' && validEventTypes.has(body.event_type))
    ? body.event_type
    : 'page_view'

  // Event-Target sanitizen (nur a-z, 0-9, _, -, max 100 Zeichen)
  const eventTarget = (eventType !== 'page_view' && typeof body.event_target === 'string')
    ? body.event_target.toLowerCase().replace(/[^a-z0-9_\-.]/g, '').slice(0, 100) || null
    : null

  // UTM-Params sanitizen
  const utmSource   = sanitizeUtm(body.utm_source)
  const utmMedium   = sanitizeUtm(body.utm_medium)
  const utmCampaign = sanitizeUtm(body.utm_campaign)

  // Referrer-Quelle aggregieren (für UI-Auswertung)
  const referrerSource = categorizeReferrer(referrerDomain)

  // Hard-Cap pro IP: 60 inserts/min. Greift zusätzlich zum allgemeinen
  // Proxy-Limit (30 req/min/IP in `src/proxy.ts`). Falls das Proxy-Limit
  // mal hochgesetzt wird, fängt dieser Limiter den /api/track-Spam ab,
  // ohne andere Routen zu beeinflussen. Upstash mit in-memory-Fallback,
  // identische Mechanik wie der Proxy-Limiter.
  const allowed = await trackInsertLimit(ip)
  if (!allowed) {
    // 200 statt 429: wir wollen nicht verraten, dass wir limitieren.
    return NextResponse.json({ ok: true, skipped: 'rate_cap' })
  }

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('page_views') as any).insert({
    path,
    referrer_domain: referrerDomain,
    country: country ? country.slice(0, 2).toUpperCase() : null,
    device_type,
    browser,
    visitor_hash: visitorHash(ip, ua),
    session_hash: sessionHash(ip, ua),
    is_bot:          false,
    event_type:      eventType,
    event_target:    eventTarget,
    utm_source:      utmSource,
    utm_medium:      utmMedium,
    utm_campaign:    utmCampaign,
    referrer_source: referrerSource,
  })

  if (error) {
    // Tracking-Fehler dürfen NIEMALS den User-Flow blockieren — silent fail
    console.error('[track] insert failed', error.message)
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return NextResponse.json({ ok: true })
}
