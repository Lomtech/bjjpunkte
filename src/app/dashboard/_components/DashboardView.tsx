'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BeltBadge } from '@/components/BeltBadge'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  Users, TrendingUp, Calendar, Award, Cake, FileWarning,
  Euro, CheckCircle2, Clock, AlertCircle, ChevronRight, Zap,
  Link2, Copy, Check, ExternalLink,
} from 'lucide-react'
import type { Belt } from '@/types/database'
import type { DashboardStats, BirthdayRow } from '@/lib/server/dashboard-stats'

function formatCents(c: number) {
  return (c / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function upcomingBirthdays(members: BirthdayRow[]) {
  const now  = new Date()
  const in7  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return members
    .filter(m => m.date_of_birth)
    .map(m => {
      const dob          = new Date(m.date_of_birth)
      const thisYear     = new Date(now.getFullYear(), dob.getMonth(), dob.getDate())
      const nextBirthday = thisYear < now
        ? new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate()) : thisYear
      const age = nextBirthday.getFullYear() - dob.getFullYear()
      return { ...m, nextBirthday, age }
    })
    .filter(m => m.nextBirthday >= now && m.nextBirthday <= in7)
    .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime())
}

export function DashboardView({ initialData }: { initialData: DashboardStats }) {
  const { t, lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'

  const [copiedSignup, setCopiedSignup] = useState(false)
  const [copiedSlug,   setCopiedSlug]   = useState(false)

  // ── Derived state from server-fetched data ───────────────────────────────
  const { gym, totalMembers, activeMembers, todayAttendance, recentPromotions,
          beltStats, membersList, birthdayList, contractList, monthPayments,
          allPayments, monthAttendance, allAttendance } = initialData

  const memberMap = new Map(membersList.map(m => [m.id, m]))

  const beltCounts = beltStats.reduce<Record<string, number>>((acc, m) => {
    acc[m.belt] = (acc[m.belt] ?? 0) + 1; return acc
  }, {})

  const birthdayMembers   = upcomingBirthdays(birthdayList)
  const expiringContracts = contractList.length
  const monthRevenue      = monthPayments.reduce((s, p) => s + p.amount_cents, 0)

  const allPay       = allPayments.filter(p => p.status === 'paid' && p.paid_at)
  const recentPayments = allPay.slice(0, 6)

  const thirtyDaysAgo   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const memberPayStatus = new Map<string, 'paid' | 'pending' | 'never'>()
  for (const p of allPayments) {
    if (!memberPayStatus.has(p.member_id) && p.status === 'paid' && p.paid_at) {
      memberPayStatus.set(p.member_id, p.paid_at >= thirtyDaysAgo ? 'paid' : 'pending')
    }
  }

  const countMap = new Map<string, number>()
  for (const row of monthAttendance) {
    countMap.set(row.member_id, (countMap.get(row.member_id) ?? 0) + 1)
  }
  const topAttenders = Array.from(countMap.entries())
    .map(([member_id, count]) => ({ member_id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const lastSeenMap = new Map<string, string>()
  for (const row of allAttendance) {
    if (!lastSeenMap.has(row.member_id)) lastSeenMap.set(row.member_id, row.checked_in_at)
  }
  const churnRisk = membersList
    .filter(m => { const ls = lastSeenMap.get(m.id); return !ls || ls < fourteenDaysAgo })
    .map(m => {
      const lastSeen = lastSeenMap.get(m.id)
      return {
        ...m,
        last_seen: lastSeen ?? '',
        days_ago: lastSeen
          ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / 86400000)
          : 999,
      }
    })
    .sort((a, b) => b.days_ago - a.days_ago)
    .slice(0, 8)

  const paidCount    = Array.from(memberPayStatus.values()).filter(s => s === 'paid').length
  const pendingCount = Array.from(memberPayStatus.values()).filter(s => s === 'pending').length

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? t('dash', 'goodMorning') : hour < 18 ? t('dash', 'goodDay') : t('dash', 'goodEvening')

  const { signup_token: signupToken, slug: gymSlug } = gym

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs text-zinc-400 font-medium mb-0.5">
          {new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">{greeting}</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard icon={<Users size={18} />}       label={t('dash', 'activeMembers')}     value={activeMembers} />
        <StatCard icon={<Calendar size={18} />}    label={t('dash', 'todayTraining')}     value={todayAttendance.length} />
        <StatCard icon={<Euro size={18} />}        label={new Date().toLocaleDateString(locale, { month: 'long' })} valueCents={monthRevenue} primary />
        <StatCard icon={<FileWarning size={18} />} label={t('dash', 'contractsExpiring')} value={expiringContracts} warn={expiringContracts > 0} />
      </div>

      {/* Access links */}
      {(signupToken || gymSlug) && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center">
                <Link2 size={12} className="text-zinc-500" />
              </span>
              {t('dash', 'accessLinks')}
            </h2>
            <Link href="/dashboard/settings?tab=zugaenge" className="text-xs text-amber-600 hover:text-amber-500 font-semibold">
              {t('dash', 'manage')}
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {signupToken && (
              <AccessLinkRow
                label={t('dash', 'signupLink')}
                description={t('dash', 'signupLinkDesc')}
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/signup/${signupToken}`}
                copied={copiedSignup}
                onCopy={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/signup/${signupToken}`)
                  setCopiedSignup(true)
                  setTimeout(() => setCopiedSignup(false), 2000)
                }}
              />
            )}
            {gymSlug && (
              <AccessLinkRow
                label={t('dash', 'publicPage')}
                description={t('dash', 'publicPageDesc')}
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/gym/${gymSlug}`}
                copied={copiedSlug}
                onCopy={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/gym/${gymSlug}`)
                  setCopiedSlug(true)
                  setTimeout(() => setCopiedSlug(false), 2000)
                }}
              />
            )}
          </div>
          {!gymSlug && (
            <Link href="/dashboard/settings?tab=zugaenge"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-600 transition-colors">
              <ExternalLink size={11} /> {t('dash', 'setupPublicPage')}
            </Link>
          )}
        </div>
      )}

      {/* Payment health bar */}
      {activeMembers > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-zinc-700">{t('dash', 'paymentStatus')}</p>
            <Link href="/dashboard/revenue" className="text-xs text-amber-600 hover:text-amber-500 font-semibold">{t('dash', 'details')}</Link>
          </div>
          <div className="flex rounded-full overflow-hidden h-2 bg-zinc-100 mb-3">
            {paidCount    > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(paidCount    / activeMembers) * 100}%` }} />}
            {pendingCount > 0 && <div className="bg-zinc-300 transition-all"  style={{ width: `${(pendingCount / activeMembers) * 100}%` }} />}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              {t('dash', 'paid')} <span className="font-bold text-zinc-800 ml-1">{paidCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-zinc-300 flex-shrink-0" />
              {t('dash', 'pending')} <span className="font-bold text-zinc-800 ml-1">{pendingCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-zinc-100 border border-zinc-300 flex-shrink-0" />
              {t('dash', 'neverPaid')} <span className="font-bold text-zinc-800 ml-1">{activeMembers - paidCount - pendingCount}</span>
            </span>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">

        {/* Recent payments */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
                <Euro size={12} className="text-amber-600" />
              </span>
              {t('dash', 'recentPayments')}
            </h2>
            <Link href="/dashboard/revenue" className="text-xs text-amber-600 hover:text-amber-500 font-semibold">{t('dash', 'allPayments')}</Link>
          </div>
          {recentPayments.length > 0 ? (
            <div className="space-y-0">
              {recentPayments.map(p => {
                const m = memberMap.get(p.member_id)
                return (
                  <Link key={p.id} href={`/dashboard/members/${p.member_id}`}
                    className="flex items-center gap-3 py-2.5 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={13} className="text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {m ? `${m.first_name} ${m.last_name}` : '–'}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' }) : '–'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-zinc-800 flex-shrink-0">{formatCents(p.amount_cents)}</span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-zinc-400 text-sm">{t('dash', 'noPayments')}</p>
          )}
        </div>

        {/* Today's training */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center">
                <Calendar size={12} className="text-zinc-500" />
              </span>
              {t('dash', 'todayTrainingCard')}
            </h2>
            <Link href="/dashboard/attendance" className="text-xs text-amber-600 hover:text-amber-500 font-semibold">{t('dash', 'checkin')}</Link>
          </div>
          {todayAttendance.length > 0 ? (
            <div className="space-y-0">
              {todayAttendance.slice(0, 7).map(a => {
                const m         = memberMap.get(a.member_id)
                const payStatus = memberPayStatus.get(a.member_id)
                return (
                  <Link key={a.id} href={`/dashboard/members/${a.member_id}`}
                    className="flex items-center gap-3 py-2.5 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 -mx-2 px-2 rounded-lg transition-colors">
                    <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 text-amber-600 text-[11px] font-bold">
                      {m?.first_name?.[0]}{m?.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {m ? `${m.first_name} ${m.last_name}` : '–'}
                      </p>
                      <p className="text-xs text-zinc-400 truncate capitalize">{a.class_type}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {payStatus === 'paid'    && <CheckCircle2 size={12} className="text-amber-400" />}
                      {payStatus === 'pending' && <Clock size={12} className="text-amber-400" />}
                      {!payStatus             && <AlertCircle size={12} className="text-zinc-300" />}
                      <span className="text-xs text-zinc-400">
                        {new Date(a.checked_in_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </Link>
                )
              })}
              {todayAttendance.length > 7 && (
                <p className="text-xs text-zinc-400 pt-2 text-center">{t('dash', 'more', { n: todayAttendance.length - 7 })}</p>
              )}
            </div>
          ) : (
            <p className="text-zinc-400 text-sm">{t('dash', 'noneCheckedIn')}</p>
          )}
        </div>
      </div>

      {/* Second grid */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">

        {/* Belt distribution */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center">
              <TrendingUp size={12} className="text-zinc-500" />
            </span>
            {t('dash', 'beltDistribution')}
          </h2>
          <div className="space-y-3">
            {(['white', 'blue', 'purple', 'brown', 'black'] as Belt[]).map(belt => (
              <div key={belt} className="flex items-center gap-3">
                <div className="w-20 flex-shrink-0"><BeltBadge belt={belt} stripes={0} /></div>
                <div className="flex-1 min-w-0 bg-zinc-100 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-amber-400 transition-all"
                    style={{ width: `${activeMembers ? ((beltCounts[belt] ?? 0) / activeMembers) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-zinc-500 text-xs w-4 text-right font-medium flex-shrink-0">
                  {beltCounts[belt] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top attenders */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
              <Zap size={12} className="text-amber-600" />
            </span>
            {t('dash', 'topAttendees')} · {new Date().toLocaleDateString(locale, { month: 'long' })}
          </h2>
          {topAttenders.length > 0 ? (
            <div className="space-y-0">
              {topAttenders.map((a, i) => {
                const m        = memberMap.get(a.member_id)
                const maxCount = topAttenders[0]?.count ?? 1
                return (
                  <Link key={a.member_id} href={`/dashboard/members/${a.member_id}`}
                    className="flex items-center gap-3 py-2.5 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 -mx-2 px-2 rounded-lg transition-colors">
                    <span className={`text-xs font-bold w-4 flex-shrink-0 ${i === 0 ? 'text-amber-500' : 'text-zinc-400'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {m ? `${m.first_name} ${m.last_name}` : '–'}
                      </p>
                      <div className="mt-1 bg-zinc-100 rounded-full h-1 overflow-hidden">
                        <div className="h-1 rounded-full bg-amber-400 transition-all" style={{ width: `${(a.count / maxCount) * 100}%` }} />
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
            <p className="text-zinc-400 text-sm">{t('dash', 'noTrainingThisMonth')}</p>
          )}
        </div>
      </div>

      {/* Churn Risk */}
      {churnRisk.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
                <AlertCircle size={12} className="text-amber-500" />
              </span>
              {t('dash', 'absenceWarning')}
            </h2>
            <span className="text-xs text-zinc-400 font-medium">{churnRisk.length} · {t('dash', 'daysLabel')}</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {churnRisk.map(m => (
              <Link key={m.id} href={`/dashboard/members/${m.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 hover:bg-amber-50 hover:border-amber-200 transition-colors">
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-amber-600">{m.first_name[0]}{m.last_name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-zinc-400">
                    {m.days_ago >= 999 ? t('dash', 'ninetyPlusDays') : t('dash', 'daysAway', { n: m.days_ago })}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  m.days_ago >= 30 ? 'bg-zinc-100 text-zinc-500' : 'bg-amber-50 text-amber-700'
                }`}>
                  {m.days_ago >= 999 ? '90+d' : `${m.days_ago}d`}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Birthdays */}
      {birthdayMembers.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center">
              <Cake size={12} className="text-zinc-500" />
            </span>
            {t('dash', 'birthdays')}
          </h2>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {birthdayMembers.map(m => (
              <Link key={m.id} href={`/dashboard/members/${m.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors">
                <div className="w-9 h-9 rounded-full bg-white border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-amber-600">{m.first_name[0]}{m.last_name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-900 font-medium text-sm truncate">{m.first_name} {m.last_name}</p>
                  <p className="text-zinc-500 text-xs">
                    {m.nextBirthday.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-600 bg-white px-2 py-0.5 rounded-full border border-amber-200 flex-shrink-0">
                  {m.age} {t('dash', 'years')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent promotions */}
      {recentPromotions.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center">
              <Award size={12} className="text-amber-600" />
            </span>
            {t('dash', 'recentPromotions')}
          </h2>
          <div className="space-y-0">
            {recentPromotions.map(p => {
              const m = memberMap.get(p.member_id)
              return (
                <Link key={p.id} href={`/dashboard/members/${p.member_id}`}
                  className="flex items-center justify-between py-2.5 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 -mx-2 px-2 rounded-lg transition-colors gap-3">
                  <span className="text-zinc-800 text-sm font-medium truncate flex-1 min-w-0">
                    {m ? `${m.first_name} ${m.last_name}` : '–'}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <BeltBadge belt={p.new_belt as Belt} stripes={p.new_stripes} />
                    <span className="text-zinc-400 text-xs whitespace-nowrap">
                      {new Date(p.promoted_at).toLocaleDateString(locale)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Placeholder for stats when no members yet */}
      {totalMembers === 0 && (
        <div className="bg-white rounded-2xl p-8 border border-zinc-100 shadow-sm text-center">
          <Users size={32} className="text-zinc-200 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm font-medium mb-1">
            {lang === 'en' ? 'No members yet' : 'Noch keine Mitglieder'}
          </p>
          <Link href="/dashboard/members/new"
            className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-semibold hover:text-amber-500 mt-2">
            {lang === 'en' ? 'Add first member' : 'Erstes Mitglied hinzufügen'} <ChevronRight size={12} />
          </Link>
        </div>
      )}
    </div>
  )
}

/* ─── StatCard ──────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, valueCents, primary = false, warn = false }: {
  icon: React.ReactNode
  label: string
  value?: number
  valueCents?: number
  primary?: boolean
  warn?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm min-w-0 hover:shadow-md transition-shadow duration-200">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
        primary ? 'bg-amber-400 shadow-sm shadow-amber-200' :
        warn    ? 'bg-red-50' : 'bg-zinc-100'
      }`}>
        <span className={primary ? 'text-white' : warn ? 'text-red-500' : 'text-zinc-500'}>{icon}</span>
      </div>
      <div className="text-2xl font-black text-zinc-950 tracking-tight truncate leading-none">
        {valueCents !== undefined
          ? (valueCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
          : value ?? 0}
      </div>
      <div className="text-zinc-400 text-xs mt-1.5 truncate font-medium">{label}</div>
    </div>
  )
}

/* ─── AccessLinkRow ─────────────────────────────────────────────────────── */
function AccessLinkRow({ label, description, value, copied, onCopy }: {
  label: string
  description: string
  value: string
  copied: boolean
  onCopy: () => void
}) {
  const display = value.replace(/^https?:\/\/[^/]+/, '')
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50 hover:bg-zinc-100 transition-colors group overflow-hidden">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-700">{label}</p>
        <p className="text-[11px] text-zinc-400 truncate">{description}</p>
        <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">{display}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="p-1.5 rounded-lg text-zinc-300 hover:text-amber-600 hover:bg-amber-50 transition-colors">
          <ExternalLink size={13} />
        </a>
        <button onClick={onCopy}
          className="p-1.5 rounded-lg text-zinc-300 hover:text-amber-600 hover:bg-amber-50 transition-colors">
          {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  )
}
