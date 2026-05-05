'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ChevronRight, Plus, X, Users, Pencil, RefreshCw, Upload, Trash2, Download } from 'lucide-react'
import { NewClassModal } from './NewClassModal'
import { EditClassModal } from './EditClassModal'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { startOfWeek, addDays } from '@/lib/constants'

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
function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function formatTime(iso: string, locale = 'de-DE') {
  return new Date(iso).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})
}
function toLocalDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function SchedulePage() {
  const { t, lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'
  const WEEKDAYS = lang === 'en'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const TYPE_LABELS: Record<string, string> = {
    gi: t('classType', 'gi'), 'no-gi': t('classType', 'no-gi'),
    'open mat': t('classType', 'open mat'), kids: t('classType', 'kids'),
    competition: t('classType', 'competition'),
  }

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
  // Cancel / delete confirmation modal
  const [cancelTarget, setCancelTarget] = useState<ClassRow | null>(null)
  // Bulk delete
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearStep, setClearStep]           = useState<'confirm' | 'downloading' | 'deleting' | 'done'>('confirm')
  const [clearCount, setClearCount]         = useState(0)

  // Refs so loadClasses can access gymId without stale closure
  const gymIdRef       = useRef('')
  const initializedRef = useRef(false)

  const loadClasses = useCallback(async (from: Date) => {
    const gId = gymIdRef.current
    if (!gId) return
    setLoading(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await supabase.rpc('get_classes_for_gym', {
      p_gym_id: gId,
      p_from: from.toISOString(),
    })
    const rows: ClassRow[] = (data ?? []) as ClassRow[]
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
      const { data: classesData } = await supabase.rpc('get_classes_for_gym', {
        p_gym_id: gId,
        p_from: startOfWeek(new Date()).toISOString(),
      })
      const rows: ClassRow[] = (classesData ?? []) as ClassRow[]
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

  function handleCancel(cls: ClassRow) {
    // Open modal — modal calls doCancel with chosen scope
    setCancelTarget(cls)
    setExpandedId(null)
  }

  async function doCancel(cls: ClassRow, scope: 'single' | 'future' | 'delete_all') {
    setCancelTarget(null)
    setCancellingId(cls.id)
    await fetch(`/api/classes/${cls.id}?scope=${scope}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    })
    setCancellingId(null)
    loadClasses(weekStart)
  }

  async function doClearAll() {
    setClearStep('downloading')
    // 1. Download CSV backup
    const backupRes = await fetch('/api/classes/bulk', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (backupRes.ok) {
      const blob = await backupRes.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a'); a.href = url
      a.download = `stundenplan-backup-${new Date().toISOString().split('T')[0]}.csv`
      a.click(); URL.revokeObjectURL(url)
    }
    // 2. Delete all future classes
    setClearStep('deleting')
    const delRes = await fetch('/api/classes/bulk', {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (delRes.ok) {
      const json = await delRes.json()
      setClearCount(json.deleted ?? 0)
      setClearStep('done')
      loadClasses(weekStart)
    } else {
      setShowClearModal(false)
      setClearStep('confirm')
    }
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
        member_name: b.members ? `${b.members.first_name} ${b.members.last_name}` : (lang === 'en' ? 'Unknown' : 'Unbekannt'),
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
          member_name: a.members ? `${a.members.first_name} ${a.members.last_name}` : (lang === 'en' ? 'Unknown' : 'Unbekannt'),
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
        member_name: lb.leads ? `${lb.leads.first_name} ${lb.leads.last_name}` : t('schedule', 'leads'),
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
  const weekLabel = `${weekStart.toLocaleDateString(locale,{day:'numeric',month:'short'})} – ${addDays(weekStart,6).toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric'})}`

  function openAddModal(day: Date) { setModalDate(toLocalDateString(day)); setShowModal(true) }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 md:px-6 border-b border-zinc-200 bg-white flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-zinc-900">{t('schedule', 'title')}</h1>
          <p className="text-zinc-400 text-xs mt-0.5 hidden sm:block">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setWeekStart(w => addDays(w,-7)); setSelectedDay(s => addDays(s,-7)) }}
            className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => { setWeekStart(startOfWeek(new Date())); setSelectedDay(today) }}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition-colors">
            {t('schedule', 'today')}
          </button>
          <button onClick={() => { setWeekStart(w => addDays(w,7)); setSelectedDay(s => addDays(s,7)) }}
            className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 transition-colors">
            <ChevronRight size={15} />
          </button>
          {gymId && (
            <a href={`/api/schedule/ical?gymId=${gymId}`}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition-colors ml-1"
              title={t('schedule', 'exportIcal')}>
              📅 {t('schedule', 'exportIcal')}
            </a>
          )}
          <Link href="/dashboard/schedule/import"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition-colors">
            <Upload size={13} /> {t('schedule', 'importCsv')}
          </Link>
          <button onClick={() => { setShowClearModal(true); setClearStep('confirm') }}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors">
            <Trash2 size={13} /> {t('schedule', 'delete')}
          </button>
          <button onClick={() => openAddModal(selectedDay)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors ml-1">
            <Plus size={14} /> {t('schedule', 'newClass')}
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
          <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">{t('common', 'loading')}</div>
        ) : (
          <>
            {/* Mobile: single-day list */}
            <div className="md:hidden px-4 py-4 space-y-2">
              {selectedDayClasses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-zinc-400 text-sm mb-3">{t('schedule', 'noClasses')}</p>
                  <button onClick={() => openAddModal(selectedDay)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-zinc-400 hover:border-amber-400 hover:text-amber-600 text-sm transition-colors">
                    <Plus size={14} /> {t('schedule', 'newClass')}
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
                    + {t('schedule', 'newClass')}
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
                          <p className="text-[11px] text-zinc-300 mb-2">{t('schedule', 'noClasses')}</p>
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
                          + {t('schedule', 'newClass')}
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

      {/* Bulk clear modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { if (clearStep === 'confirm' || clearStep === 'done') { setShowClearModal(false); setClearStep('confirm') } }}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>

            {clearStep === 'confirm' && (
              <>
                <div className="px-5 pt-5 pb-4">
                  <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mb-3">
                    <Trash2 size={20} className="text-red-500" />
                  </div>
                  <p className="font-bold text-zinc-900 text-sm mb-1">{t('schedule', 'confirmDelete')}</p>
                  <p className="text-zinc-500 text-sm">
                    {lang === 'en'
                      ? <>All <strong>future</strong> class dates will be permanently deleted.<br />A <strong>CSV backup</strong> will be downloaded automatically — it can be re-imported at any time.</>
                      : <>Alle <strong>zukünftigen</strong> Kurstermine werden unwiderruflich gelöscht.<br />Eine <strong>CSV-Sicherheitskopie</strong> wird automatisch vorher heruntergeladen — sie kann direkt wieder importiert werden.</>
                    }
                  </p>
                </div>
                <div className="px-4 pb-4 space-y-2">
                  <button onClick={doClearAll}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold text-sm transition-colors">
                    <Download size={14} /> {lang === 'en' ? 'Download backup & delete schedule' : 'Backup laden & Stundenplan löschen'}
                  </button>
                  <button onClick={() => setShowClearModal(false)}
                    className="w-full py-2.5 rounded-xl text-zinc-400 text-sm hover:text-zinc-600 transition-colors">
                    {t('common', 'cancel')}
                  </button>
                </div>
              </>
            )}

            {(clearStep === 'downloading' || clearStep === 'deleting') && (
              <div className="px-5 py-8 text-center">
                <div className="w-8 h-8 border-2 border-zinc-200 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-700">
                  {clearStep === 'downloading'
                    ? (lang === 'en' ? 'Downloading backup…' : 'Sicherheitskopie wird heruntergeladen…')
                    : (lang === 'en' ? 'Deleting schedule…' : 'Stundenplan wird gelöscht…')}
                </p>
              </div>
            )}

            {clearStep === 'done' && (
              <>
                <div className="px-5 pt-5 pb-4 text-center">
                  <div className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                    <Download size={20} className="text-green-500" />
                  </div>
                  <p className="font-bold text-zinc-900 text-sm mb-1">
                    {lang === 'en' ? `${clearCount} events deleted` : `${clearCount} Termine gelöscht`}
                  </p>
                  <p className="text-zinc-500 text-sm">
                    {lang === 'en'
                      ? <>The CSV backup is in your downloads folder and can be re-imported at any time via <strong>Import</strong>.</>
                      : <>Die CSV-Sicherheitskopie liegt in deinem Download-Ordner und kann jederzeit über <strong>Import</strong> wieder eingespielt werden.</>
                    }
                  </p>
                </div>
                <div className="px-4 pb-4 space-y-2">
                  <Link href="/dashboard/schedule/import"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors">
                    <Upload size={14} /> {lang === 'en' ? 'Import now' : 'Jetzt neu importieren'}
                  </Link>
                  <button onClick={() => { setShowClearModal(false); setClearStep('confirm') }}
                    className="w-full py-2.5 rounded-xl text-zinc-400 text-sm hover:text-zinc-600 transition-colors">
                    {t('common', 'close')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cancel / Delete confirmation modal */}
      {cancelTarget && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setCancelTarget(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-4">
              <p className="font-bold text-zinc-900 text-sm mb-1">
                {cancelTarget.recurrence_parent_id
                  ? (lang === 'en' ? 'Recurring class' : 'Serientermin')
                  : t('schedule', 'cancel')}
              </p>
              <p className="text-zinc-500 text-sm">
                <span className="font-semibold text-zinc-700">{cancelTarget.title}</span>
                {' — '}
                {new Date(cancelTarget.starts_at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                {', '}
                {formatTime(cancelTarget.starts_at, locale)}
              </p>
            </div>

            <div className="px-4 pb-4 space-y-2">
              {/* Single */}
              <button
                onClick={() => doCancel(cancelTarget, 'single')}
                disabled={cancellingId === cancelTarget.id}
                className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-left group disabled:opacity-50"
              >
                <span className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <X size={13} className="text-amber-600" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-800">{t('schedule', 'cancelThis')}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{lang === 'en' ? 'Stays in the series, marked as cancelled' : 'Bleibt in der Serie, wird als abgesagt markiert'}</p>
                </div>
              </button>

              {/* Future — only for recurring */}
              {cancelTarget.recurrence_parent_id && (
                <button
                  onClick={() => doCancel(cancelTarget, 'future')}
                  disabled={cancellingId === cancelTarget.id}
                  className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors text-left disabled:opacity-50"
                >
                  <span className="w-7 h-7 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X size={13} className="text-orange-500" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{t('schedule', 'cancelAll')}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{lang === 'en' ? 'All from this date onwards will be cancelled' : 'Alle ab diesem Datum werden abgesagt'}</p>
                  </div>
                </button>
              )}

              {/* Delete all series — only for recurring */}
              {cancelTarget.recurrence_parent_id && (
                <button
                  onClick={() => doCancel(cancelTarget, 'delete_all')}
                  disabled={cancellingId === cancelTarget.id}
                  className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 transition-colors text-left disabled:opacity-50"
                >
                  <span className="w-7 h-7 rounded-full bg-red-100 border border-red-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X size={13} className="text-red-600" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-red-700">{t('schedule', 'deleteAll')}</p>
                    <p className="text-xs text-red-400 mt-0.5">{lang === 'en' ? 'All events in this series will be permanently deleted' : 'Alle Termine dieser Serie werden unwiderruflich gelöscht'}</p>
                  </div>
                </button>
              )}

              <button
                onClick={() => setCancelTarget(null)}
                className="w-full py-2.5 rounded-xl text-zinc-400 text-sm hover:text-zinc-600 transition-colors"
              >
                {t('common', 'cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

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
  const { t, lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'
  const TYPE_LABELS: Record<string, string> = {
    gi: t('classType', 'gi'), 'no-gi': t('classType', 'no-gi'),
    'open mat': t('classType', 'open mat'), kids: t('classType', 'kids'),
    competition: t('classType', 'competition'),
  }
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
              <span className="text-[10px] text-red-500 font-semibold uppercase tracking-wide">{t('schedule', 'cancelled')}</span>
            )}
          </div>
        </div>
        <p className={`text-zinc-900 text-xs font-semibold leading-tight ${cls.is_cancelled ? 'line-through text-zinc-400' : ''}`}>
          {cls.title}
        </p>
        <p className="text-zinc-400 text-[11px] mt-0.5 tabular-nums">
          {formatTime(cls.starts_at, locale)} – {formatTime(cls.ends_at, locale)}
        </p>
        {cls.instructor && (
          <p className="text-zinc-400 text-[11px] truncate">{cls.instructor}</p>
        )}
        <div className="flex items-center gap-1.5 mt-1.5 text-zinc-400 text-[11px]">
          <Users size={10} />
          <span>{cls.confirmed_count}{cls.max_capacity ? `/${cls.max_capacity}` : ''}</span>
          {cls.waitlist_count > 0 && (
            <span className="text-amber-600 font-medium">+{cls.waitlist_count} {t('schedule', 'waitlist')}</span>
          )}
          {(cls.lead_count ?? 0) > 0 && (
            <span className="text-violet-600 font-medium">+{cls.lead_count} {t('schedule', 'leads')}</span>
          )}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-zinc-100">

          {/* Roster */}
          <div className="px-3 pt-3 pb-2">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              {t('schedule', 'participants')}
            </p>
            {rosterLoading ? (
              <p className="text-xs text-zinc-400 py-1">{t('common', 'loading')}</p>
            ) : roster.length === 0 ? (
              <p className="text-xs text-zinc-300 py-1">{lang === 'en' ? 'Nobody registered yet.' : 'Noch niemand angemeldet.'}</p>
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
                          {t('schedule', 'leads')}
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                        b.status === 'checked_in'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : b.status === 'confirmed'
                          ? 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {b.status === 'checked_in'
                          ? t('portal', 'checkedInBadge')
                          : b.status === 'confirmed'
                          ? t('portal', 'booked')
                          : t('schedule', 'waitlist')}
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
              <Pencil size={11} /> {t('schedule', 'edit')}
            </button>
            {!cls.is_cancelled && (
              <button onClick={onCancel} disabled={cancellingId === cls.id}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors border border-red-100 disabled:opacity-50">
                <X size={11} /> {t('schedule', 'cancel')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
