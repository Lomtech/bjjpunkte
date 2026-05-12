import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface PageViewRow {
  path: string
  referrer_domain: string | null
  country: string | null
  device_type: string | null
  browser: string | null
  visitor_hash: string | null
  session_hash: string | null
  created_at: string
  is_bot: boolean | null
  event_type: string | null
  event_target: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  referrer_source: string | null
}

/**
 * GET /api/admin/analytics?range=7d|30d|90d
 *   &path=/pricing       (optional — exact-match oder Prefix mit Trailing /*)
 *   &country=DE          (optional — 2-Letter-Code)
 *   &device=mobile       (optional — mobile/tablet/desktop/unknown)
 *   &browser=chrome      (optional — chrome/safari/firefox/edge/…)
 *   &source=google       (optional — kategorisierte Referrer-Source)
 *
 * Aggregierte Analytics-Daten für das Admin-Dashboard.
 * Cross-Filter: alle Stats werden auf den Filter eingeschränkt — der Funnel
 * bleibt aber session-vollständig (sonst kein sinnvoller Funnel mehr).
 *
 * Zugriff nur via requireAdmin().
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const url = new URL(req.url)
  const range = url.searchParams.get('range') || '30d'

  // Custom date range: ?from=YYYY-MM-DD&to=YYYY-MM-DD überschreibt range-Preset
  const paramFrom = url.searchParams.get('from')
  const paramTo   = url.searchParams.get('to')
  let since: string
  let until: Date     // ENDE des Zeitraums (default: jetzt). Wichtig für die
                      // Timeline-Achse — sonst stimmt sie bei Custom-Range nicht.
  let days: number
  if (paramFrom) {
    const fromDate = new Date(paramFrom + 'T00:00:00Z')
    const toDate   = paramTo ? new Date(paramTo + 'T23:59:59Z') : new Date()
    since = fromDate.toISOString()
    until = toDate
    days  = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000) + 1)
  } else {
    days  = range === '7d' ? 7 : range === '90d' ? 90 : 30
    until = new Date()
    // (days - 1) statt days, damit HEUTE als letzter Tag im Fenster liegt.
    // Vorher: 30 Tage zurück → Loop erzeugte [heute−30, heute−1] → heute fehlte.
    // Jetzt:  Fenster = [heute − (days−1), heute] inklusiv = exakt `days` Tage.
    since = new Date(until.getTime() - (days - 1) * 86400000).toISOString()
  }

  // Vorperiode für Trend-Vergleich (gleicher Zeitraum-Längen, davor).
  // periodMs basiert auf `days` (Anzahl Tage im Fenster), nicht auf der Differenz
  // until−since, damit Rolling-Range und Custom-Range konsistent dieselbe
  // Tageszahl als Vergleichsfenster nehmen.
  const periodMs  = days * 86400000
  const prevSince = new Date(new Date(since).getTime() - periodMs).toISOString()
  const prevUntil = new Date(new Date(since).getTime() - 1).toISOString()

  // Filters — alle optional, werden in-memory nach dem Fetch angewendet.
  // (Bei kleinen Volumes < 50k Rows ist das schnell genug; bei größeren
  // Volumes müsste der Filter via .eq()/.like() in die SQL-Query.)
  const filterPath    = url.searchParams.get('path')?.trim() || null
  const filterCountry = url.searchParams.get('country')?.trim().toUpperCase() || null
  const filterDevice  = url.searchParams.get('device')?.trim().toLowerCase() || null
  const filterBrowser = url.searchParams.get('browser')?.trim().toLowerCase() || null
  const filterSource  = url.searchParams.get('source')?.trim().toLowerCase() || null

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('page_views') as any)
    .select('path, referrer_domain, country, device_type, browser, visitor_hash, session_hash, created_at, is_bot, event_type, event_target, utm_source, utm_medium, utm_campaign, referrer_source')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50000)
  if (paramTo) {
    query = query.lte('created_at', until.toISOString())
  }

  // Vorperiode parallel laden (für %-Delta-Trend)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevQuery = (supabase.from('page_views') as any)
    .select('visitor_hash, session_hash, is_bot, event_type', { count: 'exact' })
    .gte('created_at', prevSince)
    .lte('created_at', prevUntil)
    .eq('is_bot', false)
    .eq('event_type', 'page_view')
    .limit(50000)

  const [{ data, error }, { data: prevData }] = await Promise.all([query, prevQuery])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Previous-period summary
  const prevRows = (prevData ?? []) as { visitor_hash: string | null; session_hash: string | null }[]
  const prev = {
    total_views: prevRows.length,
    unique_visitors: new Set(prevRows.map(r => r.visitor_hash).filter(Boolean)).size,
    unique_sessions: new Set(prevRows.map(r => r.session_hash).filter(Boolean)).size,
  }

  const allRows = (data ?? []) as PageViewRow[]

  // Bot-Filter: alles trennen — Hauptstats nur Menschen, Bot-Zahlen separat
  const botCount   = allRows.filter(r => r.is_bot === true).length
  let humanRows    = allRows.filter(r => r.is_bot !== true)

  // Cross-Filter anwenden. Path: exact OR prefix mit Trailing /* (z.B.
  // "/blog/*" matcht /blog, /blog/foo, /blog/bar/baz).
  if (filterPath) {
    const isPrefix = filterPath.endsWith('/*')
    const prefix = isPrefix ? filterPath.slice(0, -2) : null
    humanRows = humanRows.filter(r => {
      if (isPrefix) return r.path === prefix || r.path.startsWith(prefix + '/')
      return r.path === filterPath
    })
  }
  if (filterCountry) {
    humanRows = humanRows.filter(r => (r.country ?? 'unknown').toUpperCase() === filterCountry)
  }
  if (filterDevice) {
    humanRows = humanRows.filter(r => (r.device_type ?? 'unknown') === filterDevice)
  }
  if (filterBrowser) {
    humanRows = humanRows.filter(r => (r.browser ?? 'other').toLowerCase() === filterBrowser)
  }
  if (filterSource) {
    humanRows = humanRows.filter(r => (r.referrer_source ?? 'direct').toLowerCase() === filterSource)
  }

  // Page-Views vs. Click-Events trennen
  const pageViewRows = humanRows.filter(r => (r.event_type ?? 'page_view') === 'page_view')
  const clickRows    = humanRows.filter(r => r.event_type === 'click')

  const rows = pageViewRows  // existing variable name compatibility
  const total = pageViewRows.length

  // Unique visitors (über die ganze Range — visitor_hash rotiert täglich,
  // also ist das eher "unique visit-days")
  const uniqueVisitors = new Set(rows.map(r => r.visitor_hash).filter(Boolean)).size
  const uniqueSessions = new Set(rows.map(r => r.session_hash).filter(Boolean)).size

  // Top Pages
  const pageCount = new Map<string, number>()
  for (const r of rows) pageCount.set(r.path, (pageCount.get(r.path) ?? 0) + 1)
  const topPages = [...pageCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([path, count]) => ({ path, count }))

  // Top Referrers
  const refCount = new Map<string, number>()
  for (const r of rows) {
    const ref = r.referrer_domain ?? 'direct'
    refCount.set(ref, (refCount.get(ref) ?? 0) + 1)
  }
  const topReferrers = [...refCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }))

  // Country
  const countryCount = new Map<string, number>()
  for (const r of rows) {
    const c = r.country ?? 'unknown'
    countryCount.set(c, (countryCount.get(c) ?? 0) + 1)
  }
  const countries = [...countryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([country, count]) => ({ country, count }))

  // Device
  const deviceCount = new Map<string, number>()
  for (const r of rows) {
    const d = r.device_type ?? 'unknown'
    deviceCount.set(d, (deviceCount.get(d) ?? 0) + 1)
  }
  const devices = [...deviceCount.entries()].map(([device, count]) => ({ device, count }))

  // Browser
  const browserCount = new Map<string, number>()
  for (const r of rows) {
    const b = r.browser ?? 'other'
    browserCount.set(b, (browserCount.get(b) ?? 0) + 1)
  }
  const browsers = [...browserCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([browser, count]) => ({ browser, count }))

  // Daily timeline — 3 Serien (Views, Sessions, Unique Visitors) damit im
  // Chart umschaltbar/overlay-bar. Sessions + Visitors brauchen Set-Tracking
  // pro Tag, da wir unique zählen.
  //
  // Iteration vom Range-START bis Range-ENDE (nicht von HEUTE rückwärts!) —
  // sonst zeigt der Chart bei Custom-Range "from=2024-01-01&to=2024-01-05"
  // fälschlicherweise die letzten 5 Tage ab heute.
  const dailyViews    = new Map<string, number>()
  const dailySessions = new Map<string, Set<string>>()
  const dailyVisitors = new Map<string, Set<string>>()
  const startDay = new Date(since).toISOString().slice(0, 10)
  const endDay   = until.toISOString().slice(0, 10)
  for (let i = 0; i < days; i++) {
    const d = new Date(new Date(startDay + 'T12:00:00Z').getTime() + i * 86400000).toISOString().slice(0, 10)
    if (d > endDay) break
    dailyViews.set(d, 0)
    dailySessions.set(d, new Set())
    dailyVisitors.set(d, new Set())
  }
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    if (!dailyViews.has(day)) continue
    dailyViews.set(day, (dailyViews.get(day) ?? 0) + 1)
    if (r.session_hash) dailySessions.get(day)!.add(r.session_hash)
    if (r.visitor_hash) dailyVisitors.get(day)!.add(r.visitor_hash)
  }
  const timeline = [...dailyViews.entries()].sort().map(([date, count]) => ({
    date,
    count,                                     // backwards-compat: page views
    views:    count,
    sessions: dailySessions.get(date)?.size ?? 0,
    visitors: dailyVisitors.get(date)?.size ?? 0,
  }))

  // Hour-of-day distribution (24 Buckets, Europe/Berlin lokalisiert) — zeigt
  // wann am Tag die meisten Visits kommen. DSGVO-konform: rein aggregiert,
  // keine Korrelation zu individuellen visitor_hashes — der hash wird nur als
  // Set-Element verwendet um unique-counts zu zählen, nicht persistiert.
  //
  // Bewusst Europe/Berlin (nicht UTC): Gym-Owner denken in lokaler Zeit
  // ("Peak nach Feierabend um 19 Uhr"), nicht in UTC.
  const hourFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    hour12: false,
  })
  const hourlyViews    = new Array<number>(24).fill(0)
  const hourlySessions = Array.from({ length: 24 }, () => new Set<string>())
  const hourlyVisitors = Array.from({ length: 24 }, () => new Set<string>())
  for (const r of rows) {
    // Intl.DateTimeFormat liefert "00" .. "23" — bei manchen Locales auch "24"
    // an der Mitternachts-Grenze. Mit modulo 24 normalisieren.
    const h = parseInt(hourFmt.format(new Date(r.created_at)), 10) % 24
    if (!Number.isFinite(h)) continue
    hourlyViews[h]++
    if (r.session_hash) hourlySessions[h].add(r.session_hash)
    if (r.visitor_hash) hourlyVisitors[h].add(r.visitor_hash)
  }
  const hourly = hourlyViews.map((views, hour) => ({
    hour,
    views,
    sessions: hourlySessions[hour].size,
    visitors: hourlyVisitors[hour].size,
  }))

  // Conversion-Funnel: Landing → Pricing → Register
  //
  // Funnel ignoriert den path-Filter (sonst sieht man immer nur einen Step).
  // Andere Filter (country/device/browser/source) wirken aber — das ist der
  // eigentliche Use-Case: "Wie konvertieren Mobile-Nutzer aus DE?"
  const funnelRowsBase = allRows.filter(r => r.is_bot !== true && (r.event_type ?? 'page_view') === 'page_view')
  const funnelRows = funnelRowsBase.filter(r => {
    if (filterCountry && (r.country ?? 'unknown').toUpperCase() !== filterCountry) return false
    if (filterDevice && (r.device_type ?? 'unknown') !== filterDevice) return false
    if (filterBrowser && (r.browser ?? 'other').toLowerCase() !== filterBrowser) return false
    if (filterSource && (r.referrer_source ?? 'direct').toLowerCase() !== filterSource) return false
    return true
  })
  const sessionsByPath = new Map<string, Set<string>>()
  for (const r of funnelRows) {
    if (!r.session_hash) continue
    if (!sessionsByPath.has(r.path)) sessionsByPath.set(r.path, new Set())
    sessionsByPath.get(r.path)!.add(r.session_hash)
  }
  const homeSessions = sessionsByPath.get('/')?.size ?? 0
  const pricingSessions = sessionsByPath.get('/pricing')?.size ?? 0
  const registerSessions = sessionsByPath.get('/register')?.size ?? 0
  const blogSessions = [...sessionsByPath.entries()]
    .filter(([p]) => p.startsWith('/blog'))
    .reduce((acc, [, s]) => {
      for (const h of s) acc.add(h)
      return acc
    }, new Set<string>()).size

  // Referrer-Source-Aggregation (vor-kategorisierte Quellen wie 'google',
  // 'linkedin', 'direct'). Schöner als rohe Domains für Übersicht.
  const sourceCount = new Map<string, number>()
  for (const r of rows) {
    const s = r.referrer_source ?? 'direct'
    sourceCount.set(s, (sourceCount.get(s) ?? 0) + 1)
  }
  const sources = [...sourceCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ source, count }))

  // Click-Events nach Target (z.B. cta_signup_hero: 5)
  const clickByTarget = new Map<string, number>()
  for (const r of clickRows) {
    if (!r.event_target) continue
    clickByTarget.set(r.event_target, (clickByTarget.get(r.event_target) ?? 0) + 1)
  }
  const clicks = [...clickByTarget.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([target, count]) => ({ target, count }))

  // UTM-Kampagnen aggregieren — Sessions pro Kampagne
  const campaignSessions = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!r.utm_source && !r.utm_campaign) continue
    const key = `${r.utm_source ?? '?'} / ${r.utm_medium ?? '?'} / ${r.utm_campaign ?? '?'}`
    if (!campaignSessions.has(key)) campaignSessions.set(key, new Set())
    if (r.session_hash) campaignSessions.get(key)!.add(r.session_hash)
  }
  const campaigns = [...campaignSessions.entries()]
    .map(([key, sessions]) => {
      const [source, medium, campaign] = key.split(' / ')
      return { source, medium, campaign, sessions: sessions.size }
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 25)

  // Bounce-Rate: Sessions mit genau 1 Page-View
  const viewsPerSession = new Map<string, number>()
  for (const r of rows) {
    if (!r.session_hash) continue
    viewsPerSession.set(r.session_hash, (viewsPerSession.get(r.session_hash) ?? 0) + 1)
  }
  const singlePageSessions = [...viewsPerSession.values()].filter(v => v === 1).length
  const bounceRate = uniqueSessions > 0
    ? Math.round((singlePageSessions / uniqueSessions) * 100)
    : 0

  // Trend: %-Delta zur Vorperiode (null wenn Vorperiode 0)
  const pct = (curr: number, prev: number): number | null =>
    prev === 0 ? null : Math.round(((curr - prev) / prev) * 100)

  return NextResponse.json({
    range: { days, since, until: until.toISOString() },
    filter: {
      path: filterPath,
      country: filterCountry,
      device: filterDevice,
      browser: filterBrowser,
      source: filterSource,
    },
    summary: {
      total_views: total,
      unique_visitors: uniqueVisitors,
      unique_sessions: uniqueSessions,
      avg_views_per_session: uniqueSessions > 0 ? Math.round((total / uniqueSessions) * 10) / 10 : 0,
      bots_filtered: botCount,
      total_clicks: clickRows.length,
      bounce_rate_pct: bounceRate,
    },
    trend: {
      views_pct:    pct(total,            prev.total_views),
      visitors_pct: pct(uniqueVisitors,   prev.unique_visitors),
      sessions_pct: pct(uniqueSessions,   prev.unique_sessions),
      previous: prev,
    },
    timeline,
    hourly,
    top_pages: topPages,
    top_referrers: topReferrers,
    sources,
    clicks,
    campaigns,
    countries,
    devices,
    browsers,
    funnel: {
      home: homeSessions,
      blog: blogSessions,
      pricing: pricingSessions,
      register: registerSessions,
      home_to_pricing_pct: homeSessions > 0 ? Math.round((pricingSessions / homeSessions) * 100) : 0,
      pricing_to_register_pct: pricingSessions > 0 ? Math.round((registerSessions / pricingSessions) * 100) : 0,
    },
  })
}
