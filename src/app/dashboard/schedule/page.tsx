'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, X, Users, Pencil, RefreshCw } from 'lucide-react'
import { NewClassModal } from './NewClassModal'
import { EditClassModal } from './EditClassModal'

interface ClassRow {
  id: string; title: string; class_type: string; description: string | null
  instructor: string | null; starts_at: string; ends_at: string
  max_capacity: number | null; is_cancelled: boolean
  confirmed_count: number; waitlist_count: number
  recurrence_parent_id: string | null; recurrence_type: string
  lead_count?: number
}

interface BookingMember {
  id: string; status: 'confirmed' | 'waitlist' | 'checked_in'; member_id: string; member_name: string; belt: string
  type: 'member' | 'lead'
}

const TYPE_COLORS: Record<string, string> = {
  gi:          'bg-zinc-100 text-zinc-700 border-zinc-200',
  'no-gi':     'bg-zinc-200 text-zinc-700 border-zinc-300',
  'open mat':  'bg-amber-50 text-amber-700 border-amber-200',
  kids:        'bg-zinc-100 text-zinc-600 border-zinc-200',
  competition: 'bg-zinc-900 text-white border-zinc-900',
}
const TYPE_DOT: Record<string, string> = {
  gi: 'bg-zinc-400', 'no-gi': 'bg-zinc-500', 'open mat': 'bg-amber-500',
  kids: 'bg-zinc-300', competition: 'bg-zinc-900',
}
const TYPE_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat', kids: 'Kids', competition: 'Competition',
}
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function startOfWeek(d: Date): Date {
  const r = new Date(d); const day = r.getDay()
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day)); r.setHours(0,0,0,0); return r
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate()+n); return r }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})
}
function toLocalDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function SchedulePage() {
  const today = new Date(); today.setHours(0,0,0,0)

  const [weekStart, setWeekStart]       = useState<Date>(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay]   = useState<Date>(today)
  const [classes, setClasses]           = useState<ClassRow[]>([])
  const [loading, setLoading]           = useState(true)
  const [accessToken, setAccessToken]   = useState('')
  const [gymId, setGymId]               = useState('')
  const [showModal, setShowModal]       = useState(false)
  const [modalDate, setModalDate]       = useState('')
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [roster, setRoster]             = useState<BookingMember[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [editingClass, setEditingClass] = useState<ClassRow | null>(null)

  // Refs so loadClasses can access gymId without stale closure
  const gymIdRef       = useRef('')
  const initializedRef = useRef(false)

  const loadClasses = useCallback(async (from: Date) => {
    const gId = gymIdRef.current
    if (!gId) return
    setLoading(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).rpc('get_classes_for_gym', {
      p_gym_id: gId,
      p_from: from.toISOString(),
    })
    const rows: ClassRow[] = data ?? []
    const leadCounts = await loadLeadCounts(rows.map(c => c.id))
    setClasses(rows.map(c => ({ ...c, lead_count: leadCounts[c.id] ?? 0 })))
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Initial load: session + gym + classes + members all in parallel
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      // Batch 1: session and gym in parallel
      const [{ data: { session } }, { data: gym }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('gyms').select('id').single(),
      ])
      const tok = session?.access_token ?? ''
      setAccessToken(tok)
      if (!gym) { setLoading(false); return }
      const gId = (gym as { id: string }).id
      gymIdRef.current = gId
      setGymId(gId)
      // Batch 2: classes and lead counts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: classesData } = await (supabase as any).rpc('get_classes_for_gym', {
        p_gym_id: gId,
        p_from: startOfWeek(new Date()).toISOString(),
      })
      const rows: ClassRow[] = classesData ?? []
      const leadCounts = await loadLeadCounts(rows.map(c => c.id))
      setClasses(rows.map(c => ({ ...c, lead_count: leadCounts[c.id] ?? 0 })))
      setLoading(false)
      initializedRef.current = true
    }
    init()
  }, []) // run once

  // Reload when week changes (skip first run — init already loaded)
  useEffect(() => {
    if (!initializedRef.current) return
    loadClasses(weekStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  async function handleCancel(cls: ClassRow) {
    let scope = 'single'
    if (cls.recurrence_parent_id) {
      const choice = window.confirm(`"${cls.title}" ist ein Serientermin.\n\nOK = Nur diesen Termin absagen\nAbbrechen = Diesen und alle zukünftigen`)
      scope = choice ? 'single' : 'future'
    } else {
      if (!confirm('Klasse wirklich absagen?')) return
    }
    setCancellingId(cls.id)
    await fetch(`/api/classes/${cls.id}?scope=${scope}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    })
    setCancellingId(null); setExpandedId(null)
    loadClasses(weekStart)
  }

  async function loadLeadCounts(classIds: string[]): Promise<Record<string, number>> {
    if (classIds.length === 0) return {}
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('lead_bookings')
      .select('class_id')
      .in('class_id', classIds)
      .neq('status', 'cancelled')
    const countMap: Record<string, number> = {}
    for (const lb of (data ?? []) as { class_id: string }[]) {
      countMap[lb.class_id] = (countMap[lb.class_id] ?? 0) + 1
    }
    return countMap
  }

  async function loadRoster(classId: string) {
    setRosterLoading(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [{ data: bookingsData }, { data: attendanceData }, { data: leadBookingsData }] = await Promise.all([
      (supabase as any)
        .from('class_bookings')
        .select('id, status, member_id, members(first_name, last_name, belt)')
        .eq('class_id', classId).neq('status', 'cancelled').order('created_at'),
      (supabase as any)
        .from('attendance')
        .select('id, member_id, members(first_name, last_name, belt)')
        .eq('class_id', classId),
      (supabase as any)
        .from('lead_bookings')
        .select('id, status, lead_id, leads(first_name, last_name)')
        .eq('class_id', classId).neq('status', 'cancelled').order('booked_at'),
    ])

    type RawBooking = { id: string; status: string; member_id: string; members: { first_name: string; last_name: string; belt: string } | null }
    type RawAttendance = { id: string; member_id: string; members: { first_name: string; last_name: string; belt: string } | null }
    type RawLeadBooking = { id: string; status: string; lead_id: string; leads: { first_name: string; last_name: string } | null }

    const memberMap = new Map<string, BookingMember>()
    for (const b of (bookingsData ?? []) as RawBooking[]) {
      memberMap.set(b.member_id, {
        id: b.id, status: b.status as BookingMember['status'], member_id: b.member_id,
        member_name: b.members ? `${b.members.first_name} ${b.members.last_name}` : 'Unbekannt',
        belt: b.members?.belt ?? 'white',
        type: 'member',
      })
    }
    for (const a of (attendanceData ?? []) as RawAttendance[]) {
      const existing = memberMap.get(a.member_id)
      if (existing) {
        existing.status = 'checked_in'
      } else {
        memberMap.set(a.member_id, {
          id: a.id, status: 'checked_in', member_id: a.member_id,
          member_name: a.members ? `${a.members.first_name} ${a.members.last_name}` : 'Unbekannt',
          belt: a.members?.belt ?? 'white',
          type: 'member',
        })
      }
    }
    for (const lb of (leadBookingsData ?? []) as RawLeadBooking[]) {
      memberMap.set(`lead_${lb.lead_id}`, {
        id: lb.id,
        status: lb.status === 'checked_in' ? 'checked_in' : 'confirmed',
        member_id: lb.lead_id,
        member_name: lb.leads ? `${lb.leads.first_name} ${lb.leads.last_name}` : 'Interessent',
        belt: 'white',
        type: 'lead',
      })
    }
    setRoster(Array.from(memberMap.values()))
    setRosterLoading(false)
  }

  function toggleExpand(classId: string) {
    if (expandedId === classId) {
      setExpandedId(null); setRoster([])
    } else {
      setExpandedId(classId); loadRoster(classId)
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const selectedDayClasses = classes.filter(c => isSameDay(new Date(c.starts_at), selectedDay))
  const weekLabel = `${weekStart.toLocaleDateString('de-DE',{day:'numeric',month:'short'})} – ${addDays(weekStart,6).toLocaleDateString('de-DE',{day:'numeric',month:'short',year:'numeric'})}`

  function openAddModal(day: Date) { setModalDate(toLocalDateString(day)); setShowModal(true) }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 md:px-6 border-b border-zinc-200 bg-white flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-zinc-900">Stundenplan</h1>
          <p className="text-zinc-400 text-xs mt-0.5 hidden sm:block">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setWeekStart(w => addDays(w,-7)); setSelectedDay(s => addDays(s,-7)) }}
            className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => { setWeekStart(startOfWeek(new Date())); setSelectedDay(today) }}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition-colors">
            Heute
          </button>
          <button onClick={() => { setWeekStart(w => addDays(w,7)); setSelectedDay(s => addDays(s,7)) }}
            className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
            <ChevronRight size={15} />
          </button>
          {gymId && (
            <a href={`/api/schedule/ical?gymId=${gymId}`}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition-colors ml-1"
              title="Stundenplan als iCal exportieren">
              📅 iCal-Export
            </a>
          )}
          <button onClick={() => openAddModal(selectedDay)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors ml-1">
            <Plus size={14} /> Klasse
          </button>
        </div>
      </div>

      {/* Day strip */}
      <div className="flex-shrink-0 border-b border-zinc-200 bg-white overflow-x-auto">
        <div className="flex min-w-max md:grid md:grid-cols-7 px-2 md:px-4 gap-1 py-2">
          {weekDays.map((day, idx) => {
            const isToday = isSameDay(day, today)
            const isSel   = isSameDay(day, selectedDay)
            const hasCls  = classes.some(c => isSameDay(new Date(c.starts_at), day))
            return (
              <button key={idx} onClick={() => setSelectedDay(day)}
                className={`flex flex-col items-center px-4 md:px-2 py-2 rounded-lg transition-colors min-w-[56px] md:min-w-0 ${
                  isSel ? 'bg-amber-600 text-white' : isToday ? 'bg-amber-50 text-amber-700' : 'text-zinc-500 hover:bg-zinc-50'
                }`}>
                <span className="text-[10px] font-medium uppercase tracking-wide">{WEEKDAYS[idx]}</span>
                <span className="text-sm font-bold mt-0.5">{day.getDate()}</span>
                {hasCls && !isSel && <span className="w-1 h-1 rounded-full bg-amber-500 mt-1" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">Lädt…</div>
        ) : (
          <>
            {/* Mobile: single-day list */}
            <div className="md:hidden px-4 py-4 space-y-2">
              {selectedDayClasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-zinc-400 text-sm mb-3">Kein Training an diesem Tag</p>
                  <button onClick={() => openAddModal(selectedDay)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-zinc-400 hover:border-amber-400 hover:text-amber-600 text-sm transition-colors">
                    <Plus size={14} /> Klasse hinzufügen
                  </button>
                </div>
              ) : (
                <>
                  {selectedDayClasses.map(cls => (
                    <ClassCard key={cls.id} cls={cls}
                      expanded={expandedId === cls.id}
                      roster={roster} rosterLoading={rosterLoading}
                      cancellingId={cancellingId}
                      isToday={isSameDay(new Date(cls.starts_at), today)}
                      onToggle={() => toggleExpand(cls.id)}
                      onCancel={() => handleCancel(cls)}
                      onEdit={() => { setEditingClass(cls); setExpandedId(null) }}
                    />
                  ))}
                  <button onClick={() => openAddModal(selectedDay)}
                    className="w-full py-2 rounded-lg text-zinc-400 hover:text-amber-600 text-sm border border-dashed border-zinc-200 hover:border-amber-300 transition-colors">
                    + Hinzufügen
                  </button>
                </>
              )}
            </div>

            {/* Desktop: 7-column grid */}
            <div className="hidden md:grid md:grid-cols-7 gap-2 p-4 items-start">
              {weekDays.map((day, idx) => {
                const dayClasses = classes.filter(c => isSameDay(new Date(c.starts_at), day))
                const isSel      = isSameDay(day, selectedDay)
                return (
                  <div key={idx} className={`min-w-0 rounded-lg p-1.5 transition-colors ${isSel ? 'bg-amber-50/60 ring-1 ring-amber-200' : ''}`}>
                    <div className="space-y-1.5">
                      {dayClasses.length === 0 && (
                        <div className="flex flex-col items-center py-6">
                          <p className="text-[11px] text-zinc-300 mb-2">Kein Training</p>
                          <button onClick={() => openAddModal(day)}
                            className="text-zinc-300 hover:text-amber-500 transition-colors">
                            <Plus size={15} />
                          </button>
                        </div>
                      )}
                      {dayClasses.map(cls => (
                        <ClassCard key={cls.id} cls={cls}
                          expanded={expandedId === cls.id}
                          roster={roster} rosterLoading={rosterLoading}
                          cancellingId={cancellingId}
                          isToday={isSameDay(new Date(cls.starts_at), today)}
                          onToggle={() => toggleExpand(cls.id)}
                          onCancel={() => handleCancel(cls)}
                          onEdit={() => { setEditingClass(cls); setExpandedId(null) }}
                        />
                      ))}
                      {dayClasses.length > 0 && (
                        <button onClick={() => openAddModal(day)}
                          className="w-full py-1 rounded text-zinc-300 hover:text-amber-500 transition-colors text-xs">
                          + Hinzufügen
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <NewClassModal defaultDate={modalDate} accessToken={accessToken}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadClasses(weekStart) }}
        />
      )}
      {editingClass && (
        <EditClassModal cls={editingClass} accessToken={accessToken}
          onClose={() => setEditingClass(null)}
          onSaved={() => { setEditingClass(null); loadClasses(weekStart) }}
        />
      )}
    </div>
  )
}

// ─── ClassCard ────────────────────────────────────────────────────────────────

function ClassCard({
  cls, expanded, roster, rosterLoading, cancellingId, isToday,
  onToggle, onCancel, onEdit,
}: {
  cls: ClassRow; expanded: boolean; isToday: boolean
  roster: BookingMember[]; rosterLoading: boolean; cancellingId: string | null
  onToggle: () => void; onCancel: () => void; onEdit: () => void
}) {
  const now = new Date()
  const isLive = isToday && new Date(cls.starts_at) <= now && new Date(cls.ends_at) >= now

  return (
    <div className={`rounded-xl border bg-white overflow-hidden transition-all shadow-sm ${
      cls.is_cancelled ? 'border-zinc-200 opacity-60' : 'border-zinc-100'
    }`}>
      {/* Card header */}
      <button className="w-full text-left p-3 hover:bg-zinc-50/80 transition-colors" onClick={onToggle}>
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide ${TYPE_COLORS[cls.class_type] ?? TYPE_COLORS.gi}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_DOT[cls.class_type] ?? TYPE_DOT.gi}`} />
            {TYPE_LABELS[cls.class_type] ?? cls.class_type}
          </span>
          <div className="flex items-center gap-1.5">
            {isLive && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
            {cls.recurrence_parent_id && cls.recurrence_type !== 'none' && (
              <RefreshCw size={10} className="text-zinc-300" />
            )}
            {cls.is_cancelled && (
              <span className="text-[10px] text-red-500 font-semibold uppercase tracking-wide">Abgesagt</span>
            )}
          </div>
        </div>
        <p className={`text-zinc-900 text-xs font-semibold leading-tight ${cls.is_cancelled ? 'line-through text-zinc-400' : ''}`}>
          {cls.title}
        </p>
        <p className="text-zinc-400 text-[11px] mt-0.5 tabular-nums">
          {formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}
        </p>
        {cls.instructor && (
          <p className="text-zinc-400 text-[11px] truncate">{cls.instructor}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5 text-zinc-400 text-[11px]">
          <Users size={10} />
          <span>{cls.confirmed_count}{cls.max_capacity ? `/${cls.max_capacity}` : ''}</span>
          {cls.waitlist_count > 0 && (
            <span className="text-amber-600 font-medium">+{cls.waitlist_count} WL</span>
          )}
          {(cls.lead_count ?? 0) > 0 && (
            <span className="text-violet-600 font-medium">+{cls.lead_count} Int.</span>
          )}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-zinc-100">

          {/* Roster */}
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Teilnehmer
            </p>
            {rosterLoading ? (
              <p className="text-xs text-zinc-400 py-1">Lädt…</p>
            ) : roster.length === 0 ? (
              <p className="text-xs text-zinc-300 py-1">Noch niemand angemeldet.</p>
            ) : (
              <div className="space-y-2">
                {roster.map(b => (
                  <div key={b.id} className="flex flex-col gap-0.5">
                    <p className="text-xs font-semibold text-zinc-800 leading-tight break-words">
                      {b.member_name}
                    </p>
                    <div className="flex items-center gap-1 flex-wrap">
                      {b.type === 'lead' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                          Interessent
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                        b.status === 'checked_in'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : b.status === 'confirmed'
                          ? 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {b.status === 'checked_in' ? 'Eingecheckt' : b.status === 'confirmed' ? 'Angemeldet' : 'Warteliste'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-3 pb-3 pt-2 border-t border-zinc-100 space-y-1.5 mt-1">
            <button onClick={onEdit}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-zinc-600 bg-zinc-50 hover:bg-zinc-100 transition-colors border border-zinc-200">
              <Pencil size={11} /> Bearbeiten
            </button>
            {!cls.is_cancelled && (
              <button onClick={onCancel} disabled={cancellingId === cls.id}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors border border-red-100 disabled:opacity-50">
                <X size={11} /> Absagen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
