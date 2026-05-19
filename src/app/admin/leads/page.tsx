'use client'

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react'
import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'
import type { SalesLead, SalesActivity, SalesLeadStatus } from '@/types/database'
import { CallScript } from './_components/CallScript'
import { StatsModal } from './_components/StatsModal'
import { useConfirm } from '@/components/ConfirmModal'
import { usePrompt } from '@/components/PromptModal'
import { fmtDateTime, fmtDate, fmtTime, fmtNumber } from '@/lib/date-format'
import {
  TEMPLATES,
  renderTemplate,
  validateRendered,
  extractVars,
  type ColdOutreachVariant,
  type TemplateVars,
} from '@/lib/sales/cold-outreach-templates'

const FILTERS_LS_KEY = 'osss-crm-leads-filters-v1'
const VIEW_LS_KEY = 'osss-crm-leads-view-v1'

type LeadsView = 'list' | 'pipeline'

// Pipeline action labels — used in the kanban cards + tagesbericht.
function pipelineActionLabel(a: string | null): string {
  if (!a) return 'Aktion offen'
  switch (a) {
    case 'send_mail_1':      return 'Erstkontakt-Mail senden'
    case 'followup_mail_2':  return 'Follow-up-Mail #2'
    case 'linkedin_dm':      return 'LinkedIn-DM'
    case 'call_followup':    return 'Anruf-Follow-up'
    case 'callback_call':    return 'Rückruf'
    case 'demo_call':        return 'Demo-Termin'
    case 'demo_followup':    return 'Demo-Nachfass'
    case 'onboarding_check': return 'Onboarding-Check'
    default:                 return a
  }
}
function pipelineActionIcon(a: string | null): string {
  if (!a) return '•'
  switch (a) {
    case 'send_mail_1':
    case 'followup_mail_2':  return '✉'
    case 'linkedin_dm':      return '💼'
    case 'call_followup':    return '📞'
    case 'callback_call':    return '🔁'
    case 'demo_call':
    case 'demo_followup':    return '🎯'
    case 'onboarding_check': return '🚀'
    default:                 return '•'
  }
}

// Mirror of the API filter logic — used after PATCH to decide whether a lead
// should still appear in the current view, so the UI feels live.
function leadMatchesFilters(lead: SalesLead, f: {
  statusFilter: Set<SalesLeadStatus>
  martialOnly: boolean
  dueOnly: boolean
  city: string
  search: string
}): boolean {
  if (f.statusFilter.size > 0 && !f.statusFilter.has(lead.status as SalesLeadStatus)) return false
  if (f.martialOnly && !lead.is_martial_arts) return false
  if (f.dueOnly) {
    if (!lead.next_followup_at) return false
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
    if (new Date(lead.next_followup_at).getTime() > endOfToday.getTime()) return false
  }
  if (f.city && !(lead.city ?? '').toLowerCase().includes(f.city.toLowerCase())) return false
  if (f.search) {
    const q = f.search.toLowerCase()
    // Audit 2026-05-11: erweitertes Haystack — Notizen + alle URLs + intl. Phone.
    // Server matcht auch in Activities, das kann der Client nicht spiegeln —
    // nach jedem PATCH wird die Liste sowieso server-side gefetched, also
    // konvergiert die Anzeige.
    const haystack = [
      lead.name,
      lead.formatted_address ?? '',
      lead.phone ?? '',
      lead.international_phone ?? '',
      lead.email ?? '',
      lead.notes ?? '',
      lead.website ?? '',
      lead.instagram_url ?? '',
      lead.facebook_url ?? '',
    ].join(' ').toLowerCase()
    const digits = f.search.replace(/\D/g, '')
    const isPhoneLike = digits.length >= 5 && digits.length / f.search.length > 0.5
    if (isPhoneLike) {
      const phoneDigits = ((lead.phone ?? '') + (lead.international_phone ?? '')).replace(/\D/g, '')
      const tail = digits.slice(-7)
      if (phoneDigits.includes(tail)) return true
    }
    if (!haystack.includes(q)) return false
  }
  return true
}

// Heuristic: Is this number likely on WhatsApp?
// WhatsApp is registered to mobile numbers ~99% of the time. Showing the
// button on landlines (089..., 030..., 040...) leads to dead links and
// confused users.
//
// DE mobile prefixes: +49 15X, +49 16X, +49 17X (legacy +49 100X is gone)
// AT mobile: +43 6XX
// CH mobile: +41 7XX (also +41 76, 77, 78, 79)
// Other: best-effort — return true if no leading 0 or country prefix
//        we recognize (let user decide).
function isLikelyMobile(internationalPhone: string | null, nationalPhone: string | null): boolean {
  const digits = (internationalPhone ?? nationalPhone ?? '').replace(/\D/g, '')
  if (!digits) return false

  // German mobile (international format)
  if (/^491[567]\d/.test(digits)) return true
  // German mobile (national format, no country code)
  if (/^01[567]\d/.test(digits)) return true
  // Austrian mobile
  if (/^436\d/.test(digits)) return true
  // Swiss mobile
  if (/^417[6789]\d/.test(digits)) return true
  // US/Canada (NANP) — no easy way to tell mobile from landline; default false
  if (/^1\d{10}$/.test(digits)) return false
  // Anything else: be conservative, hide the button. User can long-press the
  // 📞 button to copy the number and try WhatsApp manually if they want.
  return false
}

const STATUSES: { v: SalesLeadStatus; label: string; color: string }[] = [
  { v: 'new',             label: 'Neu',          color: 'bg-zinc-100 text-zinc-700' },
  { v: 'researching',     label: 'Recherche',    color: 'bg-blue-50 text-blue-700' },
  { v: 'contacted',       label: 'Kontaktiert',  color: 'bg-amber-50 text-amber-700' },
  { v: 'callback',        label: 'Rückruf',      color: 'bg-amber-100 text-amber-800' },
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
  const [overdueCount, setOverdueCount] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // filters — persisted in localStorage so reloads keep the user's selection
  const [filtersHydrated, setFiltersHydrated] = useState(false)
  // Single-select Status-Filter: leeres Set = "Alle anzeigen", sonst genau 1 Status
  const [statusFilter, setStatusFilter] = useState<Set<SalesLeadStatus>>(new Set())
  const [martialOnly, setMartialOnly] = useState(true)
  const [dueOnly, setDueOnly] = useState(false)
  const [city, setCity] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState('priority')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)

  // Hydrate filters from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_LS_KEY)
      if (raw) {
        const f = JSON.parse(raw) as {
          statusFilter?: SalesLeadStatus[]
          martialOnly?: boolean
          dueOnly?: boolean
          city?: string
          sort?: string
          sortDir?: 'asc' | 'desc'
        }
        // Single-select: alte Multi-Select-Werte (>1) ignorieren, dann Alle anzeigen
        if (Array.isArray(f.statusFilter)) {
          setStatusFilter(f.statusFilter.length === 1 ? new Set(f.statusFilter) : new Set())
        }
        if (typeof f.martialOnly === 'boolean') setMartialOnly(f.martialOnly)
        if (typeof f.dueOnly === 'boolean') setDueOnly(f.dueOnly)
        if (typeof f.city === 'string') setCity(f.city)
        if (typeof f.sort === 'string') setSort(f.sort)
        if (f.sortDir === 'asc' || f.sortDir === 'desc') setSortDir(f.sortDir)
      }
    } catch { /* ignore corrupt LS */ }
    setFiltersHydrated(true)
  }, [])

  // Persist whenever filters change (after initial hydration)
  useEffect(() => {
    if (!filtersHydrated) return
    try {
      localStorage.setItem(FILTERS_LS_KEY, JSON.stringify({
        statusFilter: [...statusFilter],
        martialOnly,
        dueOnly,
        city,
        sort,
        sortDir,
      }))
    } catch { /* quota / private mode → ignore */ }
  }, [filtersHydrated, statusFilter, martialOnly, dueOnly, city, sort, sortDir])

  // List vs Pipeline tab. Persisted in LS and synced to URL ?view=...
  // so a deep-link from the daily reminder mail can land directly in
  // the pipeline view.
  const [view, setView] = useState<LeadsView>('list')
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const v = url.searchParams.get('view')
      if (v === 'pipeline' || v === 'list') { setView(v); return }
      const stored = localStorage.getItem(VIEW_LS_KEY)
      if (stored === 'pipeline' || stored === 'list') setView(stored)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(VIEW_LS_KEY, view) } catch { /* ignore */ }
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (view === 'pipeline') url.searchParams.set('view', 'pipeline')
    else url.searchParams.delete('view')
    window.history.replaceState({}, '', url.toString())
  }, [view])

  // panels
  const [selected, setSelected] = useState<SalesLead | null>(null)
  const [activities, setActivities] = useState<SalesActivity[]>([])
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showStats, setShowStats] = useState(false)

  // Deep-links from URL params (used by QR-Code + PWA shortcuts):
  //   ?lead=<id>  → open lead detail panel
  //   ?due=1      → activate "fällige Follow-ups" filter
  //   ?stats=1    → open stats modal
  useEffect(() => {
    if (!token) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('due') === '1') {
      setDueOnly(true)
    }
    if (url.searchParams.get('stats') === '1') {
      setShowStats(true)
      // Strip the param so refresh doesn't re-open
      url.searchParams.delete('stats')
      window.history.replaceState({}, '', url.toString())
    }
    const leadId = url.searchParams.get('lead')
    if (!leadId) return
    fetch(`/api/admin/leads?search=${leadId}&pageSize=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { leads: [] })
      .then(d => {
        const found = (d.leads ?? []).find((l: SalesLead) => l.id === leadId)
        if (found) setSelected(found)
      })
      .catch(() => {})
  }, [token])

  // Sync selected lead into URL so refreshing keeps the panel open
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (selected) url.searchParams.set('lead', selected.id)
    else url.searchParams.delete('lead')
    window.history.replaceState({}, '', url.toString())
  }, [selected])

  // search modal
  const [searchQuery, setSearchQuery] = useState('BJJ München')
  const [searchPages, setSearchPages] = useState(3)
  const [searchRunning, setSearchRunning] = useState(false)
  const [searchForce, setSearchForce] = useState(false)
  const [searchResult, setSearchResult] = useState<{
    cached?: boolean
    message?: string
    inserted: number
    updated: number
    alreadyInDb?: number
    totalFound?: number
    pagesCalled?: number
    costUsd?: number
    lastRunAt?: string
    lastResultCount?: number
    existingMatchCount?: number
    cacheTtlDays?: number
    errors: string[]
  } | null>(null)

  // quota
  type Quota = {
    todayPagesCalled: number; todaySearches: number; todayInserted: number; todayCostUsd: number
    monthPagesCalled: number; monthSearches: number; monthInserted: number; monthCostUsd: number
    dailyLimit: number; remainingToday: number; pctUsed: number
    freeCallsPerMonth: number; freeRemaining: number; freePctUsed: number; costPerCallUsd: number
  }
  const [quota, setQuota] = useState<Quota | null>(null)

  const loadQuota = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/api/admin/leads/places-quota', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setQuota(await res.json())
    } catch { /* ignore */ }
  }, [token])

  useEffect(() => { loadQuota() }, [loadQuota])

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

  // load leads — wait until filters are hydrated from localStorage
  const loadLeads = useCallback(async () => {
    if (!token || !filtersHydrated) return
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter.size > 0) params.set('status', [...statusFilter].join(','))
    if (martialOnly) params.set('martial', 'true')
    if (dueOnly) params.set('due', 'true')
    if (city.trim()) params.set('city', city.trim())
    if (debouncedSearch) params.set('search', debouncedSearch)
    params.set('sort', dueOnly ? 'next_followup' : sort)
    if (!dueOnly) params.set('dir', sortDir)
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
    setOverdueCount(data.overdueCount ?? 0)
    setTodayCount(data.todayCount ?? 0)
    setLoading(false)
  }, [token, filtersHydrated, statusFilter, martialOnly, dueOnly, city, debouncedSearch, sort, sortDir, page])

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
      const { lead } = await res.json() as { lead: SalesLead }

      // If updated lead no longer matches active filters, drop from list
      // (otherwise user has to manually refresh after every status change).
      const stillMatches = leadMatchesFilters(lead, {
        statusFilter, martialOnly, dueOnly, city: city.trim(), search: debouncedSearch,
      })

      if (stillMatches) {
        // Nach Update lokal neu sortieren, damit Lead automatisch in
        // die richtige Reihenfolge rutscht (z.B. nach Prio-Änderung)
        setLeads(prev => {
          const updated = prev.map(l => l.id === id ? lead : l)
          return sortLeadsLocal(updated, sort, sortDir)
        })
      } else {
        setLeads(prev => prev.filter(l => l.id !== id))
        setTotal(t => Math.max(0, t - 1))
      }

      // Update status counts in the sidebar
      if (typeof patch.status === 'string') {
        const oldStatus = leads.find(l => l.id === id)?.status
        if (oldStatus && oldStatus !== patch.status) {
          setStatusCounts(prev => ({
            ...prev,
            [oldStatus]: Math.max(0, (prev[oldStatus] ?? 0) - 1),
            [patch.status as string]: (prev[patch.status as string] ?? 0) + 1,
          }))
        }
      }

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
        body: JSON.stringify({ query: searchQuery.trim(), maxPages: searchPages, force: searchForce }),
      })
      const data = await res.json()
      if (res.ok) {
        setSearchResult({
          cached: data.cached,
          message: data.message,
          inserted: data.inserted ?? 0,
          updated: data.updated ?? 0,
          alreadyInDb: data.alreadyInDb,
          totalFound: data.totalFound,
          pagesCalled: data.pagesCalled,
          costUsd: data.costUsd,
          lastRunAt: data.lastRunAt,
          lastResultCount: data.lastResultCount,
          existingMatchCount: data.existingMatchCount,
          cacheTtlDays: data.cacheTtlDays,
          errors: data.errors ?? [],
        })
        if (data.quota) setQuota(data.quota)
        if (!data.cached) loadLeads()
      } else if (res.status === 429 && data.quota) {
        // Quota exceeded — show clear message + update banner
        setQuota(data.quota)
        setSearchResult({ inserted: 0, updated: 0, errors: [data.message ?? data.error ?? 'Tageslimit erreicht'] })
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

  // Sort-Handler für klickbare Tabellen-Header.
  // Klick auf bereits aktive Spalte → Richtung toggeln.
  // Klick auf neue Spalte → Spalte wechseln, sinnvolle Default-Richtung setzen.
  function handleSort(col: string, defaultDesc: boolean) {
    if (sort === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(col)
      setSortDir(defaultDesc ? 'desc' : 'asc')
    }
    setPage(0)
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 flex items-center gap-2 sm:gap-3">
              {/* Back to gym dashboard — CRM is its own PWA, so we need an explicit way out. */}
              <Link href="/dashboard"
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 rounded-xl text-zinc-700 text-xs sm:text-sm font-medium transition-colors"
                aria-label="Zurück zum Dashboard"
                title="Zurück zum Studio-Dashboard">
                <LayoutDashboard size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold text-zinc-900">Sales-CRM</h1>
                <p className="text-xs sm:text-sm text-zinc-500 truncate">
                  {total} Leads · {statusCounts.contacted ?? 0} kontakt. · {statusCounts.qualified ?? 0} qualifiz. · {statusCounts.won ?? 0} gewonnen
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mobile filter toggle */}
              <button onClick={() => setShowMobileFilters(true)}
                className="lg:hidden p-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-zinc-700"
                aria-label="Filter öffnen">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="10" y2="18" /></svg>
              </button>
              <button onClick={() => setShowStats(true)}
                className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-zinc-700"
                aria-label="Sales-Statistik">
                📊
              </button>
              <a href="/admin/analytics"
                className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-zinc-700"
                aria-label="Web-Analytics" title="Web-Analytics (DSGVO-anonym)">
                📈
              </a>
              {quota && <div className="hidden sm:block"><QuotaBadge quota={quota} /></div>}
              <button onClick={() => setShowSearchModal(true)}
                disabled={!!quota && quota.remainingToday === 0}
                className="px-3 sm:px-4 py-2 bg-amber-400 hover:bg-amber-500 text-zinc-900 text-sm font-semibold rounded-xl disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed flex items-center gap-1">
                <span>+</span>
                <span className="hidden sm:inline">Google Places suchen</span>
                <span className="sm:hidden">Suchen</span>
              </button>
            </div>
          </div>
          {/* Mobile-only quota badge below header */}
          {quota && <div className="sm:hidden mt-2"><QuotaBadge quota={quota} /></div>}

          {/* Audit 2026-05-11: Filter-Row mit Globaler Suche + Stadt + Sort +
              Toggle-Pills. Alles auf 1 Desktop-Zeile, Mobile wrappt automatisch.
              Suche dominiert (flex-1), Filter daneben kompakt. User-Wunsch:
              "horizontal auf ebene der suchleiste" — sonst Klick-Tiefe zu hoch.
              Status-Filter bleibt in Aside (informativ mit Counts). */}
          <div className="mt-3 flex flex-wrap items-stretch gap-2">
            {/* Search — Flex-1, schrumpft ab md:240px, mit Icon + Clear */}
            <div className="relative flex-1 min-w-[240px]">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                id="admin-leads-global-search"
                type="search"
                inputMode="search"
                placeholder="Suche: Name, Tel, Email, Notiz, Anruf-Inhalt …"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                className="w-full pl-10 pr-10 py-2.5 text-sm border border-zinc-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 rounded-xl bg-white shadow-sm transition-all"
                autoComplete="off"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setPage(0) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100"
                  aria-label="Suche leeren"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></svg>
                </button>
              )}
            </div>

            {/* Stadt — fester Breitenanteil */}
            <input
              type="text"
              placeholder="Stadt …"
              value={city}
              onChange={e => { setCity(e.target.value); setPage(0) }}
              className="w-32 sm:w-40 px-3 py-2.5 text-sm border border-zinc-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 rounded-xl bg-white shadow-sm"
              aria-label="Stadt"
            />

            {/* Sort — knapp, fester Breitenanteil */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="w-36 sm:w-44 px-3 py-2.5 text-sm border border-zinc-300 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 rounded-xl bg-white shadow-sm"
              aria-label="Sortierung"
            >
              <option value="priority">Priorität</option>
              <option value="next_followup">Nächster Follow-up</option>
              <option value="updated">Zuletzt geändert</option>
              <option value="created">Neueste zuerst</option>
              <option value="name">Name A-Z</option>
            </select>

            {/* Toggle-Pills: Fällig + Kampfsport — kompakt statt Checkbox-Zeilen.
                Aktiv = amber-Hintergrund, inaktiv = neutral. Mit Count-Badge bei fällig. */}
            <button
              type="button"
              onClick={() => { setDueOnly(!dueOnly); setPage(0) }}
              className={`px-3 py-2.5 text-xs font-semibold rounded-xl border shadow-sm transition-colors inline-flex items-center gap-1.5 ${
                dueOnly
                  ? 'bg-amber-400 border-amber-500 text-zinc-900'
                  : 'bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50'
              }`}
              aria-pressed={dueOnly}
              title="Nur fällige Follow-ups"
            >
              ⏰ <span>Fällig</span>
              {(overdueCount + todayCount) > 0 && (
                <span className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${
                  dueOnly ? 'bg-zinc-900 text-amber-400' : (overdueCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')
                }`}>
                  {overdueCount + todayCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setMartialOnly(!martialOnly); setPage(0) }}
              className={`px-3 py-2.5 text-xs font-semibold rounded-xl border shadow-sm transition-colors inline-flex items-center gap-1.5 ${
                martialOnly
                  ? 'bg-amber-400 border-amber-500 text-zinc-900'
                  : 'bg-white border-zinc-300 text-zinc-600 hover:bg-zinc-50'
              }`}
              aria-pressed={martialOnly}
              title="Nur Kampfsport-Studios"
            >
              🥋 <span>Kampfsport</span>
            </button>
          </div>

          {/* View tabs: Liste / Pipeline.
              Pipeline = "wer ist heute dran"; Liste = klassische CRM-Tabelle. */}
          <div className="mt-3 flex gap-1 bg-zinc-100 rounded-xl p-1 w-full sm:w-fit">
            <button
              onClick={() => setView('list')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-sm rounded-lg font-semibold transition ${
                view === 'list' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
              aria-pressed={view === 'list'}>
              📋 Liste
            </button>
            <button
              onClick={() => setView('pipeline')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-sm rounded-lg font-semibold transition ${
                view === 'pipeline' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
              aria-pressed={view === 'pipeline'}>
              🎯 Pipeline
            </button>
          </div>
        </div>
      </header>

      {/* Pipeline view — kanban + tagesbericht */}
      {view === 'pipeline' && token && (
        <PipelineView
          token={token}
          martialOnly={martialOnly}
          city={city.trim()}
          onSelect={l => setSelected(l)}
          onChanged={() => loadLeads()}
        />
      )}

      {/* Follow-up alert banner — only shown in list view */}
      {view === 'list' && (overdueCount > 0 || todayCount > 0) && !dueOnly && (
        <div className="max-w-[1600px] mx-auto px-6 pt-4">
          <button onClick={() => { setDueOnly(true); setPage(0) }}
            className={`w-full text-left rounded-xl border p-4 transition hover:scale-[1.005] ${
              overdueCount > 0
                ? 'bg-rose-50 border-rose-200 hover:bg-rose-100'
                : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
            }`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-sm font-bold ${overdueCount > 0 ? 'text-rose-900' : 'text-amber-900'}`}>
                  {overdueCount > 0 && <>🔴 <strong>{overdueCount}</strong> überfällig{overdueCount === 1 ? '' : 'e'} Follow-up{overdueCount === 1 ? '' : 's'}</>}
                  {overdueCount > 0 && todayCount > 0 && ' · '}
                  {todayCount > 0 && <>📞 <strong>{todayCount}</strong> heute fällig</>}
                </div>
                <div className="text-xs text-zinc-600 mt-0.5">Klick → nur fällige anzeigen. Erinnerungs-E-Mails laufen stündlich.</div>
              </div>
              <span className="text-xl">→</span>
            </div>
          </button>
        </div>
      )}

      {view === 'list' && (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:grid lg:grid-cols-12 lg:gap-6">
        {/* Filter sidebar — drawer on mobile, sticky on desktop */}
        {showMobileFilters && (
          <div className="lg:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setShowMobileFilters(false)} />
        )}
        <aside className={`
          ${showMobileFilters ? 'fixed inset-y-0 left-0 z-40 w-[85%] max-w-sm overflow-y-auto bg-zinc-50 p-4' : 'hidden'}
          lg:block lg:relative lg:inset-auto lg:w-auto lg:max-w-none lg:bg-transparent lg:p-0
          lg:col-span-3 lg:space-y-4
        `}>
          {/* Mobile drawer close + applied filters summary */}
          <div className="lg:hidden flex items-center justify-between mb-3 sticky top-0 bg-zinc-50 -mx-4 px-4 py-2 border-b border-zinc-200 z-10">
            <h2 className="font-bold text-zinc-900">Filter</h2>
            <button onClick={() => setShowMobileFilters(false)}
              aria-label="Filter schließen"
              className="text-zinc-500 hover:text-zinc-900 text-2xl leading-none p-2">×</button>
          </div>
          <div className="space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Status</h3>
              <button
                onClick={() => {
                  setStatusFilter(new Set())
                  setMartialOnly(true)
                  setDueOnly(false)
                  setCity('')
                  setSearch('')
                  setSort('priority')
                  setPage(0)
                  try { localStorage.removeItem(FILTERS_LS_KEY) } catch {}
                }}
                className="text-[10px] text-zinc-400 hover:text-zinc-700 uppercase tracking-wide"
                title="Filter zurücksetzen"
              >
                Reset
              </button>
            </div>

            {/* Single-select Status-Filter — Klick wechselt exklusiv, nochmal klicken zeigt wieder Alle */}
            <div className="space-y-1">
              {/* "Alle" pseudo-Eintrag — aktiv wenn kein Status gewählt */}
              <button
                type="button"
                onClick={() => { setStatusFilter(new Set()); setPage(0) }}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded transition-colors ${
                  statusFilter.size === 0 ? 'bg-amber-50 ring-1 ring-amber-300' : 'hover:bg-zinc-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full border ${
                    statusFilter.size === 0 ? 'bg-amber-500 border-amber-500' : 'border-zinc-300'
                  }`} />
                  <span className="text-xs font-medium text-zinc-700">Alle anzeigen</span>
                </span>
                <span className="text-xs text-zinc-400 tabular-nums">
                  {Object.values(statusCounts).reduce((a, b) => a + (b ?? 0), 0)}
                </span>
              </button>

              {STATUSES.map(s => {
                const checked = statusFilter.has(s.v)
                const count = statusCounts[s.v] ?? 0
                return (
                  <button
                    key={s.v}
                    type="button"
                    onClick={() => {
                      // Klick auf bereits aktiven Status → wieder Alle
                      // Klick auf anderen Status → exklusiv nur diesen
                      if (statusFilter.size === 1 && statusFilter.has(s.v)) {
                        setStatusFilter(new Set())
                      } else {
                        setStatusFilter(new Set([s.v]))
                      }
                      setPage(0)
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded transition-colors ${
                      checked ? 'bg-amber-50 ring-1 ring-amber-300' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 ${
                        checked ? 'bg-amber-500 border-amber-500' : 'border-zinc-300'
                      }`} />
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>{s.label}</span>
                    </span>
                    <span className="text-xs text-zinc-400 tabular-nums">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Audit 2026-05-11: Stadt-Input, Sort-Select und die Toggle-Checkboxen
              (Fällig, Kampfsport) sind in die horizontale Filter-Row oben gezogen
              worden. Hier in der Aside bleiben nur Status-Liste + Tages-Stats. */}

          {/* Mobile-only "Anwenden" close button */}
          <button onClick={() => setShowMobileFilters(false)}
            className="lg:hidden w-full px-4 py-3 bg-zinc-900 text-white font-semibold rounded-xl">
            Anwenden
          </button>
          </div>
        </aside>

        {/* Lead list */}
        <main className="col-span-12 lg:col-span-9 mt-4 lg:mt-0">
          {loading ? (
            <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-zinc-500">Lade…</div>
          ) : leads.length === 0 ? (
            <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center text-zinc-500">
              Keine Leads. Klick „Google Places suchen“ um welche zu importieren.
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="lg:hidden space-y-2">
                {leads.map(l => {
                  const status = STATUSES.find(s => s.v === l.status)
                  return (
                    <button key={l.id} onClick={() => setSelected(l)}
                      className={`w-full text-left bg-white border border-zinc-200 rounded-xl p-3 active:bg-amber-50 transition ${
                        selected?.id === l.id ? 'border-amber-300 bg-amber-50/50' : ''
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-zinc-900 truncate">{l.name}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {status && <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>}
                            {l.is_martial_arts && <span className="text-[10px] text-amber-700">🥋</span>}
                            <span className="text-xs text-zinc-500">{l.city ?? '—'}</span>
                          </div>
                          {l.phone && (
                            <div className="text-xs text-zinc-600 mt-1.5">📞 {l.phone}</div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-amber-500 text-sm">{'★'.repeat(l.priority)}</span>
                          {l.rating && <span className="text-[10px] text-zinc-500">{l.rating}★</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden lg:block bg-white rounded-xl border border-zinc-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                      <SortableTh col="name"     label="Studio"  sort={sort} sortDir={sortDir} onSort={handleSort} defaultDesc={false} />
                      <SortableTh col="city"     label="Stadt"   sort={sort} sortDir={sortDir} onSort={handleSort} defaultDesc={false} />
                      <th className="px-4 py-3">Kontakt</th>
                      <SortableTh col="status"   label="Status"  sort={sort} sortDir={sortDir} onSort={handleSort} defaultDesc={false} />
                      <SortableTh col="priority" label="Prio"    sort={sort} sortDir={sortDir} onSort={handleSort} defaultDesc={true} />
                      <SortableTh col="rating"   label="Rating"  sort={sort} sortDir={sortDir} onSort={handleSort} defaultDesc={true} />
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
              </div>

              {/* Pagination */}
              {total > 50 && (
                <div className="flex items-center justify-between px-4 py-3 mt-3 lg:mt-0 lg:border-t lg:border-zinc-200 text-sm text-zinc-600 bg-white rounded-xl lg:rounded-none lg:rounded-b-xl border lg:border-t-0 border-zinc-200">
                  <span>Seite {page + 1} / {Math.ceil(total / 50)}</span>
                  <div className="flex gap-2">
                    <button disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}
                      className="px-4 py-2 rounded-lg border border-zinc-200 disabled:opacity-50">‹ Zurück</button>
                    <button disabled={page + 1 >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}
                      className="px-4 py-2 rounded-lg border border-zinc-200 disabled:opacity-50">Weiter ›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      )}

      {/* Detail panel */}
      {selected && (
        <LeadDetailPanel
          lead={selected}
          activities={activities}
          onClose={() => setSelected(null)}
          onUpdate={patch => updateLead(selected.id, patch)}
          onActivity={payload => logActivity(selected.id, payload)}
          setActivities={setActivities}
          token={token}
        />
      )}

      {/* Places search modal */}
      {/* Stats modal */}
      {showStats && token && <StatsModal token={token} onClose={() => setShowStats(false)} />}

      {showSearchModal && (
        // TODO(a11y): Add focus trap (e.g. focus-trap-react / @headlessui/react Dialog) for full WCAG 2.1.2.
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="places-search-title">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 id="places-search-title" className="text-lg font-bold mb-2">Google Places durchsuchen</h3>
            <p className="text-sm text-zinc-500 mb-4">
              Importiert Studios in dein CRM. Bestehende Leads werden nie überschrieben (Status/Notes/Priorität bleiben).
              <br />
              <span className="text-xs">Cache: 7 Tage — selbe Query wird bis dahin nicht erneut Google API kosten.</span>
            </p>
            <label htmlFor="places-search-query" className="sr-only">Suchanfrage</label>
            <input id="places-search-query" type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setSearchResult(null) }}
              placeholder="z.B. BJJ München"
              className="w-full px-3 py-3 text-base border border-zinc-200 rounded-lg mb-3" />
            <div className="flex items-center gap-4 mb-2 text-sm text-zinc-600">
              <label className="flex items-center gap-2">
                Seiten:
                <input type="number" min={1} max={5} value={searchPages}
                  onChange={e => setSearchPages(parseInt(e.target.value, 10) || 1)}
                  className="w-14 px-2 py-1 border border-zinc-200 rounded" />
                <span className="text-xs text-zinc-400">×20 Studios</span>
              </label>
              <label className="flex items-center gap-2 ml-auto">
                <input type="checkbox" checked={searchForce} onChange={e => setSearchForce(e.target.checked)} />
                <span>Cache umgehen</span>
              </label>
            </div>
            {quota && (
              <div className="mb-4 px-3 py-2 bg-zinc-50 rounded-lg text-xs text-zinc-600 space-y-1">
                <div className="flex items-center justify-between">
                  <span>
                    Heute: <strong className="font-mono">{quota.todayPagesCalled} / {quota.dailyLimit}</strong>
                  </span>
                  <span>
                    Diese Suche: max <strong>{searchPages}</strong> Call{searchPages > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>
                    Frei diesen Monat: <strong className="font-mono text-emerald-700">{fmtNumber(quota.freeRemaining)}</strong> / {fmtNumber(quota.freeCallsPerMonth)}
                  </span>
                  <span className={quota.monthCostUsd === 0 ? 'text-emerald-700 font-semibold' : ''}>
                    {quota.monthCostUsd === 0 ? '✓ GRATIS (Free-Tier)' : `~$${quota.monthCostUsd.toFixed(2)} diesen Monat`}
                  </span>
                </div>
              </div>
            )}
            {quota && quota.todayPagesCalled + searchPages > quota.dailyLimit && !searchForce && (
              <div className="text-xs bg-rose-50 text-rose-800 px-3 py-2 rounded-lg mb-3">
                ⚠ Tageslimit würde überschritten. Reduziere Pages auf max <strong>{quota.remainingToday}</strong>.
              </div>
            )}
            {searchResult?.cached && (
              <div className="text-sm bg-blue-50 text-blue-900 px-3 py-2 rounded-lg mb-3">
                <div className="font-semibold">⚡ Aus Cache geantwortet — keine API-Kosten</div>
                <div className="text-xs mt-1">
                  Letzte Ausführung: {searchResult.lastRunAt && fmtDateTime(searchResult.lastRunAt)}
                  {searchResult.lastResultCount != null && ` · ${searchResult.lastResultCount} Studios beim letzten Mal`}
                </div>
                <div className="text-xs mt-1">{searchResult.existingMatchCount ?? 0} ähnliche Leads bereits in DB.</div>
                <div className="text-xs mt-2 text-blue-700">
                  Aktiviere „Cache umgehen" wenn du wirklich Google API erneut anfragen willst.
                </div>
              </div>
            )}
            {searchResult && !searchResult.cached && (searchResult.inserted > 0 || searchResult.updated > 0 || (searchResult.totalFound ?? 0) > 0) && (
              <div className="text-sm bg-emerald-50 text-emerald-800 px-3 py-2 rounded-lg mb-3">
                ✓ {searchResult.inserted} neu, {searchResult.updated} aktualisiert
                {(searchResult.alreadyInDb ?? 0) > 0 && ` · ${searchResult.alreadyInDb} schon im CRM`}
                {(searchResult.totalFound ?? 0) > 0 && ` · ${searchResult.totalFound} gefunden`}
                {(searchResult.pagesCalled ?? 0) > 0 && (
                  <div className="text-xs mt-1 opacity-80">
                    {searchResult.pagesCalled} Google-Calls verbraucht (~${searchResult.costUsd?.toFixed(3)})
                    {(searchResult.alreadyInDb ?? 0) > 0 && (searchResult.totalFound ?? 0) > 0 &&
                      ` · ${Math.round(((searchResult.alreadyInDb ?? 0) / (searchResult.totalFound ?? 1)) * 100)}% waren Duplikate`}
                  </div>
                )}
                {searchResult.errors.length > 0 && (
                  <div className="text-rose-700 text-xs mt-1">{searchResult.errors.length} Fehler: {searchResult.errors[0]}</div>
                )}
              </div>
            )}
            {searchResult && searchResult.errors.length > 0 && !searchResult.cached && searchResult.inserted === 0 && searchResult.updated === 0 && (
              <div className="text-sm bg-rose-50 text-rose-800 px-3 py-2 rounded-lg mb-3">
                ⚠ Fehler: {searchResult.errors[0]}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowSearchModal(false); setSearchResult(null); setSearchForce(false) }}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-200">Schließen</button>
              <button onClick={runPlacesSearch} disabled={searchRunning || !searchQuery.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-amber-400 hover:bg-amber-500 text-zinc-900 font-semibold disabled:opacity-50">
                {searchRunning ? 'Lädt…' : searchForce ? 'Mit Google API neu suchen' : 'Suchen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LeadDetailPanel({ lead, activities, onClose, onUpdate, onActivity, setActivities, token }: {
  lead: SalesLead
  activities: SalesActivity[]
  onClose: () => void
  onUpdate: (patch: Partial<SalesLead>) => void
  onActivity: (payload: Record<string, unknown>) => void
  setActivities: React.Dispatch<React.SetStateAction<SalesActivity[]>>
  token: string | null
}) {
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [activityKind, setActivityKind] = useState<'call' | 'email' | 'note'>('call')
  const [activityOutcome, setActivityOutcome] = useState<string>('')
  const [activityBody, setActivityBody] = useState('')

  // Auto-grow notes textarea — always show full content without scroll
  const notesRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = notesRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [notes])

  // Same auto-grow for the activity body textarea
  const activityRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = activityRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 72)}px`
  }, [activityBody])

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

  const [showQR, setShowQR] = useState(false)
  const [showColdMail, setShowColdMail] = useState(false)

  return (
    // TODO(a11y): Add focus trap (e.g. focus-trap-react / @headlessui/react Dialog) for full WCAG 2.1.2.
    <div className="fixed inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-full sm:max-w-xl bg-white shadow-2xl sm:border-l border-zinc-200 z-40 overflow-y-auto overscroll-contain" role="dialog" aria-modal="true" aria-labelledby="lead-detail-title">
      <div className="sticky top-0 bg-white border-b border-zinc-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <button onClick={onClose}
          className="sm:hidden p-2 -ml-2 text-zinc-700 hover:text-zinc-900"
          aria-label="Zurück">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 id="lead-detail-title" className="text-base sm:text-lg font-bold text-zinc-900 truncate">{lead.name}</h2>
          {lead.formatted_address && <p className="text-xs sm:text-sm text-zinc-500 truncate">{lead.formatted_address}</p>}
        </div>
        <div className="flex items-center gap-2 ml-2">
          <button onClick={() => setShowQR(true)}
            title="QR-Code zum Öffnen auf iPhone"
            aria-label="QR-Code zum Öffnen auf iPhone"
            className="flex items-center gap-1 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold">
            📱 <span className="hidden sm:inline">iPhone</span>
          </button>
          <button onClick={onClose}
            aria-label="Schließen"
            className="hidden sm:block text-zinc-400 hover:text-zinc-700 text-2xl leading-none">×</button>
        </div>
      </div>

      {showQR && <QRModal lead={lead} onClose={() => setShowQR(false)} />}

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 pb-20 sm:pb-6"
        style={{ paddingBottom: 'max(5rem, calc(5rem + env(safe-area-inset-bottom)))' }}>
        {/* Quick actions — bigger touch targets on mobile */}
        <div className="grid grid-cols-2 gap-2">
          {lead.phone && (
            <PhoneButton
              displayPhone={lead.phone}
              dialPhone={lead.international_phone ?? lead.phone}
            />
          )}
          {lead.phone && lead.international_phone && isLikelyMobile(lead.international_phone, lead.phone) && (
            <a href={`https://wa.me/${lead.international_phone.replace(/\D/g, '')}`}
              target="_blank" rel="noopener"
              className="flex items-center justify-center gap-2 px-4 py-4 bg-green-50 hover:bg-green-100 active:bg-green-200 text-green-800 font-semibold rounded-xl text-sm min-h-[52px]">
              💬 WhatsApp
            </a>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noopener"
              className="flex items-center justify-center gap-2 px-4 py-4 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 text-blue-800 font-semibold rounded-xl text-sm truncate min-h-[52px]">
              🌐 Website
            </a>
          )}
          {lead.google_maps_url && (
            <a href={lead.google_maps_url} target="_blank" rel="noopener"
              className="flex items-center justify-center gap-2 px-4 py-4 bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-800 font-semibold rounded-xl text-sm min-h-[52px]">
              📍 Maps
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`}
              className="flex items-center justify-center gap-2 px-4 py-4 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-800 font-semibold rounded-xl text-sm truncate min-h-[52px]">
              ✉ <span className="truncate">{lead.email}</span>
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

        {/* Notes — auto-grows with content, no scroll needed */}
        <label className="block">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Notizen</span>
          <textarea ref={notesRef}
            value={notes} onChange={e => setNotes(e.target.value)} onBlur={handleNotesBlur}
            placeholder="Was hast du erfahren? Wer ist Ansprechpartner? …"
            style={{ minHeight: '96px' }}
            className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg text-base sm:text-sm resize-none overflow-hidden" />
        </label>

        {/* Cold-Call Script */}
        <CallScript lead={{
          name: lead.name,
          city: lead.city,
          is_martial_arts: lead.is_martial_arts,
          sports: lead.sports,
          rating: lead.rating,
          user_ratings_total: lead.user_ratings_total,
          contact_count: lead.contact_count,
          notes: lead.notes,
        }} />

        {/* Cold-Outreach-Mail (semi-automatisch). Nur wenn Lead E-Mail hat
            UND noch nicht im "geschlossen"-Bucket ist (won/lost etc.). */}
        {lead.email && !['won', 'lost', 'do_not_contact', 'not_a_fit'].includes(lead.status) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">📧 Mail-Vorlage öffnen</h3>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Compose-Hilfe mit Template + Variable-Replace. Öffnet deinen Mail-Client (kein Auto-Versand durch Osss).
                </p>
              </div>
              <button onClick={() => setShowColdMail(true)}
                className="shrink-0 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg">
                Vorlage öffnen
              </button>
            </div>
          </div>
        )}

        {showColdMail && (
          <ColdMailComposeModal
            lead={lead}
            onClose={() => setShowColdMail(false)}
            onSent={(activity) => {
              setActivities(prev => [activity, ...prev])
              onUpdate({
                status: 'contacted' as SalesLeadStatus,
                last_contacted_at: new Date().toISOString(),
                contact_count: (lead.contact_count ?? 0) + 1,
              })
              setShowColdMail(false)
            }}
            token={token}
          />
        )}

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
              className="w-full px-3 py-2 text-base sm:text-sm border border-zinc-200 rounded-lg bg-white">
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
          <textarea ref={activityRef}
            value={activityBody} onChange={e => setActivityBody(e.target.value)}
            placeholder={activityKind === 'call' ? 'Was wurde besprochen?' : activityKind === 'email' ? 'Worum ging\'s?' : 'Notiz …'}
            style={{ minHeight: '72px' }}
            className="w-full px-3 py-2 text-base sm:text-sm border border-zinc-200 rounded-lg bg-white resize-none overflow-hidden" />
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
                <ActivityItem
                  key={a.id}
                  activity={a}
                  leadId={lead.id}
                  token={token}
                  onUpdated={updated => setActivities(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  onDeleted={() => setActivities(prev => prev.filter(x => x.id !== a.id))}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function QRModal({ lead, onClose }: { lead: SalesLead; onClose: () => void }) {
  type Mode = 'call' | 'crm'
  const [mode, setMode] = useState<Mode>(lead.phone ? 'call' : 'crm')
  const dialPhone = lead.international_phone ?? lead.phone ?? ''
  const telUrl = `tel:${dialPhone.replace(/\s/g, '')}`
  const crmUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/admin/leads?lead=${lead.id}`
    : `https://www.osss.pro/admin/leads?lead=${lead.id}`
  const value = mode === 'call' ? telUrl : crmUrl

  return (
    // TODO(a11y): Add focus trap (e.g. focus-trap-react / @headlessui/react Dialog) for full WCAG 2.1.2.
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="qr-modal-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
        <h3 id="qr-modal-title" className="text-lg font-bold text-zinc-900 mb-2 text-center">{lead.name}</h3>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-zinc-100 rounded-xl p-1">
          <button
            disabled={!lead.phone}
            onClick={() => setMode('call')}
            className={`flex-1 px-3 py-2 text-sm rounded-lg font-semibold transition ${
              mode === 'call' ? 'bg-emerald-400 text-zinc-900' : 'text-zinc-600 hover:bg-white disabled:opacity-40'
            }`}>
            📞 Direkt anrufen
          </button>
          <button
            onClick={() => setMode('crm')}
            className={`flex-1 px-3 py-2 text-sm rounded-lg font-semibold transition ${
              mode === 'crm' ? 'bg-amber-400 text-zinc-900' : 'text-zinc-600 hover:bg-white'
            }`}>
            📋 CRM öffnen
          </button>
        </div>

        <p className="text-sm text-zinc-500 mb-4 text-center">
          {mode === 'call'
            ? 'iPhone-Kamera über QR halten → Bestätigung „Anrufen?" → fertig.'
            : 'Lead öffnet sich auf iPhone — Notizen + CRM-Aktionen.'}
        </p>

        <div className="flex justify-center mb-4">
          <div className="bg-white p-3 border border-zinc-200 rounded-xl">
            <QRCodeSVG value={value} size={220} level="M" />
          </div>
        </div>

        <p className="text-xs text-zinc-400 break-all text-center mb-4">
          {mode === 'call' ? `📞 ${lead.phone}` : crmUrl}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(value)
              onClose()
            }}
            className="flex-1 px-4 py-2 text-sm rounded-lg border border-zinc-200 hover:bg-zinc-50">
            {mode === 'call' ? 'Nummer kopieren' : 'Link kopieren'}
          </button>
          <button onClick={onClose}
            className="flex-1 px-4 py-2 text-sm rounded-lg bg-zinc-900 text-white hover:bg-zinc-800">
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Cold-Outreach-Mail Compose-Modal.
 *
 * Workflow:
 *   1. Variant-Picker (small/medium/large) — wählt Template + Subject-Optionen
 *   2. Auto-fill aus Lead-Daten (studio, stadt, sportart)
 *   3. Pflicht-Personalisierungs-Felder (UWG-§7-Compliance)
 *   4. Live-Preview (rendered subject + body)
 *   5. Send via /api/admin/sales/leads/[id]/send-mail
 *
 * Bei Erfolg:
 *   - Activity-Item lokal in den Timeline-State pushen (sofort sichtbar)
 *   - Lead-Status auf 'contacted' updaten (sofort sichtbar)
 *   - Modal schließen
 */
function ColdMailComposeModal({
  lead,
  onClose,
  onSent,
  token,
}: {
  lead: SalesLead
  onClose: () => void
  onSent: (activity: SalesActivity) => void
  token: string | null
}) {
  // Default-Variant aus Lead-Größe ableiten — falls user_ratings_total
  // > 100 → mittel, > 300 → groß. Sonst klein.
  const defaultVariant: ColdOutreachVariant =
    (lead.user_ratings_total ?? 0) > 300 ? 'large'
    : (lead.user_ratings_total ?? 0) > 100 ? 'medium'
    : 'small'
  const [variant, setVariant] = useState<ColdOutreachVariant>(defaultVariant)
  const [subjectIndex, setSubjectIndex] = useState(0)

  const auto = extractVars(lead)
  const [vars, setVars] = useState<TemplateVars>({
    studio: auto.studio,
    stadt: auto.stadt,
    sportart: auto.sportart,
    vorname: '',
    nachname: '',
    hook_observation: '',
    hook_pain: '',
    hook_custom: '',
  })

  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const template = TEMPLATES.find(t => t.variant === variant)!
  const rendered = renderTemplate(template, vars, subjectIndex)
  const validation = validateRendered(rendered, vars)

  /**
   * Mail-Compose: öffnet den nativen Mail-Client des Owners mit prefilled
   * subject + body. Plattform versendet KEINE Cold-Mails mehr — der Owner
   * sendet aus seinem eigenen Mail-Client (Apple Mail, Gmail, Outlook, …).
   *
   * Warum: Cold-Mails von einer Plattform-Domain (osss.pro) tragen UWG-§7-
   * Risiko und gefährden die Domain-Reputation. mailto:-Open verlagert die
   * Sende-Verantwortung dorthin wo sie hingehört: zum Owner persönlich.
   *
   * Nach mailto:-Open wird sofort eine Activity geloggt (kind=email,
   * subject, body) + Lead-Status auf 'contacted' gesetzt. Falls der Owner
   * im Mail-Client doch nicht sendet: er muss die Activity manuell löschen.
   */
  async function handleSend() {
    if (!validation.ok) { setError(validation.reason); return }
    if (!lead.email) { setError('Lead hat keine E-Mail-Adresse'); return }
    setSending(true)
    setError(null)

    // mailto:-URL bauen. Body braucht url-encoded Newlines (%0D%0A).
    const mailto = `mailto:${encodeURIComponent(lead.email)}`
      + `?subject=${encodeURIComponent(rendered.subject)}`
      + `&body=${encodeURIComponent(rendered.body)}`

    // Mail-Client im neuen Tab öffnen (window.location würde die SPA killen
    // bei manchen Browsern, target=_blank ist sicherer).
    if (typeof window !== 'undefined') {
      window.open(mailto, '_blank')
    }

    // Activity loggen via existing /admin/sales/leads/[id]-Endpoint
    // (kind=email, action_type=contacted). Das legt die Activity an UND
    // markiert den Lead als 'contacted'. KEIN Server-Mailversand.
    try {
      if (token) {
        await fetch(`/api/admin/sales/leads/${lead.id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action_type: 'contacted',
            notes: `Mail-Vorlage geöffnet: "${rendered.subject}"`,
          }),
        })
      }
    } catch (err) {
      console.warn('[mail-compose] activity log failed (non-critical):', err)
    }

    // Optimistic activity-item für sofortige Timeline-Anzeige.
    const optimistic: SalesActivity = {
      id: `optimistic-${Date.now()}`,
      lead_id: lead.id,
      user_id: null,
      kind: 'email',
      outcome: null,
      subject: rendered.subject,
      body: rendered.body,
      media_urls: null,
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as unknown as SalesActivity
    onSent(optimistic)
  }

  function patchVar<K extends keyof TemplateVars>(key: K, value: TemplateVars[K]) {
    setVars(prev => ({ ...prev, [key]: value }))
  }

  return (
    // TODO(a11y): Add focus trap (e.g. focus-trap-react / @headlessui/react Dialog) for full WCAG 2.1.2.
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="cold-mail-title">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-5 py-4 flex items-center justify-between">
          <h2 id="cold-mail-title" className="text-lg font-bold text-zinc-900">📧 Mail-Vorlage für {lead.name}</h2>
          <button onClick={onClose} aria-label="Schließen"
            className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Empfänger-Info */}
          <div className="bg-zinc-50 rounded-lg p-3 text-sm">
            <p><strong className="text-zinc-700">An:</strong> {lead.email}</p>
            <p className="text-zinc-500 text-xs mt-1">
              Auto-Detected: Studio „{auto.studio}", Stadt „{auto.stadt}", Sportart „{auto.sportart}"
            </p>
          </div>

          {/* Variant-Picker */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide block mb-2">
              Template (basierend auf Studio-Größe)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.variant}
                  onClick={() => { setVariant(t.variant); setSubjectIndex(0) }}
                  className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                    variant === t.variant
                      ? 'bg-amber-400 border-amber-400 text-zinc-900 font-semibold'
                      : 'bg-white border-zinc-200 hover:border-zinc-400'
                  }`}>
                  {t.label.replace(/^[^(]*/, '').replace(/[()]/g, '').trim() || t.variant}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-1.5">{template.whenToUse}</p>
          </div>

          {/* Subject-Picker */}
          <div>
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide block mb-2">
              Betreff (A/B-Variante wählen)
            </label>
            <div className="space-y-1.5">
              {template.subjects.map((s, i) => (
                <label key={i} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="radio" name="subject" checked={subjectIndex === i}
                    onChange={() => setSubjectIndex(i)} className="mt-1" />
                  <span className="text-zinc-700">{s.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars as unknown as Record<string, string>)[k] || `{${k}}`)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Auto-Fill-Felder (editierbar) */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Studio-Name</span>
              <input value={vars.studio} onChange={e => patchVar('studio', e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Stadt</span>
              <input value={vars.stadt} onChange={e => patchVar('stadt', e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Sportart</span>
              <input value={vars.sportart} onChange={e => patchVar('sportart', e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                Vorname {variant === 'small' && <span className="text-rose-600">*</span>}
              </span>
              <input value={vars.vorname} onChange={e => patchVar('vorname', e.target.value)}
                placeholder="z.B. Thorsten"
                className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
            </label>
            {variant !== 'small' && (
              <label className="block col-span-2">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                  Nachname (für formelle Anrede)
                </span>
                <input value={vars.nachname} onChange={e => patchVar('nachname', e.target.value)}
                  placeholder="z.B. Müller"
                  className="mt-1 w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm" />
              </label>
            )}
          </div>

          {/* Pflicht-Personalisierungs-Hooks */}
          <div className="border-t border-zinc-200 pt-5 space-y-3">
            <h3 className="text-sm font-bold text-zinc-900">
              Pflicht-Personalisierung <span className="text-zinc-500 font-normal">(UWG §7)</span>
            </h3>
            {template.hookPrompts.map((prompt, i) => {
              const key = i === 0 ? 'hook_observation' : i === 1 ? 'hook_pain' : 'hook_custom'
              const value = vars[key as keyof TemplateVars] as string
              const isRequired = i < 2
              const tooShort = isRequired && value.trim().length < 10
              return (
                <label key={i} className="block">
                  <span className="text-xs font-medium text-zinc-700 mb-1 block">
                    {prompt} {isRequired && <span className="text-rose-600">*</span>}
                  </span>
                  <textarea value={value}
                    onChange={e => patchVar(key as keyof TemplateVars, e.target.value)}
                    rows={2}
                    placeholder="…"
                    className={`w-full px-3 py-2 text-sm border rounded-lg ${
                      tooShort ? 'border-rose-300 bg-rose-50' : 'border-zinc-200 bg-white'
                    }`} />
                  {tooShort && (
                    <p className="text-xs text-rose-600 mt-1">Mindestens 10 Zeichen für echte Personalisierung.</p>
                  )}
                </label>
              )
            })}
          </div>

          {/* Live-Preview */}
          <div className="border-t border-zinc-200 pt-5">
            <h3 className="text-sm font-bold text-zinc-900 mb-2">Vorschau</h3>
            <div className="bg-zinc-50 rounded-lg p-4 text-sm">
              <p className="font-semibold text-zinc-900 mb-2">
                Betreff: <span className="font-normal">{rendered.subject}</span>
              </p>
              <pre className="whitespace-pre-wrap font-sans text-zinc-700 text-[13px] leading-relaxed">
                {rendered.body}
              </pre>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-zinc-200 sticky bottom-0 bg-white pb-2 -mx-5 px-5">
            <button onClick={onClose} disabled={sending}
              className="flex-1 px-4 py-2.5 border border-zinc-200 text-zinc-700 font-semibold rounded-lg text-sm hover:bg-zinc-50 disabled:opacity-50">
              Abbrechen
            </button>
            <button onClick={handleSend} disabled={sending || !validation.ok}
              title="Öffnet deinen Mail-Client (Apple Mail, Gmail, Outlook, …) mit prefilled Betreff + Body. Der eigentliche Versand passiert aus deinem Mail-Client — Osss versendet keine Cold-Mails."
              className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-400 text-white font-semibold rounded-lg text-sm">
              {sending ? '…' : '📧 Im Mail-Client öffnen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhoneButton({ displayPhone, dialPhone }: { displayPhone: string; dialPhone: string }) {
  const [copied, setCopied] = useState(false)

  function handleClick(e: React.MouseEvent) {
    // Always copy first — works regardless of macOS Continuity setup
    try {
      navigator.clipboard?.writeText(dialPhone).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2200)
      })
    } catch { /* fallback to no copy */ }
    // Don't prevent default — tel: link still tries (works on iPhone, may show
    // Continuity dialog on macOS — user has choice)
    e.stopPropagation()
  }

  return (
    <a href={`tel:${dialPhone}`} onClick={handleClick}
      className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-xl text-sm relative"
      title="Klick: kopiert die Nummer + öffnet Phone-App (auf Mac via iPhone-Continuity)">
      {copied ? <span>✓ Kopiert</span> : <><span>📞</span><span>{displayPhone}</span></>}
    </a>
  )
}

function QuotaBadge({ quota }: { quota: {
  todayPagesCalled: number; todayCostUsd: number; monthPagesCalled: number; monthCostUsd: number;
  dailyLimit: number; remainingToday: number; pctUsed: number;
  freeCallsPerMonth: number; freeRemaining: number; freePctUsed: number;
} }) {
  const danger = quota.pctUsed >= 90 || quota.freePctUsed >= 95
  const warn   = (quota.pctUsed >= 70 || quota.freePctUsed >= 80) && !danger
  const tone = danger
    ? 'bg-rose-50 border-rose-200 text-rose-800'
    : warn
      ? 'bg-amber-50 border-amber-200 text-amber-900'
      : 'bg-emerald-50 border-emerald-200 text-emerald-800'

  // Was heißt es wirklich? Solange wir unter Free-Tier sind: $0 echte Kosten.
  const isFree = quota.monthCostUsd === 0
  const tooltip = [
    `Heute: ${quota.todayPagesCalled} / ${quota.dailyLimit} Calls (Selbstschutz-Limit)`,
    `Diesen Monat: ${quota.monthPagesCalled} / ${quota.freeCallsPerMonth} Free Calls`,
    isFree ? 'GRATIS — Free-Tier nicht überschritten' : `Über Free-Tier: ~$${quota.monthCostUsd.toFixed(2)}`,
    `${fmtNumber(quota.freeRemaining)} Free Calls verbleibend`,
  ].join('\n')

  return (
    <div className={`relative px-3 py-1.5 rounded-xl border text-xs font-medium ${tone}`} title={tooltip}>
      <div className="flex items-center gap-2">
        <span className="font-mono">{quota.todayPagesCalled}/{quota.dailyLimit}</span>
        <span className="opacity-70 hidden md:inline">heute</span>
        <span className="opacity-30">·</span>
        <span className="font-mono">{fmtNumber(quota.monthPagesCalled)}/{fmtNumber(quota.freeCallsPerMonth)}</span>
        <span className="opacity-70 hidden md:inline">free</span>
        {isFree
          ? <span className="text-emerald-700 font-bold ml-1">GRATIS</span>
          : <span className="ml-1">${quota.monthCostUsd.toFixed(2)}</span>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden bg-black/5">
        <div className={`h-full transition-all ${danger ? 'bg-rose-500' : warn ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.max(quota.pctUsed, quota.freePctUsed)}%` }} />
      </div>
    </div>
  )
}

// Render markdown-style image links + bare image URLs as <img> tags.
// Supports:
//   ![alt](https://...png)
//   https://example.com/foo.png
// Anything else stays as plain text. Lazy-loaded so 50 images don't kill mobile.
function renderActivityBody(body: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  // Splits on either markdown image syntax or bare image URL
  const re = /(!\[[^\]]*\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?\S*)?)/gi
  let lastIdx = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIdx) {
      out.push(<span key={`t-${key++}`}>{body.slice(lastIdx, match.index)}</span>)
    }
    const url = match[2] ?? match[3]
    out.push(
      <a key={`i-${key++}`} href={url} target="_blank" rel="noopener" className="block my-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" loading="lazy"
          className="max-w-full max-h-72 rounded-lg border border-zinc-200 bg-zinc-50 object-contain" />
      </a>
    )
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < body.length) {
    out.push(<span key={`t-${key++}`}>{body.slice(lastIdx)}</span>)
  }
  return out
}

function ActivityItem({ activity, leadId, token, onUpdated, onDeleted }: {
  activity: SalesActivity
  leadId: string
  token: string | null
  onUpdated: (a: SalesActivity) => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState(activity.subject ?? '')
  const [body, setBody] = useState(activity.body ?? '')
  const [outcome, setOutcome] = useState(activity.outcome ?? '')
  const [busy, setBusy] = useState(false)
  const confirm = useConfirm()

  // Place_imported + status_change are system-logs — view-only by default
  // (user can still expand "Mehr"-menu to delete if they really want)
  const systemKind = activity.kind === 'place_imported' || activity.kind === 'status_change'

  async function save() {
    if (!token) return
    setBusy(true)
    try {
      const patch: Record<string, unknown> = {
        subject: subject || null,
        body: body || null,
      }
      if (activity.kind === 'call') patch.outcome = outcome || null
      const res = await fetch(`/api/admin/leads/${leadId}/activity/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const { activity: updated } = await res.json()
        onUpdated(updated)
        setEditing(false)
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!token) return
    const ok = await confirm({
      title: 'Aktivität wirklich löschen?',
      description: 'Dieser Vorgang kann nicht rückgängig gemacht werden.',
      variant: 'danger',
      confirmLabel: 'Löschen',
    })
    if (!ok) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/activity/${activity.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) onDeleted()
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <li className="flex gap-3 text-sm bg-amber-50/50 -mx-2 px-2 py-2 rounded-lg">
        <span className="text-lg">{kindIcon(activity.kind)}</span>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-xs text-zinc-500">{kindLabel(activity.kind)} · {fmtDateTime(activity.occurred_at)}</div>
          {activity.kind === 'call' && (
            <select value={outcome} onChange={e => setOutcome(e.target.value)}
              className="w-full px-3 py-2 text-base sm:text-sm border border-zinc-200 rounded-lg bg-white">
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
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="Betreff (optional)"
            className="w-full px-3 py-2 text-base sm:text-sm border border-zinc-200 rounded-lg bg-white" />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
            placeholder="Notiz/Beschreibung"
            className="w-full px-3 py-2 text-base sm:text-sm border border-zinc-200 rounded-lg bg-white resize-y" />
          <div className="flex gap-2">
            <button onClick={save} disabled={busy}
              className="flex-1 px-3 py-2 bg-zinc-900 text-white text-sm rounded-lg font-semibold disabled:opacity-50">
              {busy ? '…' : 'Speichern'}
            </button>
            <button onClick={() => {
                setSubject(activity.subject ?? '')
                setBody(activity.body ?? '')
                setOutcome(activity.outcome ?? '')
                setEditing(false)
              }}
              className="px-3 py-2 border border-zinc-200 text-sm rounded-lg">
              Abbrechen
            </button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li className="flex gap-3 text-sm group">
      <span className="text-lg">{kindIcon(activity.kind)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="text-zinc-900 min-w-0 flex-1">
            <span className="font-semibold">{kindLabel(activity.kind)}</span>
            {activity.outcome && <span className="ml-2 text-xs text-zinc-500">· {activity.outcome}</span>}
            {activity.subject && <span className="ml-2 text-zinc-700">— {activity.subject}</span>}
          </div>
          {!systemKind && (
            <div className="flex items-center gap-1 flex-shrink-0 opacity-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
              <button onClick={() => setEditing(true)} disabled={busy}
                title="Bearbeiten"
                className="p-1.5 rounded hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900">
                ✎
              </button>
              <button onClick={remove} disabled={busy}
                title="Löschen"
                className="p-1.5 rounded hover:bg-rose-50 text-zinc-400 hover:text-rose-600">
                🗑
              </button>
            </div>
          )}
        </div>
        {activity.body && (
          <div className="text-zinc-600 mt-0.5 whitespace-pre-wrap break-words">
            {renderActivityBody(activity.body)}
          </div>
        )}
        <p className="text-xs text-zinc-400 mt-0.5">{fmtDateTime(activity.occurred_at)}</p>
      </div>
    </li>
  )
}

// ─── Pipeline View ─────────────────────────────────────────────────────
//
// Vier Spalten:
//   1. Heute fällig   (next_action_at <= heute, rot wenn überfällig)
//   2. Diese Woche    (next_action_at heute+1 .. heute+7)
//   3. Demo-Phase     (status ∈ demo_scheduled / demo_done / negotiating)
//   4. Geschlossen    (won / lost / not_a_fit / do_not_contact, letzte 30d)
//
// Die Daten kommen vom /api/admin/sales/leads-Endpoint, der serverseitig
// sortiert und buckets baut. Nach jeder Quick-Action wird neu geladen.
type PipelineData = {
  buckets: {
    today: SalesLead[]
    this_week: SalesLead[]
    demo: SalesLead[]
    closed: SalesLead[]
  }
  daily: { total_due_today: number; counts: Record<string, number> }
  weekly: { new_leads: number; demos_scheduled: number; won: number; lost: number }
  generated_at: string
}

function PipelineView({ token, martialOnly, city, onSelect, onChanged }: {
  token: string
  martialOnly: boolean
  city: string
  onSelect: (l: SalesLead) => void
  onChanged: () => void
}) {
  const [data, setData] = useState<PipelineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Note: confirm() Modal-Hook bleibt verfügbar für andere Quick-Actions
  // (z.B. Demo-Termin verschieben, Lead löschen). Cold-Mail-Auto-Send wurde
  // aus UWG-§7-Gründen entfernt — Plattform sendet keine automatisierten
  // Cold-Mails mehr. Compose-Hilfe öffnet jetzt mailto:-Link im Mail-Client.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('martial', martialOnly ? 'true' : 'false')
    if (city) params.set('city', city)
    try {
      const res = await fetch(`/api/admin/sales/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [token, martialOnly, city])

  useEffect(() => { load() }, [load])

  async function quickAction(leadId: string, action_type: string, extra?: Record<string, unknown>) {
    setBusyId(leadId)
    try {
      const res = await fetch(`/api/admin/sales/leads/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action_type, ...extra }),
      })
      if (res.ok) {
        await load()
        onChanged()
      }
    } finally {
      setBusyId(null)
    }
  }

  if (loading && !data) {
    return <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 text-zinc-500 text-center">Lade Pipeline…</div>
  }
  if (!data) {
    return <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 text-zinc-500 text-center">Pipeline konnte nicht geladen werden.</div>
  }

  const { buckets, daily, weekly } = data
  const todaySummaryItems: string[] = []
  for (const [k, n] of Object.entries(daily.counts)) {
    if (n > 0) todaySummaryItems.push(`${n}× ${pipelineActionLabel(k)}`)
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
      {/* Tagesbericht-Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-amber-100/40 border border-amber-200 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-amber-900">
              📋 Heute: {daily.total_due_today === 0
                ? 'Alles abgearbeitet — gut gemacht!'
                : `${daily.total_due_today} Aktion${daily.total_due_today === 1 ? '' : 'en'} fällig`}
            </div>
            {todaySummaryItems.length > 0 && (
              <div className="text-xs text-amber-800 mt-1">
                {todaySummaryItems.join(' · ')}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs items-center">
            <span className="px-2.5 py-1 bg-white/70 rounded-full text-zinc-700">
              📥 <strong>{weekly.new_leads}</strong> neue Leads
            </span>
            <span className="px-2.5 py-1 bg-white/70 rounded-full text-zinc-700">
              🎯 <strong>{weekly.demos_scheduled}</strong> Demos
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 rounded-full text-emerald-800">
              ✓ <strong>{weekly.won}</strong> gewonnen
            </span>
            <span className="px-2.5 py-1 bg-rose-50 rounded-full text-rose-800">
              × <strong>{weekly.lost}</strong> verloren
            </span>
          </div>
        </div>
      </div>

      {/* 4-column kanban — scroll horizontally on small screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <PipelineColumn
          title="Heute fällig"
          tone="rose"
          count={buckets.today.length}
          subtitle={buckets.today.length === 0 ? 'Nichts mehr offen' : `${buckets.today.length} dran`}
          leads={buckets.today}
          showOverdue
          onSelect={onSelect}
          onAction={quickAction}
          busyId={busyId}
        />
        <PipelineColumn
          title="Diese Woche"
          tone="amber"
          count={buckets.this_week.length}
          subtitle="In den nächsten 7 Tagen"
          leads={buckets.this_week}
          onSelect={onSelect}
          onAction={quickAction}
          busyId={busyId}
        />
        <PipelineColumn
          title="Demo-Phase"
          tone="indigo"
          count={buckets.demo.length}
          subtitle="Demo geplant / gehabt / Verhandlung"
          leads={buckets.demo}
          onSelect={onSelect}
          onAction={quickAction}
          busyId={busyId}
        />
        <PipelineColumn
          title="Geschlossen (30d)"
          tone="zinc"
          count={buckets.closed.length}
          subtitle="Won / Lost — letzte 30 Tage"
          leads={buckets.closed}
          onSelect={onSelect}
          onAction={quickAction}
          busyId={busyId}
          isClosed
        />
      </div>
    </div>
  )
}

function PipelineColumn({
  title, tone, count, subtitle, leads, showOverdue, isClosed, onSelect, onAction, busyId,
}: {
  title: string
  tone: 'rose' | 'amber' | 'indigo' | 'zinc'
  count: number
  subtitle: string
  leads: SalesLead[]
  showOverdue?: boolean
  isClosed?: boolean
  onSelect: (l: SalesLead) => void
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => void
  busyId: string | null
}) {
  const toneClasses = {
    rose:   'border-rose-200 bg-rose-50/50',
    amber:  'border-amber-200 bg-amber-50/50',
    indigo: 'border-indigo-200 bg-indigo-50/50',
    zinc:   'border-zinc-200 bg-zinc-50/50',
  }[tone]
  const headerClasses = {
    rose:   'text-rose-900',
    amber:  'text-amber-900',
    indigo: 'text-indigo-900',
    zinc:   'text-zinc-900',
  }[tone]

  return (
    <div className={`rounded-2xl border ${toneClasses} flex flex-col min-h-[300px] max-h-[calc(100vh-200px)]`}>
      <div className="px-4 py-3 border-b border-current/10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className={`font-bold text-sm ${headerClasses}`}>{title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full bg-white/60 font-mono ${headerClasses}`}>{count}</span>
        </div>
        <p className="text-[11px] text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {leads.length === 0 ? (
          <div className="text-center text-xs text-zinc-400 py-8">— leer —</div>
        ) : leads.map(l => (
          <PipelineCard
            key={l.id}
            lead={l}
            showOverdue={showOverdue}
            isClosed={isClosed}
            onSelect={onSelect}
            onAction={onAction}
            busy={busyId === l.id}
          />
        ))}
      </div>
    </div>
  )
}

function PipelineCard({ lead, showOverdue, isClosed, onSelect, onAction, busy }: {
  lead: SalesLead
  showOverdue?: boolean
  isClosed?: boolean
  onSelect: (l: SalesLead) => void
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => void
  busy: boolean
}) {
  const status = STATUSES.find(s => s.v === lead.status)
  const dueDate = lead.next_action_at ? new Date(lead.next_action_at) : null
  const isOverdue = showOverdue && dueDate ? dueDate < new Date() : false
  const prompt = usePrompt()

  // Owner-Vorname versuchen aus Notes/Name zu extrahieren — aktuell kein eigenes
  // Feld, also nehmen wir den ersten Satz aus den Notes oder fallback "Owner".
  const ownerHint = lead.notes ? lead.notes.split(/[.\n]/)[0].slice(0, 30) : null

  function fmtDue(d: Date): string {
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) return fmtTime(d)
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div
      onClick={() => onSelect(lead)}
      className={`relative bg-white rounded-xl border p-3 cursor-pointer hover:shadow-md transition group ${
        isOverdue ? 'border-rose-300 ring-1 ring-rose-200' : 'border-zinc-200'
      } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-zinc-900 text-sm leading-tight truncate">{lead.name}</div>
          {ownerHint && <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{ownerHint}</div>}
        </div>
        <span className="text-amber-500 text-xs flex-shrink-0">{'★'.repeat(lead.priority)}</span>
      </div>

      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {status && <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>}
        {lead.city && <span className="text-[10px] text-zinc-500">{lead.city}</span>}
      </div>

      {/* Nächste Aktion */}
      {lead.next_action && (
        <div className={`mt-2 text-xs flex items-center gap-1.5 ${isOverdue ? 'text-rose-700 font-semibold' : 'text-zinc-700'}`}>
          <span>{pipelineActionIcon(lead.next_action)}</span>
          <span className="truncate">{pipelineActionLabel(lead.next_action)}</span>
          {dueDate && (
            <span className={`ml-auto text-[10px] flex-shrink-0 ${isOverdue ? 'text-rose-700' : 'text-zinc-400'}`}>
              {isOverdue ? '⚠ ' : ''}{fmtDue(dueDate)}
            </span>
          )}
        </div>
      )}
      {!lead.next_action && lead.status === 'demo_scheduled' && lead.next_followup_at && (
        <div className="mt-2 text-xs text-indigo-700 flex items-center gap-1.5">
          🎯 Demo am {fmtDue(new Date(lead.next_followup_at))}
        </div>
      )}

      {/* Quick-Actions — only on active cards (not closed) */}
      {!isClosed && (
        <div className="mt-3 flex gap-1 -mx-1" onClick={e => e.stopPropagation()}>
          <PipelineQuickButton
            title="Aktion erledigt"
            label="✓"
            onClick={() => onAction(lead.id, 'mark_done')} />
          <PipelineQuickButton
            title="Kontaktiert"
            label="📞"
            onClick={() => onAction(lead.id, 'contacted')} />
          <PipelineQuickButton
            title="Rückruf vereinbart"
            label="🔁"
            onClick={async () => {
              // Wann soll zurückgerufen werden? Default = +1 Tag, gleiche Uhrzeit.
              // Wenn der User abbricht → keine Aktion. Leer/ungültig → Server-Default (+1d).
              const tomorrow = new Date(Date.now() + 86400_000)
              const defaultVal = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000)
                .toISOString().slice(0, 16)
              const at = await prompt({
                title: 'Rückruf vereinbart',
                label: 'Wann zurückrufen?',
                type: 'datetime-local',
                description: 'Wann soll der Lead wieder kontaktiert werden?',
                defaultValue: defaultVal,
                confirmLabel: 'Speichern',
              })
              if (at === null) return
              const parsed = at ? new Date(at) : null
              const iso = parsed && !isNaN(parsed.getTime()) ? parsed.toISOString() : null
              onAction(lead.id, 'callback', iso ? { callback_at: iso } : undefined)
            }} />
          <PipelineQuickButton
            title="Demo vereinbart"
            label="📅"
            onClick={async () => {
              // Mobile-friendly Datum-Picker via PromptModal (type='datetime-local').
              // Liefert ISO-String 'YYYY-MM-DDTHH:mm' direkt vom <input type=...>.
              const at = await prompt({
                title: 'Demo vereinbart',
                label: 'Datum + Uhrzeit',
                type: 'datetime-local',
                description: 'Wann findet die Demo statt?',
                confirmLabel: 'Speichern',
              })
              const parsed = at ? new Date(at) : null
              const iso = parsed && !isNaN(parsed.getTime()) ? parsed.toISOString() : null
              onAction(lead.id, 'demo_scheduled', iso ? { demo_at: iso } : undefined)
            }} />
          <PipelineQuickButton
            title="Verloren"
            label="✕"
            danger
            onClick={async () => {
              const reason = await prompt({
                title: 'Lead als verloren markieren',
                label: 'Grund (optional)',
                type: 'textarea',
                placeholder: 'z.B. Kein Budget, schon mit Konkurrent vertragen, …',
                confirmLabel: 'Als verloren markieren',
              })
              // null = Abbruch → keine Aktion. Leerer String = ohne Grund.
              if (reason === null) return
              const trimmed = reason.trim()
              onAction(lead.id, 'lost', trimmed ? { reason: trimmed } : undefined)
            }} />
        </div>
      )}
      {isClosed && lead.status === 'won' && (
        <div className="mt-2 text-xs text-emerald-700 font-semibold">✓ Gewonnen{lead.converted_at ? ` · ${fmtDate(lead.converted_at)}` : ''}</div>
      )}
      {isClosed && lead.status === 'lost' && (
        <div className="mt-2 text-xs text-rose-700">✕ Verloren{lead.lost_reason ? ` · ${lead.lost_reason}` : ''}</div>
      )}
    </div>
  )
}

function PipelineQuickButton({ label, title, onClick, danger }: {
  label: string
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex-1 px-2 py-1.5 text-xs rounded-lg font-semibold transition ${
        danger
          ? 'bg-zinc-100 hover:bg-rose-50 text-zinc-600 hover:text-rose-700'
          : 'bg-zinc-100 hover:bg-amber-100 text-zinc-700 hover:text-amber-900'
      }`}
    >
      {label}
    </button>
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

// Lokale Sort-Funktion — wird nach jedem updateLead() aufgerufen, damit
// Leads sofort in die richtige Reihenfolge rutschen (kein doppelter Klick
// auf Spalten-Header mehr nötig). Spiegelt die API-Sort-Logik 1:1.
function sortLeadsLocal(leads: SalesLead[], sortKey: string, dir: 'asc' | 'desc'): SalesLead[] {
  const arr = [...leads]
  const m = dir === 'asc' ? 1 : -1
  const num = (v: number | null | undefined): number => v ?? -Infinity
  const dateMs = (v: string | null | undefined, fallback = -Infinity): number =>
    v ? new Date(v).getTime() : fallback
  const followupMs = (v: string | null | undefined): number =>
    // null next_followup_at landet ans Ende beim asc-Sort (nullsFirst: false)
    v ? new Date(v).getTime() : Number.MAX_SAFE_INTEGER

  arr.sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'name':         cmp = (a.name || '').localeCompare(b.name || '', 'de'); break
      case 'city':         cmp = (a.city || '').localeCompare(b.city || '', 'de'); break
      case 'status':       cmp = (a.status || '').localeCompare(b.status || '', 'de'); break
      case 'priority':     cmp = num(a.priority) - num(b.priority); break
      case 'rating':       cmp = num(a.rating) - num(b.rating); break
      case 'created':      cmp = dateMs(a.created_at) - dateMs(b.created_at); break
      case 'updated':      cmp = dateMs(a.updated_at) - dateMs(b.updated_at); break
      case 'next_followup':
        // asc: früheste zuerst, null ans Ende → unabhängig vom dir-Multiplier
        return followupMs(a.next_followup_at) - followupMs(b.next_followup_at)
      default:             cmp = num(a.priority) - num(b.priority)
    }
    return cmp * m
  })
  return arr
}

// Klickbarer Tabellen-Header mit Sort-Pfeil-Indicator
function SortableTh({
  col, label, sort, sortDir, onSort, defaultDesc,
}: {
  col: string
  label: string
  sort: string
  sortDir: 'asc' | 'desc'
  onSort: (col: string, defaultDesc: boolean) => void
  defaultDesc: boolean
}) {
  const isActive = sort === col
  const arrow = isActive ? (sortDir === 'asc' ? '↑' : '↓') : '↕'
  return (
    <th
      onClick={() => onSort(col, defaultDesc)}
      className={`px-4 py-3 cursor-pointer select-none transition-colors ${
        isActive ? 'text-amber-700 bg-amber-50' : 'hover:bg-zinc-100 hover:text-zinc-700'
      }`}
      title={`Nach ${label} sortieren`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[10px] ${isActive ? 'opacity-100' : 'opacity-40'}`}>{arrow}</span>
      </span>
    </th>
  )
}
