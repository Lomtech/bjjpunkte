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

  // Bot-Detection
  const bot = isBot(ua)

  // Referrer-Quelle aggregieren (für UI-Auswertung)
  const referrerSource = categorizeReferrer(referrerDomain)

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
    is_bot:          bot,
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
