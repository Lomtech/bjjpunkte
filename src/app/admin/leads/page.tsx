'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SalesLead, SalesActivity, SalesLeadStatus } from '@/types/database'

const STATUSES: { v: SalesLeadStatus; label: string; color: string }[] = [
  { v: 'new',             label: 'Neu',          color: 'bg-zinc-100 text-zinc-700' },
  { v: 'researching',     label: 'Recherche',    color: 'bg-blue-50 text-blue-700' },
  { v: 'contacted',       label: 'Kontaktiert',  color: 'bg-amber-50 text-amber-700' },
  { v: 'qualified',       label: 'Qualifiziert', color: 'bg-purple-50 text-purple-700' },
  { v: 'demo_scheduled',  label: 'Demo geplant', color: 'bg-indigo-50 text-indigo-700' },
  { v: 'demo_done',       label: 'Demo gehabt',  color: 'bg-cyan-50 text-cyan-700' },
  { v: 'negotiating',     label: 'Verhandlung',  color: 'bg-orange-50 text-orange-700' },
  { v: 'won',             label: 'Gewonnen',     color: 'bg-emerald-100 text-emerald-700' },
  { v: 'lost',            label: 'Verloren',     color: 'bg-rose-50 text-rose-700' },
  { v: 'not_a_fit',       label: 'Kein Fit',     color: 'bg-stone-100 text-stone-600' },
  { v: 'do_not_contact',  label: 'Nicht kontaktieren', color: 'bg-red-100 text-red-700' },
]

export default function AdminLeadsPage() {
  const [token, setToken] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [leads, setLeads] = useState<SalesLead[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // filters
  const [statusFilter, setStatusFilter] = useState<Set<SalesLeadStatus>>(new Set(['new','researching','contacted','qualified']))
  const [martialOnly, setMartialOnly] = useState(true)
  const [city, setCity] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState('priority')
  const [page, setPage] = useState(0)

  // panels
  const [selected, setSelected] = useState<SalesLead | null>(null)
  const [activities, setActivities] = useState<SalesActivity[]>([])
  const [showSearchModal, setShowSearchModal] = useState(false)

  // search modal
  const [searchQuery, setSearchQuery] = useState('BJJ München')
  const [searchPages, setSearchPages] = useState(3)
  const [searchRunning, setSearchRunning] = useState(false)
  const [searchResult, setSearchResult] = useState<{inserted:number;updated:number;errors:string[]} | null>(null)

  // auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setAuthError('Nicht eingeloggt'); setAuthChecked(true); return }
      setToken(session.access_token)
      setAuthChecked(true)
    })
  }, [])

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  // load leads
  const loadLeads = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter.size > 0) params.set('status', [...statusFilter].join(','))
    if (martialOnly) params.set('martial', 'true')
    if (city.trim()) params.set('city', city.trim())
    if (debouncedSearch) params.set('search', debouncedSearch)
    params.set('sort', sort)
    params.set('page', String(page))
    params.set('pageSize', '50')

    const res = await fetch(`/api/admin/leads?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      if (res.status === 403) setAuthError('Forbidden — kein Admin')
      setLoading(false); return
    }
    const data = await res.json()
    setLeads(data.leads ?? [])
    setTotal(data.total ?? 0)
    setStatusCounts(data.statusCounts ?? {})
    setLoading(false)
  }, [token, statusFilter, martialOnly, city, debouncedSearch, sort, page])

  useEffect(() => { loadLeads() }, [loadLeads])

  // load activities for selected
  useEffect(() => {
    if (!selected || !token) { setActivities([]); return }
    fetch(`/api/admin/leads/${selected.id}/activity`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { activities: [] })
      .then(d => setActivities(d.activities ?? []))
  }, [selected, token])

  async function updateLead(id: string, patch: Partial<SalesLead>) {
    if (!token) return
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const { lead } = await res.json()
      setLeads(prev => prev.map(l => l.id === id ? lead : l))
      if (selected?.id === id) setSelected(lead)
    }
  }

  async function logActivity(leadId: string, payload: Record<string, unknown>) {
    if (!token) return
    const res = await fetch(`/api/admin/leads/${leadId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const { activity } = await res.json()
      setActivities(prev => [activity, ...prev])
      // refetch lead to get updated contact_count
      loadLeads()
    }
  }

  async function runPlacesSearch() {
    if (!token || !searchQuery.trim()) return
    setSearchRunning(true); setSearchResult(null)
    try {
      const res = await fetch('/api/admin/leads/places-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: searchQuery.trim(), maxPages: searchPages }),
      })
      const data = await res.json()
      if (res.ok) {
        setSearchResult({ inserted: data.inserted, updated: data.updated, errors: data.errors ?? [] })
        loadLeads()
      } else {
        setSearchResult({ inserted: 0, updated: 0, errors: [data.error ?? 'Fehler'] })
      }
    } finally {
      setSearchRunning(false)
    }
  }

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500">Lade…</div>
  }
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl font-bold">×</span>
          </div>
          <h1 className="text-lg font-bold text-zinc-900 mb-1">{authError}</h1>
          <p className="text-sm text-zinc-500">Diese Seite ist nur für Admins.</p>
          <a href="/login" className="mt-4 inline-block text-sm text-amber-700 hover:underline">Zum Login</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Sales-CRM</h1>
            <p className="text-sm text-zinc-500">{total} Leads · {statusCounts.contacted ?? 0} kontaktiert · {statusCounts.qualified ?? 0} qualifiziert · {statusCounts.won ?? 0} gewonnen</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearchModal(true)}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-zinc-900 text-sm font-semibold rounded-xl">
              + Google Places suchen
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        {/* Filter sidebar */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">Status</h3>
            <div className="space-y-1">
              {STATUSES.map(s => {
                const checked = statusFilter.has(s.v)
                const count = statusCounts[s.v] ?? 0
                return (
                  <label key={s.v} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-zinc-50 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={checked} onChange={e => {
                        const next = new Set(statusFilter)
                        if (e.target.checked) next.add(s.v); else next.delete(s.v)
                        setStatusFilter(next); setPage(0)
                      }} />
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                    </span>
                    <span className="text-xs text-zinc-400 tabular-nums">{count}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={martialOnly} onChange={e => { setMartialOnly(e.target.checked); setPage(0) }} />
              <span>Nur Kampfsport-Studios</span>
            </label>
            <input type="text" placeholder="Stadt …" value={city}
              onChange={e => { setCity(e.target.value); setPage(0) }}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
            <input type="text" placeholder="Suche Name/Adresse/Tel/Mail" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg" />
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg">
              <option value="priority">Priorität</option>
              <option value="next_followup">Nächster Follow-up</option>
              <option value="updated">Zuletzt geändert</option>
              <option value="created">Neueste zuerst</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </aside>

        {/* Lead list */}
        <main className="col-span-12 lg:col-span-9">
          {loading ? (
            <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-zinc-500">Lade…</div>
          ) : leads.length === 0 ? (
            <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-zinc-500">
              Keine Leads. Klick „Google Places suchen“ um welche zu importieren.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Studio</th>
                    <th className="px-4 py-3">Stadt</th>
                    <th className="px-4 py-3">Kontakt</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Prio</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(l => {
                    const status = STATUSES.find(s => s.v === l.status)
                    return (
                      <tr key={l.id}
                        onClick={() => setSelected(l)}
                        className={`border-b border-zinc-100 cursor-pointer hover:bg-amber-50/40 ${selected?.id === l.id ? 'bg-amber-50/60' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900">{l.name}</div>
                          {l.is_martial_arts && (
                            <div className="text-xs text-amber-700 mt-0.5">🥋 {l.sports.slice(0,3).join(', ')}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{l.city ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600">
                          {l.phone && <div>📞 {l.phone}</div>}
                          {l.website && <div className="truncate max-w-[160px]">🌐 {l.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {status && <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{'★'.repeat(l.priority)}</td>
                        <td className="px-4 py-3 text-zinc-600">
                          {l.rating ? `${l.rating} (${l.user_ratings_total})` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={e => { e.stopPropagation(); setSelected(l) }}
                            className="text-xs text-amber-700 hover:underline">Öffnen →</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {total > 50 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 text-sm text-zinc-600">
                  <span>Seite {page + 1} von {Math.ceil(total / 50)}</span>
                  <div className="flex gap-2">
                    <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                      className="px-3 py-1 rounded border border-zinc-200 disabled:opacity-50">‹</button>
                    <button disabled={page + 1 >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}
                      className="px-3 py-1 rounded border border-zinc-200 disabled:opacity-50">›</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Detail panel */}
      {selected && (
        <LeadDetailPanel
          lead={selected}
          activities={activities}
          onClose={() => setSelected(null)}
          onUpdate={patch => updateLead(selected.id, patch)}
          onActivity={payload => logActivity(selected.id, payload)}
        />
      )}

      {/* Places search modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-2">Google Places durchsuchen</h3>
            <p className="text-sm text-zinc-500 mb-4">Importiert Studios in dein CRM. Existing leads werden NICHT überschrieben — nur Metadaten aktualisiert.</p>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="z.B. BJJ München" autoFocus
              className="w-full px-3 py-2 border border-zinc-200 rounded-lg mb-3" />
            <label className="block text-sm text-zinc-600 mb-4">
              Seiten (max 5 × 20 = 100 results):
              <input type="number" min={1} max={5} value={searchPages}
                onChange={e => setSearchPages(parseInt(e.target.value, 10) || 1)}
                className="ml-2 w-16 px-2 py-1 border border-zinc-200 rounded" />
            </label>
            {searchResult && (
              <div className="text-sm bg-emerald-50 text-emerald-800 px-3 py-2 rounded-lg mb-3">
                ✓ {searchResult.inserted} neu, {searchResult.updated} aktualisiert
                {searchResult.errors.length > 0 && (
                  <div className="text-rose-700 text-xs mt-1">{searchResult.errors.length} Fehler: {searchResult.errors[0]}</div>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowSearchModal(false); setSearchResult(null) }}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-200">Schließen</button>
              <button onClick={runPlacesSearch} disabled={searchRunning || !searchQuery.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-amber-400 hover:bg-amber-500 text-zinc-900 font-semibold disabled:opacity-50">
                {searchRunning ? 'Lädt…' : 'Suchen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LeadDetailPanel({ lead, activities, onClose, onUpdate, onActivity }: {
  lead: SalesLead
  activities: SalesActivity[]
  onClose: () => void
  onUpdate: (patch: Partial<SalesLead>) => void
  onActivity: (payload: Record<string, unknown>) => void
}) {
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [activityKind, setActivityKind] = useState<'call' | 'email' | 'note'>('call')
  const [activityOutcome, setActivityOutcome] = useState<string>('')
  const [activityBody, setActivityBody] = useState('')

  useEffect(() => { setNotes(lead.notes ?? '') }, [lead.id, lead.notes])

  function handleNotesBlur() {
    if (notes !== (lead.notes ?? '')) onUpdate({ notes })
  }

  function handleAddActivity() {
    if (!activityBody.trim() && activityKind === 'note') return
    onActivity({
      kind: activityKind,
      outcome: activityOutcome || null,
      body: activityBody || null,
    })
    setActivityBody('')
    setActivityOutcome('')
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:max-w-xl bg-white shadow-2xl border-l border-zinc-200 z-40 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">{lead.name}</h2>
          {lead.formatted_address && <p className="text-sm text-zinc-500">{lead.formatted_address}</p>}
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none">×</button>
      </div>

      <div className="p-6 space-y-6">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          {lead.phone && (
            <a href={`tel:${lead.international_phone ?? lead.phone}`}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-xl text-sm">
              📞 {lead.phone}
            </a>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noopener"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold rounded-xl text-sm truncate">
              🌐 Website
            </a>
          )}
          {lead.google_maps_url && (
            <a href={lead.google_maps_url} target="_blank" rel="noopener"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold rounded-xl text-sm">
              📍 Google Maps
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold rounded-xl text-sm truncate">
              ✉ {lead.email}
            </a>
          )}
        </div>

        {/* Status + priority */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Status</span>
            <select value={lead.status} onChange={e => onUpdate({ status: e.target.value as SalesLeadStatus })}
              className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm">
              {STATUSES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Priorität</span>
            <select value={lead.priority} onChange={e => onUpdate({ priority: parseInt(e.target.value, 10) })}
              className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm">
              <option value={5}>★★★★★ Heiß</option>
              <option value={4}>★★★★ Hoch</option>
              <option value={3}>★★★ Standard</option>
              <option value={2}>★★ Niedrig</option>
              <option value={1}>★ Cold</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Nächster Follow-up</span>
          <input type="datetime-local"
            value={lead.next_followup_at ? new Date(lead.next_followup_at).toISOString().slice(0,16) : ''}
            onChange={e => onUpdate({ next_followup_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
        </label>

        {/* Notes */}
        <label className="block">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Notizen</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={handleNotesBlur} rows={4}
            placeholder="Was hast du erfahren? Wer ist Ansprechpartner? …"
            className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
        </label>

        {/* Add activity */}
        <div className="bg-zinc-50 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-zinc-900">Aktivität loggen</h3>
          <div className="flex gap-2">
            {(['call','email','note'] as const).map(k => (
              <button key={k} onClick={() => setActivityKind(k)}
                className={`flex-1 px-3 py-2 text-sm rounded-lg ${activityKind === k ? 'bg-amber-400 text-zinc-900 font-semibold' : 'bg-white border border-zinc-200'}`}>
                {k === 'call' ? '📞 Anruf' : k === 'email' ? '✉ Mail' : '📝 Notiz'}
              </button>
            ))}
          </div>
          {activityKind === 'call' && (
            <select value={activityOutcome} onChange={e => setActivityOutcome(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white">
              <option value="">Ergebnis …</option>
              <option value="answered">Erreicht</option>
              <option value="interested">Interessiert</option>
              <option value="call_back">Rückruf vereinbart</option>
              <option value="not_interested">Kein Interesse</option>
              <option value="no_answer">Niemand am Apparat</option>
              <option value="voicemail">Mailbox</option>
              <option value="wrong_number">Falsche Nummer</option>
            </select>
          )}
          <textarea value={activityBody} onChange={e => setActivityBody(e.target.value)} rows={3}
            placeholder={activityKind === 'call' ? 'Was wurde besprochen?' : activityKind === 'email' ? 'Worum ging\'s?' : 'Notiz …'}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white" />
          <button onClick={handleAddActivity}
            className="w-full px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg">
            Loggen
          </button>
        </div>

        {/* Activity timeline */}
        <div>
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">
            Timeline ({lead.contact_count}× kontaktiert)
          </h3>
          {activities.length === 0 ? (
            <p className="text-sm text-zinc-400">Noch keine Aktivitäten.</p>
          ) : (
            <ul className="space-y-3">
              {activities.map(a => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="text-lg">{kindIcon(a.kind)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-zinc-900">
                      <span className="font-semibold">{kindLabel(a.kind)}</span>
                      {a.outcome && <span className="ml-2 text-xs text-zinc-500">· {a.outcome}</span>}
                      {a.subject && <span className="ml-2 text-zinc-700">— {a.subject}</span>}
                    </div>
                    {a.body && <p className="text-zinc-600 mt-0.5 whitespace-pre-wrap break-words">{a.body}</p>}
                    <p className="text-xs text-zinc-400 mt-0.5">{new Date(a.occurred_at).toLocaleString('de-DE')}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function kindIcon(kind: string): string {
  switch (kind) {
    case 'call': return '📞'
    case 'email': return '✉'
    case 'sms': return '💬'
    case 'whatsapp': return '🟢'
    case 'meeting': return '🤝'
    case 'demo': return '🎬'
    case 'note': return '📝'
    case 'status_change': return '🔄'
    case 'followup_scheduled': return '📅'
    case 'place_imported': return '📍'
    default: return '•'
  }
}
function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    call: 'Anruf', email: 'E-Mail', sms: 'SMS', whatsapp: 'WhatsApp',
    meeting: 'Meeting', demo: 'Demo', note: 'Notiz', status_change: 'Status',
    followup_scheduled: 'Follow-up geplant', place_imported: 'Importiert',
  }
  return map[kind] ?? kind
}
