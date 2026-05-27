'use client'

import { useState, useEffect } from 'react'
import { FileText, Pause, Play, X, AlertCircle, AlertTriangle, Check, Ban, Undo2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import type { ContractStatus, PauseReason, TerminationKind, TerminationStatus, TerminationReasonCategory } from '@/types/database'

interface Contract {
  id: string
  status: ContractStatus
  start_date: string
  initial_term_months: number
  original_end_date: string | null
  effective_end_date: string | null
  is_first_term: boolean
  monthly_fee_cents: number | null
  notice_period_days: number
  notice_period_days_after_first_term: number
  notes: string | null
}

interface Pause {
  id: string
  contract_id: string
  paused_from: string
  paused_until: string | null
  reason: PauseReason
  reason_note: string | null
  extends_contract: boolean
  days_added_to_contract: number | null
  created_by_role: 'owner' | 'member' | 'admin'
}

interface Termination {
  id: string
  contract_id: string
  requested_by_role: 'member' | 'owner'
  termination_kind: TerminationKind
  reason_category: TerminationReasonCategory | null
  reason_text: string
  effective_date: string
  status: TerminationStatus
  rejected_reason: string | null
  created_at: string
}

const CATEGORY_LABELS: Record<TerminationReasonCategory, string> = {
  moved: 'Umzug',
  injury: 'Verletzung',
  financial: 'Finanzielle Gründe',
  dissatisfaction: 'Unzufriedenheit',
  medical: 'Medizinisch',
  contract_breach: 'Vertragsverletzung',
  other: 'Sonstiges',
}

interface Props {
  memberId: string
}

const REASON_LABELS: Record<PauseReason, string> = {
  injury: 'Verletzung',
  travel: 'Reise / Abwesenheit',
  financial: 'Finanzielle Gründe',
  other: 'Sonstiges',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ContractLifecycleSection({ memberId }: Props) {
  const [contract, setContract] = useState<Contract | null>(null)
  const [pauses, setPauses] = useState<Pause[]>([])
  const [terminations, setTerminations] = useState<Termination[]>([])
  const [loading, setLoading] = useState(true)
  const [showStartModal, setShowStartModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState<Pause | null>(null)
  const [showTerminateModal, setShowTerminateModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState<Termination | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  // Pause-Form-State
  const [pausedFrom, setPausedFrom] = useState(todayIso())
  const [reason, setReason] = useState<PauseReason>('injury')
  const [reasonNote, setReasonNote] = useState('')
  const [extendsContract, setExtendsContract] = useState(true)

  // Close-Form-State
  const [pausedUntil, setPausedUntil] = useState(todayIso())

  // Terminate-Form-State (Owner-Initiated, meist special_right)
  const [terminationKind, setTerminationKind] = useState<TerminationKind>('special_right')
  const [terminationCategory, setTerminationCategory] = useState<TerminationReasonCategory>('contract_breach')
  const [terminationReason, setTerminationReason] = useState('')
  const [terminationEffective, setTerminationEffective] = useState(todayIso())

  // Reject-Form-State
  const [rejectReason, setRejectReason] = useState('')

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch(`/api/members/${memberId}/contract`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (res.ok) {
        setContract(json.active ?? null)
        setPauses(json.pauses ?? [])
        setTerminations(json.terminations ?? [])
      } else {
        toast.error(json.error ?? 'Vertrag konnte nicht geladen werden')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [memberId])  // eslint-disable-line react-hooks/exhaustive-deps

  async function startPause() {
    if (!contract) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Nicht autorisiert'); return }

      const res = await fetch(`/api/contracts/${contract.id}/pauses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          paused_from: pausedFrom,
          reason,
          reason_note: reasonNote.trim() || null,
          extends_contract: extendsContract,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Pause konnte nicht gestartet werden')
        return
      }
      toast.success('Pause gestartet')
      setShowStartModal(false)
      setReasonNote('')
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  async function requestTermination() {
    if (!contract) return
    if (terminationReason.trim().length < 3) { toast.error('Begründung mit mind. 3 Zeichen erforderlich'); return }
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Nicht autorisiert'); return }
      const res = await fetch(`/api/contracts/${contract.id}/terminations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          termination_kind: terminationKind,
          reason_text: terminationReason.trim(),
          effective_date: terminationEffective,
          reason_category: terminationCategory,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Kündigung fehlgeschlagen'); return }
      toast.success('Kündigungsantrag gestellt')
      setShowTerminateModal(false); setTerminationReason('')
      await load()
    } finally { setSubmitting(false) }
  }

  async function terminationAction(t: Termination, action: 'accept'|'reject'|'withdraw', rejectedReason?: string) {
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Nicht autorisiert'); return }
      const res = await fetch(`/api/contracts/${t.contract_id}/terminations/${t.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, rejected_reason: rejectedReason }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Aktion fehlgeschlagen'); return }
      toast.success(
        action === 'accept' ? 'Kündigung akzeptiert' :
        action === 'reject' ? 'Kündigung abgelehnt' :
        'Kündigung zurückgezogen'
      )
      setShowRejectModal(null); setRejectReason('')
      await load()
    } finally { setSubmitting(false) }
  }

  async function closePause() {
    if (!showCloseModal || !contract) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Nicht autorisiert'); return }

      const res = await fetch(`/api/contracts/${contract.id}/pauses/${showCloseModal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paused_until: pausedUntil }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Pause konnte nicht beendet werden')
        return
      }
      toast.success(`Pause beendet (+${json.days_added} Tage Vertragsverlängerung)`)
      setShowCloseModal(null)
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
        <div className="h-4 w-1/3 bg-zinc-100 rounded animate-pulse mb-2" />
        <div className="h-3 w-2/3 bg-zinc-100 rounded animate-pulse" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 rounded-lg bg-zinc-50 flex items-center justify-center">
            <FileText size={13} className="text-zinc-400" />
          </span>
          <h2 className="text-sm font-semibold text-zinc-800">Vertrag</h2>
        </div>
        <p className="text-xs text-zinc-500">Kein aktiver Vertrag.</p>
      </div>
    )
  }

  const openPause = pauses.find(p => p.paused_until === null) ?? null
  const closedPauses = pauses.filter(p => p.paused_until !== null)
  const isPaused = contract.status === 'paused'
  const pendingTermination = terminations.find(t => t.status === 'requested') ?? null
  const pastTerminations = terminations.filter(t => t.status !== 'requested')

  return (
    <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <FileText size={13} className="text-indigo-600" />
          </span>
          <h2 className="text-sm font-semibold text-zinc-800">Vertrag</h2>
          <StatusBadge status={contract.status} />
          {contract.is_first_term && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
              Erstlaufzeit
            </span>
          )}
        </div>
        {!isPaused && contract.status === 'active' && (
          <button
            onClick={() => { setPausedFrom(todayIso()); setShowStartModal(true) }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition"
          >
            <Pause size={12} /> Pause starten
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <div>
          <p className="text-zinc-400">Start</p>
          <p className="text-zinc-800 font-medium">{fmtDate(contract.start_date)}</p>
        </div>
        <div>
          <p className="text-zinc-400">{contract.original_end_date ? 'Effektives Ende' : 'Laufzeit'}</p>
          <p className="text-zinc-800 font-medium">
            {contract.original_end_date ? fmtDate(contract.effective_end_date) : 'Unbefristet'}
          </p>
        </div>
        <div>
          <p className="text-zinc-400">Kündigungsfrist</p>
          <p className="text-zinc-800 font-medium">
            {contract.is_first_term ? contract.notice_period_days : contract.notice_period_days_after_first_term} Tage
          </p>
        </div>
        <div>
          <p className="text-zinc-400">Beitrag</p>
          <p className="text-zinc-800 font-medium">
            {contract.monthly_fee_cents != null
              ? `${(contract.monthly_fee_cents / 100).toFixed(2)} €`
              : '—'}
          </p>
        </div>
      </div>

      {contract.original_end_date && contract.effective_end_date &&
       contract.effective_end_date !== contract.original_end_date && (
        <p className="text-[11px] text-zinc-500 mb-3 flex items-center gap-1">
          <AlertCircle size={11} className="text-amber-500" />
          Original-Ende: {fmtDate(contract.original_end_date)} (durch Pausen verlängert)
        </p>
      )}

      {openPause && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs font-medium text-amber-900 flex items-center gap-1.5">
                <Pause size={12} /> Pausiert seit {fmtDate(openPause.paused_from)}
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                {REASON_LABELS[openPause.reason]}
                {openPause.reason_note && ` — ${openPause.reason_note}`}
                {!openPause.extends_contract && ' · Kulanz (keine Verlängerung)'}
              </p>
            </div>
            <button
              onClick={() => { setPausedUntil(todayIso()); setShowCloseModal(openPause) }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-medium transition flex-shrink-0"
            >
              <Play size={11} /> Beenden
            </button>
          </div>
        </div>
      )}

      {closedPauses.length > 0 && (
        <details className="text-xs mb-2">
          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700">
            Pausen-Historie ({closedPauses.length})
          </summary>
          <div className="mt-2 space-y-1">
            {closedPauses.map(p => (
              <div key={p.id} className="flex items-center justify-between py-1 text-zinc-600 border-b border-zinc-50 last:border-0">
                <span>{fmtDate(p.paused_from)} → {fmtDate(p.paused_until)}</span>
                <span className="text-zinc-400">
                  {REASON_LABELS[p.reason]}
                  {p.days_added_to_contract != null && ` · +${p.days_added_to_contract}d`}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Kündigung: pending termination */}
      {pendingTermination && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 mb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-orange-900">
                {pendingTermination.termination_kind === 'special_right' ? 'Sonderkündigung' : 'Kündigung'}
                {' '} {pendingTermination.requested_by_role === 'member' ? 'durch Mitglied' : 'durch Gym'}
                {' · zum '} {fmtDate(pendingTermination.effective_date)}
              </p>
              {pendingTermination.reason_category && (
                <p className="text-[11px] text-orange-700 mt-0.5">
                  {CATEGORY_LABELS[pendingTermination.reason_category]}
                </p>
              )}
              <p className="text-[11px] text-orange-800 mt-1 italic">&ldquo;{pendingTermination.reason_text}&rdquo;</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => terminationAction(pendingTermination, 'accept')}
                  disabled={submitting}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-medium transition disabled:opacity-50"
                >
                  <Check size={11} /> Akzeptieren
                </button>
                <button
                  onClick={() => { setRejectReason(''); setShowRejectModal(pendingTermination) }}
                  disabled={submitting}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[11px] font-medium transition disabled:opacity-50"
                >
                  <Ban size={11} /> Ablehnen
                </button>
                {pendingTermination.requested_by_role === 'owner' && (
                  <button
                    onClick={() => terminationAction(pendingTermination, 'withdraw')}
                    disabled={submitting}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[11px] font-medium transition disabled:opacity-50"
                  >
                    <Undo2 size={11} /> Zurückziehen
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sonderkündigung anstoßen (Owner) — nur wenn kein pending und Vertrag noch terminierbar */}
      {!pendingTermination && (contract.status === 'active' || contract.status === 'paused') && (
        <button
          onClick={() => { setTerminationReason(''); setTerminationEffective(todayIso()); setShowTerminateModal(true) }}
          className="text-xs text-orange-600 hover:text-orange-800 underline decoration-dotted underline-offset-2 mb-2"
        >
          Sonderkündigung anstoßen
        </button>
      )}

      {/* Termination-History */}
      {pastTerminations.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700">
            Kündigungs-Historie ({pastTerminations.length})
          </summary>
          <div className="mt-2 space-y-1">
            {pastTerminations.map(t => (
              <div key={t.id} className="py-1 text-zinc-600 border-b border-zinc-50 last:border-0">
                <div className="flex items-center justify-between">
                  <span>{fmtDate(t.created_at)} · {t.termination_kind === 'special_right' ? 'Sonderkündigung' : 'Ordentlich'} ({t.requested_by_role === 'member' ? 'Mitglied' : 'Gym'})</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    t.status === 'accepted' ? 'bg-red-50 text-red-700' :
                    t.status === 'rejected' ? 'bg-zinc-100 text-zinc-600' :
                    'bg-zinc-100 text-zinc-500'
                  }`}>{t.status === 'accepted' ? 'Akzeptiert' : t.status === 'rejected' ? 'Abgelehnt' : 'Zurückgezogen'}</span>
                </div>
                {t.rejected_reason && <p className="text-[10px] text-zinc-400 italic mt-0.5">Ablehnung: {t.rejected_reason}</p>}
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Start-Pause-Modal */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !submitting && setShowStartModal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-800">Pause starten</h3>
              <button onClick={() => setShowStartModal(false)} disabled={submitting} className="text-zinc-400 hover:text-zinc-700">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Pause ab</label>
                <input
                  type="date" value={pausedFrom}
                  onChange={e => setPausedFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Grund</label>
                <select
                  value={reason} onChange={e => setReason(e.target.value as PauseReason)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-indigo-400"
                >
                  {(Object.keys(REASON_LABELS) as PauseReason[]).map(r => (
                    <option key={r} value={r}>{REASON_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Notiz (optional)</label>
                <input
                  type="text" value={reasonNote} placeholder="z.B. Kreuzband-OP"
                  onChange={e => setReasonNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={extendsContract}
                  onChange={e => setExtendsContract(e.target.checked)}
                  className="mt-0.5 accent-indigo-500"
                />
                <span className="text-xs text-zinc-600">
                  Pause verlängert Vertragsende
                  <span className="block text-[11px] text-zinc-400">
                    Abwählen = Kulanz-Pause ohne Verlängerung
                  </span>
                </span>
              </label>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowStartModal(false)} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition">
                Abbrechen
              </button>
              <button onClick={startPause} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition disabled:opacity-50">
                {submitting ? 'Lädt…' : 'Pause starten'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate-Modal (Owner stößt Sonderkündigung an) */}
      {showTerminateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !submitting && setShowTerminateModal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-800">Sonderkündigung anstoßen</h3>
              <button onClick={() => setShowTerminateModal(false)} disabled={submitting} className="text-zinc-400 hover:text-zinc-700"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Art</label>
                <select value={terminationKind} onChange={e => setTerminationKind(e.target.value as TerminationKind)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-orange-400">
                  <option value="special_right">Sonderkündigung (sofort)</option>
                  <option value="regular">Ordentlich (zum Vertragsende)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Kategorie</label>
                <select value={terminationCategory} onChange={e => setTerminationCategory(e.target.value as TerminationReasonCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-orange-400">
                  {(Object.keys(CATEGORY_LABELS) as TerminationReasonCategory[]).map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Wirksam ab</label>
                <input type="date" value={terminationEffective} onChange={e => setTerminationEffective(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Begründung *</label>
                <textarea value={terminationReason} onChange={e => setTerminationReason(e.target.value)} rows={3}
                  placeholder="Pflichtfeld — wird in Kommunikation an Mitglied verwendet"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-orange-400" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowTerminateModal(false)} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition">Abbrechen</button>
              <button onClick={requestTermination} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition disabled:opacity-50">
                {submitting ? 'Lädt…' : 'Antrag senden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject-Modal (Kündigung ablehnen) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !submitting && setShowRejectModal(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-800">Kündigung ablehnen</h3>
              <button onClick={() => setShowRejectModal(null)} disabled={submitting} className="text-zinc-400 hover:text-zinc-700"><X size={16} /></button>
            </div>
            <p className="text-xs text-zinc-500 mb-3">Begründung wird dem Mitglied mitgeteilt.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
              placeholder="z.B. Sonderkündigungsrecht greift nicht — Bitte zum nächsten ordentlichen Kündigungstermin."
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-orange-400" />
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowRejectModal(null)} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition">Abbrechen</button>
              <button onClick={() => terminationAction(showRejectModal, 'reject', rejectReason.trim())} disabled={submitting || rejectReason.trim().length < 3} className="flex-1 px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition disabled:opacity-50">
                {submitting ? 'Lädt…' : 'Ablehnen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close-Pause-Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !submitting && setShowCloseModal(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-800">Pause beenden</h3>
              <button onClick={() => setShowCloseModal(null)} disabled={submitting} className="text-zinc-400 hover:text-zinc-700">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-500 mb-3">
              Pause begann am {fmtDate(showCloseModal.paused_from)}.
              {showCloseModal.extends_contract
                ? ' Vertragsende wird um die Pausen-Tage verlängert.'
                : ' Kulanz-Pause: keine Vertragsverlängerung.'}
            </p>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Pause endete am</label>
              <input
                type="date" value={pausedUntil} min={showCloseModal.paused_from}
                onChange={e => setPausedUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCloseModal(null)} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition">
                Abbrechen
              </button>
              <button onClick={closePause} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition disabled:opacity-50">
                {submitting ? 'Lädt…' : 'Pause beenden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const config: Record<ContractStatus, { label: string; cls: string }> = {
    active:            { label: 'Aktiv',                cls: 'bg-emerald-50 text-emerald-700' },
    paused:            { label: 'Pausiert',             cls: 'bg-amber-50 text-amber-700' },
    cancelled_pending: { label: 'Kündigung anstehend',  cls: 'bg-orange-50 text-orange-700' },
    cancelled:         { label: 'Gekündigt',            cls: 'bg-red-50 text-red-700' },
    ended:             { label: 'Beendet',              cls: 'bg-zinc-100 text-zinc-600' },
  }
  const c = config[status]
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.cls}`}>{c.label}</span>
}
