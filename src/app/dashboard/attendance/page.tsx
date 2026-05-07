'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BeltBadge } from '@/components/BeltBadge'
import { Trash2, UserCheck, CalendarDays, Clock, AlertTriangle } from 'lucide-react'
import type { Belt } from '@/types/database'
import { type BeltSystem, resolveBeltSystem } from '@/lib/belt-system'
import { readCachedGymId } from '../_components/RoleShell'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface AttendanceEntry {
  id: string
  checked_in_at: string
  class_type: string
  member_id: string
  class_id: string | null
  via_wellpass: boolean | null
  membership_source_at_checkin: string | null
}
interface Member { id: string; first_name: string; last_name: string; belt: string; stripes: number }

interface ClassEvent {
  id: string
  title: string
  class_type: string
  starts_at: string
  ends_at: string
  is_cancelled: boolean
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export default function AttendancePage() {
  const { t, lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'
  const [loading, setLoading]       = useState(true)
  const [gymId, setGymId]           = useState<string | null>(null)
  const [members, setMembers]       = useState<Member[]>([])
  const [todayLog, setTodayLog]     = useState<AttendanceEntry[]>([])
  const [todayClasses, setTodayClasses] = useState<ClassEvent[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [beltSystem, setBeltSystem] = useState<BeltSystem | undefined>(undefined)

  const loadData = useCallback(async () => {
    const supabase = createClient()

    // Get gymId from cache (sync) — if missing, fetch gym first
    const cachedGymId = readCachedGymId()
    let gymId: string | null = cachedGymId

    if (!gymId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: g } = await supabase
        .from('gyms')
        .select('id, class_types, belt_system')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (!g) { setLoading(false); return }
      gymId = g.id
      setBeltSystem(resolveBeltSystem(g.belt_system))
    }

    if (!gymId) { setLoading(false); return }
    setGymId(gymId)

    const today    = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

    // All 4 queries in parallel — gym settings + members + attendance + classes
    try {
      const [gymSettingsRes, membersRes, attendanceRes, classesRes] = await Promise.all([
         
        cachedGymId ? supabase.from('gyms').select('belt_system').eq('id', gymId).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('members')
          .select('id, first_name, last_name, belt, stripes')
          .eq('gym_id', gymId).eq('is_active', true).order('last_name'),
        supabase.from('attendance')
          .select('id, checked_in_at, class_type, member_id, class_id, via_wellpass, membership_source_at_checkin')
          .eq('gym_id', gymId)
          .gte('checked_in_at', today.toISOString())
          .order('checked_in_at', { ascending: false }),
         
        supabase.rpc('get_classes_for_gym', { p_gym_id: gymId, p_from: today.toISOString() }),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (gymSettingsRes.data) setBeltSystem(resolveBeltSystem((gymSettingsRes.data as any).belt_system))
      setMembers(membersRes.data as Member[] ?? [])
      setTodayLog(attendanceRes.data as AttendanceEntry[] ?? [])
      setTodayClasses(
        ((classesRes.data ?? []) as ClassEvent[])
          .filter(c => { const s = new Date(c.starts_at); return s >= today && s < tomorrow && !c.is_cancelled })
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      )
    } catch (err) {
      console.error('Failed to load attendance data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function deleteAttendance(id: string) {
    setDeletingId(id)
    const { data: { session } } = await createClient().auth.getSession()
    const res = await fetch(`/api/attendance/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    if (res.ok) setTodayLog(prev => prev.filter(a => a.id !== id))
    setDeletingId(null)
    setConfirmDeleteId(null)
  }

  const memberMap = new Map(members.map(m => [m.id, m]))

  // Group attendance by class_id (or ungrouped for manual check-ins)
  const byClass = new Map<string | null, AttendanceEntry[]>()
  for (const a of todayLog) {
    const key = a.class_id ?? null
    if (!byClass.has(key)) byClass.set(key, [])
    byClass.get(key)!.push(a)
  }

  // Build display groups: scheduled classes first (in time order), then ungrouped
  const groups: Array<{ classId: string | null; cls: ClassEvent | null; entries: AttendanceEntry[] }> = []
  for (const cls of todayClasses) {
    const entries = byClass.get(cls.id) ?? []
    if (entries.length > 0 || true) { // show all scheduled classes even if empty
      groups.push({ classId: cls.id, cls, entries })
      byClass.delete(cls.id)
    }
  }
  const remaining = byClass.get(null) ?? []
  if (remaining.length > 0) groups.push({ classId: null, cls: null, entries: remaining })

  if (loading) return (
    <div className="p-4 md:p-6 max-w-3xl animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-36 bg-zinc-200 rounded mb-2" />
        <div className="h-3 w-48 bg-zinc-100 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm h-20" />
        <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm h-20" />
      </div>
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-zinc-100 shadow-sm h-32" />
        ))}
      </div>
    </div>
  )
  if (!gymId) return null

  return (
    <div className="p-4 md:p-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">{t('attendance', 'title')}</h1>
          <p className="text-zinc-400 text-xs mt-0.5">
            {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
            {todayLog.length > 0 && ` · ${todayLog.length} ${t('attendance', 'todayLog')}`}
          </p>
        </div>
      </div>

      {/* Stat strip — bei Wellpass-Checkins zusätzliche Spalte für Anbieter-Statistik */}
      {(() => {
        const wellpassCount = todayLog.filter(e => e.via_wellpass === true).length
        const hasWellpass   = wellpassCount > 0
        return (
          <div className={`grid gap-3 mb-6 ${hasWellpass ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <UserCheck size={13} className="text-amber-600" />
                </span>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">{t('common', 'today')}</p>
              </div>
              <p className="text-2xl font-black text-zinc-950 tracking-tight">{todayLog.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <CalendarDays size={13} className="text-amber-600" />
                </span>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">{t('attendance', 'todayClasses')}</p>
              </div>
              <p className="text-2xl font-black text-zinc-950 tracking-tight">{todayClasses.length}</p>
            </div>
            {hasWellpass && (
              <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-600 text-[10px] font-black">W</span>
                  </span>
                  <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-widest" title="Wellpass / Hansefit / EGYM / Urban Sports — heute">
                    Anbieter
                  </p>
                </div>
                <p className="text-2xl font-black text-emerald-700 tracking-tight tabular-nums">{wellpassCount}</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* Attendance grouped by class */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-zinc-100 shadow-sm text-center">
          <p className="text-zinc-400 text-sm">{t('attendance', 'noEntries')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ classId, cls, entries }) => (
            <div key={classId ?? 'manual'} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
              {/* Group header */}
              <div className="px-5 py-3.5 border-b border-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Clock size={13} className="text-amber-600" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-800 truncate">
                      {cls ? cls.title : t('attendance', 'manualCheckin')}
                    </p>
                    {cls && (
                      <p className="text-[11px] text-zinc-400 tabular-nums">
                        {formatTime(cls.starts_at, locale)} – {formatTime(cls.ends_at, locale)}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-400 flex-shrink-0">
                  {entries.length} {t('nav', 'members')}
                </span>
              </div>

              {/* Entries */}
              {entries.length === 0 ? (
                <p className="text-zinc-400 text-sm text-center py-5">{t('attendance', 'noEntries')}</p>
              ) : (
                <div>
                  {entries.map(a => {
                    const m = memberMap.get(a.member_id)
                    return (
                      <div key={a.id} className="flex items-center justify-between px-5 py-3 border-b border-zinc-50 last:border-0 group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 text-xs font-black flex-shrink-0">
                            {m?.first_name?.[0]}{m?.last_name?.[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-zinc-900 text-sm font-semibold truncate">
                              {m?.first_name} {m?.last_name}
                            </p>
                            {m && <BeltBadge belt={m.belt as Belt} stripes={m.stripes} beltSystem={beltSystem} />}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <p className="text-zinc-400 text-xs tabular-nums">
                            {new Date(a.checked_in_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <button
                            onClick={() => setConfirmDeleteId(a.id)}
                            disabled={deletingId === a.id}
                            className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-400 transition-all disabled:opacity-30 min-w-[36px] min-h-[36px] flex items-center justify-center"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => { if (!deletingId) setConfirmDeleteId(null) }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-xs shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-5 text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <h2 className="text-zinc-900 font-bold text-base mb-1">{t('attendance', 'confirmDelete')}</h2>
              <p className="text-zinc-400 text-sm">{t('attendance', 'deleteEntry')}</p>
            </div>
            <div className="flex border-t border-zinc-100">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={!!deletingId}
                className="flex-1 py-3.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50 transition-colors border-r border-zinc-100"
              >
                {t('attendance', 'cancel')}
              </button>
              <button
                onClick={() => deleteAttendance(confirmDeleteId)}
                disabled={!!deletingId}
                className="flex-1 py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deletingId === confirmDeleteId ? `${t('attendance', 'delete')}…` : t('attendance', 'delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
