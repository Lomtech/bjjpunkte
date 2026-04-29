'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp } from 'lucide-react'

interface PaymentRow {
  amount_cents: number
  paid_at: string | null
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

export default function RevenuePage() {
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<MonthGroup[]>([])
  const [allTimeCents, setAllTimeCents] = useState(0)
  const [allTimeCount, setAllTimeCount] = useState(0)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id').single()
      if (!gym) { setLoading(false); return }

      const { data } = await supabase
        .from('payments')
        .select('amount_cents, paid_at')
        .eq('gym_id', gym.id)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })

      const payments = (data as PaymentRow[]) ?? []

      // Group by month
      const map = new Map<string, { count: number; total_cents: number }>()
      for (const p of payments) {
        if (!p.paid_at) continue
        const month = p.paid_at.substring(0, 7) // YYYY-MM
        const existing = map.get(month) ?? { count: 0, total_cents: 0 }
        map.set(month, { count: existing.count + 1, total_cents: existing.total_cents + p.amount_cents })
      }

      const grouped: MonthGroup[] = Array.from(map.entries()).map(([month, stats]) => {
        const [year, m] = month.split('-')
        const date = new Date(Number(year), Number(m) - 1, 1)
        return {
          month,
          label: date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
          count: stats.count,
          total_cents: stats.total_cents,
        }
      }).sort((a, b) => b.month.localeCompare(a.month))

      setMonths(grouped)
      setAllTimeCents(payments.reduce((sum, p) => sum + p.amount_cents, 0))
      setAllTimeCount(payments.length)
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
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Einnahmen</h1>
        <p className="text-slate-500 text-sm mt-1">Alle bezahlten Beitraege nach Monat</p>
      </div>

      {/* All-time summary */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="inline-flex p-2 rounded-lg mb-3 bg-amber-50 text-amber-600">
            <TrendingUp size={18} />
          </div>
          <div className="text-3xl font-bold text-slate-900">{formatCents(allTimeCents)}</div>
          <div className="text-slate-500 text-sm mt-1">Gesamteinnahmen</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="inline-flex p-2 rounded-lg mb-3 bg-green-50 text-green-600">
            <TrendingUp size={18} />
          </div>
          <div className="text-3xl font-bold text-slate-900">{allTimeCount}</div>
          <div className="text-slate-500 text-sm mt-1">Zahlungen gesamt</div>
        </div>
      </div>

      {months.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Monat</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Anzahl Zahlungen</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Betrag gesamt</th>
              </tr>
            </thead>
            <tbody>
              {months.map(m => (
                <tr key={m.month} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 font-medium text-slate-900">{m.label}</td>
                  <td className="px-5 py-4 text-slate-500 text-sm">{m.count}</td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatCents(m.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={24} className="text-amber-500" />
          </div>
          <p className="text-slate-900 font-semibold mb-2">Noch keine Einnahmen</p>
          <p className="text-slate-400 text-sm">Bezahlte Beitraege erscheinen hier.</p>
        </div>
      )}
    </div>
  )
}
