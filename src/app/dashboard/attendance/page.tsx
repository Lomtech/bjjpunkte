import { createClient } from '@/lib/supabase/server'
import { CheckInForm } from './CheckInForm'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'

interface AttendanceEntry {
  id: string; checked_in_at: string; class_type: string; member_id: string
}

export default async function AttendancePage() {
  const supabase = await createClient()
  const { data: gym } = await supabase.from('gyms').select('id').single()
  if (!gym) return null

  const today = new Date().toISOString().split('T')[0]

  const { data: members } = await supabase
    .from('members').select('id, first_name, last_name, belt, stripes')
    .eq('gym_id', gym.id).eq('is_active', true).order('last_name')

  const { data: rawAttendance } = await supabase
    .from('attendance').select('id, checked_in_at, class_type, member_id')
    .eq('gym_id', gym.id).gte('checked_in_at', today).order('checked_in_at', { ascending: false })

  const todayLog = rawAttendance as AttendanceEntry[] | null
  const memberMap = new Map((members ?? []).map(m => [m.id, m]))
  const checkedInIds = new Set((todayLog ?? []).map(a => a.member_id))

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Anwesenheit</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} · {todayLog?.length ?? 0} Trainings heute
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Einchecken</h2>
          <CheckInForm gymId={gym.id} members={members ?? []} checkedInIds={Array.from(checkedInIds)} />
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">
            Heute anwesend
            <span className="ml-2 text-sm font-normal text-slate-400">({todayLog?.length ?? 0})</span>
          </h2>
          {todayLog && todayLog.length > 0 ? (
            <div className="space-y-1 max-h-[500px] overflow-auto">
              {todayLog.map(a => {
                const m = memberMap.get(a.member_id)
                return (
                  <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 text-xs font-bold">
                        {m?.first_name?.[0]}{m?.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-slate-800 text-sm font-medium">{m?.first_name} {m?.last_name}</p>
                        {m && <BeltBadge belt={m.belt as Belt} stripes={m.stripes} />}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">{new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-slate-400 text-xs capitalize">{a.class_type}</p>
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
