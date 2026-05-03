'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { BeltBadge } from '@/components/BeltBadge'
import { resolveBeltSystem } from '@/lib/belt-system'
import type { Belt } from '@/types/database'
import {
  Calendar, CreditCard, Dumbbell, Clock, CheckCircle, BookOpen, Flame,
  Trophy, QrCode, Megaphone, Pin, Package, ChevronDown, ChevronUp, X, AlertTriangle,
} from 'lucide-react'

// ── types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string
  name: string
  description: string | null
  price_cents: number
  billing_interval: string
  contract_months: number
}

interface Announcement {
  id: string
  title: string
  body: string | null
  is_pinned: boolean
  expires_at: string | null
  created_at: string
}

interface Post {
  id: string
  title: string
  cover_url: string | null
  blocks: { type: string; content?: string; url?: string; alt?: string; level?: number }[]
  published_at: string
}

interface UpcomingClass {
  id: string; title: string; class_type: string; instructor: string | null
  starts_at: string; ends_at: string; max_capacity: number | null
  confirmed_count: number; waitlist_count: number; my_status: string | null
}

interface TrainingLog {
  id: string; note: string; class_type: string | null; logged_at: string
}

interface MemberData {
  member: {
    id: string; first_name: string; last_name: string; email: string | null
    belt: string; stripes: number; join_date: string; is_active: boolean
    subscription_status: string; date_of_birth: string | null
    contract_end_date?: string | null
    plan_id: string | null
    requested_plan_id: string | null
    cancellation_requested_at: string | null
  }
  gym: { name: string; logo_url?: string | null; belt_system?: unknown; belt_system_enabled?: boolean } | null
  attendance: { id: string; checked_in_at: string; class_type: string }[]
  totalSessions: number
  payments: { id: string; amount_cents: number; status: string; paid_at: string | null; created_at: string; checkout_url: string | null }[]
  totalPaidCents: number
  plans: Plan[]
  announcements: Announcement[]
  posts: Post[]
  upcoming_bookings: null
}

// ── helpers ───────────────────────────────────────────────────────────────────

function calcStats(attendance: { checked_in_at: string }[]) {
  const now = new Date()
  const sessionsThisMonth = attendance.filter(a => {
    const d = new Date(a.checked_in_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  function startOfWeek(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
    return d
  }

  const weekSet = new Set<number>()
  for (const a of attendance) weekSet.add(startOfWeek(new Date(a.checked_in_at)).getTime())

  let streak = 0
  let cursor = startOfWeek(now)
  while (weekSet.has(cursor.getTime())) { streak++; cursor.setDate(cursor.getDate() - 7) }

  return { sessionsThisMonth, streak }
}

function intervalLabel(interval: string) {
  if (interval === 'biannual') return '/6 Monate'
  if (interval === 'annual')   return '/Jahr'
  return '/Monat'
}

function intervalMonths(interval: string) {
  if (interval === 'biannual') return 6
  if (interval === 'annual')   return 12
  return 1
}

function formatPrice(cents: number, interval: string) {
  const total = (cents / 100).toFixed(2).replace('.', ',')
  const months = intervalMonths(interval)
  if (months > 1) {
    const perMonth = (cents / 100 / months).toFixed(2).replace('.', ',')
    return { total: `€${total}${intervalLabel(interval)}`, perMonth: `≈ €${perMonth}/Mo` }
  }
  return { total: `€${total}/Monat`, perMonth: null }
}

const CLASS_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat', kids: 'Kids', competition: 'Competition',
}
const TYPE_COLORS: Record<string, string> = {
  gi: 'bg-blue-50 text-blue-700', 'no-gi': 'bg-slate-100 text-slate-600',
  'open mat': 'bg-amber-50 text-amber-700', kids: 'bg-green-50 text-green-700',
  competition: 'bg-red-50 text-red-700',
}
const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-50 text-green-700 border-green-200', pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200', refunded: 'bg-slate-100 text-slate-500 border-slate-200',
}
const STATUS_LABELS: Record<string, string> = {
  paid: 'Bezahlt', pending: 'Ausstehend', failed: 'Fehlgeschlagen', refunded: 'Erstattet',
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  }
}

function canCheckin(startsAt: string, endsAt: string) {
  const now = Date.now()
  return now >= new Date(startsAt).getTime() - 60 * 60 * 1000 && now <= new Date(endsAt).getTime()
}

function isCheckoutExpired(p: { created_at: string; status: string }) {
  return p.status === 'pending' && (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60) > 23
}

// ── PWA install button ────────────────────────────────────────────────────────

function PWAInstallButton({ gymName }: { gymName: string }) {
  const [prompt, setPrompt] = useState<any>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches

    if (isStandalone) { setInstalled(true); return }

    if (isIos) {
      setPrompt('ios')
      return
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  if (installed || prompt === null) return null

  async function handleInstall() {
    if (prompt === 'ios') { setShowIosHint(true); return }
    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
  }

  return (
    <>
      <button
        onClick={handleInstall}
        className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-white text-sm font-semibold rounded-2xl py-3.5 transition-colors shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v13M7 9l5 6 5-6"/>
          <path d="M5 19h14"/>
        </svg>
        {gymName ? `${gymName} App installieren` : 'App installieren'}
      </button>

      {showIosHint && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowIosHint(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-sm px-6 pt-6 pb-10 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-6" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">App zum Homescreen hinzufügen</h3>
            <p className="text-slate-500 text-sm mb-5">So funktioniert es auf dem iPhone:</p>
            <ol className="space-y-3 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <span>Tippe auf das <strong>Teilen-Symbol</strong> <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">⬆</span> unten in der Browserleiste</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <span>Scrolle nach unten und tippe auf <strong>„Zum Home-Bildschirm"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <span>Tippe oben rechts auf <strong>„Hinzufügen"</strong></span>
              </li>
            </ol>
            <button onClick={() => setShowIosHint(false)} className="mt-6 w-full py-3 rounded-2xl bg-slate-900 text-white text-sm font-semibold">
              Verstanden
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── sub-components ────────────────────────────────────────────────────────────

function ContractBanner({ contractEndDate }: { contractEndDate: string }) {
  const end = new Date(contractEndDate)
  const diffDays = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const formatted = end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  if (diffDays < 0)  return <div className="rounded-2xl px-4 py-3 border border-red-200 bg-red-50 text-red-700 text-sm font-medium">Vertrag abgelaufen</div>
  if (diffDays <= 30) return <div className="rounded-2xl px-4 py-3 border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium">Vertrag läuft in {diffDays} {diffDays === 1 ? 'Tag' : 'Tagen'} ab</div>
  return <div className="rounded-2xl px-4 py-3 border border-green-200 bg-green-50 text-green-700 text-sm font-medium">Vertrag gültig bis {formatted}</div>
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-center">
      <div className="flex justify-center text-slate-400 mb-1">{icon}</div>
      <p className="text-slate-900 font-bold text-base">{value}</p>
      <p className="text-slate-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function MemberPortalPage() {
  const params = useParams()
  const token  = params.token as string

  const [data, setData]       = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [classes, setClasses]               = useState<UpcomingClass[]>([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [bookingId, setBookingId]           = useState<string | null>(null)
  const [attendanceMap, setAttendanceMap]   = useState<Record<string, { attendanceId: string; checkedOut: boolean }>>({})
  const [checkinLoading, setCheckinLoading] = useState<string | null>(null)

  const [logs, setLogs]             = useState<TrainingLog[]>([])
  const [logNote, setLogNote]       = useState('')
  const [logClassType, setLogClassType] = useState('')
  const [logSaving, setLogSaving]   = useState(false)

  // Plan selection
  const [planRequesting, setPlanRequesting] = useState<string | null>(null)
  const [localRequestedPlanId, setLocalRequestedPlanId] = useState<string | null>(null)

  // Cancellation
  const [showCancelForm, setShowCancelForm]     = useState(false)
  const [cancelNote, setCancelNote]             = useState('')
  const [cancelRequesting, setCancelRequesting] = useState(false)
  const [localCancelledAt, setLocalCancelledAt] = useState<string | null>(null)

  const loadPortal = useCallback(() => {
    fetch(`/api/portal/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else {
          setData(d)
          setLocalRequestedPlanId(d.member?.requested_plan_id ?? null)
          setLocalCancelledAt(d.member?.cancellation_requested_at ?? null)
        }
      })
      .catch(() => setError('Verbindungsfehler'))
      .finally(() => setLoading(false))
  }, [token])

  const loadClasses = useCallback(() => {
    setClassesLoading(true)
    fetch(`/api/portal/${token}/classes`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setClasses(d) })
      .catch(() => {})
      .finally(() => setClassesLoading(false))
  }, [token])

  const loadLogs = useCallback(() => {
    fetch(`/api/portal/${token}/training-log`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setLogs(d) })
      .catch(() => {})
  }, [token])

  useEffect(() => { loadPortal(); loadClasses(); loadLogs() }, [loadPortal, loadClasses, loadLogs])

  async function handleSaveLog() {
    if (!logNote.trim()) return
    setLogSaving(true)
    await fetch(`/api/portal/${token}/training-log`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: logNote, class_type: logClassType || null }),
    })
    setLogNote(''); setLogClassType('')
    await loadLogs()
    setLogSaving(false)
  }

  async function handleBook(classId: string) {
    setBookingId(classId)
    await fetch(`/api/portal/${token}/book/${classId}`, { method: 'POST' })
    setBookingId(null); loadClasses(); loadPortal()
  }

  async function handleCancelBooking(classId: string) {
    setBookingId(classId)
    await fetch(`/api/portal/${token}/book/${classId}`, { method: 'DELETE' })
    setBookingId(null); loadClasses(); loadPortal()
  }

  async function handleCheckin(classId: string) {
    setCheckinLoading(classId)
    const res  = await fetch(`/api/portal/${token}/checkin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId }),
    })
    const result = await res.json()
    if (result.success && result.attendance_id)
      setAttendanceMap(prev => ({ ...prev, [classId]: { attendanceId: result.attendance_id, checkedOut: false } }))
    setCheckinLoading(null)
  }

  async function handleRequestPlan(planId: string) {
    if (planRequesting) return
    setPlanRequesting(planId)
    await fetch(`/api/portal/${token}/plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId }),
    })
    setLocalRequestedPlanId(planId)
    setPlanRequesting(null)
  }

  async function handleWithdrawPlanRequest() {
    await fetch(`/api/portal/${token}/plan`, { method: 'DELETE' })
    setLocalRequestedPlanId(null)
  }

  async function handleRequestCancel() {
    setCancelRequesting(true)
    await fetch(`/api/portal/${token}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: cancelNote }),
    })
    setLocalCancelledAt(new Date().toISOString())
    setShowCancelForm(false)
    setCancelRequesting(false)
  }

  async function handleWithdrawCancel() {
    await fetch(`/api/portal/${token}/cancel`, { method: 'DELETE' })
    setLocalCancelledAt(null)
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Lädt...</div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-500 text-sm">{error || 'Nicht gefunden'}</p>
        <p className="text-slate-400 text-xs mt-2">Bitte kontaktiere dein Gym.</p>
      </div>
    </div>
  )

  const { member, gym, attendance, totalSessions, payments, plans, announcements, posts } = data
  const { sessionsThisMonth, streak } = calcStats(attendance ?? [])

  const beltSystem    = resolveBeltSystem((gym as any)?.belt_system)
  const beltEnabled   = (gym as any)?.belt_system_enabled ?? true
  const beltSlot      = beltSystem.find(s => s.key === member.belt) ?? beltSystem[0]
  const currentPlan   = plans.find(p => p.id === member.plan_id)
  const requestedPlan = plans.find(p => p.id === localRequestedPlanId)

  const CLASS_TYPE_OPTIONS = ['gi', 'no-gi', 'open mat', 'kids', 'competition']

  return (
    <div className="min-h-screen bg-slate-50 safe-area-top">

      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {gym?.logo_url ? (
              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                <Image src={gym.logo_url} alt={gym.name || 'Logo'} width={36} height={36} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-black text-white italic">oss</span>
              </div>
            )}
            <div>
              <p className="font-bold text-slate-900 text-sm leading-tight">{gym?.name || 'Osss'}</p>
              <p className="text-xs text-slate-400">Mitglieder-Portal</p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
            member.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-400 border-slate-200'
          }`}>
            {member.is_active ? 'Aktiv' : 'Inaktiv'}
          </span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 py-6 space-y-4">

        {/* PWA install */}
        <PWAInstallButton gymName={gym?.name ?? ''} />

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="space-y-2">
            {announcements.map(a => (
              <div key={a.id} className={`rounded-2xl p-4 border ${a.is_pinned ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
                <div className="flex items-start gap-2.5">
                  <div className="flex-shrink-0 mt-0.5">
                    {a.is_pinned ? <Pin size={13} className="text-amber-500" /> : <Megaphone size={13} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${a.is_pinned ? 'text-amber-900' : 'text-slate-800'}`}>{a.title}</p>
                    {a.body && <p className={`text-xs mt-1 leading-relaxed ${a.is_pinned ? 'text-amber-800' : 'text-slate-500'}`}>{a.body}</p>}
                    <p className="text-xs text-slate-400 mt-1.5">
                      {new Date(a.created_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Profile card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0"
              style={{ backgroundColor: beltEnabled ? beltSlot.bg : '#e2e8f0', color: beltEnabled ? beltSlot.text : '#94a3b8' }}
            >
              {member.first_name[0]}{member.last_name[0]}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900">{member.first_name} {member.last_name}</h1>
              {beltEnabled && (
                <div className="mt-1">
                  <BeltBadge belt={member.belt as Belt} stripes={member.stripes} beltSystem={beltSystem} />
                </div>
              )}
              {member.email && <p className="text-slate-400 text-xs mt-1 truncate">{member.email}</p>}
            </div>
          </div>
        </div>

        {/* Contract banner */}
        {member.contract_end_date && <ContractBanner contractEndDate={member.contract_end_date} />}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Calendar size={15} />} label="Mitglied seit" value={new Date(member.join_date).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })} />
          <StatCard icon={<Dumbbell size={15} />} label="Gesamt" value={String(totalSessions ?? 0)} />
          <StatCard icon={<Flame size={15} />} label="Diesen Monat" value={`${sessionsThisMonth}${sessionsThisMonth > 0 ? ' 🔥' : ''}`} />
          <StatCard icon={<Trophy size={15} />} label="Wochen-Streak" value={`${streak}${streak >= 4 ? ' 🏆' : ''}`} />
        </div>

        {/* QR-Code */}
        <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 shadow-sm">
          <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
            <QrCode size={15} className="text-slate-400" /> Mein Check-in Code
          </h2>
          <p className="text-slate-400 text-xs mb-4">Am Eingang scannen lassen für schnelles Einchecken</p>
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-2xl p-3 shadow-sm">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : 'https://bjjpunkte.vercel.app'}/portal/${token}`)}&color=0f172a&bgcolor=ffffff&margin=10`}
                alt="QR Code" width={240} height={240} className="rounded-lg w-full max-w-[240px]"
              />
            </div>
            <p className="text-slate-500 text-xs mt-3 text-center">Zeige diesen Code am Eingang oder Kiosk</p>
            <a href={`/qr/${token}`}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-xl py-2.5 transition-colors">
              <QrCode size={14} /> Karte öffnen & speichern
            </a>
          </div>
        </div>

        {/* Membership plans */}
        {plans.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Package size={15} className="text-slate-400" /> Mitgliedschaft
            </h2>
            {currentPlan ? (
              <p className="text-xs text-slate-400 mb-4">
                Aktuell: <span className="font-medium text-slate-600">{currentPlan.name}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-400 mb-4">Wähle einen Tarif oder fordere einen Wechsel an.</p>
            )}

            {requestedPlan && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-amber-800 text-sm font-medium">Wechsel zu „{requestedPlan.name}" angefordert</p>
                  <p className="text-amber-700 text-xs mt-0.5">Dein Gym wird die Änderung bearbeiten.</p>
                </div>
                <button onClick={handleWithdrawPlanRequest} className="text-amber-500 hover:text-amber-700 flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="space-y-3">
              {plans.map(plan => {
                const { total, perMonth } = formatPrice(plan.price_cents, plan.billing_interval)
                const isCurrentPlan   = plan.id === member.plan_id
                const isRequested     = plan.id === localRequestedPlanId
                const isLoading       = planRequesting === plan.id

                return (
                  <div key={plan.id} className={`rounded-xl border-2 p-4 transition-all ${
                    isCurrentPlan ? 'border-amber-400 bg-amber-50' :
                    isRequested   ? 'border-amber-200 bg-amber-50/50' :
                    'border-slate-100 bg-slate-50'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">{plan.name}</p>
                          {isCurrentPlan && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">Aktuell</span>
                          )}
                          {isRequested && !isCurrentPlan && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 font-bold">Angefordert</span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-lg font-black text-slate-900">{total}</span>
                          {perMonth && <span className="text-xs text-slate-400">{perMonth}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {plan.contract_months === 0
                            ? 'Jederzeit kündbar'
                            : `${plan.contract_months} Monate Mindestlaufzeit`}
                        </p>
                        {plan.description && (
                          <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                        )}
                      </div>
                      {!isCurrentPlan && !isRequested && (
                        <button
                          onClick={() => handleRequestPlan(plan.id)}
                          disabled={!!isLoading}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {isLoading ? '…' : 'Wählen'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Upcoming classes */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock size={15} className="text-slate-400" /> Nächste Trainings
          </h2>
          {classesLoading ? (
            <p className="text-slate-400 text-sm">Lädt…</p>
          ) : classes.length === 0 ? (
            <p className="text-slate-400 text-sm">Keine Trainings in den nächsten Tagen.</p>
          ) : (
            <div className="space-y-3">
              {classes.map(cls => {
                const { date, time } = formatDateTime(cls.starts_at)
                const endTime     = new Date(cls.ends_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                const spotsLeft   = cls.max_capacity != null ? cls.max_capacity - cls.confirmed_count : null
                const isBooked    = cls.my_status === 'confirmed'
                const isWaitlist  = cls.my_status === 'waitlist'
                const isLoading   = bookingId === cls.id
                const attendanceState = attendanceMap[cls.id]
                const showCheckin = isBooked && canCheckin(cls.starts_at, cls.ends_at) && !attendanceState

                return (
                  <div key={cls.id} className="rounded-xl border border-slate-100 p-4 bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${TYPE_COLORS[cls.class_type] ?? TYPE_COLORS.gi}`}>
                            {CLASS_LABELS[cls.class_type] ?? cls.class_type}
                          </span>
                          {isWaitlist && <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-amber-50 text-amber-600">Warteliste</span>}
                        </div>
                        <p className="text-slate-900 text-sm font-semibold">{cls.title}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{date} · {time}–{endTime}</p>
                        {cls.instructor && <p className="text-slate-400 text-xs">{cls.instructor}</p>}
                        <p className="text-slate-400 text-xs mt-0.5">
                          {spotsLeft != null ? spotsLeft > 0 ? `${spotsLeft} Plätze frei` : 'Ausgebucht' : `${cls.confirmed_count} Anmeldungen`}
                          {cls.waitlist_count > 0 && ` · ${cls.waitlist_count} auf Warteliste`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {isBooked ? (
                          <button onClick={() => handleCancelBooking(cls.id)} disabled={isLoading}
                            className="text-xs px-3 min-h-[44px] rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors disabled:opacity-50">
                            {isLoading ? '…' : 'Absagen'}
                          </button>
                        ) : isWaitlist ? (
                          <button onClick={() => handleCancelBooking(cls.id)} disabled={isLoading}
                            className="text-xs px-3 min-h-[44px] rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors disabled:opacity-50">
                            {isLoading ? '…' : 'Abmelden'}
                          </button>
                        ) : (
                          <button onClick={() => handleBook(cls.id)} disabled={isLoading}
                            className="text-xs px-3 min-h-[44px] rounded-lg bg-green-500 hover:bg-green-400 text-white font-medium transition-colors disabled:opacity-50">
                            {isLoading ? '…' : 'Zusagen'}
                          </button>
                        )}
                      </div>
                    </div>
                    {showCheckin && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <button onClick={() => handleCheckin(cls.id)} disabled={checkinLoading === cls.id}
                          className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                          <CheckCircle size={14} />
                          {checkinLoading === cls.id ? 'Einchecken…' : 'Einchecken'}
                        </button>
                      </div>
                    )}
                    {attendanceState && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
                          <CheckCircle size={14} /> Eingecheckt
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Payments */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard size={15} className="text-slate-400" /> Zahlungshistorie
          </h2>
          {payments?.length > 0 ? (
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${STATUS_COLORS[p.status] ?? STATUS_COLORS.pending}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                    <span className="text-slate-700 text-sm font-medium flex-shrink-0">
                      {(p.amount_cents / 100).toFixed(2).replace('.', ',')} €
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-slate-400 text-xs">{new Date(p.paid_at ?? p.created_at).toLocaleDateString('de-DE')}</span>
                    {p.status === 'pending' && p.checkout_url && (
                      isCheckoutExpired(p) ? (
                        <span className="text-slate-400 text-xs opacity-60">Link abgelaufen</span>
                      ) : (
                        <a href={p.checkout_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold transition-colors">
                          Jetzt bezahlen
                        </a>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Keine Zahlungen vorhanden.</p>
          )}
        </div>

        {/* Attendance history */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Dumbbell size={15} className="text-slate-400" /> Trainingsverlauf
            <span className="text-sm font-normal text-slate-400">({totalSessions ?? 0} gesamt)</span>
          </h2>
          {attendance?.length > 0 ? (
            <div>
              {attendance.slice(0, 20).map(a => (
                <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-700 text-sm font-medium">{CLASS_LABELS[a.class_type] ?? a.class_type}</span>
                  <span className="text-slate-400 text-xs">
                    {new Date(a.checked_in_at).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}
                    {' · '}
                    {new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {(totalSessions ?? 0) > 20 && (
                <p className="text-slate-400 text-xs pt-3 text-center">+ {(totalSessions ?? 0) - 20} weitere Einträge</p>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Noch keine Trainings aufgezeichnet.</p>
          )}
        </div>

        {/* Training log */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen size={15} className="text-slate-400" /> Technik-Logbuch
          </h2>
          <div className="space-y-3 mb-5">
            <textarea value={logNote} onChange={e => setLogNote(e.target.value)}
              placeholder="Was hast du heute gelernt oder geübt?" rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
            <div className="flex gap-2">
              <select value={logClassType} onChange={e => setLogClassType(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="">Klasse (optional)</option>
                {CLASS_TYPE_OPTIONS.map(t => <option key={t} value={t}>{CLASS_LABELS[t] ?? t}</option>)}
              </select>
              <button onClick={handleSaveLog} disabled={logSaving || !logNote.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {logSaving ? '…' : 'Speichern'}
              </button>
            </div>
          </div>
          {logs.length === 0 ? (
            <p className="text-slate-400 text-sm">Noch keine Notizen gespeichert.</p>
          ) : (
            <div className="space-y-3">
              {logs.slice(0, 10).map(log => (
                <div key={log.id} className="rounded-xl border border-slate-100 p-3 bg-slate-50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-slate-400 text-xs">
                      {new Date(log.logged_at).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}
                      {' · '}{new Date(log.logged_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {log.class_type && (
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${TYPE_COLORS[log.class_type] ?? TYPE_COLORS.gi}`}>
                        {CLASS_LABELS[log.class_type] ?? log.class_type}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 text-sm whitespace-pre-wrap">{log.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cancellation */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <AlertTriangle size={15} className="text-slate-400" /> Mitgliedschaft kündigen
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Eine Kündigung muss vom Gym bestätigt werden. Deine Mitgliedschaft läuft bis zur Bearbeitung weiter.
          </p>

          {localCancelledAt ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="text-red-700 text-sm font-semibold">Kündigung angefordert</p>
              <p className="text-red-600 text-xs mt-1">
                Eingereicht am {new Date(localCancelledAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}. Dein Gym wird sich melden.
              </p>
              <button onClick={handleWithdrawCancel}
                className="mt-3 text-xs text-red-400 hover:text-red-600 underline">
                Kündigung zurückziehen
              </button>
            </div>
          ) : showCancelForm ? (
            <div className="space-y-3">
              <textarea value={cancelNote} onChange={e => setCancelNote(e.target.value)}
                placeholder="Grund (optional)…" rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowCancelForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                  Abbrechen
                </button>
                <button onClick={handleRequestCancel} disabled={cancelRequesting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                  {cancelRequesting ? 'Wird gesendet…' : 'Kündigung senden'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCancelForm(true)}
              className="w-full py-2.5 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 text-sm font-semibold transition-colors">
              Kündigung anfordern
            </button>
          )}
        </div>

        <p className="text-center text-slate-300 text-xs pb-4">Powered by <span className="font-bold italic">Osss</span></p>
      </div>
    </div>
  )
}
