'use client'

import { useEffect, useState } from 'react'
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
  range: { days: number; since: string }
  filter?: AnalyticsFilter
  summary: {
    total_views: number
    unique_visitors: number
    unique_sessions: number
    avg_views_per_session: number
    bots_filtered: number
    total_clicks: number
  }
  timeline: { date: string; count: number }[]
  top_pages: { path: string; count: number }[]
  top_referrers: { domain: string; count: number }[]
  sources: { source: string; count: number }[]
  clicks: { target: string; count: number }[]
  campaigns: { source: string; medium: string; campaign: string; sessions: number }[]
  countries: { country: string; count: number }[]
  devices: { device: string; count: number }[]
  browsers: { browser: string; count: number }[]
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

export default function AnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('30d')
  const [filter, setFilter] = useState<AnalyticsFilter>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const customRange = !!(dateFrom || dateTo)

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
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/leads" className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
              <ArrowLeft size={15} /> CRM
            </Link>
            <span className="text-zinc-300">|</span>
            <OsssLogo variant="dark" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 ml-2">Analytics</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {(['7d', '30d', '90d'] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => { setRange(r); setDateFrom(''); setDateTo('') }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  !customRange && range === r ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                {r === '7d' ? '7 Tage' : r === '30d' ? '30 Tage' : '90 Tage'}
              </button>
            ))}
            <span className="text-zinc-200 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className={`text-xs px-2 py-1.5 rounded-lg border transition-colors outline-none ${
                  customRange ? 'border-amber-400 bg-amber-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600'
                }`}
              />
              <span className="text-zinc-400 text-xs">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className={`text-xs px-2 py-1.5 rounded-lg border transition-colors outline-none ${
                  customRange ? 'border-amber-400 bg-amber-50 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600'
                }`}
              />
              {customRange && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo('') }}
                  className="text-xs text-zinc-400 hover:text-zinc-700 px-1"
                  aria-label="Datumsfilter zurücksetzen"
                >×</button>
              )}
            </div>
          </div>
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
              <KPI icon={<Eye size={16} />} label="Page Views" value={data.summary.total_views.toLocaleString('de-DE')} />
              <KPI icon={<Users size={16} />} label="Unique Visits" value={data.summary.unique_visitors.toLocaleString('de-DE')} sub="(visit-days, anonym)" />
              <KPI icon={<MousePointerClick size={16} />} label="Sessions" value={data.summary.unique_sessions.toLocaleString('de-DE')} />
              <KPI icon={<TrendingUp size={16} />} label="Views / Session" value={data.summary.avg_views_per_session.toFixed(1)} />
            </div>

            {/* Timeline */}
            <Section title={`Page Views — letzte ${data.range.days} Tage`}>
              <Timeline data={data.timeline} />
            </Section>

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
                    items={data.top_pages.map(p => ({ label: p.path, count: p.count, value: p.path }))}
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
                    items={data.sources.map(r => ({
                      label: SOURCE_LABEL[r.source] ?? r.source,
                      count: r.count,
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
                    items={data.top_referrers.map(r => ({
                      label: r.domain === 'direct' ? '🔗 Direkt / kein Referrer' : r.domain,
                      count: r.count,
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
                      const total = data.devices.reduce((a, b) => a + b.count, 0)
                      const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
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
                            <span className="font-semibold text-zinc-900 tabular-nums">{pct}% <span className="text-zinc-400 font-normal">({d.count})</span></span>
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
                    {data.browsers.map(b => {
                      const isActive = filter.browser === b.browser
                      return (
                        <li key={b.browser}>
                          <button
                            onClick={() => toggleFilter('browser', b.browser)}
                            className={`w-full flex items-center justify-between text-sm px-2 py-1.5 rounded-md transition-colors ${
                              isActive ? 'bg-amber-100 ring-1 ring-amber-400' : 'hover:bg-zinc-50'
                            }`}>
                            <span className="capitalize text-zinc-700">{b.browser}</span>
                            <span className="font-semibold text-zinc-900 tabular-nums">{b.count}</span>
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
                    {data.countries.map(c => {
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
                            <span className="font-semibold text-zinc-900 tabular-nums">{c.count}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>
            </div>

            {/* Owner-Filter-Hinweis */}
            <OwnerFilterBanner />

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

function KPI({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-zinc-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-2">
        <span className="text-zinc-500">{icon}</span>
        {label}
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

function OwnerFilterBanner() {
  const [excluded, setExcluded] = useState(true)

  useEffect(() => {
    try {
      const ls = localStorage.getItem('osss-no-track') === '1'
      const ck = /(?:^|;\s*)osss-internal=1/.test(document.cookie ?? '')
      setExcluded(ls || ck)
    } catch { /* ignore */ }
  }, [])

  function toggle() {
    try {
      if (excluded) {
        localStorage.removeItem('osss-no-track')
        // Cookie wieder entfernen: max-age=0 löscht den Cookie
        document.cookie = 'osss-internal=; max-age=0; path=/; samesite=lax'
        setExcluded(false)
      } else {
        localStorage.setItem('osss-no-track', '1')
        document.cookie = 'osss-internal=1; max-age=31536000; path=/; samesite=lax'
        setExcluded(true)
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
      <div className="flex items-start gap-3">
        <div className="text-amber-600 flex-shrink-0 mt-0.5">👤</div>
        <div className="flex-1 text-xs leading-relaxed">
          <p className="font-bold text-amber-900 mb-1">
            Tracking auf diesem Browser: {excluded ? <span className="text-emerald-700">DEAKTIVIERT</span> : <span className="text-rose-700">AKTIV (du wirst gezählt!)</span>}
          </p>
          <p className="text-amber-800">
            {excluded
              ? 'Deine eigenen Page-Views werden NICHT in die Statistik gezählt. Cookie + LocalStorage gesetzt für 1 Jahr. Wirkt auf diesem Browser auf diesem Gerät — beim ersten Dashboard-Besuch automatisch gesetzt.'
              : '⚠️ Deine Visits werden gerade in der Statistik gezählt. Klicke unten, um dich auszuschließen.'}
          </p>
          <p className="text-[10px] text-amber-700 mt-2 leading-relaxed">
            <strong>Smartphone, anderer Browser oder Inkognito?</strong> Einfach <a href="/no-track" className="underline font-semibold">/no-track</a> einmal öffnen — setzt Opt-Out auf jedem Gerät.
          </p>
          <button
            onClick={toggle}
            className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              excluded
                ? 'text-zinc-700 hover:bg-zinc-100'
                : 'text-white bg-zinc-900 hover:bg-zinc-700'
            }`}
          >
            {excluded ? '🔁 Tracking wieder aktivieren' : '🚫 Mich nicht mehr tracken'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Timeline({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) return <Empty />

  // SVG-Line-Chart mit gefüllter Area — sieht auch bei 1 Datenpunkt sauber aus
  const W = 800   // ViewBox-Breite (skaliert per CSS)
  const H = 160   // ViewBox-Höhe
  const PAD_L = 40
  const PAD_R = 30  // Platz für letztes Datum-Label (z.B. "07.05")
  const PAD_T = 10
  const PAD_B = 28
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const max = Math.max(...data.map(d => d.count), 4)
  // Y-Achse auf nächste runde Zahl
  const niceMax = max <= 5 ? 5 : max <= 10 ? 10 : max <= 50 ? Math.ceil(max / 10) * 10 : Math.ceil(max / 100) * 100
  const today = new Date().toISOString().slice(0, 10)

  // Punkte berechnen
  const points = data.map((d, i) => {
    const x = PAD_L + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
    const y = PAD_T + innerH - (d.count / niceMax) * innerH
    return { x, y, ...d, isToday: d.date === today }
  })

  // Path-D für Line
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  // Path-D für Area-Fill
  const areaPath = data.length === 1
    ? '' // kein Area bei 1 Punkt
    : `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(PAD_T + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(PAD_T + innerH).toFixed(1)} Z`

  // Y-Achse Ticks
  const yTicks = [0, niceMax / 4, niceMax / 2, (niceMax * 3) / 4, niceMax].map(v => Math.round(v))

  // X-Achse: zeige nur jeden 5. Tag (sonst überlappt)
  const xLabelStep = Math.max(1, Math.ceil(data.length / 7))

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
        {/* Grid-Linien (Y-Achse) */}
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

        {/* Area-Fill */}
        {areaPath && (
          <path d={areaPath} fill="url(#timeline-grad)" opacity="0.6" />
        )}
        <defs>
          <linearGradient id="timeline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Linie */}
        <path d={linePath} fill="none" stroke="#fbbf24" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Datenpunkte */}
        {points.map((p, i) => {
          // Tooltip-Position: 76px breit. Damit es nicht aus dem SVG ragt,
          // shiften wir je nach Punkt-Position links/rechts/zentriert.
          const TOOLTIP_W = 76
          const HALF = TOOLTIP_W / 2
          let tooltipX: number
          let textX: number
          let textAnchor: 'start' | 'middle' | 'end'
          if (p.x - HALF < PAD_L) {
            // Nah linker Rand → Tooltip rechts neben Punkt
            tooltipX = p.x
            textX = p.x + 6
            textAnchor = 'start'
          } else if (p.x + HALF > W - 5) {
            // Nah rechter Rand → Tooltip links vom Punkt
            tooltipX = p.x - TOOLTIP_W
            textX = p.x - 6
            textAnchor = 'end'
          } else {
            tooltipX = p.x - HALF
            textX = p.x
            textAnchor = 'middle'
          }
          return (
            <g key={i} className="group">
              {/* Größerer Hover-Bereich (transparent) */}
              <circle cx={p.x} cy={p.y} r={10} fill="transparent" />
              {/* Sichtbarer Punkt */}
              <circle cx={p.x} cy={p.y} r={p.isToday ? 5 : 3}
                fill={p.isToday ? '#f59e0b' : '#fbbf24'}
                stroke="#fff" strokeWidth="2" />
              {/* Tooltip on hover */}
              <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <rect x={tooltipX} y={p.y - 30} width={TOOLTIP_W} height={20} rx={4}
                  fill="#18181b" />
                <text x={textX} y={p.y - 16} textAnchor={textAnchor}
                  fontSize="9" fill="#fafafa" fontFamily="monospace">
                  {p.date.slice(5)} · {p.count}
                </text>
              </g>
            </g>
          )
        })}

        {/* X-Achse Labels — Anchor abhängig von Position (verhindert Clipping am Rand) */}
        {points.map((p, i) => {
          if (i % xLabelStep !== 0 && i !== points.length - 1) return null
          const isFirst = i === 0
          const isLast = i === points.length - 1
          const anchor: 'start' | 'middle' | 'end' = isFirst ? 'start' : isLast ? 'end' : 'middle'
          return (
            <text key={i} x={p.x} y={H - 10} textAnchor={anchor}
              fontSize="9" fill={p.isToday ? '#d97706' : '#a1a1aa'}
              fontWeight={p.isToday ? '700' : '400'}>
              {p.date.slice(8, 10)}.{p.date.slice(5, 7)}
            </text>
          )
        })}
      </svg>
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
