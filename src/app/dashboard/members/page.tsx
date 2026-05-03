'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Users, Upload, AlertTriangle, ChevronRight, Mail, Clock, MessageCircle, X, Copy, ExternalLink, Check, Download } from 'lucide-react'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'
import { type BeltSystem, resolveBeltSystem } from '@/lib/belt-system'
import { toWaPhone } from '@/lib/phone'

const BULK_TEMPLATES = [
  { id: 'info',    label: '📢 Allgemeine Info',        text: () => `Hallo! Kurze Nachricht von eurem Gym. 👋` },
  { id: 'payment', label: '💰 Beitragserinnerung',     text: () => `Hallo! Euer monatlicher Mitgliedsbeitrag ist fällig. Bitte überweist ihn diese Woche. Danke! 🙏` },
  { id: 'event',   label: '🥋 Trainings-Erinnerung',  text: () => `Hey! Heute Abend Training – wir sehen uns auf der Matte! Oss! 💪` },
  { id: 'comp',    label: '🏆 Wettkampf-Ankündigung', text: () => `Hey Leute! Wir nehmen am nächsten Wettkampf teil. Wer Interesse hat – meldet euch! Details folgen. Oss! 🏆` },
  { id: 'custom',  label: '✏️ Eigene Nachricht',       text: () => `` },
]

const SUB_COLORS: Record<string, string> = {
  active:    'bg-amber-50 text-amber-700 border border-amber-200',
  trial:     'bg-zinc-100 text-zinc-600 border border-zinc-200',
  past_due:  'bg-zinc-100 text-zinc-500 border border-zinc-200',
  cancelled: 'bg-zinc-100 text-zinc-500',
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
  onboarding_status: string | null; portal_token: string | null
  cancellation_requested_at: string | null
  requested_plan_id: string | null
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
  const [beltSystem, setBeltSystem]         = useState<BeltSystem | undefined>(undefined)
  const [beltEnabled, setBeltEnabled]       = useState(true)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const [bulkLoading, setBulkLoading]       = useState(false)
  const [bulkResult, setBulkResult]         = useState<string | null>(null)
  const [bulkMembers, setBulkMembers]       = useState<{ memberId: string; memberName: string; memberEmail: string; checkoutUrl: string | null; amountCents: number }[]>([])
  const [showBulkResults, setShowBulkResults] = useState(false)
  const [search, setSearch]                 = useState('')
  const [activatingId, setActivatingId]     = useState<string | null>(null)
  const [activatedMember, setActivatedMember] = useState<Member | null>(null)
  const [showWaModal, setShowWaModal]       = useState(false)
  const [copiedId, setCopiedId]             = useState<string | null>(null)

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(key)
    setTimeout(() => setCopiedId(prev => prev === key ? null : prev), 2000)
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id, monthly_fee_cents, belt_system, belt_system_enabled').single()
      if (!gym) { setLoading(false); return }
      setGymId(gym.id)
      setMonthlyFeeCents(gym.monthly_fee_cents ?? 0)
      setBeltSystem(resolveBeltSystem((gym as any)?.belt_system))
      setBeltEnabled((gym as any)?.belt_system_enabled ?? true)
      const { data } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, phone, belt, stripes, join_date, is_active, subscription_status, contract_end_date, monthly_fee_override_cents, onboarding_status, portal_token, cancellation_requested_at, requested_plan_id')
        .eq('gym_id', gym.id).order('last_name').limit(1000)
      setMembers((data as unknown as Member[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const pending  = members.filter(m => m.onboarding_status === 'pending')
  const nonPending = members.filter(m => m.onboarding_status !== 'pending')
  const filtered = nonPending.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q)
  })
  const active   = nonPending.filter(m => m.is_active)
  const inactive = nonPending.filter(m => !m.is_active)
  const pendingRequests = nonPending.filter(m => m.cancellation_requested_at || m.requested_plan_id)
  const activeWithEmail = active.filter(m => m.email)

  function downloadCSV() {
    const headers = [
      'Vorname', 'Nachname', 'E-Mail', 'Telefon', 'Geburtsdatum',
      'Gürtel', 'Stripes', 'Mitglied seit', 'Status', 'Abo-Status',
      'Vertrag bis', 'Beitrag (€)',
    ]
    const rows = members.map(m => [
      m.first_name,
      m.last_name,
      m.email ?? '',
      m.phone ?? '',
      (m as { date_of_birth?: string | null }).date_of_birth ?? '',
      m.belt,
      String(m.stripes),
      m.join_date,
      m.is_active ? 'Aktiv' : 'Inaktiv',
      (m as { subscription_status?: string }).subscription_status ?? '',
      m.contract_end_date ?? '',
      ((m as { monthly_fee_override_cents?: number | null }).monthly_fee_override_cents ?? 0) > 0
        ? (((m as { monthly_fee_override_cents?: number | null }).monthly_fee_override_cents ?? 0) / 100).toFixed(2).replace('.', ',')
        : '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `mitglieder-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

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
      if (res.ok) {
        setBulkResult(`${json.count} Zahlungslinks erstellt.`)
        setBulkMembers(json.members ?? [])
        setShowBulkResults(true)
      } else {
        setBulkResult(`Fehler: ${json.error}`)
      }
    } catch { setBulkResult('Fehler beim Erstellen der Zahlungslinks.') }
    finally { setBulkLoading(false); setShowBulkConfirm(false) }
  }

  async function activateMember(id: string) {
    setActivatingId(id)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/members/${id}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    if (res.ok) {
      setMembers(prev => prev.map(m => m.id === id ? { ...m, is_active: true, onboarding_status: 'complete' } : m))
      const member = members.find(m => m.id === id)
      if (member) setActivatedMember({ ...member, is_active: true, onboarding_status: 'complete' })
    }
    setActivatingId(null)
  }

  if (loading) return <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Lädt…</div>

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Mitglieder</h1>
          <p className="text-zinc-400 text-xs mt-0.5 font-medium">{active.length} aktiv · {inactive.length} inaktiv</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/dashboard/members/import"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-medium text-sm transition-colors shadow-sm">
            <Upload size={14} /> CSV
          </Link>
          <button onClick={handleEmailAll}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-medium text-sm transition-colors shadow-sm"
            title={`E-Mail an ${activeWithEmail.length} Mitglieder`}>
            <Mail size={14} /> E-Mail
          </button>
          <button onClick={() => setShowWaModal(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-semibold text-sm transition-colors shadow-sm"
            title="WhatsApp Nachrichten vorbereiten">
            <MessageCircle size={14} /> WhatsApp
          </button>
          <button onClick={downloadCSV}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 font-medium text-sm transition-colors shadow-sm"
            title="Mitgliederliste als CSV exportieren">
            <Download size={14} /> Export
          </button>
          <button onClick={() => setShowBulkConfirm(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-sm transition-colors border border-amber-200">
            Alle anfordern
          </button>
          <Link href="/dashboard/members/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-sm transition-colors shadow-sm">
            <Plus size={14} /> Mitglied
          </Link>
        </div>
      </div>

      {/* Search */}
      <input
        type="search" placeholder="Name oder E-Mail suchen…"
        value={search} onChange={e => setSearch(e.target.value)}
        className="w-full mb-4 px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 shadow-sm"
      />

      {bulkResult && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-100 border border-zinc-200 text-zinc-700 text-sm font-medium">{bulkResult}</div>
      )}

      {/* Pending member requests (cancellations / plan changes) */}
      {pendingRequests.length > 0 && (
        <div className="mb-4 bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Offene Mitglieder-Anfragen</span>
            <span className="ml-auto text-xs font-semibold text-zinc-600 bg-zinc-200 px-2 py-0.5 rounded-full border border-zinc-300">{pendingRequests.length}</span>
          </div>
          <div className="divide-y divide-zinc-100">
            {pendingRequests.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-zinc-700">{m.first_name[0]}{m.last_name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{m.first_name} {m.last_name}</p>
                  <div className="flex gap-2 mt-0.5">
                    {m.cancellation_requested_at && (
                      <span className="text-xs text-zinc-500 font-medium">Kündigung beantragt</span>
                    )}
                    {m.requested_plan_id && (
                      <span className="text-xs text-amber-600 font-medium">Plan-Änderung beantragt</span>
                    )}
                  </div>
                </div>
                <Link href={`/dashboard/members/${m.id}`}
                  className="text-xs text-zinc-600 hover:text-zinc-900 font-medium flex-shrink-0">Details →</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending sign-ups */}
      {pending.length > 0 && (
        <div className="mb-4 bg-amber-50 rounded-xl border border-amber-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
            <Clock size={13} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Ausstehende Anmeldungen</span>
            <span className="ml-auto text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">{pending.length}</span>
          </div>
          <div className="divide-y divide-amber-100">
            {pending.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-amber-700">{m.first_name[0]}{m.last_name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{m.first_name} {m.last_name}</p>
                  {m.email && <p className="text-xs text-zinc-500 truncate">{m.email}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/dashboard/members/${m.id}`}
                    className="text-xs text-amber-700 hover:text-amber-600 font-medium">Details</Link>
                  <button
                    onClick={() => activateMember(m.id)}
                    disabled={activatingId === m.id}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                    {activatingId === m.id ? '…' : 'Aktivieren'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk confirm */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-lg max-w-sm w-full">
            <h2 className="font-bold text-zinc-900 mb-2">Beiträge anfordern</h2>
            <p className="text-zinc-600 text-sm mb-5">
              Zahlungslinks für <span className="font-semibold">{activeWithEmail.length} Mitglieder</span> erstellen? Die Links werden angezeigt, damit du sie per WhatsApp oder E-Mail versenden kannst.
            </p>
            <div className="flex gap-3">
              <button onClick={handleBulkCheckout} disabled={bulkLoading}
                className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm">
                {bulkLoading ? 'Wird gesendet…' : 'Bestätigen'}
              </button>
              <button onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {filtered.length > 0 ? (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/80">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Name</th>
                  {beltEnabled && <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Gürtel</th>}
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Seit</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Beitrag</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const cs = contractStatus(m.contract_end_date)
                  const feeCents = m.monthly_fee_override_cents ?? monthlyFeeCents
                  const subStatus = m.subscription_status ?? 'none'
                  return (
                    <tr key={m.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-zinc-900 text-sm truncate">{m.first_name} {m.last_name}</span>
                          {cs === 'expired' && <span title="Vertrag abgelaufen" className="flex-shrink-0"><AlertTriangle size={12} className="text-red-500" /></span>}
                          {cs === 'expiring' && <span title="Vertrag läuft ab" className="flex-shrink-0"><AlertTriangle size={12} className="text-amber-500" /></span>}
                        </div>
                        {m.email && <div className="text-xs text-zinc-400 truncate max-w-full">{m.email}</div>}
                      </td>
                      {beltEnabled && <td className="px-4 py-3.5"><BeltBadge belt={m.belt as Belt} stripes={m.stripes} beltSystem={beltSystem} /></td>}
                      <td className="px-4 py-3.5 text-zinc-500 text-sm">{new Date(m.join_date).toLocaleDateString('de-DE')}</td>
                      <td className="px-4 py-3.5">
                        {feeCents > 0 ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SUB_COLORS[subStatus] || 'text-zinc-500'}`}>
                            {subStatus !== 'none' ? SUB_LABELS[subStatus] : formatCents(feeCents)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.is_active ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-zinc-100 text-zinc-400'
                        }`}>
                          {m.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {m.phone && (
                            <a href={`https://wa.me/${toWaPhone(m.phone)}?text=${encodeURIComponent(`Hallo ${m.first_name}! 👋`)}`}
                              target="_blank" rel="noopener noreferrer"
                              title="WhatsApp"
                              className="text-[#25D366] hover:text-[#1ebe57] transition-colors">
                              <MessageCircle size={15} />
                            </a>
                          )}
                          <Link href={`/dashboard/members/${m.id}`} className="text-amber-600 hover:text-amber-500 text-sm font-medium">Details →</Link>
                        </div>
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
                  className="flex items-center gap-3 bg-white rounded-xl border border-zinc-200 p-3.5 hover:bg-zinc-50 transition-colors shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-amber-600">{m.first_name[0]}{m.last_name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-zinc-900 text-sm truncate">{m.first_name} {m.last_name}</span>
                      {cs === 'expired' && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
                      {cs === 'expiring' && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {beltEnabled && <BeltBadge belt={m.belt as Belt} stripes={m.stripes} beltSystem={beltSystem} />}
                      {feeCents > 0 && subStatus !== 'none' && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SUB_COLORS[subStatus]}`}>
                          {SUB_LABELS[subStatus]}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-zinc-200 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <Users size={20} className="text-amber-500" />
          </div>
          <p className="text-zinc-900 font-semibold text-sm mb-1">
            {search ? 'Keine Ergebnisse' : 'Noch keine Mitglieder'}
          </p>
          <p className="text-zinc-400 text-xs mb-4">
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

      {/* Activation notification modal */}
      {activatedMember && (
        <ActivationModal member={activatedMember} onClose={() => setActivatedMember(null)} />
      )}

      {/* WhatsApp Bulk Modal */}
      {showWaModal && (
        <WhatsAppBulkModal
          members={active.filter(m => m.phone)}
          onClose={() => setShowWaModal(false)}
        />
      )}

      {/* Bulk Checkout Results Modal */}
      {showBulkResults && bulkMembers.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowBulkResults(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 flex-shrink-0">
              <div>
                <p className="font-bold text-zinc-900 text-sm">Zahlungslinks erstellt</p>
                <p className="text-zinc-400 text-xs">{bulkMembers.length} Links — per WhatsApp oder Kopieren versenden</p>
              </div>
              <button onClick={() => setShowBulkResults(false)} className="text-zinc-400 hover:text-zinc-600 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {bulkMembers.map(m => {
                const memberRecord = members.find(mem => mem.id === m.memberId)
                const phone = memberRecord?.phone ?? null
                const waText = `Hallo ${m.memberName}, hier ist dein Zahlungslink für diesen Monat: ${m.checkoutUrl}`
                const waUrl = phone
                  ? `https://wa.me/${toWaPhone(phone)}?text=${encodeURIComponent(waText)}`
                  : null
                return (
                  <div key={m.memberId} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 bg-white">
                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-amber-600">
                        {m.memberName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{m.memberName}</p>
                      <p className="text-xs text-zinc-400 truncate">{m.memberEmail}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {m.checkoutUrl && (
                        <>
                          <a href={m.checkoutUrl} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors" title="Link öffnen">
                            <ExternalLink size={14} />
                          </a>
                          <button
                            onClick={() => handleCopy(m.checkoutUrl!, `checkout-${m.memberId}`)}
                            className={`p-1.5 rounded-lg transition-colors ${copiedId === `checkout-${m.memberId}` ? 'text-green-600 bg-green-50' : 'text-zinc-500 hover:bg-zinc-100'}`}
                            title="Link kopieren">
                            {copiedId === `checkout-${m.memberId}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </>
                      )}
                      {waUrl ? (
                        <a href={waUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe57] text-white text-xs font-semibold transition-colors">
                          <MessageCircle size={12} />
                          WhatsApp
                        </a>
                      ) : (
                        <button
                          onClick={() => handleCopy(waText, `wa-${m.memberId}`)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${copiedId === `wa-${m.memberId}` ? 'bg-green-100 text-green-700' : 'bg-zinc-100 hover:bg-slate-200 text-zinc-700'}`}
                          title="Nachricht + Link kopieren">
                          {copiedId === `wa-${m.memberId}` ? <Check size={12} /> : <Copy size={12} />}
                          {copiedId === `wa-${m.memberId}` ? 'Kopiert!' : 'Kopieren'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActivationModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [copiedPortal, setCopiedPortal] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const portalUrl = member.portal_token ? `${origin}/portal/${member.portal_token}` : null
  const waText = `Hallo ${member.first_name}! 🥋 Willkommen im Gym – dein Profil ist jetzt aktiv.\n\nHier findest du deine Trainings, Zahlungen und Statistiken:\n${portalUrl ?? origin}`
  const mailtoUrl = member.email
    ? `mailto:${member.email}?subject=${encodeURIComponent('Willkommen im Gym – dein Profil ist aktiv!')}&body=${encodeURIComponent(`Hallo ${member.first_name}!\n\nDein Mitgliedsprofil ist jetzt aktiv.\n\nHier ist dein persönlicher Bereich:\n${portalUrl ?? origin}\n\nOss! 🥋`)}`
    : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
          <p className="font-bold text-zinc-900 text-sm">✓ {member.first_name} {member.last_name} aktiviert!</p>
          <p className="text-zinc-500 text-xs mt-0.5">Jetzt benachrichtigen:</p>
        </div>
        <div className="p-5 space-y-3">
          {member.phone && (
            <a href={`https://wa.me/${toWaPhone(member.phone)}?text=${encodeURIComponent(waText)}`}
              target="_blank" rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-semibold text-sm transition-colors">
              <MessageCircle size={18} />
              <div className="text-left">
                <p>Per WhatsApp senden</p>
                <p className="text-white/70 text-xs font-normal">{member.phone}</p>
              </div>
            </a>
          )}
          {mailtoUrl && (
            <a href={mailtoUrl} onClick={onClose}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-zinc-100 hover:bg-slate-200 text-zinc-700 font-semibold text-sm transition-colors">
              <Mail size={18} />
              <div className="text-left">
                <p>Per E-Mail senden</p>
                <p className="text-zinc-400 text-xs font-normal">{member.email}</p>
              </div>
            </a>
          )}
          {portalUrl && (
            <button onClick={() => {
                navigator.clipboard.writeText(portalUrl!)
                setCopiedPortal(true)
                setTimeout(() => { setCopiedPortal(false); onClose() }, 1200)
              }}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border font-semibold text-sm transition-colors ${copiedPortal ? 'border-green-200 bg-green-50 text-green-700' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-700'}`}>
              {copiedPortal ? <Check size={18} /> : <Copy size={18} />}
              <div className="text-left">
                <p>{copiedPortal ? 'Kopiert!' : 'Profillink kopieren'}</p>
                <p className="text-xs font-normal truncate max-w-[200px] opacity-60">{portalUrl}</p>
              </div>
            </button>
          )}
          <button onClick={onClose} className="w-full py-2 text-zinc-400 text-sm hover:text-zinc-600">
            Später senden
          </button>
        </div>
      </div>
    </div>
  )
}

function WhatsAppBulkModal({ members, onClose }: {
  members: { id: string; first_name: string; last_name: string; phone: string | null }[]
  onClose: () => void
}) {
  const [templateId, setTemplateId] = useState(BULK_TEMPLATES[0].id)
  const [customMsg, setCustomMsg]   = useState('')
  const [step, setStep]             = useState<'compose' | 'send'>('compose')
  const [sentIdx, setSentIdx]       = useState<Set<string>>(new Set())

  const tmpl    = BULK_TEMPLATES.find(t => t.id === templateId)!
  const message = templateId === 'custom' ? customMsg : tmpl.text()

  function markSent(id: string) { setSentIdx(prev => new Set([...prev, id])) }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#128C7E] text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} />
            <div>
              <p className="font-bold text-sm">WhatsApp Nachrichten vorbereiten</p>
              <p className="text-white/70 text-xs">{members.length} Mitglieder mit Nummer</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1">
          {step === 'compose' ? (
            <div className="p-5 space-y-4">
              {/* Template picker */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Vorlage wählen</p>
                <div className="space-y-1.5">
                  {BULK_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => setTemplateId(t.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        templateId === t.id
                          ? 'bg-[#25D366]/10 text-[#128C7E] font-semibold border border-[#25D366]/30'
                          : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Message */}
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Nachricht</p>
                <textarea
                  value={templateId === 'custom' ? customMsg : tmpl.text()}
                  onChange={e => { setTemplateId('custom'); setCustomMsg(e.target.value) }}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm focus:outline-none focus:border-[#25D366] resize-none"
                />
              </div>
              <button onClick={() => setStep('send')} disabled={!message.trim()}
                className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] disabled:opacity-40 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
                <MessageCircle size={16} /> Weiter → Nachrichten senden
              </button>
            </div>
          ) : (
            <div className="p-5">
              <div className="mb-4 p-3 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20">
                <p className="text-xs font-semibold text-[#128C7E] mb-1">Deine Nachricht:</p>
                <p className="text-sm text-zinc-700">{message}</p>
              </div>
              <p className="text-xs text-zinc-500 mb-3">Klicke pro Mitglied auf den Button — WhatsApp öffnet sich mit der Nachricht vorausgefüllt.</p>
              <div className="space-y-2">
                {members.map(m => {
                  const done = sentIdx.has(m.id)
                  const waUrl = `https://wa.me/${toWaPhone(m.phone!)}?text=${encodeURIComponent(message)}`
                  return (
                    <div key={m.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      done ? 'bg-zinc-50 border-zinc-200' : 'bg-white border-zinc-200'
                    }`}>
                      <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-[#128C7E]">{m.first_name[0]}{m.last_name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-zinc-400 truncate">{m.phone}</p>
                      </div>
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        onClick={() => markSent(m.id)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          done
                            ? 'bg-zinc-200 text-zinc-700 border border-zinc-300'
                            : 'bg-[#25D366] hover:bg-[#1ebe57] text-white'
                        }`}>
                        <MessageCircle size={12} />
                        {done ? '✓ Gesendet' : 'Senden'}
                      </a>
                    </div>
                  )
                })}
              </div>
              {sentIdx.size > 0 && (
                <p className="mt-4 text-center text-xs text-zinc-400">{sentIdx.size} von {members.length} gesendet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
