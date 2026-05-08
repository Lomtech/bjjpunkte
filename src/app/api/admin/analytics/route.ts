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
 *
 * Aggregierte Analytics-Daten für das Admin-Dashboard.
 * Zugriff nur via requireAdmin().
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const url = new URL(req.url)
  const range = url.searchParams.get('range') || '30d'
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('page_views') as any)
    .select('path, referrer_domain, country, device_type, browser, visitor_hash, session_hash, created_at, is_bot, event_type, event_target, utm_source, utm_medium, utm_campaign, referrer_source')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allRows = (data ?? []) as PageViewRow[]

  // Bot-Filter: alles trennen — Hauptstats nur Menschen, Bot-Zahlen separat
  const botCount   = allRows.filter(r => r.is_bot === true).length
  const humanRows  = allRows.filter(r => r.is_bot !== true)

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

  // Daily timeline
  const daily = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    daily.set(d, 0)
  }
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    if (daily.has(day)) daily.set(day, (daily.get(day) ?? 0) + 1)
  }
  const timeline = [...daily.entries()].sort().map(([date, count]) => ({ date, count }))

  // Conversion-Funnel: Landing → Pricing → Register
  const sessionsByPath = new Map<string, Set<string>>()
  for (const r of rows) {
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

  return NextResponse.json({
    range: { days, since },
    summary: {
      total_views: total,
      unique_visitors: uniqueVisitors,
      unique_sessions: uniqueSessions,
      avg_views_per_session: uniqueSessions > 0 ? Math.round((total / uniqueSessions) * 10) / 10 : 0,
      bots_filtered: botCount,
      total_clicks: clickRows.length,
    },
    timeline,
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
