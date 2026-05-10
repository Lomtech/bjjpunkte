'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp, CheckCircle2, Clock, AlertCircle, ChevronRight, ChevronLeft,
  Euro, Users, Calendar, ArrowUpRight, Download, Search, X as XIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface PaymentFull {
  id: string
  member_id: string | null
  member_name: string | null   // stored at payment time — survives member deletion
  amount_cents: number
  paid_at: string | null
  status: string
  created_at: string
  invoice_number: string | null
}

interface MemberStatus {
  id: string
  first_name: string
  last_name: string
  monthly_fee_cents: number
  last_paid_at: string | null
  last_amount_cents: number | null
  total_paid_cents: number
  total_payments: number
  status: 'paid' | 'pending' | 'never'
}

interface MonthGroup {
  month: string
  label: string
  count: number
  total_cents: number
}

function formatCents(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

type Tab = 'overview' | 'members' | 'history'

export default function RevenuePage() {
  const { t, lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<Tab>('overview')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [allTimeCents, setAllTimeCents] = useState(0)
  const [allTimeCount, setAllTimeCount] = useState(0)
  const [monthCents, setMonthCents]     = useState(0)
  const [prevMonthCents, setPrevMonthCents] = useState(0)
  const [members, setMembers]           = useState<MemberStatus[]>([])
  const [allPayments, setAllPayments]   = useState<(PaymentFull & { member_name: string })[]>([])
  const [months, setMonths]             = useState<MonthGroup[]>([])
  const [expectedMonthlyCents, setExpectedMonthlyCents] = useState(0)
  const [historyQuery, setHistoryQuery] = useState('')
  useEffect(() => {
    setLoading(true)
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: gym } = await (supabase.from('gyms') as any)
        .select('id, monthly_fee_cents, name')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (!gym) { setLoading(false); return }

      const gymData = gym as { id: string; monthly_fee_cents: number; name: string }

      const startOfMonth  = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const startOfPrevMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const yearStart = new Date(selectedYear, 0, 1).toISOString()
      const yearEnd   = new Date(selectedYear + 1, 0, 1).toISOString()

      try {
        const [paymentsRes, membersRes, plansRes] = await Promise.all([
          supabase.from('payments')
            .select('id, member_id, member_name, amount_cents, paid_at, status, created_at')
            .eq('gym_id', gymData.id)
            .gte('paid_at', yearStart)
            .lt('paid_at', yearEnd)
            .order('paid_at', { ascending: false })
            .limit(5000),
          supabase.from('members')
            .select('id, first_name, last_name, monthly_fee_override_cents, plan_id')
            .eq('gym_id', gymData.id)
            .eq('is_active', true),
          (supabase.from('membership_plans') as any)
            .select('id, price_cents')
            .eq('gym_id', gymData.id)
            .eq('is_active', true),
        ])

        const payments = (paymentsRes.data ?? []) as unknown as PaymentFull[]
        const paidPayments = payments.filter(p => p.status === 'paid' && p.paid_at)

        const activeMembers = (membersRes.data ?? []) as {
          id: string; first_name: string; last_name: string
          monthly_fee_override_cents: number | null; plan_id: string | null
        }[]

        // Plan price lookup: plan_id → price_cents
        const planPriceMap = new Map<string, number>(
          ((plansRes.data ?? []) as { id: string; price_cents: number }[]).map(p => [p.id, p.price_cents])
        )

        // Effective fee: override → plan price → gym default
        function effectiveFee(m: { monthly_fee_override_cents: number | null; plan_id: string | null }) {
          if (m.monthly_fee_override_cents != null) return m.monthly_fee_override_cents
          if (m.plan_id && planPriceMap.has(m.plan_id)) return planPriceMap.get(m.plan_id)!
          return gymData.monthly_fee_cents ?? 0
        }

        // Member name map
        const nameMap = new Map(activeMembers.map(m => [m.id, `${m.first_name} ${m.last_name}`]))

        // Monthly breakdown
        const map = new Map<string, { count: number; total_cents: number }>()
        for (const p of paidPayments) {
          const month = p.paid_at!.substring(0, 7)
          const ex = map.get(month) ?? { count: 0, total_cents: 0 }
          map.set(month, { count: ex.count + 1, total_cents: ex.total_cents + p.amount_cents })
        }
        const monthGroups = Array.from(map.entries()).map(([month, stats]) => {
          const [year, m] = month.split('-')
          const date = new Date(Number(year), Number(m) - 1, 1)
          return { month, label: date.toLocaleDateString(locale, { month: 'long', year: 'numeric' }), ...stats }
        }).sort((a, b) => b.month.localeCompare(a.month))
        setMonths(monthGroups)

        // Totals
        const totalCents = paidPayments.reduce((s, p) => s + p.amount_cents, 0)
        setAllTimeCents(totalCents)
        setAllTimeCount(paidPayments.length)

        const currMonthStr = new Date().toISOString().substring(0, 7)
        const prevMonthStr = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().substring(0, 7)
        setMonthCents(monthGroups.find(m => m.month === currMonthStr)?.total_cents ?? 0)
        setPrevMonthCents(monthGroups.find(m => m.month === prevMonthStr)?.total_cents ?? 0)

        // Per-member status
        const memberStatuses: MemberStatus[] = activeMembers.map(m => {
          const memberPayments = paidPayments.filter(p => p.member_id === m.id)
          const latest = memberPayments[0]
          const fee = effectiveFee(m)
          const totalPaid = memberPayments.reduce((s, p) => s + p.amount_cents, 0)

          let status: 'paid' | 'pending' | 'never' = 'never'
          if (latest?.paid_at) {
            status = latest.paid_at >= thirtyDaysAgo ? 'paid' : 'pending'
          }

          return {
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            monthly_fee_cents: fee,
            last_paid_at: latest?.paid_at ?? null,
            last_amount_cents: latest?.amount_cents ?? null,
            total_paid_cents: totalPaid,
            total_payments: memberPayments.length,
            status,
          }
        }).sort((a, b) => {
          const order = { pending: 0, never: 1, paid: 2 }
          return order[a.status] - order[b.status]
        })

        setMembers(memberStatuses)
        setExpectedMonthlyCents(activeMembers.reduce((s, m) => s + effectiveFee(m), 0))

        // All payments with member name — prefer stored member_name (survives deletion),
        // fall back to live nameMap, then "Ex-Mitglied" label
        setAllPayments(
          payments
            .filter(p => p.status === 'paid' && p.paid_at)
            .map(p => ({
              ...p,
              member_name: p.member_name
                ?? (p.member_id ? nameMap.get(p.member_id) : null)
                ?? (lang === 'en' ? 'Former member' : 'Ex-Mitglied'),
            }))
        )
      } catch (err) {
        console.error('Failed to load revenue data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedYear])

  function downloadPaymentsCSV() {
    const headers = [t('revenue', 'csvHeaderDate'), t('revenue', 'csvHeaderMember'), t('revenue', 'csvHeaderAmount'), t('revenue', 'csvHeaderStatus'), t('revenue', 'csvHeaderId')]
    const rows = allPayments.map(p => [
      p.paid_at ? new Date(p.paid_at).toLocaleDateString(locale) : new Date(p.created_at).toLocaleDateString(locale),
      p.member_name,
      (p.amount_cents / 100).toFixed(2).replace('.', ','),
      p.status === 'paid' ? t('revenue', 'paid') : p.status === 'pending' ? t('revenue', 'pending') : p.status,
      p.id,
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `zahlungen-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  async function downloadDATEV() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    const year = new Date().getFullYear()
    const res  = await fetch(`/api/datev/export?year=${year}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      console.error('[datev] export failed:', await res.text())
      return
    }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `datev-buchungsstapel-${year}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (loading) return <div className="flex items-center justify-center h-full text-zinc-400 text-sm">{t('common', 'loading')}</div>

  const paidCount    = members.filter(m => m.status === 'paid').length
  const pendingCount = members.filter(m => m.status === 'pending').length
  const neverCount   = members.filter(m => m.status === 'never').length
  const monthDelta   = monthCents - prevMonthCents
  const maxMonthCents = Math.max(...months.map(m => m.total_cents), 1)
  const currentYear   = new Date().getFullYear()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t('revenue', 'overview') },
    { key: 'members',  label: t('revenue', 'memberStatus') },
    { key: 'history',  label: t('revenue', 'history') },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">{t('revenue', 'title')}</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              disabled={selectedYear <= currentYear - 4}
              className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-40 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-zinc-700 w-12 text-center">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              disabled={selectedYear >= currentYear}
              className="p-1.5 rounded-lg hover:bg-zinc-100 disabled:opacity-40 transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <p className="text-zinc-400 text-xs mt-0.5 font-medium">{t('revenue', 'subtitle')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { icon: <Euro size={18} />, value: formatCents(allTimeCents), label: String(selectedYear), primary: true },
          { icon: <Calendar size={18} />, value: formatCents(monthCents), label: new Date().toLocaleDateString(locale, { month: 'long' }), sub: monthDelta !== 0 ? `${monthDelta > 0 ? '+' : ''}${formatCents(monthDelta)}` : null, primary: false },
          { icon: <Users size={18} />, value: formatCents(expectedMonthlyCents), label: t('revenue', 'expectedMonthly'), primary: false },
          { icon: <AlertCircle size={18} />, value: String(pendingCount + neverCount), label: t('revenue', 'pending'), primary: false },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm min-w-0 hover:shadow-md transition-shadow duration-200">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.primary ? 'bg-amber-400 shadow-sm shadow-amber-200' : 'bg-zinc-100'}`}>
              <span className={card.primary ? 'text-white' : 'text-zinc-500'}>{card.icon}</span>
            </div>
            <div className="text-2xl font-black text-zinc-950 tracking-tight truncate leading-none">{card.value}</div>
            <div className="text-zinc-400 text-xs mt-1.5 truncate flex items-center gap-1.5 font-medium">
              <span className="truncate">{card.label}</span>
              {'sub' in card && card.sub && (
                <span className={`font-semibold flex-shrink-0 ${monthDelta > 0 ? 'text-emerald-600' : 'text-zinc-400'}`}>{card.sub}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-2xl mb-5">
        {tabs.map(tabItem => (
          <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-150 ${
              tab === tabItem.key
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-600'
            }`}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Payment health */}
          <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">{t('revenue', 'paymentStatus')}</h2>
            <div className="flex rounded-full overflow-hidden h-2 bg-zinc-100 mb-4">
              {paidCount    > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${members.length ? (paidCount / members.length) * 100 : 0}%` }} />}
              {pendingCount > 0 && <div className="bg-zinc-300 transition-all" style={{ width: `${members.length ? (pendingCount / members.length) * 100 : 0}%` }} />}
              {neverCount   > 0 && <div className="bg-zinc-200 transition-all" style={{ width: `${members.length ? (neverCount / members.length) * 100 : 0}%` }} />}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t('revenue', 'paid'),    count: paidCount,    dot: 'bg-amber-400' },
                { label: t('revenue', 'pending'), count: pendingCount, dot: 'bg-zinc-300' },
                { label: t('revenue', 'never'),   count: neverCount,   dot: 'bg-zinc-200' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 bg-zinc-50 border border-zinc-100 text-center">
                  <div className="text-2xl font-bold text-zinc-900">{s.count}</div>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                    <span className="text-xs text-zinc-500 truncate">{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly bar chart */}
          {months.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">{t('revenue', 'monthlyOverview')}</h2>
              <div className="space-y-3">
                {months.slice(0, 6).map(m => (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-24 flex-shrink-0 truncate">{m.label}</span>
                    <div className="flex-1 min-w-0 bg-zinc-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-amber-400 transition-all"
                        style={{ width: `${(m.total_cents / maxMonthCents) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 w-16 text-right flex-shrink-0 truncate">
                      {formatCents(m.total_cents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary table */}
          {months.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('revenue', 'monthlyDetails')}</p>
              </div>
              <div className="divide-y divide-gray-100">
                {months.map(m => (
                  <div key={m.month} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50">
                    <span className="text-sm font-medium text-zinc-900">{m.label}</span>
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-xs text-zinc-400 flex-shrink-0">{m.count} {m.count !== 1 ? t('revenue', 'paymentPlural') : t('revenue', 'paymentSingular')}</span>
                      <span className="text-sm font-semibold text-zinc-900 flex-shrink-0">{formatCents(m.total_cents)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {months.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl border border-zinc-200 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <Euro size={20} className="text-amber-500" />
              </div>
              <p className="text-zinc-900 font-semibold text-sm mb-1">{t('revenue', 'noRevenue')}</p>
              <p className="text-zinc-400 text-xs">{t('revenue', 'noRevenueHint')}</p>
            </div>
          )}
        </div>
      )}

      {/* MEMBERS TAB */}
      {tab === 'members' && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('revenue', 'membersPayStatus')}</p>
            <span className="text-xs text-zinc-400">{members.length} {t('revenue', 'activeCount')}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {members.map(m => (
              <Link key={m.id} href={`/dashboard/members/${m.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 transition-colors">
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {m.status === 'paid'    && <CheckCircle2 size={16} className="text-amber-500" />}
                  {m.status === 'pending' && <Clock        size={16} className="text-zinc-400" />}
                  {m.status === 'never'   && <AlertCircle  size={16} className="text-zinc-300" />}
                </div>

                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {m.status === 'paid' && m.last_paid_at
                      ? t('revenue', 'paidDaysAgo').replace('{n}', String(daysSince(m.last_paid_at))).replace('{total}', String(m.total_payments))
                      : m.status === 'pending' && m.last_paid_at
                      ? t('revenue', 'pendingDaysAgo').replace('{n}', String(daysSince(m.last_paid_at)))
                      : t('revenue', 'neverPaid')}
                  </p>
                </div>

                {/* Right side */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-zinc-700">{formatCents(m.monthly_fee_cents)}</p>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                    m.status === 'paid'    ? 'bg-amber-50 text-amber-700' :
                                            'bg-zinc-100 text-zinc-500'
                  }`}>
                    {m.status === 'paid' ? t('revenue', 'paidCurrent') : m.status === 'pending' ? t('revenue', 'pending') : t('revenue', 'never')}
                  </span>
                </div>
                <ChevronRight size={14} className="text-zinc-300 flex-shrink-0" />
              </Link>
            ))}
            {members.length === 0 && (
              <div className="py-12 text-center text-zinc-400 text-sm">{t('revenue', 'noActiveMembers')}</div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (() => {
        // Lokales Filter-Memo: case-insensitive Substring-Match auf member_name
        // (mit Trim damit „ Lom " auch matched).
        const q = historyQuery.trim().toLowerCase()
        const filteredPayments = q
          ? allPayments.filter(p => p.member_name.toLowerCase().includes(q))
          : allPayments
        const filteredCents = filteredPayments.reduce((s, p) => s + p.amount_cents, 0)
        return (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('revenue', 'paymentHistory')}</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 whitespace-nowrap">
                  {q
                    ? `${filteredPayments.length} / ${allPayments.length} · ${formatCents(filteredCents)}`
                    : `${allPayments.length} ${t('revenue', 'transactions')} · ${formatCents(allTimeCents)}`}
                </span>
                {allPayments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button onClick={downloadPaymentsCSV}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-600 transition-colors"
                      title={t('revenue', 'exportCsv')}>
                      <Download size={12} /> CSV
                    </button>
                    <button onClick={downloadDATEV}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-600 transition-colors"
                      title="DATEV">
                      <Download size={12} /> DATEV
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Search-Box: Live-Filter auf member_name. Nutzt stored member_name
                aus payments-Tabelle (überlebt Mitglieds-Löschung). */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={historyQuery}
                onChange={e => setHistoryQuery(e.target.value)}
                placeholder={lang === 'en' ? 'Search by member name…' : 'Nach Mitgliedsnamen suchen…'}
                className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                aria-label={lang === 'en' ? 'Search payments' : 'Zahlungen durchsuchen'}
              />
              {historyQuery && (
                <button
                  onClick={() => setHistoryQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                  aria-label={lang === 'en' ? 'Clear search' : 'Suche löschen'}
                  type="button"
                >
                  <XIcon size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredPayments.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors group">
                {p.member_id ? (
                  <Link href={`/dashboard/members/${p.member_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <ArrowUpRight size={13} className="text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">{p.member_name}</p>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                      <ArrowUpRight size={13} className="text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-400 truncate italic">{p.member_name}</p>
                      <p className="text-xs text-zinc-400">
                        {p.paid_at
                          ? new Date(p.paid_at).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : '–'}
                        {p.invoice_number && <span className="ml-2 text-zinc-300">#{p.invoice_number}</span>}
                      </p>
                    </div>
                  </div>
                )}
                <span className="text-sm font-semibold text-zinc-800 flex-shrink-0">{formatCents(p.amount_cents)}</span>
                {p.status === 'paid' && (
                  <a href={`/api/invoices/${p.id}?print=1`} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 p-1.5 rounded-lg text-zinc-300 hover:text-amber-600 hover:bg-amber-50 transition-colors opacity-0 group-hover:opacity-100"
                    title={t('revenue', 'download')}>
                    <Download size={13} />
                  </a>
                )}
              </div>
            ))}
            {allPayments.length === 0 && (
              <div className="py-12 text-center text-zinc-400 text-sm">{t('revenue', 'noPayments')}</div>
            )}
            {allPayments.length > 0 && filteredPayments.length === 0 && (
              <div className="py-12 text-center text-zinc-400 text-sm">
                {lang === 'en'
                  ? <>No payments match „<span className="font-semibold text-zinc-600">{historyQuery}</span>"</>
                  : <>Keine Zahlungen passen zu „<span className="font-semibold text-zinc-600">{historyQuery}</span>"</>}
              </div>
            )}
          </div>
        </div>
        )
      })()}
    </div>
  )
}
