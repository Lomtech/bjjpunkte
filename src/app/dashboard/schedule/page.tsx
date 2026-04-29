'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, X, Users } from 'lucide-react'
import { NewClassModal } from './NewClassModal'

interface ClassRow {
  id: string
  title: string
  class_type: string
  description: string | null
  instructor: string | null
  starts_at: string
  ends_at: string
  max_capacity: number | null
  is_cancelled: boolean
  confirmed_count: number
  waitlist_count: number
}

interface BookingMember {
  id: string
  status: string
  member_id: string
  member_name: string
  belt: string
}

const TYPE_COLORS: Record<string, string> = {
  gi:          'bg-blue-50 text-blue-700 border-blue-200',
  'no-gi':     'bg-slate-100 text-slate-600 border-slate-200',
  'open mat':  'bg-amber-50 text-amber-700 border-amber-200',
  kids:        'bg-green-50 text-green-700 border-green-200',
  competition: 'bg-red-50 text-red-700 border-red-200',
}

const TYPE_DOT: Record<string, string> = {
  gi:          'bg-blue-500',
  'no-gi':     'bg-slate-400',
  'open mat':  'bg-amber-500',
  kids:        'bg-green-500',
  competition: 'bg-red-500',
}

const TYPE_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat', kids: 'Kids', competition: 'Competition',
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function toLocalDateString(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [accessToken, setAccessToken] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [modalDate, setModalDate] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [roster, setRoster] = useState<BookingMember[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const loadClasses = useCallback(async (token: string, from: Date) => {
    setLoading(true)
    // load 2 weeks ahead so the week view is covered
    const fromIso = from.toISOString()
    const res = await fetch(`/api/classes?from=${encodeURIComponent(fromIso)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setClasses(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      const tok = session?.access_token ?? ''
      setAccessToken(tok)
      // Load classes starting 2 weeks before today to capture current week
      loadClasses(tok, startOfWeek(new Date()))
    })
  }, [loadClasses])

  useEffect(() => {
    if (accessToken) {
      loadClasses(accessToken, weekStart)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  async function handleCancel(classId: string) {
    if (!confirm('Klasse wirklich absagen?')) return
    setCancellingId(classId)
    await fetch(`/api/classes/${classId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    setCancellingId(null)
    setExpandedId(null)
    loadClasses(accessToken, weekStart)
  }

  async function loadRoster(classId: string) {
    setRosterLoading(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('class_bookings')
      .select('id, status, member_id, members(first_name, last_name, belt)')
      .eq('class_id', classId)
      .neq('status', 'cancelled')
      .order('created_at')
    setRoster(
      (data ?? []).map((b: {
        id: string; status: string; member_id: string;
        members: { first_name: string; last_name: string; belt: string } | null
      }) => ({
        id: b.id,
        status: b.status,
        member_id: b.member_id,
        member_name: b.members ? `${b.members.first_name} ${b.members.last_name}` : 'Unbekannt',
        belt: b.members?.belt ?? 'white',
      }))
    )
    setRosterLoading(false)
  }

  function toggleExpand(classId: string) {
    if (expandedId === classId) {
      setExpandedId(null)
      setRoster([])
    } else {
      setExpandedId(classId)
      loadRoster(classId)
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekLabel = `${weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stundenplan</h1>
          <p className="text-slate-500 text-sm mt-0.5">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(w => addDays(w, -7))}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Heute
          </button>
          <button
            onClick={() => setWeekStart(w => addDays(w, 7))}
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => { setModalDate(toLocalDateString(today)); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors ml-2"
          >
            <Plus size={15} />
            Neue Klasse
          </button>
        </div>
      </div>

      {/* Week grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400 text-sm">Lädt…</div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day, idx) => {
            const isToday = isSameDay(day, today)
            const dayClasses = classes.filter(c => {
              const d = new Date(c.starts_at)
              return isSameDay(d, day)
            })

            return (
              <div key={idx} className="min-w-0">
                {/* Day header */}
                <div className={`text-center mb-2 py-1.5 rounded-lg ${isToday ? 'bg-amber-500' : ''}`}>
                  <p className={`text-xs font-medium ${isToday ? 'text-white' : 'text-slate-400'}`}>{WEEKDAYS[idx]}</p>
                  <p className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-900'}`}>
                    {day.getDate()}
                  </p>
                </div>

                {/* Classes */}
                <div className="space-y-2">
                  {dayClasses.length === 0 && (
                    <button
                      onClick={() => { setModalDate(toLocalDateString(day)); setShowModal(true) }}
                      className="w-full py-4 rounded-xl border border-dashed border-slate-200 text-slate-300 hover:border-amber-300 hover:text-amber-400 transition-colors text-xs"
                    >
                      +
                    </button>
                  )}
                  {dayClasses.map(cls => (
                    <div key={cls.id} className={`rounded-xl border ${cls.is_cancelled ? 'opacity-50 border-dashed border-slate-200' : 'border-slate-200'} bg-white shadow-sm overflow-hidden`}>
                      <button
                        className="w-full text-left p-3"
                        onClick={() => toggleExpand(cls.id)}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md border font-medium ${TYPE_COLORS[cls.class_type] ?? TYPE_COLORS.gi}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[cls.class_type] ?? TYPE_DOT.gi}`} />
                            {TYPE_LABELS[cls.class_type] ?? cls.class_type}
                          </span>
                          {cls.is_cancelled && (
                            <span className="text-xs text-red-400 font-medium">Abgesagt</span>
                          )}
                        </div>
                        <p className="text-slate-900 text-xs font-semibold leading-tight truncate">{cls.title}</p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {formatTime(cls.starts_at)}–{formatTime(cls.ends_at)}
                        </p>
                        {cls.instructor && (
                          <p className="text-slate-400 text-xs truncate">{cls.instructor}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1.5 text-slate-500 text-xs">
                          <Users size={10} />
                          <span>{cls.confirmed_count}{cls.max_capacity ? `/${cls.max_capacity}` : ''}</span>
                          {cls.waitlist_count > 0 && (
                            <span className="text-amber-500">+{cls.waitlist_count} WL</span>
                          )}
                        </div>
                      </button>

                      {/* Expanded roster */}
                      {expandedId === cls.id && (
                        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                          {rosterLoading ? (
                            <p className="text-xs text-slate-400">Lädt…</p>
                          ) : roster.length === 0 ? (
                            <p className="text-xs text-slate-400">Keine Buchungen</p>
                          ) : (
                            <div className="space-y-1 mb-2 max-h-32 overflow-auto">
                              {roster.map(b => (
                                <div key={b.id} className="flex items-center justify-between">
                                  <p className="text-xs text-slate-700 truncate">{b.member_name}</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                    b.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {b.status === 'confirmed' ? '✓' : 'WL'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {!cls.is_cancelled && (
                            <button
                              onClick={() => handleCancel(cls.id)}
                              disabled={cancellingId === cls.id}
                              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
                            >
                              <X size={11} />
                              Klasse absagen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {dayClasses.length > 0 && (
                    <button
                      onClick={() => { setModalDate(toLocalDateString(day)); setShowModal(true) }}
                      className="w-full py-1.5 rounded-lg text-slate-300 hover:text-amber-400 transition-colors text-xs"
                    >
                      + Hinzufügen
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <NewClassModal
          defaultDate={modalDate}
          accessToken={accessToken}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false)
            loadClasses(accessToken, weekStart)
          }}
        />
      )}
    </div>
  )
}
