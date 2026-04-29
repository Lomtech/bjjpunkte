'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, X, Users, Pencil, RefreshCw } from 'lucide-react'
import { NewClassModal } from './NewClassModal'
import { EditClassModal } from './EditClassModal'

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
  recurrence_parent_id: string | null
  recurrence_type: string
}

interface BookingMember {
  id: string; status: string; member_id: string; member_name: string; belt: string
}

const TYPE_COLORS: Record<string, string> = {
  gi:          'bg-blue-50 text-blue-700 border-blue-200',
  'no-gi':     'bg-gray-100 text-gray-600 border-gray-200',
  'open mat':  'bg-amber-50 text-amber-700 border-amber-200',
  kids:        'bg-green-50 text-green-700 border-green-200',
  competition: 'bg-red-50 text-red-700 border-red-200',
}
const TYPE_DOT: Record<string, string> = {
  gi: 'bg-blue-500', 'no-gi': 'bg-gray-400', 'open mat': 'bg-amber-500',
  kids: 'bg-green-500', competition: 'bg-red-500',
}
const TYPE_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat', kids: 'Kids', competition: 'Competition',
}
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}
function addDays(date: Date, days: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + days); return d
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
function toLocalDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export default function SchedulePage() {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [weekStart, setWeekStart]     = useState<Date>(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date>(today)
  const [classes, setClasses]         = useState<ClassRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [accessToken, setAccessToken] = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [modalDate, setModalDate]     = useState('')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [roster, setRoster]           = useState<BookingMember[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [cancellingId, setCancellingId]   = useState<string | null>(null)
  const [editingClass, setEditingClass]   = useState<ClassRow | null>(null)

  const loadClasses = useCallback(async (token: string, from: Date) => {
    setLoading(true)
    const res = await fetch(`/api/classes?from=${encodeURIComponent(from.toISOString())}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) setClasses(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      const tok = session?.access_token ?? ''
      setAccessToken(tok)
      loadClasses(tok, startOfWeek(new Date()))
    })
  }, [loadClasses])

  useEffect(() => {
    if (accessToken) loadClasses(accessToken, weekStart)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  async function handleCancel(cls: ClassRow) {
    let scope = 'single'
    if (cls.recurrence_parent_id) {
      const choice = window.confirm(
        `"${cls.title}" ist ein Serientermin.\n\nOK = Nur diesen Termin absagen\nAbbrechen = Diesen und alle zukünftigen`
      )
      scope = choice ? 'single' : 'future'
    } else {
      if (!confirm('Klasse wirklich absagen?')) return
    }
    setCancellingId(cls.id)
    await fetch(`/api/classes/${cls.id}?scope=${scope}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
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
      .eq('class_id', classId).neq('status', 'cancelled').order('created_at')
    setRoster((data ?? []).map((b: {
      id: string; status: string; member_id: string
      members: { first_name: string; last_name: string; belt: string } | null
    }) => ({
      id: b.id, status: b.status, member_id: b.member_id,
      member_name: b.members ? `${b.members.first_name} ${b.members.last_name}` : 'Unbekannt',
      belt: b.members?.belt ?? 'white',
    })))
    setRosterLoading(false)
  }

  function toggleExpand(classId: string) {
    if (expandedId === classId) { setExpandedId(null); setRoster([]) }
    else { setExpandedId(classId); loadRoster(classId) }
  }

  function openAddModal(day: Date) {
    setModalDate(toLocalDateString(day)); setShowModal(true)
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekLabel = `${weekStart.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const selectedDayClasses = classes.filter(c => isSameDay(new Date(c.starts_at), selectedDay))

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 py-3 md:px-6 bg-white border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900">Stundenplan</h1>
          <p className="text-slate-400 text-xs mt-0.5 truncate">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => { setWeekStart(w => addDays(w, -7)); setSelectedDay(s => addDays(s, -7)) }}
            className="p-2 rounded-lg border border-gray-200 text-slate-500 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => { setWeekStart(startOfWeek(new Date())); setSelectedDay(today) }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-slate-600 text-xs font-medium hover:bg-gray-50 transition-colors">
            Heute
          </button>
          <button onClick={() => { setWeekStart(w => addDays(w, 7)); setSelectedDay(s => addDays(s, 7)) }}
            className="p-2 rounded-lg border border-gray-200 text-slate-500 hover:bg-gray-50 transition-colors">
            <ChevronRight size={15} />
          </button>
          <button onClick={() => openAddModal(selectedDay)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold transition-colors ml-1">
            <Plus size={14} /> Klasse
          </button>
        </div>
      </div>

      {/* ── Day strip (always visible) ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max md:grid md:grid-cols-7 px-2 md:px-4 gap-1 py-2">
          {weekDays.map((day, idx) => {
            const isToday = isSameDay(day, today)
            const isSel   = isSameDay(day, selectedDay)
            const hasCls  = classes.some(c => isSameDay(new Date(c.starts_at), day))
            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(day)}
                className={`flex flex-col items-center px-4 md:px-2 py-2 rounded-lg transition-colors min-w-[56px] md:min-w-0 ${
                  isSel
                    ? 'bg-amber-500 text-white'
                    : isToday
                      ? 'bg-amber-50 text-amber-700'
                      : 'text-slate-500 hover:bg-gray-50'
                }`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide">{WEEKDAYS[idx]}</span>
                <span className="text-sm font-bold mt-0.5">{day.getDate()}</span>
                {hasCls && !isSel && (
                  <span className="w-1 h-1 rounded-full bg-amber-400 mt-1" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Classes for selected day ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Lädt…</div>
        ) : (
          <>
            {/* Mobile: single-day list */}
            <div className="md:hidden px-4 py-4 space-y-2">
              {selectedDayClasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-slate-400 text-sm mb-3">Kein Training an diesem Tag</p>
                  <button onClick={() => openAddModal(selectedDay)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-slate-400 hover:border-amber-400 hover:text-amber-500 text-sm transition-colors">
                    <Plus size={14} /> Klasse hinzufügen
                  </button>
                </div>
              ) : (
                <>
                  {selectedDayClasses.map(cls => (
                    <ClassCard
                      key={cls.id} cls={cls}
                      expanded={expandedId === cls.id}
                      roster={roster} rosterLoading={rosterLoading}
                      cancellingId={cancellingId}
                      onToggle={() => toggleExpand(cls.id)}
                      onCancel={() => handleCancel(cls)}
                      onEdit={() => { setEditingClass(cls); setExpandedId(null) }}
                    />
                  ))}
                  <button onClick={() => openAddModal(selectedDay)}
                    className="w-full py-2 rounded-lg text-slate-400 hover:text-amber-500 transition-colors text-sm border border-dashed border-gray-200 hover:border-amber-300">
                    + Hinzufügen
                  </button>
                </>
              )}
            </div>

            {/* Desktop: 7-column grid */}
            <div className="hidden md:grid md:grid-cols-7 gap-3 p-4 md:p-6 items-start">
              {weekDays.map((day, idx) => {
                const dayClasses = classes.filter(c => isSameDay(new Date(c.starts_at), day))
                const isToday    = isSameDay(day, today)
                const isSel      = isSameDay(day, selectedDay)
                return (
                  <div key={idx} className={`min-w-0 rounded-xl p-1.5 transition-colors ${isSel || isToday ? 'bg-amber-50/60' : ''}`}>
                    <div className="space-y-2">
                      {dayClasses.length === 0 && (
                        <div className="flex flex-col items-center py-5 text-center">
                          <p className="text-xs text-slate-300 mb-2">Kein Training</p>
                          <button onClick={() => openAddModal(day)}
                            className="text-slate-300 hover:text-amber-400 transition-colors text-sm">
                            <Plus size={16} />
                          </button>
                        </div>
                      )}
                      {dayClasses.map(cls => (
                        <ClassCard
                          key={cls.id} cls={cls}
                          expanded={expandedId === cls.id}
                          roster={roster} rosterLoading={rosterLoading}
                          cancellingId={cancellingId}
                          onToggle={() => toggleExpand(cls.id)}
                          onCancel={() => handleCancel(cls)}
                          onEdit={() => { setEditingClass(cls); setExpandedId(null) }}
                        />
                      ))}
                      {dayClasses.length > 0 && (
                        <button onClick={() => openAddModal(day)}
                          className="w-full py-1.5 rounded-lg text-slate-300 hover:text-amber-400 transition-colors text-xs">
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
        <NewClassModal
          defaultDate={modalDate} accessToken={accessToken}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadClasses(accessToken, weekStart) }}
        />
      )}
      {editingClass && (
        <EditClassModal
          cls={editingClass} accessToken={accessToken}
          onClose={() => setEditingClass(null)}
          onSaved={() => { setEditingClass(null); loadClasses(accessToken, weekStart) }}
        />
      )}
    </div>
  )
}

function ClassCard({
  cls, expanded, roster, rosterLoading, cancellingId,
  onToggle, onCancel, onEdit,
}: {
  cls: ClassRow; expanded: boolean
  roster: BookingMember[]; rosterLoading: boolean; cancellingId: string | null
  onToggle: () => void; onCancel: () => void; onEdit: () => void
}) {
  return (
    <div className={`rounded-lg border bg-white shadow-sm overflow-hidden ${
      cls.is_cancelled ? 'border-gray-200' : 'border-gray-200'
    }`}>
      <button className="w-full text-left p-3" onClick={onToggle}>
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${TYPE_COLORS[cls.class_type] ?? TYPE_COLORS.gi}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_DOT[cls.class_type] ?? TYPE_DOT.gi}`} />
            {TYPE_LABELS[cls.class_type] ?? cls.class_type}
          </span>
          <div className="flex items-center gap-1">
            {cls.recurrence_parent_id && cls.recurrence_type !== 'none' && (
              <RefreshCw size={10} className="text-slate-300 flex-shrink-0" />
            )}
            {cls.is_cancelled && (
              <span className="text-[10px] text-red-400 font-medium">Abgesagt</span>
            )}
          </div>
        </div>
        <p className={`text-slate-900 text-xs font-semibold leading-tight ${cls.is_cancelled ? 'line-through text-slate-400' : ''}`}>
          {cls.title}
        </p>
        <p className="text-slate-400 text-[11px] mt-0.5">{formatTime(cls.starts_at)}–{formatTime(cls.ends_at)}</p>
        {cls.instructor && <p className="text-slate-400 text-[11px] truncate">{cls.instructor}</p>}
        <div className="flex items-center gap-1 mt-1.5 text-slate-400 text-[11px]">
          <Users size={10} />
          <span>{cls.confirmed_count}{cls.max_capacity ? `/${cls.max_capacity}` : ''}</span>
          {cls.waitlist_count > 0 && <span className="text-amber-500">+{cls.waitlist_count} WL</span>}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-3 pb-3 pt-2 bg-gray-50">
          {rosterLoading ? (
            <p className="text-xs text-slate-400">Lädt…</p>
          ) : roster.length === 0 ? (
            <p className="text-xs text-slate-400">Keine Buchungen</p>
          ) : (
            <div className="space-y-1 mb-2 max-h-32 overflow-auto">
              {roster.map(b => (
                <div key={b.id} className="flex items-center justify-between">
                  <p className="text-xs text-slate-700 truncate">{b.member_name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    b.status === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {b.status === 'confirmed' ? '✓' : 'WL'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <button onClick={onEdit}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors">
              <Pencil size={11} /> Bearbeiten
            </button>
            {!cls.is_cancelled && (
              <button onClick={onCancel} disabled={cancellingId === cls.id}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-50">
                <X size={11} /> Absagen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
