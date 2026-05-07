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
  summary: {
    total_views: number
    unique_visitors: number
    unique_sessions: number
    avg_views_per_session: number
  }
  timeline: { date: string; count: number }[]
  top_pages: { path: string; count: number }[]
  top_referrers: { domain: string; count: number }[]
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

export default function AnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('30d')

  // Owner-Opt-Out für Tracking: wer auf dieser Seite war, ist Admin/Owner und
  // soll seine eigenen Visits nicht in der Statistik haben.
  useEffect(() => {
    try { localStorage.setItem('osss-no-track', '1') } catch { /* ignore */ }
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

        const res = await fetch(`/api/admin/analytics?range=${range}`, {
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
  }, [range, router])

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
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d'] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  range === r ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'
                }`}
              >
                {r === '7d' ? '7 Tage' : r === '30d' ? '30 Tage' : '90 Tage'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-5 py-8">

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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Top Pages */}
              <Section title="Top Pages">
                {data.top_pages.length === 0 ? <Empty /> : (
                  <BarList
                    items={data.top_pages.map(p => ({ label: p.path, count: p.count }))}
                    formatLabel={l => l}
                  />
                )}
              </Section>

              {/* Top Referrers */}
              <Section title="Woher kommen die Besucher?">
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
            </div>

            {/* Conversion-Funnel */}
            <Section title="🎯 Conversion Funnel">
              <Funnel funnel={data.funnel} />
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Devices */}
              <Section title="Geräte">
                {data.devices.length === 0 ? <Empty /> : (
                  <ul className="space-y-2">
                    {data.devices.map(d => {
                      const total = data.devices.reduce((a, b) => a + b.count, 0)
                      const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
                      return (
                        <li key={d.device} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            {d.device === 'mobile' ? <Smartphone size={14} className="text-zinc-400" /> :
                             d.device === 'tablet' ? <Tablet size={14} className="text-zinc-400" /> :
                             <Monitor size={14} className="text-zinc-400" />}
                            <span className="capitalize text-zinc-700">{d.device}</span>
                          </span>
                          <span className="font-semibold text-zinc-900 tabular-nums">{pct}% <span className="text-zinc-400 font-normal">({d.count})</span></span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              {/* Browsers */}
              <Section title="Browser">
                {data.browsers.length === 0 ? <Empty /> : (
                  <ul className="space-y-2">
                    {data.browsers.map(b => (
                      <li key={b.browser} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-zinc-700">{b.browser}</span>
                        <span className="font-semibold text-zinc-900 tabular-nums">{b.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Countries */}
              <Section title="Länder">
                {data.countries.length === 0 ? <Empty /> : (
                  <ul className="space-y-2">
                    {data.countries.map(c => (
                      <li key={c.country} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Globe size={13} className="text-zinc-400" />
                          <span className="text-zinc-700 uppercase">{c.country === 'unknown' ? '—' : c.country}</span>
                        </span>
                        <span className="font-semibold text-zinc-900 tabular-nums">{c.count}</span>
                      </li>
                    ))}
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
      setExcluded(localStorage.getItem('osss-no-track') === '1')
    } catch { /* ignore */ }
  }, [])

  function toggle() {
    try {
      if (excluded) {
        localStorage.removeItem('osss-no-track')
        setExcluded(false)
      } else {
        localStorage.setItem('osss-no-track', '1')
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
              ? 'Deine eigenen Page-Views werden NICHT in die Statistik gezählt. Beim ersten Besuch dieser Seite automatisch gesetzt — pro Browser einmal nötig.'
              : '⚠️ Deine Visits werden gerade in der Statistik gezählt. Klicke unten, um dich auszuschließen.'}
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
        {points.map((p, i) => (
          <g key={i} className="group">
            {/* Größerer Hover-Bereich (transparent) */}
            <circle cx={p.x} cy={p.y} r={10} fill="transparent" />
            {/* Sichtbarer Punkt */}
            <circle cx={p.x} cy={p.y} r={p.isToday ? 5 : 3}
              fill={p.isToday ? '#f59e0b' : '#fbbf24'}
              stroke="#fff" strokeWidth="2" />
            {/* Tooltip on hover */}
            <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <rect x={p.x - 38} y={p.y - 30} width={76} height={20} rx={4}
                fill="#18181b" />
              <text x={p.x} y={p.y - 16} textAnchor="middle"
                fontSize="9" fill="#fafafa" fontFamily="monospace">
                {p.date.slice(5)} · {p.count}
              </text>
            </g>
          </g>
        ))}

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

function BarList({ items, formatLabel }: { items: { label: string; count: number }[]; formatLabel: (l: string) => string }) {
  const max = Math.max(...items.map(i => i.count), 1)
  return (
    <ul className="space-y-1.5">
      {items.map(i => (
        <li key={i.label} className="text-sm">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-zinc-700 truncate font-mono text-xs" title={i.label}>{formatLabel(i.label)}</span>
            <span className="font-semibold text-zinc-900 tabular-nums ml-2">{i.count}</span>
          </div>
          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(i.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Funnel({ funnel }: { funnel: AnalyticsData['funnel'] }) {
  const max = Math.max(funnel.home, funnel.pricing, funnel.register, 1)
  const stages = [
    { label: '🏠 Landing (/)',           count: funnel.home,     conversion: null },
    { label: '📝 Blog (/blog/*)',         count: funnel.blog,     conversion: null },
    { label: '💰 Pricing (/pricing)',     count: funnel.pricing,  conversion: funnel.home_to_pricing_pct },
    { label: '✍️ Register (/register)',  count: funnel.register, conversion: funnel.pricing_to_register_pct },
  ]
  return (
    <div className="space-y-3">
      {stages.map((s, i) => (
        <div key={i}>
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
        </div>
      ))}
      <p className="text-xs text-zinc-500 mt-3 italic">
        Sessions auf der jeweiligen Seite. Conversion-Rate berechnet aus Sessions, nicht
        Visitors — eine Person kann mehrere Sessions haben.
      </p>
    </div>
  )
}
