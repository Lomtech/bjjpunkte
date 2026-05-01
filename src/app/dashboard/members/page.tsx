'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Users, Upload, AlertTriangle, ChevronRight, Mail, Clock, MessageCircle, X, Copy, ExternalLink } from 'lucide-react'

function toWaPhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('0'))  p = '+49' + p.slice(1)
  return p.replace(/^\+/, '')
}

const BULK_TEMPLATES = [
  { id: 'info',    label: '📢 Allgemeine Info',        text: () => `Hallo! Kurze Nachricht von eurem Gym. 👋` },
  { id: 'payment', label: '💰 Beitragserinnerung',     text: () => `Hallo! Euer monatlicher Mitgliedsbeitrag ist fällig. Bitte überweist ihn diese Woche. Danke! 🙏` },
  { id: 'event',   label: '🥋 Trainings-Erinnerung',  text: () => `Hey! Heute Abend Training – wir sehen uns auf der Matte! Oss! 💪` },
  { id: 'comp',    label: '🏆 Wettkampf-Ankündigung', text: () => `Hey Leute! Wir nehmen am nächsten Wettkampf teil. Wer Interesse hat – meldet euch! Details folgen. Oss! 🏆` },
  { id: 'custom',  label: '✏️ Eigene Nachricht',       text: () => `` },
]
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
  onboarding_status: string | null
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
  const [bulkMembers, setBulkMembers]       = useState<{ memberId: string; memberName: string; memberEmail: string; checkoutUrl: string | null; amountCents: number }[]>([])
  const [showBulkResults, setShowBulkResults] = useState(false)
  const [search, setSearch]                 = useState('')
  const [activatingId, setActivatingId]     = useState<string | null>(null)
  const [showWaModal, setShowWaModal]       = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id, monthly_fee_cents').single()
      if (!gym) { setLoading(false); return }
      setGymId(gym.id)
      setMonthlyFeeCents(gym.monthly_fee_cents ?? 0)
      const { data } = await supabase
        .from('members')
        .select('id, first_name, last_name, email, phone, belt, stripes, join_date, is_active, subscription_status, contract_end_date, monthly_fee_override_cents, onboarding_status')
        .eq('gym_id', gym.id).order('last_name')
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
    await (supabase.from('members') as any).update({ is_active: true, onboarding_status: 'complete' }).eq('id', id)
    setMembers(prev => prev.map(m => m.id === id ? { ...m, is_active: true, onboarding_status: 'complete' } : m))
    setActivatingId(null)
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
          <button onClick={() => setShowWaModal(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe57] text-white font-semibold text-sm transition-colors"
            title="WhatsApp Rundnachricht">
            <MessageCircle size={14} /> WhatsApp
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
                  <p className="text-sm font-semibold text-slate-900 truncate">{m.first_name} {m.last_name}</p>
                  {m.email && <p className="text-xs text-slate-500 truncate">{m.email}</p>}
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
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-lg max-w-sm w-full">
            <h2 className="font-bold text-slate-900 mb-2">Beiträge anfordern</h2>
            <p className="text-slate-600 text-sm mb-5">
              Zahlungslinks für <span className="font-semibold">{activeWithEmail.length} Mitglieder</span> erstellen? Die Links werden angezeigt, damit du sie per WhatsApp oder E-Mail versenden kannst.
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="font-bold text-slate-900 text-sm">Zahlungslinks erstellt</p>
                <p className="text-slate-400 text-xs">{bulkMembers.length} Links — per WhatsApp oder Kopieren versenden</p>
              </div>
              <button onClick={() => setShowBulkResults(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
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
                  <div key={m.memberId} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
                    <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-amber-600">
                        {m.memberName.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{m.memberName}</p>
                      <p className="text-xs text-slate-400 truncate">{m.memberEmail}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {m.checkoutUrl && (
                        <>
                          <a href={m.checkoutUrl} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors" title="Link öffnen">
                            <ExternalLink size={14} />
                          </a>
                          <button
                            onClick={() => { navigator.clipboard.writeText(m.checkoutUrl!) }}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors" title="Link kopieren">
                            <Copy size={14} />
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
                          onClick={() => { navigator.clipboard.writeText(waText) }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                          title="Nachricht + Link kopieren">
                          <Copy size={12} />
                          Kopieren
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
              <p className="font-bold text-sm">WhatsApp Rundnachricht</p>
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
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Vorlage wählen</p>
                <div className="space-y-1.5">
                  {BULK_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => setTemplateId(t.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        templateId === t.id
                          ? 'bg-[#25D366]/10 text-[#128C7E] font-semibold border border-[#25D366]/30'
                          : 'bg-gray-50 text-slate-700 hover:bg-gray-100'
                      }`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Message */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nachricht</p>
                <textarea
                  value={templateId === 'custom' ? customMsg : tmpl.text()}
                  onChange={e => { setTemplateId('custom'); setCustomMsg(e.target.value) }}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-800 text-sm focus:outline-none focus:border-[#25D366] resize-none"
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
                <p className="text-sm text-slate-700">{message}</p>
              </div>
              <p className="text-xs text-slate-500 mb-3">Klicke pro Mitglied auf den Button — WhatsApp öffnet sich mit der Nachricht vorausgefüllt.</p>
              <div className="space-y-2">
                {members.map(m => {
                  const done = sentIdx.has(m.id)
                  const waUrl = `https://wa.me/${toWaPhone(m.phone!)}?text=${encodeURIComponent(message)}`
                  return (
                    <div key={m.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    }`}>
                      <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-[#128C7E]">{m.first_name[0]}{m.last_name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-slate-400 truncate">{m.phone}</p>
                      </div>
                      <a href={waUrl} target="_blank" rel="noopener noreferrer"
                        onClick={() => markSent(m.id)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          done
                            ? 'bg-green-100 text-green-700 border border-green-200'
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
                <p className="mt-4 text-center text-xs text-slate-400">{sentIdx.size} von {members.length} gesendet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
