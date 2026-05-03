'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BeltBadge } from '@/components/BeltBadge'
import { Trash2, UserCheck, CalendarDays, Clock } from 'lucide-react'
import type { Belt } from '@/types/database'
import { type BeltSystem, resolveBeltSystem } from '@/lib/belt-system'

interface AttendanceEntry {
  id: string
  checked_in_at: string
  class_type: string
  member_id: string
  class_id: string | null
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

export default function AttendancePage() {
  const [loading, setLoading]       = useState(true)
  const [gymId, setGymId]           = useState<string | null>(null)
  const [members, setMembers]       = useState<Member[]>([])
  const [todayLog, setTodayLog]     = useState<AttendanceEntry[]>([])
  const [todayClasses, setTodayClasses] = useState<ClassEvent[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [beltSystem, setBeltSystem] = useState<BeltSystem | undefined>(undefined)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    // Single server-side call — eliminates sequential client→Supabase trips
    const res = await fetch('/api/dashboard/attendance-data', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) { setLoading(false); return }
    const d = await res.json()

    setGymId(d.gym.id)
    setBeltSystem(resolveBeltSystem(d.gym.belt_system))
    setMembers(d.members as Member[])
    setTodayLog(d.attendance as AttendanceEntry[])
    setTodayClasses(
      (d.classes as ClassEvent[]).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    )
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function deleteAttendance(id: string) {
    if (!confirm('Eintrag wirklich löschen?')) return
    setDeletingId(id)
    const { data: { session } } = await createClient().auth.getSession()
    const res = await fetch(`/api/attendance/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    if (res.ok) setTodayLog(prev => prev.filter(a => a.id !== id))
    setDeletingId(null)
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
    <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Lädt…</div>
  )
  if (!gymId) return null

  return (
    <div className="p-4 md:p-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Anwesenheit</h1>
          <p className="text-zinc-400 text-xs mt-0.5">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            {todayLog.length > 0 && ` · ${todayLog.length} eingecheckt`}
          </p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <UserCheck size={13} className="text-amber-600" />
            </span>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Heute</p>
          </div>
          <p className="text-2xl font-black text-zinc-950 tracking-tight">{todayLog.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <CalendarDays size={13} className="text-amber-600" />
            </span>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Klassen</p>
          </div>
          <p className="text-2xl font-black text-zinc-950 tracking-tight">{todayClasses.length}</p>
        </div>
      </div>

      {/* Attendance grouped by class */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-zinc-100 shadow-sm text-center">
          <p className="text-zinc-400 text-sm">Heute noch niemand eingecheckt.</p>
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
                      {cls ? cls.title : 'Manuell'}
                    </p>
                    {cls && (
                      <p className="text-[11px] text-zinc-400 tabular-nums">
                        {formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold text-zinc-400 flex-shrink-0">
                  {entries.length} {entries.length === 1 ? 'Person' : 'Personen'}
                </span>
              </div>

              {/* Entries */}
              {entries.length === 0 ? (
                <p className="text-zinc-400 text-sm text-center py-5">Noch niemand eingecheckt.</p>
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
                            {new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <button
                            onClick={() => deleteAttendance(a.id)}
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
    </div>
  )
}
