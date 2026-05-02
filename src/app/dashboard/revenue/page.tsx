'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp, CheckCircle2, Clock, AlertCircle, ChevronRight,
  Euro, Users, Calendar, ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'

interface PaymentFull {
  id: string
  member_id: string
  amount_cents: number
  paid_at: string | null
  status: string
  created_at: string
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
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<Tab>('overview')
  const [allTimeCents, setAllTimeCents] = useState(0)
  const [allTimeCount, setAllTimeCount] = useState(0)
  const [monthCents, setMonthCents]     = useState(0)
  const [prevMonthCents, setPrevMonthCents] = useState(0)
  const [members, setMembers]           = useState<MemberStatus[]>([])
  const [allPayments, setAllPayments]   = useState<(PaymentFull & { member_name: string })[]>([])
  const [months, setMonths]             = useState<MonthGroup[]>([])
  const [expectedMonthlyCents, setExpectedMonthlyCents] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id, monthly_fee_cents').single()
      if (!gym) { setLoading(false); return }

      const gymData = gym as { id: string; monthly_fee_cents: number }

      const startOfMonth  = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const startOfPrevMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [paymentsRes, membersRes] = await Promise.all([
        supabase.from('payments')
          .select('id, member_id, amount_cents, paid_at, status, created_at')
          .eq('gym_id', gymData.id)
          .order('paid_at', { ascending: false }),
        supabase.from('members')
          .select('id, first_name, last_name, monthly_fee_override_cents')
          .eq('gym_id', gymData.id)
          .eq('is_active', true),
      ])

      const payments = (paymentsRes.data ?? []) as PaymentFull[]
      const paidPayments = payments.filter(p => p.status === 'paid' && p.paid_at)

      const activeMembers = (membersRes.data ?? []) as {
        id: string; first_name: string; last_name: string; monthly_fee_override_cents: number | null
      }[]

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
        return { month, label: date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }), ...stats }
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
        const fee = m.monthly_fee_override_cents ?? gymData.monthly_fee_cents ?? 0
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
      setExpectedMonthlyCents(activeMembers.reduce((s, m) => s + (m.monthly_fee_override_cents ?? gymData.monthly_fee_cents ?? 0), 0))

      // All payments with member name
      setAllPayments(
        payments
          .filter(p => p.status === 'paid' && p.paid_at)
          .map(p => ({ ...p, member_name: nameMap.get(p.member_id) ?? 'Unbekannt' }))
      )

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Lädt…</div>

  const paidCount    = members.filter(m => m.status === 'paid').length
  const pendingCount = members.filter(m => m.status === 'pending').length
  const neverCount   = members.filter(m => m.status === 'never').length
  const monthDelta   = monthCents - prevMonthCents
  const maxMonthCents = Math.max(...months.map(m => m.total_cents), 1)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Übersicht' },
    { key: 'members',  label: 'Mitglieder' },
    { key: 'history',  label: 'Verlauf' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">Einnahmen</h1>
        <p className="text-zinc-400 text-xs mt-0.5">Zahlungsübersicht und Mitgliederstatus</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl p-4 border border-zinc-200 shadow-sm min-w-0">
          <div className="inline-flex p-2 rounded-lg mb-2 bg-amber-50 text-amber-600"><Euro size={15} /></div>
          <div className="text-xl font-bold text-zinc-900 truncate">{formatCents(allTimeCents)}</div>
          <div className="text-zinc-500 text-xs mt-0.5 truncate">Gesamt</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-zinc-200 shadow-sm min-w-0">
          <div className="inline-flex p-2 rounded-lg mb-2 bg-green-50 text-green-600"><Calendar size={15} /></div>
          <div className="text-xl font-bold text-zinc-900 truncate">{formatCents(monthCents)}</div>
          <div className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1 flex-wrap">
            <span className="truncate">{new Date().toLocaleDateString('de-DE', { month: 'long' })}</span>
            {monthDelta !== 0 && (
              <span className={`font-medium flex-shrink-0 ${monthDelta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {monthDelta > 0 ? '+' : ''}{formatCents(monthDelta)}
              </span>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-zinc-200 shadow-sm min-w-0">
          <div className="inline-flex p-2 rounded-lg mb-2 bg-blue-50 text-blue-600"><Users size={15} /></div>
          <div className="text-xl font-bold text-zinc-900">{formatCents(expectedMonthlyCents)}</div>
          <div className="text-zinc-500 text-xs mt-0.5 truncate">Soll / Monat</div>
        </div>
        <div className={`bg-white rounded-xl p-4 border shadow-sm min-w-0 ${pendingCount + neverCount > 0 ? 'border-red-100' : 'border-zinc-200'}`}>
          <div className={`inline-flex p-2 rounded-lg mb-2 ${pendingCount + neverCount > 0 ? 'bg-red-50 text-red-500' : 'bg-zinc-100 text-zinc-400'}`}>
            <AlertCircle size={15} />
          </div>
          <div className={`text-xl font-bold ${pendingCount + neverCount > 0 ? 'text-red-600' : 'text-zinc-900'}`}>
            {pendingCount + neverCount}
          </div>
          <div className="text-zinc-500 text-xs mt-0.5 truncate">Ausstehend</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl mb-5">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Payment health */}
          <div className="bg-white rounded-xl p-5 border border-zinc-200 shadow-sm">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Zahlungsstatus · Aktive Mitglieder</h2>
            <div className="flex rounded-full overflow-hidden h-3 bg-zinc-100 mb-4">
              {paidCount    > 0 && <div className="bg-green-400 transition-all" style={{ width: `${members.length ? (paidCount / members.length) * 100 : 0}%` }} />}
              {pendingCount > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${members.length ? (pendingCount / members.length) * 100 : 0}%` }} />}
              {neverCount   > 0 && <div className="bg-red-300 transition-all" style={{ width: `${members.length ? (neverCount / members.length) * 100 : 0}%` }} />}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Bezahlt', count: paidCount,    color: 'text-green-600 bg-green-50', dot: 'bg-green-400' },
                { label: 'Ausstehend', count: pendingCount, color: 'text-amber-700 bg-amber-50', dot: 'bg-amber-400' },
                { label: 'Nie bezahlt', count: neverCount, color: 'text-red-600 bg-red-50',  dot: 'bg-red-300' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-3 ${s.color} text-center`}>
                  <div className="text-2xl font-bold">{s.count}</div>
                  <div className="text-xs font-medium mt-0.5 opacity-80 truncate">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly bar chart */}
          {months.length > 0 && (
            <div className="bg-white rounded-xl p-5 border border-zinc-200 shadow-sm">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Monatsübersicht</h2>
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
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Details nach Monat</p>
              </div>
              <div className="divide-y divide-gray-100">
                {months.map(m => (
                  <div key={m.month} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50">
                    <span className="text-sm font-medium text-zinc-900">{m.label}</span>
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-xs text-zinc-400 flex-shrink-0">{m.count} Zahlung{m.count !== 1 ? 'en' : ''}</span>
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
              <p className="text-zinc-900 font-semibold text-sm mb-1">Noch keine Einnahmen</p>
              <p className="text-zinc-400 text-xs">Erstelle Zahlungslinks in den Mitgliederprofilen.</p>
            </div>
          )}
        </div>
      )}

      {/* MEMBERS TAB */}
      {tab === 'members' && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Mitglieder · Zahlungsstatus</p>
            <span className="text-xs text-zinc-400">{members.length} aktiv</span>
          </div>
          <div className="divide-y divide-gray-100">
            {members.map(m => (
              <Link key={m.id} href={`/dashboard/members/${m.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 transition-colors">
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {m.status === 'paid'    && <CheckCircle2 size={16} className="text-green-500" />}
                  {m.status === 'pending' && <Clock        size={16} className="text-amber-500" />}
                  {m.status === 'never'   && <AlertCircle  size={16} className="text-red-400" />}
                </div>

                {/* Name + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {m.first_name} {m.last_name}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {m.status === 'paid' && m.last_paid_at
                      ? `Bezahlt vor ${daysSince(m.last_paid_at)} Tagen · ${m.total_payments}× insgesamt`
                      : m.status === 'pending' && m.last_paid_at
                      ? `Zuletzt vor ${daysSince(m.last_paid_at)} Tagen · überfällig`
                      : 'Noch nie bezahlt'}
                  </p>
                </div>

                {/* Right side */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold text-zinc-700">{formatCents(m.monthly_fee_cents)}</p>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                    m.status === 'paid'    ? 'bg-green-50 text-green-700' :
                    m.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                                            'bg-red-50 text-red-600'
                  }`}>
                    {m.status === 'paid' ? 'Aktuell' : m.status === 'pending' ? 'Ausstehend' : 'Nie bezahlt'}
                  </span>
                </div>
                <ChevronRight size={14} className="text-zinc-300 flex-shrink-0" />
              </Link>
            ))}
            {members.length === 0 && (
              <div className="py-12 text-center text-zinc-400 text-sm">Keine aktiven Mitglieder.</div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Zahlungshistorie</p>
            <span className="text-xs text-zinc-400">{allPayments.length} Transaktionen · {formatCents(allTimeCents)}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {allPayments.map(p => (
              <Link key={p.id} href={`/dashboard/members/${p.member_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                  <ArrowUpRight size={13} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{p.member_name}</p>
                  <p className="text-xs text-zinc-400">
                    {p.paid_at
                      ? new Date(p.paid_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : '–'}
                  </p>
                </div>
                <span className="text-sm font-semibold text-zinc-800 flex-shrink-0">{formatCents(p.amount_cents)}</span>
              </Link>
            ))}
            {allPayments.length === 0 && (
              <div className="py-12 text-center text-zinc-400 text-sm">Noch keine Zahlungen vorhanden.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
