'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Users, Upload, AlertTriangle, ChevronRight, Mail } from 'lucide-react'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'

const SUB_COLORS: Record<string, string> = {
  active:    'bg-green-50 text-green-700 border border-green-200',
  trial:     'bg-blue-50 text-blue-700 border border-blue-200',
  past_due:  'bg-red-50 text-red-700 border border-red-200',
  cancelled: 'bg-gray-100 text-slate-500',
  none:      '',
}
const SUB_LABELS: Record<string, string> = {
  active: 'Aktiv', trial: 'Testphase', past_due: 'Überfällig', cancelled: 'Gekündigt', none: '',
}

interface Member {
  id: string; first_name: string; last_name: string
  email: string | null; phone: string | null
  belt: string; stripes: number; join_date: string
  is_active: boolean; subscription_status: string | null
  contract_end_date: string | null; monthly_fee_override_cents: number | null
}

function contractStatus(endDate: string | null): 'ok' | 'expiring' | 'expired' {
  if (!endDate) return 'ok'
  const diffDays = (new Date(endDate).getTime() - Date.now()) / 86400000
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'expiring'
  return 'ok'
}

function formatCents(cents: number) {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}

export default function MembersPage() {
  const [loading, setLoading]               = useState(true)
  const [members, setMembers]               = useState<Member[]>([])
  const [gymId, setGymId]                   = useState('')
  const [monthlyFeeCents, setMonthlyFeeCents] = useState(0)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkLoading, setBulkLoading]       = useState(false)
  const [bulkResult, setBulkResult]         = useState<string | null>(null)
  const [search, setSearch]                 = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id, monthly_fee_cents').single()
      if (!gym) { setLoading(false); return }
      setGymId(gym.id)
      setMonthlyFeeCents(gym.monthly_fee_cents ?? 0)
      const { data } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, phone, belt, stripes, join_date, is_active, subscription_status, contract_end_date, monthly_fee_override_cents')
        .eq('gym_id', gym.id).order('last_name')
      setMembers((data as Member[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = members.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q)
  })
  const active   = members.filter(m => m.is_active)
  const inactive = members.filter(m => !m.is_active)
  const activeWithEmail = active.filter(m => m.email)

  function handleEmailAll() {
    const emails = activeWithEmail.map(m => m.email).join(',')
    window.open(`mailto:${emails}?subject=Information%20von%20eurem%20Gym`, '_blank')
  }

  async function handleBulkCheckout() {
    setBulkLoading(true); setBulkResult(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch('/api/stripe/bulk-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ gymId, amountCents: monthlyFeeCents }),
      })
      const json = await res.json()
      setBulkResult(res.ok ? `${json.count} Zahlungslinks erstellt.` : `Fehler: ${json.error}`)
    } catch { setBulkResult('Fehler beim Erstellen der Zahlungslinks.') }
    finally { setBulkLoading(false); setShowBulkConfirm(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Lädt…</div>

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">Mitglieder</h1>
          <p className="text-slate-400 text-xs mt-0.5">{active.length} aktiv · {inactive.length} inaktiv</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/dashboard/members/import"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 font-medium text-sm transition-colors">
            <Upload size={14} /> CSV
          </Link>
          <button onClick={handleEmailAll}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 font-medium text-sm transition-colors"
            title={`E-Mail an ${activeWithEmail.length} Mitglieder`}>
            <Mail size={14} /> E-Mail
          </button>
          <button onClick={() => setShowBulkConfirm(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium text-sm transition-colors border border-amber-200">
            Alle anfordern
          </button>
          <Link href="/dashboard/members/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors">
            <Plus size={14} /> Mitglied
          </Link>
        </div>
      </div>

      {/* Search */}
      <input
        type="search" placeholder="Name oder E-Mail suchen…"
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full mb-4 px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />

      {bulkResult && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm font-medium">{bulkResult}</div>
      )}

      {/* Bulk confirm */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg max-w-sm w-full">
            <h2 className="font-bold text-slate-900 mb-2">Beiträge anfordern</h2>
            <p className="text-slate-600 text-sm mb-5">
              Zahlungslink an <span className="font-semibold">{activeWithEmail.length} Mitglieder</span> mit E-Mail senden?
            </p>
            <div className="flex gap-3">
              <button onClick={handleBulkCheckout} disabled={bulkLoading}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm">
                {bulkLoading ? 'Wird gesendet…' : 'Bestätigen'}
              </button>
              <button onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 text-sm">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {filtered.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gürtel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Seit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Beitrag</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const cs = contractStatus(m.contract_end_date)
                  const feeCents = m.monthly_fee_override_cents ?? monthlyFeeCents
                  const subStatus = m.subscription_status ?? 'none'
                  return (
                    <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-slate-900 text-sm truncate">{m.first_name} {m.last_name}</span>
                          {cs === 'expired' && <span title="Vertrag abgelaufen" className="flex-shrink-0"><AlertTriangle size={12} className="text-red-500" /></span>}
                          {cs === 'expiring' && <span title="Vertrag läuft ab" className="flex-shrink-0"><AlertTriangle size={12} className="text-amber-500" /></span>}
                        </div>
                        {m.email && <div className="text-xs text-slate-400 truncate max-w-full">{m.email}</div>}
                      </td>
                      <td className="px-4 py-3.5"><BeltBadge belt={m.belt as Belt} stripes={m.stripes} /></td>
                      <td className="px-4 py-3.5 text-slate-500 text-sm">{new Date(m.join_date).toLocaleDateString('de-DE')}</td>
                      <td className="px-4 py-3.5">
                        {feeCents > 0 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SUB_COLORS[subStatus] || 'text-slate-500'}`}>
                            {subStatus !== 'none' ? SUB_LABELS[subStatus] : formatCents(feeCents)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-slate-400'
                        }`}>
                          {m.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`/dashboard/members/${m.id}`} className="text-amber-600 hover:text-amber-500 text-sm font-medium">Details →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {filtered.map(m => {
              const cs = contractStatus(m.contract_end_date)
              const feeCents = m.monthly_fee_override_cents ?? monthlyFeeCents
              const subStatus = m.subscription_status ?? 'none'
              return (
                <Link key={m.id} href={`/dashboard/members/${m.id}`}
                  className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-3.5 hover:bg-gray-50 transition-colors shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-amber-600">{m.first_name[0]}{m.last_name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900 text-sm truncate">{m.first_name} {m.last_name}</span>
                      {cs === 'expired' && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                      {cs === 'expiring' && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <BeltBadge belt={m.belt as Belt} stripes={m.stripes} />
                      {feeCents > 0 && subStatus !== 'none' && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SUB_COLORS[subStatus]}`}>
                          {SUB_LABELS[subStatus]}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <Users size={20} className="text-amber-500" />
          </div>
          <p className="text-slate-900 font-semibold text-sm mb-1">
            {search ? 'Keine Ergebnisse' : 'Noch keine Mitglieder'}
          </p>
          <p className="text-slate-400 text-xs mb-4">
            {search ? `Keine Mitglieder für "${search}"` : 'Füge dein erstes Mitglied hinzu.'}
          </p>
          {!search && (
            <Link href="/dashboard/members/new"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm">
              <Plus size={14} /> Mitglied hinzufügen
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
