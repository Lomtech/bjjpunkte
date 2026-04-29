'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp } from 'lucide-react'

interface PaymentRow { amount_cents: number; paid_at: string | null }
interface MonthGroup { month: string; label: string; count: number; total_cents: number }

function formatCents(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export default function RevenuePage() {
  const [loading, setLoading]           = useState(true)
  const [months, setMonths]             = useState<MonthGroup[]>([])
  const [allTimeCents, setAllTimeCents] = useState(0)
  const [allTimeCount, setAllTimeCount] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id').single()
      if (!gym) { setLoading(false); return }

      const { data } = await supabase
        .from('payments').select('amount_cents, paid_at')
        .eq('gym_id', gym.id).eq('status', 'paid')
        .order('paid_at', { ascending: false })

      const payments = (data as PaymentRow[]) ?? []
      const map = new Map<string, { count: number; total_cents: number }>()
      for (const p of payments) {
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

      setAllTimeCents(payments.reduce((s, p) => s + p.amount_cents, 0))
      setAllTimeCount(payments.length)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Lädt…</div>

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Einnahmen</h1>
        <p className="text-slate-400 text-xs mt-0.5">Alle bezahlten Beiträge nach Monat</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="inline-flex p-2 rounded-lg mb-2 bg-amber-50 text-amber-600"><TrendingUp size={16} /></div>
          <div className="text-2xl font-bold text-slate-900">{formatCents(allTimeCents)}</div>
          <div className="text-slate-500 text-xs mt-0.5">Gesamteinnahmen</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="inline-flex p-2 rounded-lg mb-2 bg-green-50 text-green-600"><TrendingUp size={16} /></div>
          <div className="text-2xl font-bold text-slate-900">{allTimeCount}</div>
          <div className="text-slate-500 text-xs mt-0.5">Zahlungen gesamt</div>
        </div>
      </div>

      {months.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Monat</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Zahlungen</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {months.map(m => (
                <tr key={m.month} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-slate-900 text-sm">{m.label}</td>
                  <td className="px-4 py-3.5 text-slate-500 text-sm">{m.count}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-900 text-sm">{formatCents(m.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <TrendingUp size={20} className="text-amber-500" />
          </div>
          <p className="text-slate-900 font-semibold text-sm mb-1">Noch keine Einnahmen</p>
          <p className="text-slate-400 text-xs">Bezahlte Beiträge erscheinen hier.</p>
        </div>
      )}
    </div>
  )
}
