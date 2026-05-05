'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Users, Upload, AlertTriangle, ChevronRight, Mail, Clock, MessageCircle, X, Copy, ExternalLink, Check, Download, UserCheck, Navigation, MoreHorizontal } from 'lucide-react'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'
import { type BeltSystem, resolveBeltSystem } from '@/lib/belt-system'
import { toWaPhone } from '@/lib/phone'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const SUB_COLORS: Record<string, string> = {
  active:    'bg-amber-50 text-amber-700 border border-amber-200',
  trial:     'bg-zinc-100 text-zinc-600 border border-zinc-200',
  past_due:  'bg-zinc-100 text-zinc-500 border border-zinc-200',
  cancelled: 'bg-zinc-100 text-zinc-500',
  none:      '',
}

interface Member {
  id: string; first_name: string; last_name: string
  email: string | null; phone: string | null
  belt: string; stripes: number; join_date: string
  is_active: boolean; subscription_status: string | null
  contract_end_date: string | null; monthly_fee_override_cents: number | null
  onboarding_status: string | null; portal_token: string | null
  cancellation_requested_at: string | null
  requested_plan_id: string | null
  plan_id: string | null
  created_at: string
}

function contractStatus(endDate: string | null): 'ok' | 'expiring' | 'expired' {
  if (!endDate) return 'ok'
  const diffDays = (new Date(endDate).getTime() - Date.now()) / 86400000
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'expiring'
  return 'ok'
}

function formatCents(cents: number) {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}

export default function MembersPage() {
  const router = useRouter()
  const { t, lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'

  const SUB_LABELS: Record<string, string> = {
    active:    t('members', 'subActive'),
    trial:     t('members', 'subTrial'),
    past_due:  t('members', 'subPastDue'),
    cancelled: t('members', 'subCancelled'),
    none:      '',
  }

  const [loading, setLoading]               = useState(true)
  const [members, setMembers]               = useState<Member[]>([])
  const [gymId, setGymId]                   = useState('')
  const [monthlyFeeCents, setMonthlyFeeCents] = useState(0)
  const [planPriceMap, setPlanPriceMap]     = useState<Record<string, number>>({})
  const [beltSystem, setBeltSystem]         = useState<BeltSystem | undefined>(undefined)
  const [beltEnabled, setBeltEnabled]       = useState(true)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkLoading, setBulkLoading]       = useState(false)
  const [bulkResult, setBulkResult]         = useState<string | null>(null)
  const [bulkMembers, setBulkMembers]       = useState<{ memberId: string; memberName: string; memberEmail: string; checkoutUrl: string | null; amountCents: number }[]>([])
  const [showBulkResults, setShowBulkResults] = useState(false)
  const [search, setSearch]                 = useState('')
  const [activatingId, setActivatingId]     = useState<string | null>(null)
  const [activatedMember, setActivatedMember] = useState<Member | null>(null)
  const [showWaModal, setShowWaModal]       = useState(false)
  const [copiedId, setCopiedId]             = useState<string | null>(null)
  const [checkingInId, setCheckingInId]     = useState<string | null>(null)
  const [checkedInIds, setCheckedInIds]     = useState<Set<string>>(new Set())
  const [eligibleClasses, setEligibleClasses] = useState<{ id: string; class_type: string; title: string; starts_at: string }[]>([])
  // memberId waiting for class selection (when >1 eligible class)
  const [selectingMemberId, setSelectingMemberId] = useState<string | null>(null)
  // GPS toast
  const [gpsError, setGpsError]            = useState<string | null>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  // Cached GPS position (valid 5 min) — avoids re-prompting for every check-in
  const cachedGps = useRef<{ lat: number; lng: number; ts: number } | null>(null)
  const GPS_CACHE_MS = 5 * 60 * 1000

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(key)
    setTimeout(() => setCopiedId(prev => prev === key ? null : prev), 2000)
  }

  /** Get GPS — use cache if fresh, otherwise request from browser */
  function getGps(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      const cached = cachedGps.current
      if (cached && Date.now() - cached.ts < GPS_CACHE_MS) {
        resolve({ lat: cached.lat, lng: cached.lng }); return
      }
      if (!navigator.geolocation) { reject(new Error(t('portal', 'gpsNotAvailable'))); return }
      navigator.geolocation.getCurrentPosition(
        pos => {
          cachedGps.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() }
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        err => reject(new Error(err.code === 1
          ? (lang === 'en' ? 'GPS access denied. Please allow location access.' : 'GPS-Zugriff verweigert. Bitte Standortfreigabe erlauben.')
          : (lang === 'en' ? 'Could not determine GPS location.' : 'GPS-Standort konnte nicht ermittelt werden.'))),
        { enableHighAccuracy: true, timeout: 10_000 }
      )
    })
  }

  /** Called when user taps Check-in on a member row */
  function handleCheckInClick(memberId: string) {
    if (checkingInId) return
    if (eligibleClasses.length === 0) return
    if (eligibleClasses.length === 1) {
      doCheckIn(memberId, eligibleClasses[0])
    } else {
      setSelectingMemberId(memberId)
    }
  }

  async function doCheckIn(memberId: string, cls: { id: string; class_type: string }) {
    setSelectingMemberId(null)
    setGpsError(null)
    setCheckingInId(memberId)

    let coords: { lat: number; lng: number }
    try {
      coords = await getGps()
    } catch (e) {
      setCheckingInId(null)
      setGpsError(e instanceof Error ? e.message : t('portal', 'gpsError'))
      return
    }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/attendance/gps', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id:  memberId,
        class_type: cls.class_type ?? 'gi',
        class_id:   cls.id,
        lat:        coords.lat,
        lng:        coords.lng,
      }),
    })
    setCheckingInId(null)

    if (res.ok) {
      setCheckedInIds(prev => new Set(prev).add(memberId))
      setTimeout(() => setCheckedInIds(prev => { const n = new Set(prev); n.delete(memberId); return n }), 3000)
    } else {
      const json = await res.json().catch(() => ({}))
      setGpsError(json.error ?? (lang === 'en' ? 'Check-in failed' : 'Check-in fehlgeschlagen'))
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id, monthly_fee_cents, belt_system, belt_system_enabled').single()
      if (!gym) { setLoading(false); return }
      setGymId(gym.id)
      setMonthlyFeeCents(gym.monthly_fee_cents ?? 0)
      setBeltSystem(resolveBeltSystem((gym as any)?.belt_system))
      setBeltEnabled((gym as any)?.belt_system_enabled ?? true)
      // Load members + classes in parallel (look back 3 h for retroactive check-in)
      const now = new Date()
      const [membersRes, classesRes, plansRes] = await Promise.all([
        supabase
          .from('members')
          .select('id, first_name, last_name, email, phone, belt, stripes, join_date, is_active, subscription_status, contract_end_date, monthly_fee_override_cents, onboarding_status, portal_token, cancellation_requested_at, requested_plan_id, plan_id, created_at')
          // 500 is the practical limit for client-side filtering. Gyms exceeding this
          // need a server-side search endpoint with ?q= pagination.
          .eq('gym_id', gym.id).order('last_name').limit(500),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc('get_classes_for_gym', { p_gym_id: gym.id, p_from: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString() }),
        supabase.from('membership_plans').select('id, price_cents').eq('gym_id', gym.id),
      ])
      setMembers((membersRes.data as unknown as Member[]) ?? [])

      // Build plan price lookup map
      const map: Record<string, number> = {}
      for (const p of (plansRes.data ?? []) as { id: string; price_cents: number }[]) {
        map[p.id] = p.price_cents
      }
      setPlanPriceMap(map)

      // Eligible = not cancelled, ends at most 3 h ago, starts ≤ now + 30 min
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const classes = (classesRes.data ?? []) as any[]
      const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000)         // now + 30 min
      const retroLimit  = new Date(now.getTime() - 3 * 60 * 60 * 1000)     // now − 3 h
      const eligible = classes
        .filter(c => {
          const start = new Date(c.starts_at)
          const end   = new Date(c.ends_at)
          return !c.is_cancelled && start <= windowEnd && end >= retroLimit
        })
        .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      setEligibleClasses(eligible.map((c: any) => ({
        id: c.id, class_type: c.class_type ?? 'gi', title: c.title, starts_at: c.starts_at,
      })))

      setLoading(false)
    }
    load()
  }, [])

  const pending  = members.filter(m => m.onboarding_status === 'pending')
  const nonPending = members.filter(m => m.onboarding_status !== 'pending')
  const filtered = nonPending.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q)
  })
  const active   = nonPending.filter(m => m.is_active)
  const inactive = nonPending.filter(m => !m.is_active)
  const pendingRequests = nonPending.filter(m => m.cancellation_requested_at || m.requested_plan_id)
  const activeWithEmail = active.filter(m => m.email)

  function downloadCSV() {
    const headers = lang === 'en'
      ? ['First name', 'Last name', 'Email', 'Phone', 'Date of birth', 'Belt', 'Stripes', 'Member since', 'Status', 'Subscription status', 'Contract until', 'Fee (€)']
      : ['Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Geburtsdatum', 'Gürtel', 'Stripes', 'Mitglied seit', 'Status', 'Abo-Status', 'Vertrag bis', 'Beitrag (€)']
    const rows = members.map(m => [
      m.first_name,
      m.last_name,
      m.email ?? '',
      m.phone ?? '',
      (m as { date_of_birth?: string | null }).date_of_birth ?? '',
      m.belt,
      String(m.stripes),
      m.join_date,
      m.is_active ? t('members', 'active') : t('members', 'inactive'),
      (m as { subscription_status?: string }).subscription_status ?? '',
      m.contract_end_date ?? '',
      (() => {
        const cents = m.monthly_fee_override_cents ?? (m.plan_id ? (planPriceMap[m.plan_id] ?? 0) : 0)
        return cents > 0 ? (cents / 100).toFixed(2).replace('.', ',') : ''
      })(),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${lang === 'en' ? 'members' : 'mitglieder'}-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function handleEmailAll() {
    const emails = activeWithEmail.map(m => m.email).join(',')
    window.open(`mailto:${emails}?subject=Information%20von%20eurem%20Gym`, '_blank')
  }

  async function handleBulkCheckout() {
    setBulkLoading(true); setBulkResult(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch('/api/stripe/bulk-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ gymId, amountCents: monthlyFeeCents }),
      })
      const json = await res.json()
      if (res.ok) {
        setBulkResult(lang === 'en' ? `${json.count} payment links created.` : `${json.count} Zahlungslinks erstellt.`)
        setBulkMembers(json.members ?? [])
        setShowBulkResults(true)
      } else {
        setBulkResult(`${lang === 'en' ? 'Error' : 'Fehler'}: ${json.error}`)
      }
    } catch { setBulkResult(lang === 'en' ? 'Error creating payment links.' : 'Fehler beim Erstellen der Zahlungslinks.') }
    finally { setBulkLoading(false); setShowBulkConfirm(false) }
  }

  async function activateMember(id: string) {
    setActivatingId(id)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/members/${id}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === id ? { ...m, is_active: true, onboarding_status: 'complete' } : m))
      const member = members.find(m => m.id === id)
      if (member) setActivatedMember({ ...member, is_active: true, onboarding_status: 'complete' })
    }
    setActivatingId(null)
  }

  if (loading) return (
    <div className="p-4 md:p-6 animate-pulse">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="h-7 w-32 bg-zinc-200 rounded mb-2" />
          <div className="h-3 w-48 bg-zinc-100 rounded" />
        </div>
        <div className="h-9 w-24 bg-zinc-200 rounded-xl" />
      </div>
      <div className="h-10 w-full bg-zinc-100 rounded-xl mb-4" />
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 border-b border-zinc-100 last:border-0">
            <div className="w-8 h-8 rounded-full bg-zinc-100 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-40 bg-zinc-200 rounded" />
              <div className="h-2.5 w-24 bg-zinc-100 rounded" />
            </div>
            <div className="h-3 w-16 bg-zinc-100 rounded hidden md:block" />
            <div className="h-6 w-20 bg-zinc-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">{t('members', 'title')}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-zinc-400 text-xs font-medium">{active.length} {t('members', 'active').toLowerCase()} · {inactive.length} {t('members', 'inactive').toLowerCase()}</p>
            {eligibleClasses.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {eligibleClasses.length === 1
                  ? `${eligibleClasses[0].title} ${lang === 'en' ? 'is live' : 'läuft'}`
                  : `${eligibleClasses.length} ${lang === 'en' ? 'classes active' : 'Kurse aktiv'}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Desktop buttons */}
          <Link href="/dashboard/members/import"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-medium text-sm transition-colors shadow-sm">
            <Upload size={14} /> CSV
          </Link>
          <button onClick={handleEmailAll}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-medium text-sm transition-colors shadow-sm"
            title={`${t('members', 'email')} — ${activeWithEmail.length} ${t('members', 'title').toLowerCase()}`}>
            <Mail size={14} /> {t('members', 'email')}
          </button>
          <button onClick={() => setShowWaModal(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-semibold text-sm transition-colors shadow-sm"
            title={t('members', 'bulkMessage')}>
            <MessageCircle size={14} /> {t('members', 'whatsapp')}
          </button>
          <button onClick={downloadCSV}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-medium text-sm transition-colors shadow-sm"
            title={t('members', 'exportCsv')}>
            <Download size={14} /> Export
          </button>
          <button onClick={() => setShowBulkConfirm(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-sm transition-colors border border-amber-200">
            {lang === 'en' ? 'Request all' : 'Alle anfordern'}
          </button>

          {/* Mobile "⋯" menu */}
          <div className="relative sm:hidden">
            <button onClick={() => setShowMobileMenu(v => !v)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white border border-zinc-200 text-zinc-600 shadow-sm">
              <MoreHorizontal size={16} />
            </button>
            {showMobileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMobileMenu(false)} />
                <div className="absolute right-0 top-11 z-50 w-52 bg-white rounded-2xl border border-zinc-100 shadow-xl overflow-hidden">
                  <Link href="/dashboard/members/import" onClick={() => setShowMobileMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 border-b border-zinc-50">
                    <Upload size={15} className="text-zinc-400 flex-shrink-0" /> CSV {lang === 'en' ? 'Import' : 'Import'}
                  </Link>
                  <button onClick={() => { handleEmailAll(); setShowMobileMenu(false) }}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 w-full text-left border-b border-zinc-50">
                    <Mail size={15} className="text-zinc-400 flex-shrink-0" /> {t('members', 'email')}
                  </button>
                  <button onClick={() => { setShowWaModal(true); setShowMobileMenu(false) }}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 w-full text-left border-b border-zinc-50">
                    <MessageCircle size={15} className="text-[#25D366] flex-shrink-0" /> WhatsApp
                  </button>
                  <button onClick={() => { downloadCSV(); setShowMobileMenu(false) }}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50 w-full text-left border-b border-zinc-50">
                    <Download size={15} className="text-zinc-400 flex-shrink-0" /> Export CSV
                  </button>
                  <button onClick={() => { setShowBulkConfirm(true); setShowMobileMenu(false) }}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 w-full text-left">
                    {lang === 'en' ? 'Request all payments' : 'Alle Zahlungen anfordern'}
                  </button>
                </div>
              </>
            )}
          </div>

          <Link href="/dashboard/members/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-sm transition-colors shadow-sm">
            <Plus size={14} /> {lang === 'en' ? 'Member' : 'Mitglied'}
          </Link>
        </div>
      </div>

      {/* Search */}
      <input
        type="search" placeholder={lang === 'en' ? 'Search by name or email…' : 'Name oder E-Mail suchen…'}
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full mb-4 px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 shadow-sm"
      />

      {/* GPS error toast */}
      {gpsError && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <Navigation size={15} className="flex-shrink-0 text-red-400" />
          <span className="flex-1">{gpsError}</span>
          <button onClick={() => setGpsError(null)} className="text-red-300 hover:text-red-500 flex-shrink-0"><X size={14} /></button>
        </div>
      )}

      {bulkResult && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-700 text-sm font-medium">{bulkResult}</div>
      )}

      {/* Pending member requests (cancellations / plan changes) */}
      {pendingRequests.length > 0 && (
        <div className="mb-4 rounded-xl overflow-hidden shadow-sm"
          style={{ border: '2px solid #fca5a5', background: 'linear-gradient(135deg,#fff1f2 0%,#fff7f7 100%)' }}>
          <div className="px-4 py-3 border-b border-red-200 flex items-center gap-2 bg-red-50">
            <span className="text-base">❌</span>
            <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
              {lang === 'en' ? 'Cancellation requests' : 'Kündigungen'}
            </span>
            <span className="ml-auto text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-300">
              {pendingRequests.length}
            </span>
          </div>
          <div className="divide-y divide-red-100">
            {pendingRequests.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.cancellation_requested_at ? 'bg-red-100' : 'bg-amber-100'}`}>
                  <span className={`text-xs font-bold ${m.cancellation_requested_at ? 'text-red-700' : 'text-amber-700'}`}>
                    {m.first_name[0]}{m.last_name[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{m.first_name} {m.last_name}</p>
                  <div className="flex gap-2 mt-0.5">
                    {m.cancellation_requested_at && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                        ❌ {t('members', 'cancellation')}
                      </span>
                    )}
                    {m.requested_plan_id && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        🔄 {t('members', 'planChange')}
                      </span>
                    )}
                  </div>
                </div>
                <Link href={`/dashboard/members/${m.id}`}
                  className="text-xs font-bold text-red-600 hover:text-red-800 flex-shrink-0 underline underline-offset-2">
                  {lang === 'en' ? 'Details →' : 'Details →'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New sign-ups in last 24h — info only, no approval needed */}
      {active.filter(m => (Date.now() - new Date(m.created_at).getTime()) < 24 * 60 * 60 * 1000).length > 0 && (
        <div className="mb-4 bg-green-50 rounded-xl border border-green-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-green-200 flex items-center gap-2">
            <span className="text-xs font-semibold text-green-800 uppercase tracking-wider">🆕 {lang === 'en' ? 'New today' : 'Heute neu'}</span>
            <span className="ml-auto text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
              {active.filter(m => (Date.now() - new Date(m.created_at).getTime()) < 24 * 60 * 60 * 1000).length}
            </span>
          </div>
          <div className="divide-y divide-green-100">
            {active
              .filter(m => (Date.now() - new Date(m.created_at).getTime()) < 24 * 60 * 60 * 1000)
              .map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-green-700">{m.first_name[0]}{m.last_name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{m.first_name} {m.last_name}</p>
                    {m.email && <p className="text-xs text-zinc-500 truncate">{m.email}</p>}
                  </div>
                  <Link href={`/dashboard/members/${m.id}`}
                    className="text-xs text-green-700 hover:text-green-600 font-medium flex-shrink-0">
                    {lang === 'en' ? 'View' : 'Ansehen'} →
                  </Link>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Bulk confirm */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-lg max-w-sm w-full">
            <h2 className="font-bold text-zinc-900 mb-2">{lang === 'en' ? 'Request fees' : 'Beiträge anfordern'}</h2>
            <p className="text-zinc-600 text-sm mb-5">
              {lang === 'en'
                ? <>Create payment links for <span className="font-semibold">{activeWithEmail.length} members</span>? The links will be displayed so you can send them via WhatsApp or email.</>
                : <>Zahlungslinks für <span className="font-semibold">{activeWithEmail.length} Mitglieder</span> erstellen? Die Links werden angezeigt, damit du sie per WhatsApp oder E-Mail versenden kannst.</>
              }
            </p>
            <div className="flex gap-3">
              <button onClick={handleBulkCheckout} disabled={bulkLoading}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm">
                {bulkLoading ? (lang === 'en' ? 'Sending…' : 'Wird gesendet…') : (lang === 'en' ? 'Confirm' : 'Bestätigen')}
              </button>
              <button onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm">
                {t('common', 'cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {filtered.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{lang === 'en' ? 'Name' : 'Name'}</th>
                  {beltEnabled && <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{lang === 'en' ? 'Belt' : 'Gürtel'}</th>}
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{t('members', 'joinDate')}</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{t('members', 'fee')}</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">{t('members', 'subscriptionStatus')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const cs = contractStatus(m.contract_end_date)
                  const feeCents = m.monthly_fee_override_cents ?? (m.plan_id ? (planPriceMap[m.plan_id] ?? 0) : 0)
                  const subStatus = m.subscription_status ?? 'none'
                  return (
                    <tr key={m.id}
                      onClick={() => router.push(`/dashboard/members/${m.id}`)}
                      className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-zinc-900 text-sm truncate">{m.first_name} {m.last_name}</span>
                          {cs === 'expired' && <span title={t('members', 'contractExpired')} className="flex-shrink-0"><AlertTriangle size={12} className="text-red-500" /></span>}
                          {cs === 'expiring' && <span title={t('members', 'contractExpiring')} className="flex-shrink-0"><AlertTriangle size={12} className="text-amber-500" /></span>}
                        </div>
                        {m.email && <div className="text-xs text-zinc-400 truncate max-w-full">{m.email}</div>}
                      </td>
                      {beltEnabled && <td className="px-4 py-3.5"><BeltBadge belt={m.belt as Belt} stripes={m.stripes} beltSystem={beltSystem} /></td>}
                      <td className="px-4 py-3.5 text-zinc-500 text-sm">{new Date(m.join_date).toLocaleDateString(locale)}</td>
                      <td className="px-4 py-3.5">
                        {feeCents > 0 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SUB_COLORS[subStatus] || 'text-zinc-500'}`}>
                            {subStatus !== 'none' ? SUB_LABELS[subStatus] : formatCents(feeCents)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            m.is_active ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-zinc-100 text-zinc-400'
                          }`}>
                            {m.is_active ? t('members', 'active') : t('members', 'inactive')}
                          </span>
                          {(Date.now() - new Date(m.created_at).getTime()) < 24 * 60 * 60 * 1000 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                              {lang === 'en' ? 'New' : 'Neu'} 🆕
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {m.phone && (
                            <a href={`https://wa.me/${toWaPhone(m.phone)}?text=${encodeURIComponent(`${lang === 'en' ? `Hello ${m.first_name}! 👋` : `Hallo ${m.first_name}! 👋`}`)}`}
                              target="_blank" rel="noopener noreferrer"
                              title="WhatsApp"
                              className="text-[#25D366] hover:text-[#1ebe57] transition-colors">
                              <MessageCircle size={15} />
                            </a>
                          )}
                          {m.is_active && (
                            <button
                              onClick={() => handleCheckInClick(m.id)}
                              disabled={checkingInId === m.id || eligibleClasses.length === 0}
                              title={
                                eligibleClasses.length === 0 ? (lang === 'en' ? 'No class active right now' : 'Kein Kurs gerade aktiv')
                                : eligibleClasses.length === 1 ? (lang === 'en' ? `Check in for ${eligibleClasses[0].title}` : `Einchecken für ${eligibleClasses[0].title}`)
                                : t('members', 'selectClass')
                              }
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                checkedInIds.has(m.id)
                                  ? 'bg-green-500 text-white'
                                  : eligibleClasses.length === 0
                                    ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                                    : 'bg-amber-400 hover:bg-amber-300 text-zinc-900'
                              } disabled:opacity-60`}
                            >
                              {checkedInIds.has(m.id)
                                ? <><Check size={12} /> ✓</>
                                : checkingInId === m.id
                                  ? '…'
                                  : <><UserCheck size={12} /> Check-in</>
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {filtered.map(m => {
              const cs = contractStatus(m.contract_end_date)
              const feeCents = m.monthly_fee_override_cents ?? monthlyFeeCents
              const subStatus = m.subscription_status ?? 'none'
              return (
                <div key={m.id} className="flex items-center gap-3 bg-white rounded-xl border border-zinc-200 p-3.5 shadow-sm">
                  <div onClick={() => router.push(`/dashboard/members/${m.id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-amber-600">{m.first_name[0]}{m.last_name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-900 text-sm truncate">{m.first_name} {m.last_name}</span>
                        {cs === 'expired' && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                        {cs === 'expiring' && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {beltEnabled && <BeltBadge belt={m.belt as Belt} stripes={m.stripes} beltSystem={beltSystem} />}
                        {feeCents > 0 && subStatus !== 'none' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SUB_COLORS[subStatus]}`}>
                            {SUB_LABELS[subStatus]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {m.is_active ? (
                    <button
                      onClick={() => handleCheckInClick(m.id)}
                      disabled={checkingInId === m.id || eligibleClasses.length === 0}
                      title={eligibleClasses.length === 0 ? (lang === 'en' ? 'No class active' : 'Kein Kurs aktiv') : undefined}
                      className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        checkedInIds.has(m.id)
                          ? 'bg-green-500 text-white'
                          : eligibleClasses.length === 0
                            ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                            : 'bg-amber-400 hover:bg-amber-300 text-zinc-900'
                      } disabled:opacity-60`}
                    >
                      {checkedInIds.has(m.id) ? <Check size={13} /> : checkingInId === m.id ? '…' : <UserCheck size={13} />}
                    </button>
                  ) : (
                    <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <Users size={20} className="text-amber-500" />
          </div>
          <p className="text-zinc-900 font-semibold text-sm mb-1">
            {search ? (lang === 'en' ? 'No results' : 'Keine Ergebnisse') : (lang === 'en' ? 'No members yet' : 'Noch keine Mitglieder')}
          </p>
          <p className="text-zinc-400 text-xs mb-4">
            {search
              ? (lang === 'en' ? `No members for "${search}"` : `Keine Mitglieder für "${search}"`)
              : (lang === 'en' ? 'Add your first member.' : 'Füge dein erstes Mitglied hinzu.')}
          </p>
          {!search && (
            <Link href="/dashboard/members/new"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm">
              <Plus size={14} /> {t('members', 'addMember')}
            </Link>
          )}
        </div>
      )}

      {/* Class selection modal (shown when >1 eligible class) */}
      {selectingMemberId && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectingMemberId(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-xs shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-zinc-100">
              <p className="font-bold text-zinc-900 text-sm">{lang === 'en' ? 'Which class?' : 'Für welchen Kurs?'}</p>
              <p className="text-zinc-400 text-xs mt-0.5">
                {(() => { const m = members.find(x => x.id === selectingMemberId); return m ? `${m.first_name} ${m.last_name}` : '' })()}
              </p>
            </div>
            <div className="p-3 space-y-2">
              {eligibleClasses.map(cls => {
                const now = new Date()
                const start = new Date(cls.starts_at)
                const isLive = start <= now
                const minsUntil = Math.round((start.getTime() - now.getTime()) / 60000)
                return (
                  <button
                    key={cls.id}
                    onClick={() => doCheckIn(selectingMemberId!, cls)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 hover:bg-amber-50 border border-zinc-100 hover:border-amber-200 transition-all text-left group"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isLive ? 'bg-amber-500 animate-pulse' : 'bg-zinc-300'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 group-hover:text-amber-700 truncate">{cls.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {isLive ? (lang === 'en' ? 'Live now' : 'Läuft gerade') : (lang === 'en' ? `Starts in ${minsUntil} min.` : `Beginnt in ${minsUntil} Min.`)}
                        {' · '}
                        {new Date(cls.starts_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <UserCheck size={15} className="text-zinc-300 group-hover:text-amber-500 flex-shrink-0 transition-colors" />
                  </button>
                )
              })}
            </div>
            <div className="px-3 pb-3">
              <button
                onClick={() => setSelectingMemberId(null)}
                className="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-500 text-sm hover:bg-zinc-50 transition-colors"
              >
                {t('common', 'cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activation notification modal */}
      {activatedMember && (
        <ActivationModal member={activatedMember} onClose={() => setActivatedMember(null)} />
      )}

      {/* WhatsApp Bulk Modal */}
      {showWaModal && (
        <WhatsAppBulkModal
          members={active.filter(m => m.phone)}
          onClose={() => setShowWaModal(false)}
        />
      )}

      {/* Bulk Checkout Results Modal */}
      {showBulkResults && bulkMembers.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowBulkResults(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 flex-shrink-0">
              <div>
                <p className="font-bold text-zinc-900 text-sm">{lang === 'en' ? 'Payment links created' : 'Zahlungslinks erstellt'}</p>
                <p className="text-zinc-400 text-xs">{bulkMembers.length} {lang === 'en' ? 'links — send via WhatsApp or copy' : 'Links — per WhatsApp oder Kopieren versenden'}</p>
              </div>
              <button onClick={() => setShowBulkResults(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {bulkMembers.map(m => {
                const memberRecord = members.find(mem => mem.id === m.memberId)
                const phone = memberRecord?.phone ?? null
                const waText = lang === 'en'
                  ? `Hello ${m.memberName}, here is your payment link for this month: ${m.checkoutUrl}`
                  : `Hallo ${m.memberName}, hier ist dein Zahlungslink für diesen Monat: ${m.checkoutUrl}`
                const waUrl = phone
                  ? `https://wa.me/${toWaPhone(phone)}?text=${encodeURIComponent(waText)}`
                  : null
                return (
                  <div key={m.memberId} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 bg-white">
                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-amber-600">
                        {m.memberName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{m.memberName}</p>
                      <p className="text-xs text-zinc-400 truncate">{m.memberEmail}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {m.checkoutUrl && (
                        <>
                          <a href={m.checkoutUrl} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors" title={lang === 'en' ? 'Open link' : 'Link öffnen'}>
                            <ExternalLink size={14} />
                          </a>
                          <button
                            onClick={() => handleCopy(m.checkoutUrl!, `checkout-${m.memberId}`)}
                            className={`p-1.5 rounded-lg transition-colors ${copiedId === `checkout-${m.memberId}` ? 'text-green-600 bg-green-50' : 'text-zinc-500 hover:bg-zinc-100'}`}
                            title={t('members', 'copyLink')}>
                            {copiedId === `checkout-${m.memberId}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </>
                      )}
                      {waUrl ? (
                        <a href={waUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe57] text-white text-xs font-semibold transition-colors">
                          <MessageCircle size={12} />
                          WhatsApp
                        </a>
                      ) : (
                        <button
                          onClick={() => handleCopy(waText, `wa-${m.memberId}`)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${copiedId === `wa-${m.memberId}` ? 'bg-green-100 text-green-700' : 'bg-zinc-100 hover:bg-slate-200 text-zinc-700'}`}
                          title={lang === 'en' ? 'Copy message + link' : 'Nachricht + Link kopieren'}>
                          {copiedId === `wa-${m.memberId}` ? <Check size={12} /> : <Copy size={12} />}
                          {copiedId === `wa-${m.memberId}` ? (lang === 'en' ? 'Copied!' : 'Kopiert!') : (lang === 'en' ? 'Copy' : 'Kopieren')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActivationModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [copiedPortal, setCopiedPortal] = useState(false)
  const { lang } = useLanguage()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const portalUrl = member.portal_token ? `${origin}/portal/${member.portal_token}` : null
  const waText = lang === 'en'
    ? `Hello ${member.first_name}! 🥋 Welcome to the gym – your profile is now active.\n\nHere you'll find your training sessions, payments and stats:\n${portalUrl ?? origin}`
    : `Hallo ${member.first_name}! 🥋 Willkommen im Gym – dein Profil ist jetzt aktiv.\n\nHier findest du deine Trainings, Zahlungen und Statistiken:\n${portalUrl ?? origin}`
  const mailtoUrl = member.email
    ? lang === 'en'
      ? `mailto:${member.email}?subject=${encodeURIComponent('Welcome to the gym – your profile is active!')}&body=${encodeURIComponent(`Hello ${member.first_name}!\n\nYour membership profile is now active.\n\nHere is your personal area:\n${portalUrl ?? origin}\n\nOss! 🥋`)}`
      : `mailto:${member.email}?subject=${encodeURIComponent('Willkommen im Gym – dein Profil ist aktiv!')}&body=${encodeURIComponent(`Hallo ${member.first_name}!\n\nDein Mitgliedsprofil ist jetzt aktiv.\n\nHier ist dein persönlicher Bereich:\n${portalUrl ?? origin}\n\nOss! 🥋`)}`
    : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
          <p className="font-bold text-zinc-900 text-sm">✓ {member.first_name} {member.last_name} {lang === 'en' ? 'activated!' : 'aktiviert!'}</p>
          <p className="text-zinc-500 text-xs mt-0.5">{lang === 'en' ? 'Notify now:' : 'Jetzt benachrichtigen:'}</p>
        </div>
        <div className="p-5 space-y-3">
          {member.phone && (
            <a href={`https://wa.me/${toWaPhone(member.phone)}?text=${encodeURIComponent(waText)}`}
              target="_blank" rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-semibold text-sm transition-colors">
              <MessageCircle size={18} />
              <div className="text-left">
                <p>{lang === 'en' ? 'Send via WhatsApp' : 'Per WhatsApp senden'}</p>
                <p className="text-white/70 text-xs font-normal">{member.phone}</p>
              </div>
            </a>
          )}
          {mailtoUrl && (
            <a href={mailtoUrl} onClick={onClose}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-zinc-100 hover:bg-slate-200 text-zinc-700 font-semibold text-sm transition-colors">
              <Mail size={18} />
              <div className="text-left">
                <p>{lang === 'en' ? 'Send via email' : 'Per E-Mail senden'}</p>
                <p className="text-zinc-400 text-xs font-normal">{member.email}</p>
              </div>
            </a>
          )}
          {portalUrl && (
            <button onClick={() => {
                navigator.clipboard.writeText(portalUrl!)
                setCopiedPortal(true)
                setTimeout(() => { setCopiedPortal(false); onClose() }, 1200)
              }}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border font-semibold text-sm transition-colors ${copiedPortal ? 'border-green-200 bg-green-50 text-green-700' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}>
              {copiedPortal ? <Check size={18} /> : <Copy size={18} />}
              <div className="text-left">
                <p>{copiedPortal ? (lang === 'en' ? 'Copied!' : 'Kopiert!') : (lang === 'en' ? 'Copy profile link' : 'Profillink kopieren')}</p>
                <p className="text-xs font-normal truncate max-w-[200px] opacity-60">{portalUrl}</p>
              </div>
            </button>
          )}
          <button onClick={onClose} className="w-full py-2 text-zinc-400 text-sm hover:text-zinc-600">
            {lang === 'en' ? 'Send later' : 'Später senden'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WhatsAppBulkModal({ members, onClose }: {
  members: { id: string; first_name: string; last_name: string; phone: string | null }[]
  onClose: () => void
}) {
  const { lang } = useLanguage()

  const BULK_TEMPLATES = [
    { id: 'info',    label: `📢 ${lang === 'en' ? 'General Info' : 'Allgemeine Info'}`,        text: () => lang === 'en' ? `Hello! Quick message from your gym. 👋` : `Hallo! Kurze Nachricht von eurem Gym. 👋` },
    { id: 'payment', label: `💰 ${lang === 'en' ? 'Payment reminder' : 'Beitragserinnerung'}`, text: () => lang === 'en' ? `Hello! Your monthly membership fee is due. Please transfer it this week. Thanks! 🙏` : `Hallo! Euer monatlicher Mitgliedsbeitrag ist fällig. Bitte überweist ihn diese Woche. Danke! 🙏` },
    { id: 'event',   label: `🥋 ${lang === 'en' ? 'Training reminder' : 'Trainings-Erinnerung'}`,  text: () => lang === 'en' ? `Hey! Training tonight – see you on the mat! Oss! 💪` : `Hey! Heute Abend Training – wir sehen uns auf der Matte! Oss! 💪` },
    { id: 'comp',    label: `🏆 ${lang === 'en' ? 'Competition announcement' : 'Wettkampf-Ankündigung'}`, text: () => lang === 'en' ? `Hey guys! We're entering the next competition. Interested? Let us know! Details to follow. Oss! 🏆` : `Hey Leute! Wir nehmen am nächsten Wettkampf teil. Wer Interesse hat – meldet euch! Details folgen. Oss! 🏆` },
    { id: 'custom',  label: `✏️ ${lang === 'en' ? 'Custom message' : 'Eigene Nachricht'}`,       text: () => `` },
  ]

  const [templateId, setTemplateId] = useState(BULK_TEMPLATES[0].id)
  const [customMsg, setCustomMsg]   = useState('')
  const [step, setStep]             = useState<'compose' | 'send'>('compose')
  const [sentIdx, setSentIdx]       = useState<Set<string>>(new Set())

  const tmpl    = BULK_TEMPLATES.find(t => t.id === templateId)!
  const message = templateId === 'custom' ? customMsg : tmpl.text()

  function markSent(id: string) { setSentIdx(prev => new Set([...prev, id])) }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#128C7E] text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} />
            <div>
              <p className="font-bold text-sm">{lang === 'en' ? 'Prepare WhatsApp messages' : 'WhatsApp Nachrichten vorbereiten'}</p>
              <p className="text-white/70 text-xs">{members.length} {lang === 'en' ? 'members with phone number' : 'Mitglieder mit Nummer'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {step === 'compose' ? (
            <div className="p-5 space-y-4">
              {/* Template picker */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Choose template' : 'Vorlage wählen'}</p>
                <div className="space-y-1.5">
                  {BULK_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => setTemplateId(t.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        templateId === t.id
                          ? 'bg-[#25D366]/10 text-[#128C7E] font-semibold border border-[#25D366]/30'
                          : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Message */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Message' : 'Nachricht'}</p>
                <textarea
                  value={templateId === 'custom' ? customMsg : tmpl.text()}
                  onChange={e => { setTemplateId('custom'); setCustomMsg(e.target.value) }}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm focus:outline-none focus:border-[#25D366] resize-none"
                />
              </div>
              <button onClick={() => setStep('send')} disabled={!message.trim()}
                className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] disabled:opacity-40 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
                <MessageCircle size={16} /> {lang === 'en' ? 'Next → Send messages' : 'Weiter → Nachrichten senden'}
              </button>
            </div>
          ) : (
            <div className="p-5">
              <div className="mb-4 p-3 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20">
                <p className="text-xs font-semibold text-[#128C7E] mb-1">{lang === 'en' ? 'Your message:' : 'Deine Nachricht:'}</p>
                <p className="text-sm text-zinc-700">{message}</p>
              </div>
              <p className="text-xs text-zinc-500 mb-3">{lang === 'en' ? 'Click the button per member — WhatsApp opens with the message pre-filled.' : 'Klicke pro Mitglied auf den Button — WhatsApp öffnet sich mit der Nachricht vorausgefüllt.'}</p>
              <div className="space-y-2">
                {members.map(m => {
                  const done = sentIdx.has(m.id)
                  const waUrl = `https://wa.me/${toWaPhone(m.phone!)}?text=${encodeURIComponent(message)}`
                  return (
                    <div key={m.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      done ? 'bg-zinc-50 border-zinc-200' : 'bg-white border-zinc-200'
                    }`}>
                      <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-[#128C7E]">{m.first_name[0]}{m.last_name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-zinc-400 truncate">{m.phone}</p>
                      </div>
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        onClick={() => markSent(m.id)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          done
                            ? 'bg-zinc-200 text-zinc-700 border border-zinc-300'
                            : 'bg-[#25D366] hover:bg-[#1ebe57] text-white'
                        }`}>
                        <MessageCircle size={12} />
                        {done ? (lang === 'en' ? '✓ Sent' : '✓ Gesendet') : (lang === 'en' ? 'Send' : 'Senden')}
                      </a>
                    </div>
                  )
                })}
              </div>
              {sentIdx.size > 0 && (
                <p className="mt-4 text-center text-xs text-zinc-400">{sentIdx.size} {lang === 'en' ? 'of' : 'von'} {members.length} {lang === 'en' ? 'sent' : 'gesendet'}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
