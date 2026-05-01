'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckInForm } from './CheckInForm'
import { BeltBadge } from '@/components/BeltBadge'
import { Trash2, Tablet } from 'lucide-react'
import Link from 'next/link'
import type { Belt } from '@/types/database'

interface AttendanceEntry { id: string; checked_in_at: string; class_type: string; member_id: string }
interface Member         { id: string; first_name: string; last_name: string; belt: string; stripes: number }

export default function AttendancePage() {
  const [loading, setLoading]       = useState(true)
  const [gymId, setGymId]           = useState<string | null>(null)
  const [members, setMembers]       = useState<Member[]>([])
  const [todayLog, setTodayLog]     = useState<AttendanceEntry[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: gym } = await supabase.from('gyms').select('id').single()
    if (!gym) { setLoading(false); return }
    setGymId(gym.id)
    const today = new Date().toISOString().split('T')[0]
    const [{ data: membersData }, { data: rawAttendance }] = await Promise.all([
      supabase.from('members').select('id, first_name, last_name, belt, stripes')
        .eq('gym_id', gym.id).eq('is_active', true).order('last_name'),
      supabase.from('attendance').select('id, checked_in_at, class_type, member_id')
        .eq('gym_id', gym.id).gte('checked_in_at', today).order('checked_in_at', { ascending: false }),
    ])
    setMembers((membersData as Member[]) ?? [])
    setTodayLog((rawAttendance as AttendanceEntry[]) ?? [])
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

  const memberMap    = new Map(members.map(m => [m.id, m]))
  const checkedInIds = todayLog.map(a => a.member_id)

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Lädt…</div>
  if (!gymId) return null

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">Anwesenheit</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} · {todayLog.length} heute
          </p>
        </div>
        <Link href="/dashboard/attendance/kiosk"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex-shrink-0 transition-colors">
          <Tablet size={14} /> Kiosk
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">Einchecken</h2>
          <CheckInForm gymId={gymId} members={members} checkedInIds={checkedInIds} onCheckedIn={() => loadData()} />
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 text-sm mb-4">
            Heute anwesend
            <span className="ml-1.5 text-slate-400 font-normal">({todayLog.length})</span>
          </h2>
          {todayLog.length > 0 ? (
            <div className="space-y-0 max-h-[60vh] overflow-auto">
              {todayLog.map(a => {
                const m = memberMap.get(a.member_id)
                return (
                  <div key={a.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 text-xs font-bold flex-shrink-0">
                        {m?.first_name?.[0]}{m?.last_name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-slate-800 text-sm font-medium truncate">{m?.first_name} {m?.last_name}</p>
                        {m && <BeltBadge belt={m.belt as Belt} stripes={m.stripes} />}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right max-w-[90px]">
                        <p className="text-slate-500 text-xs whitespace-nowrap">{new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-slate-400 text-xs capitalize truncate">{a.class_type}</p>
                      </div>
                      <button onClick={() => deleteAttendance(a.id)} disabled={deletingId === a.id}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all disabled:opacity-40 touch-manipulation"
                        title="Löschen">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Noch niemand eingecheckt.</p>
          )}
        </div>
      </div>
    </div>
  )
}
