import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  visitorHash,
  sessionHash,
  classifyDevice,
  extractReferrerDomain,
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
 * Body: { path: string, referrer?: string }
 */
export async function POST(req: Request) {
  let body: { path?: string; referrer?: string } = {}
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
    path === '/dashboard'
  ) {
    return NextResponse.json({ ok: true, skipped: true })
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
  })

  if (error) {
    // Tracking-Fehler dürfen NIEMALS den User-Flow blockieren — silent fail
    console.error('[track] insert failed', error.message)
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  return NextResponse.json({ ok: true })
}
