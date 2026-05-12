'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OsssLogo } from '@/components/Logo'
import {
  ArrowLeft,
  TrendingUp,
  Users,
  Eye,
  MousePointerClick,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  RefreshCw,
} from 'lucide-react'

interface AnalyticsData {
  range: { days: number; since: string; until?: string }
  filter?: AnalyticsFilter
  summary: {
    total_views: number
    unique_visitors: number
    unique_sessions: number
    avg_views_per_session: number
    bots_filtered: number
    total_clicks: number
    bounce_rate_pct?: number
  }
  trend?: {
    views_pct: number | null
    visitors_pct: number | null
    sessions_pct: number | null
    previous: { total_views: number; unique_visitors: number; unique_sessions: number }
  }
  timeline: { date: string; count: number; views?: number; sessions?: number; visitors?: number }[]
  hourly?: { hour: number; views: number; sessions: number; visitors: number }[]
  top_pages:    { path: string;    count: number; views?: number; sessions?: number; visitors?: number }[]
  top_referrers:{ domain: string;  count: number; views?: number; sessions?: number; visitors?: number }[]
  sources:      { source: string;  count: number; views?: number; sessions?: number; visitors?: number }[]
  clicks:       { target: string; count: number }[]
  campaigns:    { source: string; medium: string; campaign: string; sessions: number }[]
  countries:    { country: string; count: number; views?: number; sessions?: number; visitors?: number }[]
  devices:      { device: string;  count: number; views?: number; sessions?: number; visitors?: number }[]
  browsers:     { browser: string; count: number; views?: number; sessions?: number; visitors?: number }[]
  funnel: {
    home: number
    blog: number
    pricing: number
    register: number
    home_to_pricing_pct: number
    pricing_to_register_pct: number
  }
}

type Range = '7d' | '30d' | '90d'

/**
 * Cross-Filter State. Click auf einen Path/Country/Device/Browser/Source
 * filtert alle anderen Stats. Path-Filter ist exakt-match oder Prefix mit
 * trailing /* (z.B. "/blog/*" matcht /blog, /blog/foo).
 */
interface AnalyticsFilter {
  path?: string | null
  country?: string | null
  device?: string | null
  browser?: string | null
  source?: string | null
}

/**
 * Liest den aktuell aktiven Metric-Wert (views/sessions/visitors) aus einer
 * aggregierten Bucket-Row. Backwards-compat: wenn nur `count` da ist (alte
 * API-Version), fallback auf `count` für alle Metriken — sonst würden
 * Visitors-Toggles bei deployment-skew leere Listen zeigen.
 */
function metricValue(
  row: { count: number; views?: number; sessions?: number; visitors?: number },
  metric: Metric,
): number {
  if (metric === 'views')    return row.views    ?? row.count
  if (metric === 'sessions') return row.sessions ?? row.count
  return row.visitors ?? row.count
}

// Hübsche Labels für die kategorisierten Quellen aus categorizeReferrer()
const SOURCE_LABEL: Record<string, string> = {
  google:        '🔍 Google',
  bing:          '🔍 Bing',
  duckduckgo:    '🦆 DuckDuckGo',
  'other-search': '🔍 Andere Suche',
  linkedin:      '💼 LinkedIn',
  facebook:      '📘 Facebook',
  twitter:       '🐦 Twitter / X',
  instagram:     '📷 Instagram',
  reddit:        '🟠 Reddit',
  youtube:       '▶️ YouTube',
  tiktok:        '🎵 TikTok',
  pinterest:     '📌 Pinterest',
  whatsapp:      '💬 WhatsApp',
  telegram:      '✈️ Telegram',
  email:         '📧 E-Mail',
  tech:          '💻 Tech-Communities',
  direct:        '🔗 Direkt / kein Referrer',
  other:         '🌐 Andere',
}

// Eine Schluessel-Konstante damit ein späterer Schema-Bruch alle gespeicherten
// State-Snapshots ungültig macht (statt mit veralteten Defaults zu kollidieren).
const PERSIST_KEY = 'osss-analytics-state-v1'

interface PersistedState {
  range: Range
  metric: Metric
  dateFrom: string
  dateTo: string
  filter: AnalyticsFilter
}

function loadPersisted(): Partial<PersistedState> {
  // SSR-safe — useState-Initializer läuft beim Mount, da sind wir im Browser,
  // aber wenn dieser Code je in einem Server-Render landet, fängt der Guard ab.
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PERSIST_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as Partial<PersistedState>
  } catch {
    return {}
  }
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Persistierter UI-State (range / metric / dateFrom / dateTo / filter).
  // useState-Initializer liest einmalig aus localStorage — das vermeidet das
  // klassische Flicker-Pattern "default → effect-restore → re-render-fetch".
  // Default-Fallbacks identisch zum vorherigen Verhalten, falls noch nichts
  // gespeichert ist oder der Browser-Storage geleert wurde.
  const persisted = loadPersisted()
  const [range, setRange]       = useState<Range>(persisted.range ?? '30d')
  const [filter, setFilter]     = useState<AnalyticsFilter>(persisted.filter ?? {})
  const [dateFrom, setDateFrom] = useState<string>(persisted.dateFrom ?? '')
  const [dateTo, setDateTo]     = useState<string>(persisted.dateTo ?? '')
  const customRange = !!(dateFrom || dateTo)
  // Globaler Metric-Toggle: Timeline + Stunden-Chart + Geräte/Browser/Länder/
  // Quellen lesen alle aus diesem State. Click auf "Visitors" filtert UI auf
  // unique visitors, nicht auf page views.
  const [metric, setMetric] = useState<Metric>(persisted.metric ?? 'views')

  // Persistenz: jeder relevanter State-Wechsel schreibt einen Snapshot zurück.
  // Schreibt nur Felder die wir auch wieder lesen — vermeidet localStorage-Wachstum
  // bei zukünftigen Refactors.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify({
        range, metric, dateFrom, dateTo, filter,
      } satisfies PersistedState))
    } catch { /* Storage voll / private mode → leise scheitern */ }
  }, [range, metric, dateFrom, dateTo, filter])

  // Helper: toggle a filter dimension. Click again on same value = clear.
  function toggleFilter<K extends keyof AnalyticsFilter>(key: K, value: AnalyticsFilter[K]) {
    setFilter(prev => {
      const current = prev[key]
      if (current === value) {
        // Same value clicked again → unset this dimension
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
  }
  function clearFilter() { setFilter({}) }
  const hasFilter = Object.values(filter).some(v => v != null)

  // Owner-Opt-Out für Tracking: wer auf dieser Seite war, ist Admin/Owner und
  // soll seine eigenen Visits nicht in der Statistik haben. Cookie zusätzlich
  // zu localStorage — Track-Endpoint prüft den Cookie server-side.
  useEffect(() => {
    try {
      document.cookie = 'osss-internal=1; max-age=31536000; path=/; samesite=lax'
      localStorage.setItem('osss-no-track', '1')
    } catch { /* manche Browser blocken cookies/localStorage */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
          return
        }

        const params = new URLSearchParams()
        if (customRange) {
          if (dateFrom) params.set('from', dateFrom)
          if (dateTo)   params.set('to',   dateTo)
        } else {
          params.set('range', range)
        }
        if (filter.path)    params.set('path',    filter.path)
        if (filter.country) params.set('country', filter.country)
        if (filter.device)  params.set('device',  filter.device)
        if (filter.browser) params.set('browser', filter.browser)
        if (filter.source)  params.set('source',  filter.source)
        const res = await fetch(`/api/admin/analytics?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        })
        if (!res.ok) {
          if (res.status === 403) {
            setError('Forbidden — Admin-Only Bereich.')
            return
          }
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || `HTTP ${res.status}`)
        }
        const json = await res.json() as AnalyticsData
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [range, router, filter, customRange, dateFrom, dateTo])

  return (
    <div className="min-h-screen bg-zinc-50">

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/admin/leads" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
              <ArrowLeft size={15} /> CRM
            </Link>
            <span className="text-zinc-300">|</span>
            <OsssLogo variant="dark" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-2">Analytics</span>
          </div>
          <DateRangePicker
            range={range}
            dateFrom={dateFrom}
            dateTo={dateTo}
            customRange={customRange}
            onPreset={(r) => { setRange(r); setDateFrom(''); setDateTo('') }}
            onCustom={(from, to) => { setDateFrom(from); setDateTo(to) }}
            onExport={() => downloadCSV(data)}
            hasData={!!data}
          />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-5 py-8">

        {/* Tracking-Toggle — prominent ganz oben, damit Owner sofort sieht ob
            er gerade getrackt wird oder nicht. Dupliziert mit OwnerFilterBanner
            am Ende der Page, aber DIESER hier ist der primäre Touch-Point. */}
        <TrackingToggleCard />

        {/* Active-Filter-Banner — zeigt aktive Cross-Filter mit X zum Entfernen */}
        {hasFilter && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">
                Filter aktiv:
              </span>
              {filter.path && (
                <FilterChip label="Pfad" value={filter.path} onClear={() => toggleFilter('path', filter.path)} />
              )}
              {filter.country && (
                <FilterChip label="Land" value={filter.country} onClear={() => toggleFilter('country', filter.country)} />
              )}
              {filter.device && (
                <FilterChip label="Gerät" value={filter.device} onClear={() => toggleFilter('device', filter.device)} />
              )}
              {filter.browser && (
                <FilterChip label="Browser" value={filter.browser} onClear={() => toggleFilter('browser', filter.browser)} />
              )}
              {filter.source && (
                <FilterChip label="Quelle" value={filter.source} onClear={() => toggleFilter('source', filter.source)} />
              )}
            </div>
            <button onClick={clearFilter}
              className="shrink-0 text-xs font-semibold text-amber-900 hover:text-amber-700 underline">
              Alle entfernen
            </button>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-6">
            <p className="font-bold text-rose-900">Fehler</p>
            <p className="text-sm text-rose-700 mt-1">{error}</p>
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="animate-spin text-zinc-400" size={28} />
          </div>
        )}

        {data && (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <KPI icon={<Eye size={16} />} label="Page Views"
                value={data.summary.total_views.toLocaleString('de-DE')}
                trendPct={data.trend?.views_pct ?? undefined}
                sub={data.trend?.previous ? `vorher: ${data.trend.previous.total_views.toLocaleString('de-DE')}` : undefined}
              />
              <KPI icon={<Users size={16} />} label="Unique Visits"
                value={data.summary.unique_visitors.toLocaleString('de-DE')}
                trendPct={data.trend?.visitors_pct ?? undefined}
                sub={data.trend?.previous ? `vorher: ${data.trend.previous.unique_visitors.toLocaleString('de-DE')}` : '(visit-days, anonym)'}
              />
              <KPI icon={<MousePointerClick size={16} />} label="Sessions"
                value={data.summary.unique_sessions.toLocaleString('de-DE')}
                trendPct={data.trend?.sessions_pct ?? undefined}
                sub={data.trend?.previous ? `vorher: ${data.trend.previous.unique_sessions.toLocaleString('de-DE')}` : undefined}
              />
              <KPI icon={<TrendingUp size={16} />} label="Bounce Rate"
                value={`${data.summary.bounce_rate_pct ?? 0}%`}
                sub="Sessions mit 1 Page-View"
              />
            </div>

            {/* Timeline */}
            <Section title={`${metric === 'views' ? 'Page Views' : metric === 'sessions' ? 'Sessions' : 'Visitors'} — letzte ${data.range.days} Tage`}>
              <Timeline
                data={data.timeline}
                metric={metric}
                onMetricChange={setMetric}
                onSelectDay={d => { setDateFrom(d); setDateTo(d) }}
              />
            </Section>

            {/* Stunden-Verteilung (Europe/Berlin) — wann am Tag kommen Visits */}
            {data.hourly && data.hourly.some(h => h.views > 0) && (
              <Section title="Tageszeit-Verteilung (Berlin)">
                <HourDistribution data={data.hourly} metric={metric} onMetricChange={setMetric} />
              </Section>
            )}

            {/* Bot-Filter + Click-Events Banner */}
            {(data.summary.bots_filtered > 0 || data.summary.total_clicks > 0) && (
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {data.summary.bots_filtered > 0 && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-600">
                    🤖 <strong>{data.summary.bots_filtered.toLocaleString('de-DE')}</strong> Bot-Visits aus Statistik gefiltert
                  </div>
                )}
                {data.summary.total_clicks > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
                    🖱 <strong>{data.summary.total_clicks.toLocaleString('de-DE')}</strong> CTA-Clicks im Zeitraum
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Top Pages */}
              <Section title="Top Pages">
                {data.top_pages.length === 0 ? <Empty /> : (
                  <BarList
                    items={[...data.top_pages]
                      .sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
                      .map(p => ({ label: p.path, count: metricValue(p, metric), value: p.path }))}
                    formatLabel={l => l}
                    onClick={path => toggleFilter('path', path)}
                    activeValue={filter.path ?? undefined}
                  />
                )}
              </Section>

              {/* Quellen (kategorisiert) — bevorzugt vor rohen Domains */}
              <Section title="Quellen (kategorisiert)">
                {data.sources.length === 0 ? <Empty /> : (
                  <BarList
                    items={[...data.sources]
                      .sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
                      .map(r => ({
                        label: SOURCE_LABEL[r.source] ?? r.source,
                        count: metricValue(r, metric),
                        value: r.source,
                      }))}
                    formatLabel={l => l}
                    onClick={source => toggleFilter('source', source)}
                    activeValue={filter.source ?? undefined}
                  />
                )}
              </Section>

              {/* Top Referrers (Rohe Domains) */}
              <Section title="Top Referrer-Domains">
                {data.top_referrers.length === 0 ? <Empty /> : (
                  <BarList
                    items={[...data.top_referrers]
                      .sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
                      .map(r => ({
                        label: r.domain === 'direct' ? '🔗 Direkt / kein Referrer' : r.domain,
                        count: metricValue(r, metric),
                      }))}
                    formatLabel={l => l}
                  />
                )}
              </Section>

              {/* CTA-Clicks */}
              <Section title="CTA-Clicks">
                {data.clicks.length === 0 ? (
                  <div className="text-xs text-zinc-400 py-4 text-center leading-relaxed">
                    Noch keine Click-Events.<br />
                    <span className="text-zinc-500">Buttons mit <code className="bg-zinc-100 px-1 rounded">data-track=&quot;…&quot;</code> tracken automatisch.</span>
                  </div>
                ) : (
                  <BarList
                    items={data.clicks.map(c => ({
                      label: c.target,
                      count: c.count,
                    }))}
                    formatLabel={l => l}
                  />
                )}
              </Section>
            </div>

            {/* UTM-Kampagnen — nur anzeigen wenn welche da sind */}
            {data.campaigns.length > 0 && (
              <Section title="UTM-Kampagnen (nach Sessions)">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-zinc-400 uppercase tracking-wider text-[10px] font-bold">
                        <th className="text-left py-2 px-3">Source</th>
                        <th className="text-left py-2 px-3">Medium</th>
                        <th className="text-left py-2 px-3">Campaign</th>
                        <th className="text-right py-2 px-3">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaigns.map((c, i) => (
                        <tr key={i} className="border-t border-zinc-100">
                          <td className="py-2 px-3 font-mono text-zinc-700">{c.source !== '?' ? c.source : <span className="text-zinc-300">—</span>}</td>
                          <td className="py-2 px-3 font-mono text-zinc-700">{c.medium !== '?' ? c.medium : <span className="text-zinc-300">—</span>}</td>
                          <td className="py-2 px-3 font-mono text-zinc-700">{c.campaign !== '?' ? c.campaign : <span className="text-zinc-300">—</span>}</td>
                          <td className="py-2 px-3 text-right font-bold tabular-nums">{c.sessions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[10px] text-zinc-400 leading-relaxed">
                  Tipp: Hänge <code className="bg-zinc-100 px-1 rounded">?utm_source=linkedin&amp;utm_campaign=launch</code> an deine geteilten Links —
                  dann zählen wir die Klicks separat pro Kampagne.
                </p>
              </Section>
            )}

            {/* Conversion-Funnel */}
            <Section title="🎯 Conversion Funnel">
              <Funnel
                funnel={data.funnel}
                onClick={path => toggleFilter('path', path)}
                activePath={filter.path ?? undefined}
              />
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Devices */}
              <Section title="Geräte">
                {data.devices.length === 0 ? <Empty /> : (
                  <ul className="space-y-1">
                    {data.devices.map(d => {
                      const val = metricValue(d, metric)
                      const total = data.devices.reduce((a, b) => a + metricValue(b, metric), 0)
                      const pct = total > 0 ? Math.round((val / total) * 100) : 0
                      const isActive = filter.device === d.device
                      return (
                        <li key={d.device}>
                          <button
                            onClick={() => toggleFilter('device', d.device)}
                            className={`w-full flex items-center justify-between text-sm px-2 py-1.5 rounded-md transition-colors ${
                              isActive ? 'bg-amber-100 ring-1 ring-amber-400' : 'hover:bg-zinc-50'
                            }`}>
                            <span className="flex items-center gap-2">
                              {d.device === 'mobile' ? <Smartphone size={14} className="text-zinc-400" /> :
                               d.device === 'tablet' ? <Tablet size={14} className="text-zinc-400" /> :
                               <Monitor size={14} className="text-zinc-400" />}
                              <span className="capitalize text-zinc-700">{d.device}</span>
                            </span>
                            <span className="font-semibold text-zinc-900 tabular-nums">{pct}% <span className="text-zinc-400 font-normal">({val})</span></span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              {/* Browsers */}
              <Section title="Browser">
                {data.browsers.length === 0 ? <Empty /> : (
                  <ul className="space-y-1">
                    {[...data.browsers]
                      .sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
                      .map(b => {
                      const isActive = filter.browser === b.browser
                      return (
                        <li key={b.browser}>
                          <button
                            onClick={() => toggleFilter('browser', b.browser)}
                            className={`w-full flex items-center justify-between text-sm px-2 py-1.5 rounded-md transition-colors ${
                              isActive ? 'bg-amber-100 ring-1 ring-amber-400' : 'hover:bg-zinc-50'
                            }`}>
                            <span className="capitalize text-zinc-700">{b.browser}</span>
                            <span className="font-semibold text-zinc-900 tabular-nums">{metricValue(b, metric)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              {/* Countries */}
              <Section title="Länder">
                {data.countries.length === 0 ? <Empty /> : (
                  <ul className="space-y-1">
                    {[...data.countries]
                      .sort((a, b) => metricValue(b, metric) - metricValue(a, metric))
                      .map(c => {
                      const isActive = filter.country === c.country.toUpperCase()
                      return (
                        <li key={c.country}>
                          <button
                            onClick={() => toggleFilter('country', c.country.toUpperCase())}
                            className={`w-full flex items-center justify-between text-sm px-2 py-1.5 rounded-md transition-colors ${
                              isActive ? 'bg-amber-100 ring-1 ring-amber-400' : 'hover:bg-zinc-50'
                            }`}>
                            <span className="flex items-center gap-2">
                              <Globe size={13} className="text-zinc-400" />
                              <span className="text-zinc-700 uppercase">{c.country === 'unknown' ? '—' : c.country}</span>
                            </span>
                            <span className="font-semibold text-zinc-900 tabular-nums">{metricValue(c, metric)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>
            </div>

            {/* DSGVO-Hinweis */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 leading-relaxed">
              <p className="font-bold mb-1">🔒 DSGVO-anonyme Reichweiten-Messung</p>
              <p>
                Cookielos. Keine IP-Speicherung. Keine personenbezogenen Daten.
                visitor_hash + session_hash sind täglich/30min rotierend gesalzen — kein
                Personenbezug rekonstruierbar (anonym im Sinne von Erwägungsgrund 26 DSGVO).
                Daher kein Cookie-Banner notwendig nach TTDSG § 25.
              </p>
            </div>
          </>
        )}

      </main>
    </div>
  )
}

// ─── Helper Components ─────────────────────────────────────────────────────

/**
 * Großer prominenter Toggle ganz oben auf der Analytics-Page.
 * Status-Karte mit zwei knackigen Action-Buttons (Tracking AN / AUS).
 */
function TrackingToggleCard() {
  const [excluded, setExcluded] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const ls = localStorage.getItem('osss-no-track') === '1'
      const ck = /(?:^|;\s*)osss-internal=1/.test(document.cookie ?? '')
      setExcluded(ls || ck)
    } catch { setExcluded(false) }
  }, [])

  function setOff() {
    try {
      localStorage.setItem('osss-no-track', '1')
      document.cookie = 'osss-internal=1; max-age=31536000; path=/; samesite=lax'
      setExcluded(true)
    } catch { /* ignore */ }
  }
  function setOn() {
    try {
      localStorage.removeItem('osss-no-track')
      document.cookie = 'osss-internal=; max-age=0; path=/; samesite=lax'
      setExcluded(false)
    } catch { /* ignore */ }
  }

  if (excluded === null) return null  // hydration-safe: nichts bis Cookie geprüft

  return (
    <div className={`rounded-2xl border-2 p-4 mb-6 ${
      excluded
        ? 'bg-emerald-50 border-emerald-300'
        : 'bg-rose-50 border-rose-300'
    }`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
            excluded ? 'bg-emerald-100' : 'bg-rose-100'
          }`}>
            {excluded ? '🚫' : '👁'}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Tracking dieser Browser</p>
            <p className={`font-black text-base ${excluded ? 'text-emerald-800' : 'text-rose-800'}`}>
              {excluded ? 'DEAKTIVIERT' : 'AKTIV — du wirst gezählt'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={setOff}
            disabled={excluded}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${
              excluded
                ? 'bg-emerald-200 text-emerald-700 cursor-default'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white'
            }`}
          >
            🚫 Mich nicht tracken
          </button>
          <button
            onClick={setOn}
            disabled={!excluded}
            className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${
              !excluded
                ? 'bg-rose-200 text-rose-700 cursor-default'
                : 'bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700'
            }`}
          >
            🔁 Tracking AN
          </button>
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 mt-2.5 leading-relaxed">
        Wirkt auf diesem Browser/Gerät. Für andere Geräte (Smartphone etc.) einfach <a href="/no-track" className="underline font-semibold text-zinc-700">/no-track</a> dort öffnen.
      </p>
    </div>
  )
}

function KPI({
  icon, label, value, sub, trendPct,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  trendPct?: number | null
}) {
  // Trend-Pille: grün wenn up, rot wenn down, grau wenn 0/null
  const trendUI = trendPct == null ? null : trendPct === 0 ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded-md">
      = 0%
    </span>
  ) : trendPct > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
      ▲ {trendPct}%
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md">
      ▼ {Math.abs(trendPct)}%
    </span>
  )

  return (
    <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
          <span className="text-zinc-500">{icon}</span>
          {label}
        </div>
        {trendUI}
      </div>
      <div className="text-2xl font-black text-zinc-950 tabular-nums">{value}</div>
      {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm mb-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-sm text-zinc-400 italic">Noch keine Daten in diesem Zeitraum.</p>
}

type Metric = 'views' | 'sessions' | 'visitors'

interface TimelinePoint {
  date: string
  count: number
  views?: number
  sessions?: number
  visitors?: number
}

/**
 * Voll interaktive Timeline mit:
 *  - Smooth Catmull-Rom-Bezier-Kurve (statt eckiger Linien)
 *  - Multi-Metric-Toggle: Page Views / Sessions / Unique Visitors
 *  - Mouse-Follow-Crosshair (vertikale Linie + Tooltip am Cursor)
 *  - Click auf Tag → Date-Filter auf diesen Tag setzen
 *  - Animation beim Laden (Path zeichnet sich)
 *  - Peak-Marker bleibt sichtbar
 *  - Wochentag im Tooltip
 *
 * Auto-Switch: wenn API neue Felder (views/sessions/visitors) liefert,
 * werden die Toggles aktiv. Fallback auf altes `count`-Feld.
 */
function Timeline({
  data,
  onSelectDay,
  metric: metricProp,
  onMetricChange,
}: {
  data: TimelinePoint[]
  onSelectDay?: (date: string) => void
  /** Optional controlled metric. Wenn gesetzt, ist der interne State inaktiv. */
  metric?: Metric
  onMetricChange?: (m: Metric) => void
}) {
  const hasMulti = data.length > 0 && data[0].views !== undefined
  const [internalMetric, setInternalMetric] = useState<Metric>('views')
  const metric = metricProp ?? internalMetric
  const setMetric = (m: Metric) => {
    if (onMetricChange) onMetricChange(m)
    else setInternalMetric(m)
  }
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  if (data.length === 0) return <Empty />

  const W = 800
  const H = 180
  const PAD_L = 40
  const PAD_R = 30
  const PAD_T = 12
  const PAD_B = 32
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const valueOf = (d: TimelinePoint): number => {
    if (!hasMulti) return d.count
    if (metric === 'views')    return d.views ?? d.count ?? 0
    if (metric === 'sessions') return d.sessions ?? 0
    return d.visitors ?? 0
  }

  const values = data.map(valueOf)
  const max = Math.max(...values, 4)
  const niceMax =
    max <= 5  ? 5  :
    max <= 10 ? 10 :
    max <= 50 ? Math.ceil(max / 10) * 10 :
    max <= 500 ? Math.ceil(max / 50) * 50 :
    Math.ceil(max / 100) * 100
  const today = new Date().toISOString().slice(0, 10)

  // Points
  const points = data.map((d, i) => {
    const x = PAD_L + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
    const v = valueOf(d)
    const y = PAD_T + innerH - (v / niceMax) * innerH
    return { x, y, value: v, date: d.date, isToday: d.date === today, idx: i }
  })

  // Catmull-Rom → Bezier für smooth curves
  // Wenn 1 Punkt: nur Punkt. Wenn 2 Punkte: gerade Linie. Sonst: Bezier.
  function smoothPath(): string {
    if (points.length === 0) return ''
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] ?? points[i]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2] ?? p2
      const tension = 6  // höher = ausgeprägtere Kurven; 6 = sanft
      const cp1x = p1.x + (p2.x - p0.x) / tension
      const cp1y = p1.y + (p2.y - p0.y) / tension
      const cp2x = p2.x - (p3.x - p1.x) / tension
      const cp2y = p2.y - (p3.y - p1.y) / tension
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }
    return d
  }

  const linePath = smoothPath()
  const areaPath = data.length === 1
    ? ''
    : `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_T + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD_T + innerH).toFixed(1)} Z`

  const yTicks = [0, niceMax / 4, niceMax / 2, (niceMax * 3) / 4, niceMax].map(v => Math.round(v))
  const xLabelStep = Math.max(1, Math.ceil(data.length / 7))

  // Peak (höchster Wert)
  const peakIdx = values.reduce((maxI, v, i, arr) => v > arr[maxI] ? i : maxI, 0)
  const peak = points[peakIdx]

  // Mouse-Tracking: finde nächsten Datenpunkt zur Mausposition
  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * W
    let nearest = 0
    let minDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - mouseX)
      if (dist < minDist) { minDist = dist; nearest = i }
    }
    setHoverIdx(nearest)
  }
  function handleLeave() { setHoverIdx(null) }

  const hovered = hoverIdx != null ? points[hoverIdx] : null
  const hoveredDow = hovered ? (() => {
    const d = new Date(hovered.date + 'T12:00:00Z')
    return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getUTCDay()]
  })() : ''

  // Tooltip-Positionierung im SVG-Koordinatensystem
  const TOOLTIP_W = 110
  const TOOLTIP_H = 32
  let tooltipX = 0, tooltipY = 0
  if (hovered) {
    tooltipX = hovered.x + 12
    if (tooltipX + TOOLTIP_W > W - 5) tooltipX = hovered.x - TOOLTIP_W - 12
    tooltipY = hovered.y - TOOLTIP_H - 8
    if (tooltipY < PAD_T) tooltipY = hovered.y + 12
  }

  const METRIC_LABEL: Record<Metric, string> = {
    views: 'Page Views',
    sessions: 'Sessions',
    visitors: 'Visitors',
  }

  return (
    <div className="w-full">
      {/* Metric-Toggle (nur wenn Daten verfügbar) */}
      {hasMulti && (
        <div className="flex items-center gap-1 mb-3 -mt-1">
          {(['views', 'sessions', 'visitors'] as Metric[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors ${
                metric === m
                  ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                  : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {METRIC_LABEL[m]}
            </button>
          ))}
          <span className="text-[10px] text-zinc-400 ml-auto">Tipp: Klick auf Tag → Filter</span>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto cursor-crosshair select-none"
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <defs>
          <linearGradient id="timeline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
          {/* Animations-Mask: lässt die Linie von links nach rechts erscheinen */}
          <clipPath id="timeline-reveal">
            <rect x="0" y="0" width={W} height={H}>
              <animate attributeName="width" from="0" to={W} dur="0.9s" fill="freeze" />
            </rect>
          </clipPath>
        </defs>

        {/* Grid */}
        {yTicks.map((tick, i) => {
          const y = PAD_T + innerH - (tick / niceMax) * innerH
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                stroke="#e4e4e7" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '2 3'} />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end"
                fontSize="9" fill="#a1a1aa" fontFamily="monospace">{tick}</text>
            </g>
          )
        })}

        {/* Area + Line — beide mit Reveal-Animation */}
        <g clipPath="url(#timeline-reveal)">
          {areaPath && <path d={areaPath} fill="url(#timeline-grad)" />}
          <path d={linePath} fill="none" stroke="#f59e0b" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Peak-Marker (immer sichtbar, auch ohne Hover) */}
        {peak && peak.value > 0 && (
          <g className="pointer-events-none">
            <circle cx={peak.x} cy={peak.y} r={3} fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
            <text x={peak.x} y={peak.y - 8} textAnchor="middle"
              fontSize="9" fontWeight="700" fill="#d97706">
              {peak.value}
            </text>
          </g>
        )}

        {/* X-Achse Labels */}
        {points.map((p, i) => {
          if (i % xLabelStep !== 0 && i !== points.length - 1) return null
          const isFirst = i === 0
          const isLast = i === points.length - 1
          const anchor: 'start' | 'middle' | 'end' = isFirst ? 'start' : isLast ? 'end' : 'middle'
          return (
            <text key={i} x={p.x} y={H - 12} textAnchor={anchor}
              fontSize="9" fill={p.isToday ? '#d97706' : '#a1a1aa'}
              fontWeight={p.isToday ? '700' : '400'}>
              {p.date.slice(8, 10)}.{p.date.slice(5, 7)}
            </text>
          )
        })}

        {/* Mouse-Follow-Crosshair + Hover-Punkt + Tooltip */}
        {hovered && (
          <g className="pointer-events-none">
            {/* Vertikale Crosshair-Linie */}
            <line x1={hovered.x} y1={PAD_T} x2={hovered.x} y2={PAD_T + innerH}
              stroke="#d4d4d8" strokeWidth="1" strokeDasharray="3 3" />
            {/* Hervorgehobener Punkt */}
            <circle cx={hovered.x} cy={hovered.y} r={6} fill="#fff" stroke="#f59e0b" strokeWidth="2.5" />
            <circle cx={hovered.x} cy={hovered.y} r={2.5} fill="#f59e0b" />
            {/* Tooltip */}
            <rect x={tooltipX} y={tooltipY} width={TOOLTIP_W} height={TOOLTIP_H} rx={6}
              fill="#18181b" />
            <text x={tooltipX + 8} y={tooltipY + 12}
              fontSize="9" fontWeight="700" fill="#fbbf24" fontFamily="monospace">
              {hoveredDow}, {hovered.date.slice(8, 10)}.{hovered.date.slice(5, 7)}
            </text>
            <text x={tooltipX + 8} y={tooltipY + 25}
              fontSize="11" fontWeight="900" fill="#fff" fontFamily="monospace">
              {hovered.value} {METRIC_LABEL[metric].toLowerCase()}
            </text>
          </g>
        )}

        {/* Klickbare Hitboxen über jeden Punkt — filtert auf den Tag */}
        {onSelectDay && points.map((p, i) => {
          const slotWidth = points.length > 1 ? innerW / (points.length - 1) : innerW
          return (
            <rect
              key={`hit-${i}`}
              x={p.x - slotWidth / 2}
              y={PAD_T}
              width={slotWidth}
              height={innerH}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectDay(p.date)}
            >
              <title>{`Klick → Filter auf ${p.date}`}</title>
            </rect>
          )
        })}
      </svg>
    </div>
  )
}

/**
 * HourDistribution — 24-Stunden-Verteilung, Europe/Berlin-lokalisiert.
 *
 * DSGVO-Hinweis: Daten kommen rein aggregiert vom Server (counts pro Stunde
 * über alle visitor_hashes), keine individuellen Zeitstempel hier. Visitor-Hashes
 * rotieren täglich → kein Cross-Day-Tracking → anonym im Sinne von Erw.-Gr. 26.
 *
 * Toggle zwischen Views / Sessions / unique Visitors wie beim Timeline-Chart.
 */
function HourDistribution({
  data,
  metric: metricProp,
  onMetricChange,
}: {
  data: { hour: number; views: number; sessions: number; visitors: number }[]
  metric?: Metric
  onMetricChange?: (m: Metric) => void
}) {
  const [internalMetric, setInternalMetric] = useState<Metric>('views')
  const metric = metricProp ?? internalMetric
  const setMetric = (m: Metric) => {
    if (onMetricChange) onMetricChange(m)
    else setInternalMetric(m)
  }
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const valueOf = (h: typeof data[number]): number => {
    if (metric === 'views')    return h.views
    if (metric === 'sessions') return h.sessions
    return h.visitors
  }
  const values = data.map(valueOf)
  const max = Math.max(...values, 1)
  const peakIdx = values.indexOf(max)
  const total = values.reduce((a, b) => a + b, 0)

  // Mini-Bar-Chart: 24 vertikale Balken
  const W = 800
  const H = 160
  const PAD_L = 36
  const PAD_R = 12
  const PAD_T = 16
  const PAD_B = 28
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const barW = innerW / 24
  const barGap = Math.max(1, barW * 0.18)

  return (
    <div className="space-y-3">
      {/* Toggle wie bei Timeline */}
      <div className="flex items-center gap-2 text-xs">
        {(['views', 'sessions', 'visitors'] as Metric[]).map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              metric === m ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
            }`}
          >
            {m === 'views' ? 'Views' : m === 'sessions' ? 'Sessions' : 'Visitors'}
          </button>
        ))}
        <span className="text-zinc-300 ml-auto">·</span>
        <span className="text-zinc-500">
          Peak: <span className="font-semibold text-zinc-900">{String(peakIdx).padStart(2, '0')}:00</span> ({max})
        </span>
        <span className="text-zinc-300">·</span>
        <span className="text-zinc-500">Ø {total > 0 ? Math.round(total / 24) : 0}/Std</span>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
          {/* Gridlines (4 horizontale Linien) */}
          {[0.25, 0.5, 0.75, 1].map(f => {
            const y = PAD_T + innerH - innerH * f
            return (
              <line
                key={f}
                x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                stroke="#e4e4e7" strokeWidth={1} strokeDasharray="2 4"
              />
            )
          })}
          {/* Y-Achse Max */}
          <text x={PAD_L - 6} y={PAD_T + 4} fontSize="10" fill="#a1a1aa" textAnchor="end">{max}</text>
          <text x={PAD_L - 6} y={PAD_T + innerH + 4} fontSize="10" fill="#a1a1aa" textAnchor="end">0</text>

          {data.map((h, i) => {
            const v = valueOf(h)
            const x = PAD_L + i * barW + barGap / 2
            const barH = max > 0 ? (v / max) * innerH : 0
            const y = PAD_T + innerH - barH
            const isPeak = i === peakIdx && v > 0
            const isHover = hoverIdx === i
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={barW - barGap}
                  height={barH}
                  rx={2}
                  fill={isHover ? '#0f172a' : isPeak ? '#f59e0b' : '#fbbf24'}
                  fillOpacity={v === 0 ? 0.15 : 1}
                  className="transition-colors"
                />
                {/* Hover-Hotbox über volle Höhe (auch leere Stunden hoverbar) */}
                <rect
                  x={x - barGap / 2}
                  y={PAD_T}
                  width={barW}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                  style={{ cursor: 'default' }}
                />
              </g>
            )
          })}

          {/* X-Achse: alle 3 Stunden labeln */}
          {[0, 3, 6, 9, 12, 15, 18, 21].map(h => {
            const x = PAD_L + h * barW + barW / 2
            return (
              <text
                key={h}
                x={x} y={H - PAD_B + 16}
                fontSize="10" fill="#71717a" textAnchor="middle"
              >
                {String(h).padStart(2, '0')}
              </text>
            )
          })}
          <text x={W - PAD_R} y={H - PAD_B + 16} fontSize="10" fill="#71717a" textAnchor="end">Uhr</text>
        </svg>

        {/* Tooltip */}
        {hoverIdx !== null && (
          <div
            className="absolute pointer-events-none bg-zinc-900 text-white text-xs rounded-md px-2.5 py-1.5 shadow-lg"
            style={{
              left: `${((PAD_L + hoverIdx * barW + barW / 2) / W) * 100}%`,
              top: 4,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-mono text-amber-300">{String(hoverIdx).padStart(2, '0')}:00 – {String((hoverIdx + 1) % 24).padStart(2, '0')}:00</div>
            <div className="font-semibold">{valueOf(data[hoverIdx])} {metric}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * BarList — generische Liste mit Balken-Visualisierung. Optional klickbar:
 * wenn `onClick` + `value` pro Item gesetzt sind, wird das Item zu einem
 * Filter-Toggle (klick = filtern, klick gleicher Wert = un-filtern).
 */
function BarList({
  items,
  formatLabel,
  onClick,
  activeValue,
}: {
  items: { label: string; count: number; value?: string }[]
  formatLabel: (l: string) => string
  onClick?: (value: string) => void
  activeValue?: string
}) {
  const max = Math.max(...items.map(i => i.count), 1)
  return (
    <ul className="space-y-1.5">
      {items.map(i => {
        const isActive = onClick && i.value !== undefined && activeValue === i.value
        const isClickable = !!onClick && i.value !== undefined
        const inner = (
          <>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-zinc-700 truncate font-mono text-xs" title={i.label}>{formatLabel(i.label)}</span>
              <span className="font-semibold text-zinc-900 tabular-nums ml-2">{i.count}</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(i.count / max) * 100}%` }} />
            </div>
          </>
        )
        if (isClickable) {
          return (
            <li key={i.label}>
              <button
                onClick={() => onClick!(i.value!)}
                className={`w-full text-left text-sm px-2 py-1 rounded-md transition-colors ${
                  isActive ? 'bg-amber-100 ring-1 ring-amber-400' : 'hover:bg-zinc-50'
                }`}>
                {inner}
              </button>
            </li>
          )
        }
        return <li key={i.label} className="text-sm">{inner}</li>
      })}
    </ul>
  )
}

/**
 * Funnel — Conversion-Pipeline-Visualisierung. Path-Filter-aware:
 * Stages sind klickbar und filtern auf den jeweiligen Pfad.
 *
 * Path-Mapping:
 *   Landing  → '/' (exact)
 *   Blog     → '/blog/*' (prefix)
 *   Pricing  → '/pricing'
 *   Register → '/register'
 */
function Funnel({
  funnel,
  onClick,
  activePath,
}: {
  funnel: AnalyticsData['funnel']
  onClick?: (path: string) => void
  activePath?: string
}) {
  const max = Math.max(funnel.home, funnel.pricing, funnel.register, 1)
  const stages = [
    { label: '🏠 Landing (/)',           count: funnel.home,     conversion: null,                              path: '/' },
    { label: '📝 Blog (/blog/*)',         count: funnel.blog,     conversion: null,                              path: '/blog/*' },
    { label: '💰 Pricing (/pricing)',     count: funnel.pricing,  conversion: funnel.home_to_pricing_pct,        path: '/pricing' },
    { label: '✍️ Register (/register)',  count: funnel.register, conversion: funnel.pricing_to_register_pct,    path: '/register' },
  ]
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const isActive = activePath === s.path
        const inner = (
          <>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-zinc-700">{s.label}</span>
              <span className="text-zinc-900 font-semibold tabular-nums">
                {s.count} {s.conversion !== null && (
                  <span className="text-zinc-400 font-normal ml-1">→ {s.conversion}%</span>
                )}
              </span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                style={{ width: `${(s.count / max) * 100}%` }}
              />
            </div>
          </>
        )
        if (onClick) {
          return (
            <button
              key={i}
              onClick={() => onClick(s.path)}
              className={`w-full text-left px-2 py-1.5 rounded-md transition-colors ${
                isActive ? 'bg-amber-100 ring-1 ring-amber-400' : 'hover:bg-zinc-50'
              }`}>
              {inner}
            </button>
          )
        }
        return <div key={i}>{inner}</div>
      })}
      <p className="text-xs text-zinc-500 mt-3 italic">
        Sessions auf der jeweiligen Seite. Conversion-Rate berechnet aus Sessions, nicht
        Visitors — eine Person kann mehrere Sessions haben. Tippe auf einen Stage, um
        alle anderen Statistiken auf den Pfad zu filtern.
      </p>
    </div>
  )
}

/**
 * Date-Range-Picker mit Quick-Presets + Custom-Inputs + CSV-Export.
 *
 * Presets:
 *  - Heute (heute 00:00 → 23:59)
 *  - Gestern
 *  - 7 Tage / 30 Tage / 90 Tage (rollend, Range-Mode)
 *  - Diesen Monat
 *  - Letzter Monat
 *  - Custom (manuelle Datum-Felder)
 */
function DateRangePicker({
  range, dateFrom, dateTo, customRange,
  onPreset, onCustom, onExport, hasData,
}: {
  range: Range
  dateFrom: string
  dateTo: string
  customRange: boolean
  onPreset: (r: Range) => void
  onCustom: (from: string, to: string) => void
  onExport: () => void
  hasData: boolean
}) {
  // Local Date helpers — vermeiden TZ-Schmerz
  function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10)
  }
  const today = isoDate(new Date())
  const yesterday = isoDate(new Date(Date.now() - 86400000))

  const monthFirst = (offset: number): string => {
    const d = new Date()
    d.setMonth(d.getMonth() + offset, 1)
    return isoDate(d)
  }
  const monthLast = (offset: number): string => {
    const d = new Date()
    // Tag 0 des Folge-Monats = letzter Tag des aktuellen Monats
    d.setMonth(d.getMonth() + offset + 1, 0)
    return isoDate(d)
  }

  // Detect which preset is "active" based on dateFrom/dateTo
  function isActive(from: string, to: string): boolean {
    return customRange && dateFrom === from && dateTo === to
  }

  const presets: { key: string; label: string; from: string; to: string }[] = [
    { key: 'today',     label: 'Heute',          from: today,           to: today           },
    { key: 'yesterday', label: 'Gestern',        from: yesterday,       to: yesterday       },
    { key: 'thismonth', label: 'Diesen Monat',   from: monthFirst(0),   to: today           },
    { key: 'lastmonth', label: 'Letzter Monat',  from: monthFirst(-1),  to: monthLast(-1)   },
  ]

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      {/* Quick-Presets (Tag/Monat-basiert) */}
      {presets.map(p => (
        <button
          key={p.key}
          onClick={() => onCustom(p.from, p.to)}
          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
            isActive(p.from, p.to)
              ? 'bg-zinc-900 text-white'
              : 'text-zinc-500 hover:bg-zinc-100'
          }`}
        >
          {p.label}
        </button>
      ))}

      <span className="text-zinc-300">·</span>

      {/* Rolling-Range-Presets */}
      {(['7d', '30d', '90d'] as Range[]).map(r => (
        <button
          key={r}
          onClick={() => onPreset(r)}
          className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
            !customRange && range === r ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
          }`}
        >
          {r === '7d' ? '7 T.' : r === '30d' ? '30 T.' : '90 T.'}
        </button>
      ))}

      <span className="text-zinc-200 hidden sm:inline">|</span>

      {/* Custom date inputs */}
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={dateFrom}
          onChange={e => onCustom(e.target.value, dateTo || e.target.value)}
          aria-label="Von"
          className={`text-xs px-2 py-1.5 rounded-lg border transition-colors outline-none ${
            customRange ? 'border-amber-400 bg-amber-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600'
          }`}
        />
        <span className="text-zinc-400 text-xs">–</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => onCustom(dateFrom || e.target.value, e.target.value)}
          aria-label="Bis"
          className={`text-xs px-2 py-1.5 rounded-lg border transition-colors outline-none ${
            customRange ? 'border-amber-400 bg-amber-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600'
          }`}
        />
        {customRange && (
          <button
            onClick={() => onCustom('', '')}
            className="text-xs text-zinc-400 hover:text-zinc-700 px-1"
            aria-label="Datumsfilter zurücksetzen"
            title="Zurück zu rollender Range"
          >×</button>
        )}
      </div>

      <button
        onClick={onExport}
        disabled={!hasData}
        className="ml-1 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 disabled:text-zinc-300 disabled:hover:bg-transparent transition-colors"
        title="Als CSV herunterladen"
      >
        ⬇ CSV
      </button>
    </div>
  )
}

/**
 * Exportiert die aktuelle Analytics-Snapshot als CSV — eine Datei mit
 * mehreren Sektionen (Summary, Timeline, TopPages, etc.) damit ein einzelner
 * Download alles abdeckt was im UI sichtbar ist.
 */
function downloadCSV(data: AnalyticsData | null): void {
  if (!data) return
  const esc = (v: string | number) => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines: string[] = []
  lines.push('# Osss Analytics Export')
  lines.push(`# Range: ${data.range.since.slice(0, 10)} → ${(data.range.until ?? '').slice(0, 10)} (${data.range.days} Tage)`)
  lines.push('')

  lines.push('# Summary')
  lines.push('metric,value')
  lines.push(`page_views,${data.summary.total_views}`)
  lines.push(`unique_visitors,${data.summary.unique_visitors}`)
  lines.push(`unique_sessions,${data.summary.unique_sessions}`)
  lines.push(`bounce_rate_pct,${data.summary.bounce_rate_pct ?? ''}`)
  lines.push(`bots_filtered,${data.summary.bots_filtered}`)
  lines.push(`total_clicks,${data.summary.total_clicks}`)
  lines.push('')

  lines.push('# Timeline')
  lines.push('date,views,sessions,visitors')
  for (const t of data.timeline) {
    lines.push(`${t.date},${t.views ?? t.count},${t.sessions ?? ''},${t.visitors ?? ''}`)
  }
  lines.push('')

  lines.push('# Top Pages')
  lines.push('path,count')
  for (const p of data.top_pages) lines.push(`${esc(p.path)},${p.count}`)
  lines.push('')

  lines.push('# Sources')
  lines.push('source,count')
  for (const s of data.sources) lines.push(`${esc(s.source)},${s.count}`)
  lines.push('')

  lines.push('# Countries')
  lines.push('country,count')
  for (const c of data.countries) lines.push(`${esc(c.country)},${c.count}`)

  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `osss-analytics-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * FilterChip — kleine Pille die einen aktiven Filter zeigt mit X zum Entfernen.
 */
function FilterChip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-amber-300 rounded-full text-zinc-800">
      <span className="text-amber-700 font-semibold">{label}:</span>
      <code className="font-mono text-[11px]">{value}</code>
      <button
        onClick={onClear}
        aria-label={`${label}-Filter entfernen`}
        className="text-zinc-400 hover:text-zinc-700 leading-none ml-0.5"
        type="button">×</button>
    </span>
  )
}
