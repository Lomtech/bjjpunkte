'use client'

import { useEffect, useState } from 'react'

type Stats = {
  range: string
  activitiesByKind: Record<string, number>
  callsByOutcome: Record<string, number>
  byDay: Record<string, number>
  totalCalls: number
  successfulCalls: number
  callSuccessRate: number
  pipeline: Record<string, number>
  conversion: {
    contactRate: number
    qualifyRate: number
    demoRate: number
    winRate: number
    overallWinRate: number
  }
  topCities: { city: string; count: number }[]
  totalLeads: number
  avgContactsPerLead: number
}

const RANGES = [
  { id: 'today', label: 'Heute' },
  { id: '7d',    label: '7 Tage' },
  { id: '30d',   label: '30 Tage' },
  { id: 'all',   label: 'Alle' },
]

const OUTCOME_LABELS: Record<string, { label: string; positive: boolean }> = {
  answered:       { label: 'Erreicht',          positive: true  },
  interested:     { label: 'Interessiert',       positive: true  },
  call_back:      { label: 'Rückruf vereinbart', positive: true  },
  no_answer:      { label: 'Niemand am Apparat', positive: false },
  voicemail:      { label: 'Mailbox',            positive: false },
  not_interested: { label: 'Kein Interesse',     positive: false },
  wrong_number:   { label: 'Falsche Nummer',     positive: false },
}

const PIPELINE_ORDER = ['new','researching','contacted','qualified','demo_scheduled','demo_done','negotiating','won','lost','not_a_fit','do_not_contact']
const PIPELINE_LABELS: Record<string, string> = {
  new: 'Neu',
  researching: 'Recherche',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  demo_scheduled: 'Demo geplant',
  demo_done: 'Demo gehabt',
  negotiating: 'Verhandlung',
  won: 'Gewonnen',
  lost: 'Verloren',
  not_a_fit: 'Kein Fit',
  do_not_contact: 'Nicht kontaktieren',
}

export function StatsModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [range, setRange] = useState('7d')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/leads/stats?range=${range}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range, token])

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4 overflow-hidden" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-900">📊 Statistik</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none p-2">×</button>
        </div>

        {/* Range tabs */}
        <div className="px-4 sm:px-6 pt-4">
          <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
            {RANGES.map(r => (
              <button key={r.id} onClick={() => setRange(r.id)}
                className={`flex-1 px-3 py-2 text-sm rounded-lg font-semibold transition ${
                  range === r.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
                }`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {loading || !stats ? (
            <div className="text-center text-zinc-400 py-8">Lade…</div>
          ) : (
            <>
              {/* Top KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <KPI label="Anrufe"      value={stats.totalCalls.toString()} />
                <KPI label="Erfolgsrate" value={`${stats.callSuccessRate}%`} tone={stats.callSuccessRate >= 30 ? 'good' : stats.callSuccessRate >= 15 ? 'ok' : 'bad'} />
                <KPI label="Demos"       value={(stats.activitiesByKind['demo'] ?? 0).toString()} />
                <KPI label="E-Mails"     value={(stats.activitiesByKind['email'] ?? 0).toString()} />
              </div>

              {/* Calls by outcome */}
              {stats.totalCalls > 0 && (
                <Section title="Anruf-Ergebnisse">
                  <div className="space-y-2">
                    {Object.entries(stats.callsByOutcome)
                      .sort(([,a], [,b]) => b - a)
                      .map(([outcome, count]) => {
                        const meta = OUTCOME_LABELS[outcome] ?? { label: outcome, positive: false }
                        const pct = stats.totalCalls > 0 ? (count / stats.totalCalls * 100) : 0
                        return (
                          <div key={outcome} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between mb-0.5">
                                <span className="text-sm text-zinc-700">{meta.label}</span>
                                <span className="text-sm text-zinc-500 font-mono">{count} · {pct.toFixed(0)}%</span>
                              </div>
                              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                <div className={`h-full ${meta.positive ? 'bg-emerald-400' : 'bg-zinc-300'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </Section>
              )}

              {/* Pipeline funnel */}
              <Section title={`Pipeline (alle Leads · ${stats.totalLeads})`}>
                <div className="space-y-1.5">
                  {PIPELINE_ORDER.filter(s => (stats.pipeline[s] ?? 0) > 0).map(status => {
                    const count = stats.pipeline[status] ?? 0
                    const pct = stats.totalLeads > 0 ? (count / stats.totalLeads * 100) : 0
                    const isWin = status === 'won'
                    const isLoss = ['lost','not_a_fit','do_not_contact'].includes(status)
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <div className="w-32 sm:w-40 text-sm text-zinc-700 truncate">{PIPELINE_LABELS[status]}</div>
                        <div className="flex-1 h-7 bg-zinc-50 rounded-md overflow-hidden relative">
                          <div className={`h-full ${isWin ? 'bg-emerald-300' : isLoss ? 'bg-rose-200' : 'bg-amber-200'}`}
                            style={{ width: `${Math.max(pct, 3)}%` }} />
                          <span className="absolute left-2 top-0.5 text-xs font-mono text-zinc-700">
                            {count} · {pct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>

              {/* Conversion rates */}
              <Section title="Conversion (alle Leads)">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <KPI label="Kontakt-Quote"   value={`${stats.conversion.contactRate}%`} sub="aller Leads" />
                  <KPI label="→ Qualifiziert"  value={`${stats.conversion.qualifyRate}%`} sub="der Kontakte" />
                  <KPI label="→ Demo"          value={`${stats.conversion.demoRate}%`} sub="der Qualifizierten" />
                  <KPI label="→ Gewonnen"      value={`${stats.conversion.winRate}%`} sub="der Demos" />
                </div>
                {stats.totalLeads > 0 && (
                  <p className="text-xs text-zinc-500 mt-3">
                    Overall Win-Rate: <strong>{stats.conversion.overallWinRate}%</strong> aller Leads · Ø {stats.avgContactsPerLead} Kontakte pro Lead
                  </p>
                )}
              </Section>

              {/* Calls per day — Heatmap-Style, GitHub-Contribution-inspiriert.
                  Zeigt 28 Tage (4 Wochen) als Grid. Compact, funktioniert mit wenig
                  und mit viel Daten gleichermaßen, kein Empty-Space-Problem. */}
              {Object.keys(stats.byDay).length > 0 && (
                <Section title="Anruf-Aktivität (letzte 4 Wochen)">
                  {(() => {
                    const DAYS = 28
                    const days: { day: string; count: number; isToday: boolean; weekday: number }[] = []
                    const now = new Date()
                    // 28 Tage rückwärts, in chronologischer Reihenfolge
                    for (let i = DAYS - 1; i >= 0; i--) {
                      const d = new Date(now)
                      d.setDate(d.getDate() - i)
                      const key = d.toISOString().slice(0, 10)
                      // Mo=0, Di=1, ..., So=6
                      const wd = (d.getDay() + 6) % 7
                      days.push({
                        day: key,
                        count: stats.byDay[key] ?? 0,
                        isToday: i === 0,
                        weekday: wd,
                      })
                    }
                    const total = days.reduce((s, d) => s + d.count, 0)
                    const activeDays = days.filter(d => d.count > 0).length
                    const avgPerActiveDay = activeDays > 0 ? +(total / activeDays).toFixed(1) : 0
                    const todayCount = days[days.length - 1].count

                    // Streak — wieviele Tage in Folge mit Calls (heute zurück)
                    let streak = 0
                    for (let i = days.length - 1; i >= 0; i--) {
                      if (days[i].count > 0) streak++
                      else break
                    }

                    // Color-Scale für Heatmap
                    function tone(c: number, isToday: boolean): string {
                      if (c === 0) return isToday ? 'bg-zinc-200 ring-2 ring-amber-400' : 'bg-zinc-100'
                      const ring = isToday ? ' ring-2 ring-amber-700' : ''
                      if (c >= 21) return 'bg-amber-600' + ring
                      if (c >= 11) return 'bg-amber-500' + ring
                      if (c >= 6)  return 'bg-amber-400' + ring
                      if (c >= 1)  return 'bg-amber-200' + ring
                      return 'bg-zinc-100' + ring
                    }

                    const WEEKDAY_LABELS = ['Mo', '', 'Mi', '', 'Fr', '', 'So']

                    return (
                      <>
                        {/* KPI-Reihe oben */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-zinc-50 rounded-lg p-2.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">Heute</div>
                            <div className={`text-xl font-black tabular-nums ${todayCount > 0 ? 'text-amber-600' : 'text-zinc-300'}`}>{todayCount}</div>
                          </div>
                          <div className="bg-zinc-50 rounded-lg p-2.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">Streak</div>
                            <div className={`text-xl font-black tabular-nums ${streak > 0 ? 'text-emerald-600' : 'text-zinc-300'}`}>{streak} <span className="text-xs font-normal text-zinc-400">Tag{streak === 1 ? '' : 'e'}</span></div>
                          </div>
                          <div className="bg-zinc-50 rounded-lg p-2.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-0.5">Gesamt 28d</div>
                            <div className="text-xl font-black tabular-nums text-zinc-900">{total}</div>
                          </div>
                        </div>

                        {/* Heatmap-Grid: 7 Reihen (Mo-So) × 4 Spalten (4 Wochen) */}
                        <div className="flex gap-2">
                          <div className="flex flex-col gap-1 pt-0">
                            {WEEKDAY_LABELS.map((l, i) => (
                              <div key={i} className="text-[9px] text-zinc-400 h-4 flex items-center font-medium">{l}</div>
                            ))}
                          </div>
                          <div className="flex-1 grid grid-flow-col grid-rows-7 gap-1">
                            {/* Padding-Squares vor dem ersten Tag, damit Mo-So-Spalten sauber stehen */}
                            {(() => {
                              const firstWd = days[0].weekday
                              const placeholders = Array.from({ length: firstWd }, (_, i) => (
                                <div key={`pad-${i}`} className="" />
                              ))
                              const cells = days.map(({ day, count, isToday }) => (
                                <div
                                  key={day}
                                  className={`h-4 rounded-sm ${tone(count, isToday)} group relative cursor-default`}
                                  title={`${new Date(day).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} · ${count} Calls`}
                                >
                                  {/* Tooltip on hover */}
                                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                                    {new Date(day).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} · <strong>{count}</strong>
                                  </div>
                                </div>
                              ))
                              return [...placeholders, ...cells]
                            })()}
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center justify-end gap-1 mt-3 text-[9px] text-zinc-400">
                          <span>0</span>
                          <div className="w-3 h-3 rounded-sm bg-zinc-100" />
                          <div className="w-3 h-3 rounded-sm bg-amber-200" />
                          <div className="w-3 h-3 rounded-sm bg-amber-400" />
                          <div className="w-3 h-3 rounded-sm bg-amber-500" />
                          <div className="w-3 h-3 rounded-sm bg-amber-600" />
                          <span>20+</span>
                        </div>

                        {/* Motivierender Footer statt anklagendem Tipp */}
                        <p className="text-xs text-zinc-500 mt-3 leading-relaxed">
                          {activeDays === 0 && <>Noch keine Daten — der erste Anruf zählt.</>}
                          {activeDays === 1 && <>Erster Tag dabei. <strong>Konsistenz</strong> ist wichtiger als Volumen — auch 5 Anrufe/Tag bringen dich nach 1 Monat zu 100+ Conversations.</>}
                          {activeDays >= 2 && activeDays < 7 && <>Du baust gerade Schwung auf. Ø <strong>{avgPerActiveDay}</strong> Calls pro aktivem Tag · {streak >= 2 && <>aktuelle Streak: <strong>{streak} Tage</strong>.</>}</>}
                          {activeDays >= 7 && <>Solide Aktivität. Ø <strong>{avgPerActiveDay}</strong> Calls pro aktivem Tag · Gesamt <strong>{total}</strong> in 28 Tagen{streak >= 3 && <> · Streak: <strong>{streak} Tage</strong> 🔥</>}.</>}
                        </p>
                      </>
                    )
                  })()}
                </Section>
              )}

              {/* Top cities */}
              {stats.topCities.length > 0 && (
                <Section title="Top Städte">
                  <div className="space-y-1.5">
                    {stats.topCities.map(({ city, count }) => {
                      const max = stats.topCities[0]?.count ?? 1
                      const pct = (count / max) * 100
                      return (
                        <div key={city} className="flex items-center gap-3">
                          <div className="w-32 sm:w-40 text-sm text-zinc-700 truncate">{city}</div>
                          <div className="flex-1 h-5 bg-zinc-50 rounded-md overflow-hidden relative">
                            <div className="h-full bg-blue-200" style={{ width: `${pct}%` }} />
                            <span className="absolute left-2 top-0 text-xs font-mono text-zinc-600">{count}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good'|'ok'|'bad' }) {
  const valueColor = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : tone === 'ok' ? 'text-amber-700' : 'text-zinc-900'
  return (
    <div className="bg-zinc-50 rounded-xl p-3">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}
