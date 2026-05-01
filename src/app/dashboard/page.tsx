'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, TrendingUp, Calendar, Award, Cake, FileWarning,
  Euro, CheckCircle2, Clock, AlertCircle, ChevronRight, Zap,
} from 'lucide-react'
import Link from 'next/link'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'

interface AttendanceRow   { id: string; checked_in_at: string; class_type: string; member_id: string }
interface PromotionRow    { id: string; new_belt: string; new_stripes: number; promoted_at: string; member_id: string }
interface MemberBirthday  { id: string; first_name: string; last_name: string; date_of_birth: string }
interface PaymentRow      { id: string; member_id: string; amount_cents: number; paid_at: string | null; status: string }

function formatCents(c: number) {
  return (c / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function upcomingBirthdays(members: MemberBirthday[]) {
  const now   = new Date()
  const in7   = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return members
    .filter(m => m.date_of_birth)
    .map(m => {
      const dob         = new Date(m.date_of_birth)
      const thisYear    = new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
      const nextBirthday = thisYear < now
        ? new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate()) : thisYear
      const age = nextBirthday.getFullYear() - dob.getFullYear()
      return { ...m, nextBirthday, age }
    })
    .filter(m => m.nextBirthday >= now && m.nextBirthday <= in7)
    .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime())
}

export default function DashboardPage() {
  const [loading, setLoading]               = useState(true)
  const [totalMembers, setTotalMembers]     = useState(0)
  const [activeMembers, setActiveMembers]   = useState(0)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRow[]>([])
  const [recentPromotions, setRecentPromotions] = useState<PromotionRow[]>([])
  const [beltCounts, setBeltCounts]         = useState<Record<string, number>>({})
  const [memberMap, setMemberMap]           = useState<Map<string, { first_name: string; last_name: string }>>(new Map())
  const [birthdayMembers, setBirthdayMembers] = useState<ReturnType<typeof upcomingBirthdays>>([])
  const [expiringContracts, setExpiringContracts] = useState(0)
  const [monthRevenue, setMonthRevenue]     = useState(0)
  const [recentPayments, setRecentPayments] = useState<PaymentRow[]>([])
  const [topAttenders, setTopAttenders]     = useState<{ member_id: string; count: number }[]>([])
  const [memberPayStatus, setMemberPayStatus] = useState<Map<string, 'paid' | 'pending' | 'never'>>(new Map())

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id').single()
      if (!gym) { setLoading(false); return }

      const today        = new Date().toISOString().split('T')[0]
      const in30         = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [
        { count: total },
        { count: active },
        { data: rawAttendance },
        { data: rawPromotions },
        { data: beltStats },
        { data: membersList },
        { data: birthdayList },
        { data: contractList },
        { data: monthPayments },
        { data: allPayments },
        { data: monthAttendance },
      ] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gym.id),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gym.id).eq('is_active', true),
        supabase.from('attendance').select('id, checked_in_at, class_type, member_id').eq('gym_id', gym.id).gte('checked_in_at', today).order('checked_in_at', { ascending: false }),
        supabase.from('belt_promotions').select('id, new_belt, new_stripes, promoted_at, member_id').eq('gym_id', gym.id).order('promoted_at', { ascending: false }).limit(5),
        supabase.from('members').select('belt').eq('gym_id', gym.id).eq('is_active', true),
        supabase.from('members').select('id, first_name, last_name').eq('gym_id', gym.id),
        supabase.from('members').select('id, first_name, last_name, date_of_birth').eq('gym_id', gym.id).eq('is_active', true).not('date_of_birth', 'is', null),
        supabase.from('members').select('id, contract_end_date').eq('gym_id', gym.id).eq('is_active', true).not('contract_end_date', 'is', null).lte('contract_end_date', in30),
        supabase.from('payments').select('amount_cents').eq('gym_id', gym.id).eq('status', 'paid').gte('paid_at', startOfMonth),
        supabase.from('payments').select('id, member_id, amount_cents, paid_at, status').eq('gym_id', gym.id).order('paid_at', { ascending: false }).limit(20),
        supabase.from('attendance').select('member_id').eq('gym_id', gym.id).gte('checked_in_at', startOfMonth),
      ])

      setTotalMembers(total ?? 0)
      setActiveMembers(active ?? 0)
      setTodayAttendance((rawAttendance as AttendanceRow[]) ?? [])
      setRecentPromotions((rawPromotions as PromotionRow[]) ?? [])
      setBeltCounts(((beltStats ?? []) as { belt: string }[]).reduce<Record<string, number>>((acc, m) => {
        acc[m.belt] = (acc[m.belt] ?? 0) + 1; return acc
      }, {}))

      const mMap = new Map((membersList ?? []).map(m => [m.id, m]))
      setMemberMap(mMap)
      setBirthdayMembers(upcomingBirthdays((birthdayList as MemberBirthday[]) ?? []))
      setExpiringContracts(((contractList ?? []) as { id: string }[]).length)

      // Revenue this month
      const mPay = (monthPayments ?? []) as { amount_cents: number }[]
      setMonthRevenue(mPay.reduce((s, p) => s + p.amount_cents, 0))

      // Recent paid payments
      const allPay = ((allPayments ?? []) as PaymentRow[]).filter(p => p.status === 'paid' && p.paid_at)
      setRecentPayments(allPay.slice(0, 6))

      // Payment status per member
      const payStatusMap = new Map<string, 'paid' | 'pending' | 'never'>()
      for (const p of (allPayments ?? []) as PaymentRow[]) {
        if (!payStatusMap.has(p.member_id) && p.status === 'paid' && p.paid_at) {
          const status = p.paid_at >= thirtyDaysAgo ? 'paid' : 'pending'
          payStatusMap.set(p.member_id, status)
        }
      }
      setMemberPayStatus(payStatusMap)

      // Top attenders this month
      const countMap = new Map<string, number>()
      for (const row of (monthAttendance ?? []) as { member_id: string }[]) {
        countMap.set(row.member_id, (countMap.get(row.member_id) ?? 0) + 1)
      }
      const sorted = Array.from(countMap.entries())
        .map(([member_id, count]) => ({ member_id, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
      setTopAttenders(sorted)

      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Lädt…
      </div>
    )
  }

  const paidCount    = Array.from(memberPayStatus.values()).filter(s => s === 'paid').length
  const pendingCount = Array.from(memberPayStatus.values()).filter(s => s === 'pending').length

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Users size={16} />}        label="Aktive Mitglieder"  value={activeMembers}                color="blue" />
        <StatCard icon={<Calendar size={16} />}     label="Heute im Training"  value={todayAttendance.length}       color="green" />
        <StatCard icon={<Euro size={16} />}         label={`${new Date().toLocaleDateString('de-DE', { month: 'long' })}`} valueCents={monthRevenue} color="amber" />
        <StatCard icon={<FileWarning size={16} />}  label="Verträge laufen ab" value={expiringContracts}            color={expiringContracts > 0 ? 'red' : 'slate'} />
      </div>

      {/* Payment health bar */}
      {activeMembers > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Zahlungsstatus · Aktive Mitglieder</p>
            <Link href="/dashboard/revenue" className="text-xs text-amber-600 hover:text-amber-500 font-medium">Details →</Link>
          </div>
          <div className="flex rounded-full overflow-hidden h-2.5 bg-gray-100 mb-2.5">
            {paidCount    > 0 && <div className="bg-green-400 transition-all" style={{ width: `${(paidCount / activeMembers) * 100}%` }} />}
            {pendingCount > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(pendingCount / activeMembers) * 100}%` }} />}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
              Bezahlt <span className="font-semibold text-slate-700">{paidCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
              Ausstehend <span className="font-semibold text-slate-700">{pendingCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-200 flex-shrink-0" />
              Nie bezahlt <span className="font-semibold text-slate-700">{activeMembers - paidCount - pendingCount}</span>
            </span>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">

        {/* Recent payments */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Euro size={13} /> Letzte Zahlungen
            </h2>
            <Link href="/dashboard/revenue" className="text-xs text-amber-600 hover:text-amber-500 font-medium">Alle →</Link>
          </div>
          {recentPayments.length > 0 ? (
            <div className="space-y-0">
              {recentPayments.map(p => {
                const m = memberMap.get(p.member_id)
                return (
                  <Link key={p.id} href={`/dashboard/members/${p.member_id}`}
                    className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={13} className="text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {m ? `${m.first_name} ${m.last_name}` : '–'}
                      </p>
                      <p className="text-xs text-slate-400">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '–'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 flex-shrink-0">{formatCents(p.amount_cents)}</span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Noch keine Zahlungen.</p>
          )}
        </div>

        {/* Today's training */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Calendar size={13} /> Heute im Training
            </h2>
            <Link href="/dashboard/attendance" className="text-xs text-amber-600 hover:text-amber-500 font-medium">Check-in →</Link>
          </div>
          {todayAttendance.length > 0 ? (
            <div className="space-y-0">
              {todayAttendance.slice(0, 7).map(a => {
                const m = memberMap.get(a.member_id)
                const payStatus = memberPayStatus.get(a.member_id)
                return (
                  <Link key={a.id} href={`/dashboard/members/${a.member_id}`}
                    className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 text-amber-600 text-[11px] font-bold">
                      {m?.first_name?.[0]}{m?.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {m ? `${m.first_name} ${m.last_name}` : '–'}
                      </p>
                      <p className="text-xs text-slate-400 truncate capitalize">{a.class_type}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {payStatus === 'paid'    && <CheckCircle2 size={12} className="text-green-400" />}
                      {payStatus === 'pending' && <Clock size={12} className="text-amber-400" />}
                      {!payStatus             && <AlertCircle size={12} className="text-red-300" />}
                      <span className="text-xs text-slate-400">
                        {new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </Link>
                )
              })}
              {todayAttendance.length > 7 && (
                <p className="text-xs text-slate-400 pt-2 text-center">+{todayAttendance.length - 7} weitere</p>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Noch niemand eingecheckt.</p>
          )}
        </div>
      </div>

      {/* Second grid */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">

        {/* Belt distribution */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp size={13} /> Belt-Verteilung
          </h2>
          <div className="space-y-3">
            {(['white', 'blue', 'purple', 'brown', 'black'] as Belt[]).map(belt => (
              <div key={belt} className="flex items-center gap-3">
                <div className="w-20 flex-shrink-0">
                  <BeltBadge belt={belt} stripes={0} />
                </div>
                <div className="flex-1 min-w-0 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-amber-400 transition-all"
                    style={{ width: `${activeMembers ? ((beltCounts[belt] ?? 0) / activeMembers) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-slate-500 text-xs w-4 text-right font-medium flex-shrink-0">
                  {beltCounts[belt] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top attenders this month */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Zap size={13} /> Top-Trainingsbesucher · {new Date().toLocaleDateString('de-DE', { month: 'long' })}
          </h2>
          {topAttenders.length > 0 ? (
            <div className="space-y-0">
              {topAttenders.map((a, i) => {
                const m = memberMap.get(a.member_id)
                const maxCount = topAttenders[0]?.count ?? 1
                return (
                  <Link key={a.member_id} href={`/dashboard/members/${a.member_id}`}
                    className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors">
                    <span className={`text-xs font-bold w-4 flex-shrink-0 ${i === 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {m ? `${m.first_name} ${m.last_name}` : '–'}
                      </p>
                      <div className="mt-1 bg-gray-100 rounded-full h-1 overflow-hidden">
                        <div
                          className="h-1 rounded-full bg-amber-400 transition-all"
                          style={{ width: `${(a.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      {a.count}×
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Noch keine Trainingseinheiten diesen Monat.</p>
          )}
        </div>
      </div>

      {/* Birthdays */}
      {birthdayMembers.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mb-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Cake size={13} /> Geburtstage · nächste 7 Tage
          </h2>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {birthdayMembers.map(m => (
              <Link key={m.id} href={`/dashboard/members/${m.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors">
                <div className="w-9 h-9 rounded-full bg-white border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-amber-600">{m.first_name[0]}{m.last_name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 font-medium text-sm truncate">{m.first_name} {m.last_name}</p>
                  <p className="text-slate-500 text-xs">
                    {m.nextBirthday.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-600 bg-white px-2 py-0.5 rounded-full border border-amber-200 flex-shrink-0">
                  {m.age} J.
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent promotions */}
      {recentPromotions.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Award size={13} /> Letzte Graduierungen
          </h2>
          <div className="space-y-0">
            {recentPromotions.map(p => {
              const m = memberMap.get(p.member_id)
              return (
                <Link key={p.id} href={`/dashboard/members/${p.member_id}`}
                  className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors gap-3">
                  <span className="text-slate-800 text-sm font-medium truncate flex-1 min-w-0">
                    {m ? `${m.first_name} ${m.last_name}` : '–'}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <BeltBadge belt={p.new_belt as Belt} stripes={p.new_stripes} />
                    <span className="text-slate-400 text-xs whitespace-nowrap">
                      {new Date(p.promoted_at).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── StatCard ─────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, valueCents, color }: {
  icon: React.ReactNode
  label: string
  value?: number
  valueCents?: number
  color: 'blue' | 'green' | 'amber' | 'slate' | 'red'
}) {
  const colors = {
    blue:  'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-gray-100 text-slate-500',
    red:   'bg-red-50 text-red-500',
  }
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm min-w-0">
      <div className={`inline-flex p-2 rounded-lg mb-2.5 ${colors[color]}`}>{icon}</div>
      <div className="text-2xl font-bold text-slate-900 truncate">
        {valueCents !== undefined
          ? (valueCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
          : value ?? 0}
      </div>
      <div className="text-slate-500 text-xs mt-0.5 truncate">{label}</div>
    </div>
  )
}
