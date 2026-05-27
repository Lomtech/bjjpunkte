'use client'

import { useState } from 'react'
import { X, Pause, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/Toast'
import type { PauseReason, TerminationKind, TerminationReasonCategory } from '@/types/database'

interface Props {
  token: string
  hasOpenPause: boolean
  hasPendingTermination: boolean
  lang: 'de' | 'en'
  onAfterAction?: () => void
}

const PAUSE_REASON_LABELS: Record<PauseReason, { de: string; en: string }> = {
  injury:    { de: 'Verletzung',          en: 'Injury' },
  travel:    { de: 'Reise / Abwesenheit', en: 'Travel / absence' },
  financial: { de: 'Finanzielle Gründe',  en: 'Financial reasons' },
  other:     { de: 'Sonstiges',           en: 'Other' },
}

const CATEGORY_LABELS: Record<TerminationReasonCategory, { de: string; en: string }> = {
  moved:           { de: 'Umzug',              en: 'Moved' },
  injury:          { de: 'Verletzung',         en: 'Injury' },
  financial:       { de: 'Finanzielle Gründe', en: 'Financial' },
  dissatisfaction: { de: 'Unzufriedenheit',    en: 'Dissatisfaction' },
  medical:         { de: 'Medizinisch',        en: 'Medical' },
  contract_breach: { de: 'Vertragsverletzung', en: 'Contract breach' },
  other:           { de: 'Sonstiges',          en: 'Other' },
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function PortalContractActions({ token, hasOpenPause, hasPendingTermination, lang, onAfterAction }: Props) {
  const t = useToast()
  const [showPause, setShowPause] = useState(false)
  const [showTerminate, setShowTerminate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Pause-Form
  const [pausedFrom, setPausedFrom] = useState(todayIso())
  const [pauseReason, setPauseReason] = useState<PauseReason>('injury')
  const [pauseNote, setPauseNote] = useState('')

  // Terminate-Form
  const [termKind, setTermKind] = useState<TerminationKind>('regular')
  const [termCategory, setTermCategory] = useState<TerminationReasonCategory>('other')
  const [termReason, setTermReason] = useState('')
  const [termEffective, setTermEffective] = useState(todayIso())

  async function submitPause() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/portal/${token}/contract/pause-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused_from: pausedFrom, reason: pauseReason, reason_note: pauseNote.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        t.error(json.error ?? (lang === 'en' ? 'Pause failed' : 'Pause fehlgeschlagen'))
        return
      }
      t.success(lang === 'en' ? 'Pause started' : 'Pause gestartet')
      setShowPause(false); setPauseNote('')
      onAfterAction?.()
    } finally { setSubmitting(false) }
  }

  async function submitTerminate() {
    if (termReason.trim().length < 3) {
      t.error(lang === 'en' ? 'Reason required (min 3 chars)' : 'Begründung mit min. 3 Zeichen erforderlich')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/portal/${token}/contract/termination-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termination_kind: termKind,
          reason_text: termReason.trim(),
          effective_date: termEffective,
          reason_category: termCategory,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        t.error(json.error ?? (lang === 'en' ? 'Termination failed' : 'Kündigung fehlgeschlagen'))
        return
      }
      t.success(lang === 'en' ? 'Termination request sent' : 'Kündigungsantrag gestellt')
      setShowTerminate(false); setTermReason('')
      onAfterAction?.()
    } finally { setSubmitting(false) }
  }

  return (
    <>
      <div className="flex gap-2 mt-3">
        {!hasOpenPause && (
          <button
            onClick={() => { setPausedFrom(todayIso()); setShowPause(true) }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
          >
            <Pause size={12} /> {lang === 'en' ? 'Request pause' : 'Pause beantragen'}
          </button>
        )}
        {!hasPendingTermination && (
          <button
            onClick={() => { setTermEffective(todayIso()); setShowTerminate(true) }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition"
          >
            <AlertTriangle size={12} /> {lang === 'en' ? 'Request cancellation' : 'Kündigung beantragen'}
          </button>
        )}
      </div>

      {/* Pause-Modal */}
      {showPause && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !submitting && setShowPause(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">{lang === 'en' ? 'Request pause' : 'Pause beantragen'}</h3>
              <button onClick={() => setShowPause(false)} disabled={submitting} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{lang === 'en' ? 'Pause from' : 'Pause ab'}</label>
                <input type="date" value={pausedFrom} onChange={e => setPausedFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{lang === 'en' ? 'Reason' : 'Grund'}</label>
                <select value={pauseReason} onChange={e => setPauseReason(e.target.value as PauseReason)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-amber-400">
                  {(Object.keys(PAUSE_REASON_LABELS) as PauseReason[]).map(r => (
                    <option key={r} value={r}>{PAUSE_REASON_LABELS[r][lang]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{lang === 'en' ? 'Note (optional)' : 'Notiz (optional)'}</label>
                <input type="text" value={pauseNote} onChange={e => setPauseNote(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-amber-400" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {lang === 'en'
                  ? 'Your contract will be extended by the pause duration. The gym can end the pause early if needed.'
                  : 'Dein Vertrag verlängert sich um die Pausen-Dauer. Das Gym kann die Pause vorzeitig beenden.'}
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowPause(false)} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition">{lang === 'en' ? 'Cancel' : 'Abbrechen'}</button>
              <button onClick={submitPause} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition disabled:opacity-50">
                {submitting ? (lang === 'en' ? 'Loading…' : 'Lädt…') : (lang === 'en' ? 'Start pause' : 'Pause starten')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate-Modal */}
      {showTerminate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !submitting && setShowTerminate(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">{lang === 'en' ? 'Request cancellation' : 'Kündigung beantragen'}</h3>
              <button onClick={() => setShowTerminate(false)} disabled={submitting} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{lang === 'en' ? 'Kind' : 'Art'}</label>
                <select value={termKind} onChange={e => setTermKind(e.target.value as TerminationKind)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-orange-400">
                  <option value="regular">{lang === 'en' ? 'Regular (to contract end)' : 'Ordentlich (zum Vertragsende)'}</option>
                  <option value="special_right">{lang === 'en' ? 'Special right (immediate)' : 'Sonderkündigung (sofort)'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{lang === 'en' ? 'Category' : 'Kategorie'}</label>
                <select value={termCategory} onChange={e => setTermCategory(e.target.value as TerminationReasonCategory)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-orange-400">
                  {(Object.keys(CATEGORY_LABELS) as TerminationReasonCategory[]).map(c => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c][lang]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{lang === 'en' ? 'Effective from' : 'Wirksam ab'}</label>
                <input type="date" value={termEffective} onChange={e => setTermEffective(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{lang === 'en' ? 'Reason *' : 'Begründung *'}</label>
                <textarea value={termReason} onChange={e => setTermReason(e.target.value)} rows={3}
                  placeholder={lang === 'en' ? 'Required — communicated to gym' : 'Pflichtfeld — wird ans Gym kommuniziert'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-orange-400" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {lang === 'en'
                  ? 'Your request will be reviewed by the gym. You can withdraw it as long as no decision has been made.'
                  : 'Dein Antrag wird vom Gym geprüft. Solange noch keine Entscheidung gefallen ist, kannst du ihn zurückziehen.'}
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowTerminate(false)} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition">{lang === 'en' ? 'Cancel' : 'Abbrechen'}</button>
              <button onClick={submitTerminate} disabled={submitting} className="flex-1 px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition disabled:opacity-50">
                {submitting ? (lang === 'en' ? 'Loading…' : 'Lädt…') : (lang === 'en' ? 'Send request' : 'Antrag senden')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
