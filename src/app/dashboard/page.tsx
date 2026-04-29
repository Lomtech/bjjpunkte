'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, TrendingUp, Calendar, Award } from 'lucide-react'
import Link from 'next/link'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'

interface AttendanceRow { id: string; checked_in_at: string; class_type: string; member_id: string }
interface PromotionRow { id: string; new_belt: string; new_stripes: number; promoted_at: string; member_id: string }
interface MemberRow { id: string; first_name: string; last_name: string; belt: string }

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [totalMembers, setTotalMembers] = useState(0)
  const [activeMembers, setActiveMembers] = useState(0)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow[]>([])
  const [recentPromotions, setRecentPromotions] = useState<PromotionRow[]>([])
  const [beltCounts, setBeltCounts] = useState<Record<string, number>>({})
  const [memberMap, setMemberMap] = useState<Map<string, { first_name: string; last_name: string }>>(new Map())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id, name').single()
      if (!gym) { setLoading(false); return }

      const today = new Date().toISOString().split('T')[0]

      const [
        { count: total },
        { count: active },
        { data: rawAttendance },
        { data: rawPromotions },
        { data: beltStats },
        { data: membersList },
      ] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gym.id),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gym.id).eq('is_active', true),
        supabase.from('attendance').select('id, checked_in_at, class_type, member_id').eq('gym_id', gym.id).gte('checked_in_at', today).order('checked_in_at', { ascending: false }),
        supabase.from('belt_promotions').select('id, new_belt, new_stripes, promoted_at, member_id').eq('gym_id', gym.id).order('promoted_at', { ascending: false }).limit(5),
        supabase.from('members').select('belt').eq('gym_id', gym.id).eq('is_active', true),
        supabase.from('members').select('id, first_name, last_name').eq('gym_id', gym.id),
      ])

      setTotalMembers(total ?? 0)
      setActiveMembers(active ?? 0)
      setTodayAttendance((rawAttendance as AttendanceRow[]) ?? [])
      setRecentPromotions((rawPromotions as PromotionRow[]) ?? [])

      const counts = ((beltStats ?? []) as MemberRow[]).reduce<Record<string, number>>((acc, m) => {
        acc[m.belt] = (acc[m.belt] ?? 0) + 1
        return acc
      }, {})
      setBeltCounts(counts)

      setMemberMap(new Map((membersList ?? []).map(m => [m.id, m])))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Lädt...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users size={18} />} label="Aktive Mitglieder" value={activeMembers} color="blue" />
        <StatCard icon={<Users size={18} />} label="Gesamt" value={totalMembers} color="slate" />
        <StatCard icon={<Calendar size={18} />} label="Heute anwesend" value={todayAttendance.length} color="green" />
        <StatCard icon={<Award size={18} />} label="Letzte Promotions" value={recentPromotions.length} color="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Belt distribution */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-5 flex items-center gap-2 text-sm uppercase tracking-wide text-slate-500">
            <TrendingUp size={14} />
            Belt-Verteilung
          </h2>
          {(['white','blue','purple','brown','black'] as Belt[]).map(belt => (
            <div key={belt} className="flex items-center gap-3 mb-3">
              <div className="w-20 flex-shrink-0"><BeltBadge belt={belt} stripes={0} /></div>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-amber-400"
                  style={{ width: `${activeMembers ? ((beltCounts[belt] ?? 0) / activeMembers) * 100 : 0}%` }}
                />
              </div>
              <span className="text-slate-500 text-sm w-5 text-right font-medium">{beltCounts[belt] ?? 0}</span>
            </div>
          ))}
        </div>

        {/* Today's attendance */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-500 text-sm uppercase tracking-wide flex items-center gap-2">
              <Calendar size={14} />
              Heute im Training
            </h2>
            <Link href="/dashboard/attendance" className="text-xs text-amber-600 hover:text-amber-500 font-medium">
              Alle →
            </Link>
          </div>
          {todayAttendance.length > 0 ? (
            <div className="space-y-1">
              {todayAttendance.slice(0, 6).map(a => {
                const m = memberMap.get(a.member_id)
                return (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-slate-800 text-sm font-medium">{m?.first_name} {m?.last_name}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · {a.class_type}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Noch niemand eingecheckt.</p>
          )}
        </div>
      </div>

      {/* Recent promotions */}
      {recentPromotions.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-500 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
            <Award size={14} />
            Letzte Promotions
          </h2>
          <div className="space-y-3">
            {recentPromotions.map(p => {
              const m = memberMap.get(p.member_id)
              return (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-slate-800 text-sm font-medium">{m?.first_name} {m?.last_name}</span>
                  <div className="flex items-center gap-2">
                    <BeltBadge belt={p.new_belt as Belt} stripes={p.new_stripes} />
                    <span className="text-slate-400 text-xs">{new Date(p.promoted_at).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number
  color: 'blue' | 'green' | 'amber' | 'slate'
}) {
  const colors = {
    blue:  'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-500',
  }
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colors[color]}`}>{icon}</div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      <div className="text-slate-500 text-sm mt-1">{label}</div>
    </div>
  )
}
