'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'
import { Calendar, CreditCard, Dumbbell, TrendingUp, Clock, CheckCircle, LogOut, BookOpen, Flame, Trophy, QrCode } from 'lucide-react'

interface UpcomingBooking {
  class_id: string
  title: string
  class_type: string
  starts_at: string
  ends_at: string
  instructor: string | null
  booking_status: 'confirmed' | 'waitlist'
}

interface UpcomingClass {
  id: string
  title: string
  class_type: string
  instructor: string | null
  starts_at: string
  ends_at: string
  max_capacity: number | null
  confirmed_count: number
  waitlist_count: number
  my_status: string | null
}

interface TrainingLog {
  id: string
  note: string
  class_type: string | null
  logged_at: string
}

interface MemberData {
  member: {
    id: string; first_name: string; last_name: string; email: string | null
    belt: string; stripes: number; join_date: string; is_active: boolean
    subscription_status: string; date_of_birth: string | null
    contract_end_date?: string | null
  }
  gym: { name: string } | null
  attendance: { id: string; checked_in_at: string; class_type: string }[]
  totalSessions: number
  payments: { id: string; amount_cents: number; status: string; paid_at: string | null; created_at: string; checkout_url: string | null }[]
  totalPaidCents: number
  upcoming_bookings: UpcomingBooking[] | null
}

function calcStats(attendance: { checked_in_at: string }[]) {
  const now = new Date()
  const nowMonth = now.getMonth()
  const nowYear = now.getFullYear()

  const sessionsThisMonth = attendance.filter(a => {
    const d = new Date(a.checked_in_at)
    return d.getMonth() === nowMonth && d.getFullYear() === nowYear
  }).length

  // Monday-based week start
  function startOfWeek(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay() // 0=Sun
    const diff = day === 0 ? -6 : 1 - day
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + diff)
    return d
  }

  // Build a set of week-start timestamps that have at least one session
  const weekSet = new Set<number>()
  for (const a of attendance) {
    const ws = startOfWeek(new Date(a.checked_in_at))
    weekSet.add(ws.getTime())
  }

  // Count consecutive weeks going back from current week
  let streak = 0
  let weekCursor = startOfWeek(now)
  while (weekSet.has(weekCursor.getTime())) {
    streak++
    weekCursor.setDate(weekCursor.getDate() - 7)
  }

  return { sessionsThisMonth, streak }
}

function ContractBanner({ contractEndDate }: { contractEndDate: string }) {
  const end = new Date(contractEndDate)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const formatted = end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (diffDays < 0) {
    return (
      <div className="rounded-2xl px-4 py-3 border border-red-200 bg-red-50 text-red-700 text-sm font-medium">
        Vertrag abgelaufen
      </div>
    )
  }
  if (diffDays <= 30) {
    return (
      <div className="rounded-2xl px-4 py-3 border border-amber-200 bg-amber-50 text-amber-700 text-sm font-medium">
        Vertrag läuft in {diffDays} {diffDays === 1 ? 'Tag' : 'Tagen'} ab
      </div>
    )
  }
  return (
    <div className="rounded-2xl px-4 py-3 border border-green-200 bg-green-50 text-green-700 text-sm font-medium">
      Vertrag gültig bis {formatted}
    </div>
  )
}

const CLASS_TYPE_OPTIONS = ['gi', 'no-gi', 'open mat', 'kids', 'competition']

interface AttendanceState {
  attendanceId: string
  checkedOut: boolean
}

const CLASS_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat', kids: 'Kids', competition: 'Competition',
}

const TYPE_COLORS: Record<string, string> = {
  gi:          'bg-blue-50 text-blue-700',
  'no-gi':     'bg-slate-100 text-slate-600',
  'open mat':  'bg-amber-50 text-amber-700',
  kids:        'bg-green-50 text-green-700',
  competition: 'bg-red-50 text-red-700',
}

const STATUS_COLORS: Record<string, string> = {
  paid:     'bg-green-50 text-green-700 border-green-200',
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  failed:   'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-slate-100 text-slate-500 border-slate-200',
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

function canCheckin(startsAt: string, endsAt: string): boolean {
  const now = Date.now()
  const start = new Date(startsAt).getTime()
  const end = new Date(endsAt).getTime()
  return now >= start - 60 * 60 * 1000 && now <= end
}

export default function MemberPortalPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Classes section
  const [classes, setClasses] = useState<UpcomingClass[]>([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [bookingId, setBookingId] = useState<string | null>(null)

  // Attendance states keyed by class_id
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceState>>({})
  const [checkinLoading, setCheckinLoading] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  // Training log
  const [logs, setLogs] = useState<TrainingLog[]>([])
  const [logNote, setLogNote] = useState('')
  const [logClassType, setLogClassType] = useState('')
  const [logSaving, setLogSaving] = useState(false)

  const loadPortal = useCallback(() => {
    fetch(`/api/portal/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Verbindungsfehler'))
      .finally(() => setLoading(false))
  }, [token])

  const loadClasses = useCallback(() => {
    setClassesLoading(true)
    fetch(`/api/portal/${token}/classes`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setClasses(d) })
      .catch(() => {/* ignore */})
      .finally(() => setClassesLoading(false))
  }, [token])

  const loadLogs = useCallback(() => {
    fetch(`/api/portal/${token}/training-log`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setLogs(d) })
      .catch(() => {/* ignore */})
  }, [token])

  useEffect(() => {
    loadPortal()
    loadClasses()
    loadLogs()
  }, [loadPortal, loadClasses, loadLogs])

  async function handleSaveLog() {
    if (!logNote.trim()) return
    setLogSaving(true)
    await fetch(`/api/portal/${token}/training-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: logNote, class_type: logClassType || null }),
    })
    setLogNote('')
    setLogClassType('')
    await loadLogs()
    setLogSaving(false)
  }

  async function handleBook(classId: string) {
    setBookingId(classId)
    await fetch(`/api/portal/${token}/book/${classId}`, { method: 'POST' })
    setBookingId(null)
    loadClasses()
    loadPortal()
  }

  async function handleCancel(classId: string) {
    setBookingId(classId)
    await fetch(`/api/portal/${token}/book/${classId}`, { method: 'DELETE' })
    setBookingId(null)
    loadClasses()
    loadPortal()
  }

  async function handleCheckin(classId: string) {
    setCheckinLoading(classId)
    const res = await fetch(`/api/portal/${token}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId }),
    })
    const result = await res.json()
    if (result.success && result.attendance_id) {
      setAttendanceMap(prev => ({
        ...prev,
        [classId]: { attendanceId: result.attendance_id, checkedOut: false },
      }))
    }
    setCheckinLoading(null)
  }

  async function handleCheckout(classId: string, attendanceId: string) {
    setCheckoutLoading(classId)
    await fetch(`/api/portal/${token}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId }),
    })
    setAttendanceMap(prev => ({
      ...prev,
      [classId]: { ...prev[classId], checkedOut: true },
    }))
    setCheckoutLoading(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Lädt...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 text-sm">{error || 'Nicht gefunden'}</p>
          <p className="text-slate-400 text-xs mt-2">Bitte kontaktiere dein Gym.</p>
        </div>
      </div>
    )
  }

  const { member, gym, attendance, totalSessions, payments, totalPaidCents } = data
  const { sessionsThisMonth, streak } = calcStats(attendance ?? [])

  const beltColor: Record<string, string> = {
    white: '#e2e8f0', blue: '#3b82f6', purple: '#a855f7', brown: '#92400e', black: '#1e293b',
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-white italic">oss</span>
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm tracking-wide">Osss</p>
              {gym && <p className="text-xs text-slate-400">{gym.name}</p>}
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
            member.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-400 border-slate-200'
          }`}>
            {member.is_active ? 'Aktiv' : 'Inaktiv'}
          </span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 py-6 space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0"
              style={{ backgroundColor: beltColor[member.belt] ?? '#64748b' }}
            >
              {member.first_name[0]}{member.last_name[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{member.first_name} {member.last_name}</h1>
              <div className="mt-1">
                <BeltBadge belt={member.belt as Belt} stripes={member.stripes} />
              </div>
            </div>
          </div>
          {member.email && (
            <p className="text-slate-500 text-sm mt-4 pt-4 border-t border-slate-100">{member.email}</p>
          )}
        </div>

        {/* Contract banner */}
        {member.contract_end_date && (
          <ContractBanner contractEndDate={member.contract_end_date} />
        )}

        {/* QR-Code Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <QrCode size={15} className="text-slate-400" />
            Mein Check-in Code
          </h2>
          <p className="text-slate-400 text-xs mb-4">Am Eingang scannen lassen für schnelles Einchecken</p>
          <div className="flex flex-col items-center">
            <div className="bg-white border-2 border-slate-100 rounded-2xl p-3 shadow-sm">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : 'https://bjjpunkte.vercel.app'}/portal/${token}`)}&color=0f172a&bgcolor=ffffff&margin=10`}
                alt="QR Code"
                width={200}
                height={200}
                className="rounded-lg"
              />
            </div>
            <p className="text-slate-400 text-xs mt-3 text-center">
              Zeige diesen Code am Eingang oder Kiosk
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Calendar size={15} />}
            label="Mitglied seit"
            value={new Date(member.join_date).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
          />
          <StatCard
            icon={<Dumbbell size={15} />}
            label="Gesamt"
            value={String(totalSessions ?? 0)}
          />
          <StatCard
            icon={<Flame size={15} />}
            label="Diesen Monat"
            value={`${sessionsThisMonth}${sessionsThisMonth > 0 ? ' 🔥' : ''}`}
          />
          <StatCard
            icon={<Trophy size={15} />}
            label="Wochen-Streak"
            value={`${streak}${streak >= 4 ? ' 🏆' : ''}`}
          />
        </div>

        {/* Upcoming classes */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Clock size={15} className="text-slate-400" />
            Nächste Trainings
          </h2>

          {classesLoading ? (
            <p className="text-slate-400 text-sm">Lädt…</p>
          ) : classes.length === 0 ? (
            <p className="text-slate-400 text-sm">Keine Trainings in den nächsten Tagen.</p>
          ) : (
            <div className="space-y-3">
              {classes.map(cls => {
                const { date, time } = formatDateTime(cls.starts_at)
                const endTime = new Date(cls.ends_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                const spotsLeft = cls.max_capacity != null ? cls.max_capacity - cls.confirmed_count : null
                const isBooked = cls.my_status === 'confirmed'
                const isWaitlist = cls.my_status === 'waitlist'
                const isLoading = bookingId === cls.id
                const attendanceState = attendanceMap[cls.id]
                const showCheckin = isBooked && canCheckin(cls.starts_at, cls.ends_at) && !attendanceState

                return (
                  <div key={cls.id} className="rounded-xl border border-slate-100 p-4 bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${TYPE_COLORS[cls.class_type] ?? TYPE_COLORS.gi}`}>
                            {CLASS_LABELS[cls.class_type] ?? cls.class_type}
                          </span>
                          {isWaitlist && (
                            <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-amber-50 text-amber-600">
                              Warteliste
                            </span>
                          )}
                        </div>
                        <p className="text-slate-900 text-sm font-semibold">{cls.title}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{date} · {time}–{endTime}</p>
                        {cls.instructor && (
                          <p className="text-slate-400 text-xs">{cls.instructor}</p>
                        )}
                        <p className="text-slate-400 text-xs mt-0.5">
                          {spotsLeft != null
                            ? spotsLeft > 0 ? `${spotsLeft} Plätze frei` : 'Ausgebucht'
                            : `${cls.confirmed_count} Anmeldungen`}
                          {cls.waitlist_count > 0 && ` · ${cls.waitlist_count} auf Warteliste`}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {isBooked ? (
                          <button
                            onClick={() => handleCancel(cls.id)}
                            disabled={isLoading}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium transition-colors disabled:opacity-50"
                          >
                            {isLoading ? '…' : 'Absagen'}
                          </button>
                        ) : isWaitlist ? (
                          <button
                            onClick={() => handleCancel(cls.id)}
                            disabled={isLoading}
                            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors disabled:opacity-50"
                          >
                            {isLoading ? '…' : 'Abmelden'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBook(cls.id)}
                            disabled={isLoading}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-white font-medium transition-colors disabled:opacity-50"
                          >
                            {isLoading ? '…' : 'Zusagen'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Check-in area */}
                    {showCheckin && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <button
                          onClick={() => handleCheckin(cls.id)}
                          disabled={checkinLoading === cls.id}
                          className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={14} />
                          {checkinLoading === cls.id ? 'Einchecken…' : 'Einchecken'}
                        </button>
                      </div>
                    )}

                    {attendanceState && !attendanceState.checkedOut && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-600 font-medium flex items-center gap-1.5">
                            <CheckCircle size={14} />
                            Eingecheckt
                          </span>
                          <button
                            onClick={() => handleCheckout(cls.id, attendanceState.attendanceId)}
                            disabled={checkoutLoading === cls.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <LogOut size={11} />
                            {checkoutLoading === cls.id ? '…' : 'Auschecken'}
                          </button>
                        </div>
                      </div>
                    )}

                    {attendanceState?.checkedOut && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <span className="text-sm text-slate-400 flex items-center gap-1.5">
                          <CheckCircle size={14} />
                          Ausgecheckt
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
            <CreditCard size={15} className="text-slate-400" />
            Zahlungshistorie
          </h2>
          {payments && payments.length > 0 ? (
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
                    <span className="text-slate-400 text-xs">
                      {new Date(p.paid_at ?? p.created_at).toLocaleDateString('de-DE')}
                    </span>
                    {p.status === 'pending' && p.checkout_url && (
                      <a href={p.checkout_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold transition-colors">
                        Jetzt bezahlen
                      </a>
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
            <Dumbbell size={15} className="text-slate-400" />
            Trainingsverlauf
            <span className="text-sm font-normal text-slate-400">({totalSessions ?? 0} gesamt)</span>
          </h2>
          {attendance && attendance.length > 0 ? (
            <div className="space-y-0">
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
                <p className="text-slate-400 text-xs pt-3 text-center">
                  + {(totalSessions ?? 0) - 20} weitere Einträge
                </p>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Noch keine Trainings aufgezeichnet.</p>
          )}
        </div>

        {/* Technik-Logbuch */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen size={15} className="text-slate-400" />
            Technik-Logbuch
          </h2>

          {/* Input form */}
          <div className="space-y-3 mb-5">
            <textarea
              value={logNote}
              onChange={e => setLogNote(e.target.value)}
              placeholder="Was hast du heute gelernt oder geübt?"
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <div className="flex gap-2">
              <select
                value={logClassType}
                onChange={e => setLogClassType(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="">Klasse (optional)</option>
                {CLASS_TYPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{CLASS_LABELS[t] ?? t}</option>
                ))}
              </select>
              <button
                onClick={handleSaveLog}
                disabled={logSaving || !logNote.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {logSaving ? '…' : 'Speichern'}
              </button>
            </div>
          </div>

          {/* Log entries */}
          {logs.length === 0 ? (
            <p className="text-slate-400 text-sm">Noch keine Notizen gespeichert.</p>
          ) : (
            <div className="space-y-3">
              {logs.slice(0, 10).map(log => (
                <div key={log.id} className="rounded-xl border border-slate-100 p-3 bg-slate-50">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-slate-400 text-xs">
                      {new Date(log.logged_at).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}
                      {' · '}
                      {new Date(log.logged_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
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

        <p className="text-center text-slate-300 text-xs pb-4">Powered by <span className="font-bold italic">Osss</span></p>
      </div>
    </div>
  )
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
