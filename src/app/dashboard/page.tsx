'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, TrendingUp, Calendar, Award, Cake, FileWarning } from 'lucide-react'
import Link from 'next/link'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'

interface AttendanceRow { id: string; checked_in_at: string; class_type: string; member_id: string }
interface PromotionRow  { id: string; new_belt: string; new_stripes: number; promoted_at: string; member_id: string }
interface MemberRow     { id: string; first_name: string; last_name: string; belt: string }
interface MemberBirthday { id: string; first_name: string; last_name: string; date_of_birth: string }
interface MemberWithContract { id: string; contract_end_date: string | null }

function upcomingBirthdays(members: MemberBirthday[]) {
  const now = new Date()
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return members
    .filter(m => m.date_of_birth)
    .map(m => {
      const dob = new Date(m.date_of_birth)
      const thisYear = new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
      const nextBirthday = thisYear < now
        ? new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate()) : thisYear
      const age = nextBirthday.getFullYear() - dob.getFullYear()
      return { ...m, nextBirthday, age }
    })
    .filter(m => m.nextBirthday >= now && m.nextBirthday <= in7)
    .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime())
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [totalMembers, setTotalMembers] = useState(0)
  const [activeMembers, setActiveMembers] = useState(0)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow[]>([])
  const [recentPromotions, setRecentPromotions] = useState<PromotionRow[]>([])
  const [beltCounts, setBeltCounts] = useState<Record<string, number>>({})
  const [memberMap, setMemberMap] = useState<Map<string, { first_name: string; last_name: string }>>(new Map())
  const [birthdayMembers, setBirthdayMembers] = useState<ReturnType<typeof upcomingBirthdays>>([])
  const [expiringContracts, setExpiringContracts] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id').single()
      if (!gym) { setLoading(false); return }

      const today = new Date().toISOString().split('T')[0]
      const in30  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const [
        { count: total },
        { count: active },
        { data: rawAttendance },
        { data: rawPromotions },
        { data: beltStats },
        { data: membersList },
        { data: birthdayList },
        { data: contractList },
      ] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gym.id),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gym.id).eq('is_active', true),
        supabase.from('attendance').select('id, checked_in_at, class_type, member_id').eq('gym_id', gym.id).gte('checked_in_at', today).order('checked_in_at', { ascending: false }),
        supabase.from('belt_promotions').select('id, new_belt, new_stripes, promoted_at, member_id').eq('gym_id', gym.id).order('promoted_at', { ascending: false }).limit(5),
        supabase.from('members').select('belt').eq('gym_id', gym.id).eq('is_active', true),
        supabase.from('members').select('id, first_name, last_name').eq('gym_id', gym.id),
        supabase.from('members').select('id, first_name, last_name, date_of_birth').eq('gym_id', gym.id).eq('is_active', true).not('date_of_birth', 'is', null),
        supabase.from('members').select('id, contract_end_date').eq('gym_id', gym.id).eq('is_active', true).not('contract_end_date', 'is', null).lte('contract_end_date', in30),
      ])

      setTotalMembers(total ?? 0)
      setActiveMembers(active ?? 0)
      setTodayAttendance((rawAttendance as AttendanceRow[]) ?? [])
      setRecentPromotions((rawPromotions as PromotionRow[]) ?? [])
      setBeltCounts(((beltStats ?? []) as MemberRow[]).reduce<Record<string, number>>((acc, m) => {
        acc[m.belt] = (acc[m.belt] ?? 0) + 1; return acc
      }, {}))
      setMemberMap(new Map((membersList ?? []).map(m => [m.id, m])))
      setBirthdayMembers(upcomingBirthdays((birthdayList as MemberBirthday[]) ?? []))
      setExpiringContracts(((contractList as MemberWithContract[]) ?? []).length)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Lädt…</div>
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Users size={16} />} label="Aktive Mitglieder" value={activeMembers} color="blue" />
        <StatCard icon={<Users size={16} />} label="Gesamt" value={totalMembers} color="slate" />
        <StatCard icon={<Calendar size={16} />} label="Heute anwesend" value={todayAttendance.length} color="green" />
        <StatCard icon={<FileWarning size={16} />} label="Verträge laufen ab" value={expiringContracts} color="amber" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Belt distribution */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp size={13} /> Belt-Verteilung
          </h2>
          <div className="space-y-3">
            {(['white','blue','purple','brown','black'] as Belt[]).map(belt => (
              <div key={belt} className="flex items-center gap-3">
                <div className="w-20 flex-shrink-0"><BeltBadge belt={belt} stripes={0} /></div>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-amber-400 transition-all"
                    style={{ width: `${activeMembers ? ((beltCounts[belt] ?? 0) / activeMembers) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-slate-500 text-xs w-4 text-right font-medium">{beltCounts[belt] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's training */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={13} /> Heute im Training
            </h2>
            <Link href="/dashboard/attendance" className="text-xs text-amber-600 hover:text-amber-500 font-medium">Alle →</Link>
          </div>
          {todayAttendance.length > 0 ? (
            <div className="space-y-0">
              {todayAttendance.slice(0, 6).map(a => {
                const m = memberMap.get(a.member_id)
                return (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
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

      {/* Birthdays */}
      <div className="mt-4 bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Cake size={13} /> Geburtstage nächste 7 Tage
        </h2>
        {birthdayMembers.length > 0 ? (
          <div className="space-y-2.5">
            {birthdayMembers.map(m => (
              <div key={m.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-amber-600">{m.first_name[0]}{m.last_name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/dashboard/members/${m.id}`} className="text-slate-900 font-medium text-sm hover:text-amber-600 truncate block">
                    {m.first_name} {m.last_name}
                  </Link>
                  <p className="text-slate-400 text-xs">
                    {m.nextBirthday.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex-shrink-0">
                  {m.age} J.
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Keine Geburtstage in den nächsten 7 Tagen.</p>
        )}
      </div>

      {/* Recent promotions */}
      {recentPromotions.length > 0 && (
        <div className="mt-4 bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Award size={13} /> Letzte Graduierungen
          </h2>
          <div className="space-y-2.5">
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
    slate: 'bg-gray-100 text-slate-500',
  }
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
      <div className={`inline-flex p-2 rounded-lg mb-2.5 ${colors[color]}`}>{icon}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-slate-500 text-xs mt-0.5">{label}</div>
    </div>
  )
}
