'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Users, Upload, AlertTriangle } from 'lucide-react'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'

const SUB_COLORS: Record<string, string> = {
  active:    'bg-green-50 text-green-700 border border-green-200',
  trial:     'bg-blue-50 text-blue-700 border border-blue-200',
  past_due:  'bg-red-50 text-red-700 border border-red-200',
  cancelled: 'bg-slate-100 text-slate-500',
  none:      'bg-slate-100 text-slate-400',
}
const SUB_LABELS: Record<string, string> = {
  active: 'Aktiv', trial: 'Testphase', past_due: 'Ueberfaellig', cancelled: 'Gekuendigt', none: '–',
}

interface Member {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  belt: string
  stripes: number
  join_date: string
  is_active: boolean
  subscription_status: string | null
  contract_end_date: string | null
}

function contractStatus(endDate: string | null): 'ok' | 'expiring' | 'expired' {
  if (!endDate) return 'ok'
  const end = new Date(endDate)
  const now = new Date()
  const diffDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'expiring'
  return 'ok'
}

export default function MembersPage() {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [gymId, setGymId] = useState('')
  const [monthlyFeeCents, setMonthlyFeeCents] = useState(0)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id, monthly_fee_cents').single()
      if (!gym) { setLoading(false); return }

      setGymId(gym.id)
      setMonthlyFeeCents(gym.monthly_fee_cents ?? 0)

      const { data } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, phone, belt, stripes, join_date, is_active, subscription_status, contract_end_date')
        .eq('gym_id', gym.id)
        .order('last_name')

      setMembers((data as Member[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const active = members.filter(m => m.is_active)
  const inactive = members.filter(m => !m.is_active)
  const activeWithEmail = active.filter(m => m.email)

  async function handleBulkCheckout() {
    setBulkLoading(true)
    setBulkResult(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch('/api/stripe/bulk-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gymId, amountCents: monthlyFeeCents }),
      })
      const json = await res.json()
      if (!res.ok) setBulkResult(`Fehler: ${json.error}`)
      else setBulkResult(`${json.count} Zahlungslinks erstellt.`)
    } catch {
      setBulkResult('Fehler beim Erstellen der Zahlungslinks.')
    } finally {
      setBulkLoading(false)
      setShowBulkConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Laedt...</div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mitglieder</h1>
          <p className="text-slate-500 text-sm mt-1">{active.length} aktiv · {inactive.length} inaktiv</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/members/import"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-colors shadow-sm"
          >
            <Upload size={16} />
            CSV importieren
          </Link>
          <button
            onClick={() => setShowBulkConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold text-sm transition-colors shadow-sm border border-amber-200"
          >
            Alle Beitraege anfordern
          </button>
          <Link
            href="/dashboard/members/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <Plus size={16} />
            Mitglied hinzufuegen
          </Link>
        </div>
      </div>

      {bulkResult && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm font-medium">
          {bulkResult}
        </div>
      )}

      {/* Bulk confirm dialog */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-lg max-w-sm w-full mx-4">
            <h2 className="font-bold text-slate-900 text-lg mb-2">Beitraege anfordern</h2>
            <p className="text-slate-600 text-sm mb-5">
              Zahlungslink an <span className="font-semibold text-slate-900">{activeWithEmail.length} aktive Mitglieder</span> mit E-Mail senden?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBulkCheckout}
                disabled={bulkLoading}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
              >
                {bulkLoading ? 'Wird gesendet...' : 'Bestaetigen'}
              </button>
              <button
                onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {members.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Belt</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Mitglied seit</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Beitrag</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {members.map(member => {
                const cs = contractStatus(member.contract_end_date)
                return (
                  <tr key={member.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900">{member.first_name} {member.last_name}</span>
                        {cs === 'expired' && (
                          <span title="Vertrag abgelaufen"><AlertTriangle size={14} className="text-red-500 flex-shrink-0" /></span>
                        )}
                        {cs === 'expiring' && (
                          <span title="Vertrag laeuft bald ab"><AlertTriangle size={14} className="text-amber-500 flex-shrink-0" /></span>
                        )}
                      </div>
                      {member.email && <div className="text-xs text-slate-400 mt-0.5">{member.email}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <BeltBadge belt={member.belt as Belt} stripes={member.stripes} />
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-sm hidden md:table-cell">
                      {new Date(member.join_date).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SUB_COLORS[member.subscription_status ?? 'none']}`}>
                        {SUB_LABELS[member.subscription_status ?? 'none']}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        member.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {member.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/members/${member.id}`}
                        className="text-amber-600 hover:text-amber-500 text-sm font-medium"
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-amber-500" />
          </div>
          <p className="text-slate-900 font-semibold mb-2">Noch keine Mitglieder</p>
          <p className="text-slate-400 text-sm mb-6">Fuege dein erstes Mitglied hinzu.</p>
          <Link
            href="/dashboard/members/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <Plus size={16} />
            Mitglied hinzufuegen
          </Link>
        </div>
      )}
    </div>
  )
}
