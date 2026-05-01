'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, CheckCircle2, Clock, AlertCircle, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface PaymentRow { amount_cents: number; paid_at: string | null }
interface MonthGroup { month: string; label: string; count: number; total_cents: number }
interface MemberStatus {
  id: string
  name: string
  monthly_fee_cents: number
  last_paid_at: string | null
  last_amount_cents: number | null
  status: 'paid' | 'pending' | 'never'
}

function formatCents(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export default function RevenuePage() {
  const [loading, setLoading]           = useState(true)
  const [months, setMonths]             = useState<MonthGroup[]>([])
  const [allTimeCents, setAllTimeCents] = useState(0)
  const [allTimeCount, setAllTimeCount] = useState(0)
  const [members, setMembers]           = useState<MemberStatus[]>([])
  const [gymFeeCents, setGymFeeCents]   = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id, monthly_fee_cents').single()
      if (!gym) { setLoading(false); return }

      const gymData = gym as { id: string; monthly_fee_cents: number }
      setGymFeeCents(gymData.monthly_fee_cents ?? 0)

      const [paymentsRes, membersRes] = await Promise.all([
        supabase.from('payments').select('amount_cents, paid_at, member_id, status')
          .eq('gym_id', gymData.id).order('paid_at', { ascending: false }),
        supabase.from('members').select('id, first_name, last_name, monthly_fee_override_cents')
          .eq('gym_id', gymData.id).eq('is_active', true),
      ])

      const payments = (paymentsRes.data ?? []) as (PaymentRow & { member_id: string; status: string })[]
      const paidPayments = payments.filter(p => p.status === 'paid')

      // Monthly breakdown
      const map = new Map<string, { count: number; total_cents: number }>()
      for (const p of paidPayments) {
        if (!p.paid_at) continue
        const month = p.paid_at.substring(0, 7)
        const ex = map.get(month) ?? { count: 0, total_cents: 0 }
        map.set(month, { count: ex.count + 1, total_cents: ex.total_cents + p.amount_cents })
      }
      setMonths(Array.from(map.entries()).map(([month, stats]) => {
        const [year, m] = month.split('-')
        const date = new Date(Number(year), Number(m) - 1, 1)
        return { month, label: date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }), ...stats }
      }).sort((a, b) => b.month.localeCompare(a.month)))

      setAllTimeCents(paidPayments.reduce((s, p) => s + p.amount_cents, 0))
      setAllTimeCount(paidPayments.length)

      // Member payment status
      const activeMembers = (membersRes.data ?? []) as { id: string; first_name: string; last_name: string; monthly_fee_override_cents: number | null }[]
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const memberStatuses: MemberStatus[] = activeMembers.map(m => {
        const memberPayments = paidPayments.filter(p => p.member_id === m.id)
        const latest = memberPayments[0]
        const fee = m.monthly_fee_override_cents ?? gymData.monthly_fee_cents ?? 0

        let status: 'paid' | 'pending' | 'never' = 'never'
        if (latest?.paid_at) {
          status = latest.paid_at >= thirtyDaysAgo ? 'paid' : 'pending'
        }

        return {
          id: m.id,
          name: `${m.first_name} ${m.last_name}`,
          monthly_fee_cents: fee,
          last_paid_at: latest?.paid_at ?? null,
          last_amount_cents: latest?.amount_cents ?? null,
          status,
        }
      }).sort((a, b) => {
        const order = { pending: 0, never: 1, paid: 2 }
        return order[a.status] - order[b.status]
      })

      setMembers(memberStatuses)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Lädt…</div>

  const unpaidCount = members.filter(m => m.status !== 'paid').length
  const expectedMonthlyCents = members.reduce((s, m) => s + m.monthly_fee_cents, 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Einnahmen</h1>
        <p className="text-slate-400 text-xs mt-0.5">Zahlungsstatus und Monatsübersicht</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="inline-flex p-2 rounded-lg mb-2 bg-amber-50 text-amber-600"><TrendingUp size={16} /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCents(allTimeCents)}</div>
          <div className="text-slate-500 text-xs mt-0.5">Gesamteinnahmen</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="inline-flex p-2 rounded-lg mb-2 bg-green-50 text-green-600"><TrendingUp size={16} /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCents(expectedMonthlyCents)}</div>
          <div className="text-slate-500 text-xs mt-0.5">Soll / Monat</div>
        </div>
        {unpaidCount > 0 && (
          <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm">
            <div className="inline-flex p-2 rounded-lg mb-2 bg-red-50 text-red-500"><AlertCircle size={16} /></div>
            <div className="text-2xl font-bold text-red-600">{unpaidCount}</div>
            <div className="text-slate-500 text-xs mt-0.5">Ausstehend</div>
          </div>
        )}
      </div>

      {/* Member payment status */}
      {members.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mitglieder · Zahlungsstatus</p>
          </div>
          <div className="divide-y divide-gray-100">
            {members.map(m => (
              <Link key={m.id} href={`/dashboard/members/${m.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                {m.status === 'paid' && <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />}
                {m.status === 'pending' && <Clock size={15} className="text-amber-500 flex-shrink-0" />}
                {m.status === 'never' && <AlertCircle size={15} className="text-red-400 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{m.name}</p>
                  <p className="text-xs text-slate-400">
                    {m.status === 'paid' && m.last_paid_at
                      ? `Bezahlt vor ${daysSince(m.last_paid_at)} Tagen`
                      : m.status === 'pending' && m.last_paid_at
                      ? `Zuletzt vor ${daysSince(m.last_paid_at)} Tagen`
                      : 'Noch nie bezahlt'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-700">{formatCents(m.monthly_fee_cents)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    m.status === 'paid' ? 'bg-green-50 text-green-700' :
                    m.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-600'
                  }`}>
                    {m.status === 'paid' ? 'Aktuell' : m.status === 'pending' ? 'Ausstehend' : 'Nie bezahlt'}
                  </span>
                </div>
                <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      {months.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nach Monat</p>
          </div>
          <table className="w-full">
            <tbody>
              {months.map(m => (
                <tr key={m.month} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-slate-900 text-sm">{m.label}</td>
                  <td className="px-4 py-3.5 text-slate-400 text-sm">{m.count} Zahlung{m.count !== 1 ? 'en' : ''}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-900 text-sm">{formatCents(m.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <TrendingUp size={20} className="text-amber-500" />
          </div>
          <p className="text-slate-900 font-semibold text-sm mb-1">Noch keine Einnahmen</p>
          <p className="text-slate-400 text-xs">Erstelle Zahlungslinks in den Mitgliederprofilen.</p>
        </div>
      )}
    </div>
  )
}
