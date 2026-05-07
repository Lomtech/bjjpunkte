'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Check, Loader2, FileWarning } from 'lucide-react'

/**
 * Inkasso-Panel für Member-Detail-Seite.
 *
 * Zeigt:
 *  - Aktueller Mahnstufen-Status (0=OK, 1=1.Mahnung, 2=2.Mahnung, 3=Inkasso)
 *  - Outstanding-Betrag (manuell pflegbar)
 *  - History aller Aktionen
 *  - Aktionen-Buttons: Mahnung erfassen / Inkasso übergeben / Zahlung erhalten
 */

interface MemberInfo {
  id: string
  first_name: string
  last_name: string
  dunning_level?: number | null
  dunning_amount_cents?: number | null
  dunning_started_at?: string | null
  dunning_last_action_at?: string | null
}

interface Action {
  id: string
  action_type: string
  amount_cents: number | null
  notes: string | null
  performed_by: string | null
  performed_at: string
}

const ACTION_LABELS: Record<string, { label: string; tone: 'amber' | 'rose' | 'emerald' | 'zinc'; icon: string }> = {
  first_reminder:    { label: '1. Mahnung gesendet',     tone: 'amber',   icon: '📧' },
  second_reminder:   { label: '2. Mahnung gesendet',     tone: 'amber',   icon: '📧' },
  final_warning:     { label: 'Letzte Mahnung',          tone: 'rose',    icon: '⚠️' },
  collection_handoff:{ label: 'Inkasso übergeben',       tone: 'rose',    icon: '🔴' },
  payment_received:  { label: 'Zahlung eingegangen',     tone: 'emerald', icon: '✅' },
  note:              { label: 'Notiz',                    tone: 'zinc',    icon: '📝' },
}

const LEVEL_LABEL = ['Unauffällig', '1. Mahnung', '2. Mahnung', 'Inkasso übergeben']

export function DunningPanel({ member, onUpdate }: { member: MemberInfo; onUpdate?: () => void }) {
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [showForm, setShowForm] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch(`/api/members/${member.id}/dunning`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setActions(json.actions ?? [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [member.id])

  async function logAction(actionType: string) {
    setBusy(actionType)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Nicht eingeloggt')

      const amountCents = amount ? Math.round(parseFloat(amount.replace(',', '.')) * 100) : null

      const res = await fetch(`/api/members/${member.id}/dunning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action_type: actionType,
          amount_cents: amountCents,
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Fehler')
      }

      // Reload actions
      const reloadRes = await fetch(`/api/members/${member.id}/dunning`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (reloadRes.ok) {
        const j = await reloadRes.json()
        setActions(j.actions ?? [])
      }
      setShowForm(null)
      setAmount('')
      setNotes('')
      onUpdate?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(null)
    }
  }

  const level = member.dunning_level ?? 0
  const levelTone = level === 0 ? 'emerald' : level >= 3 ? 'rose' : 'amber'
  const tonalClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    amber:   'bg-amber-50 border-amber-200 text-amber-900',
    rose:    'bg-rose-50 border-rose-200 text-rose-900',
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
          <FileWarning size={14} className="text-zinc-500" />
          Inkasso & Mahnungen
        </h3>
      </div>

      {/* Status-Box */}
      <div className={`rounded-xl border-2 p-4 mb-4 ${tonalClasses[levelTone]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Aktueller Status</p>
            <p className="text-lg font-black mt-0.5">{LEVEL_LABEL[level]}</p>
          </div>
          {level > 0 && member.dunning_amount_cents != null && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Offen</p>
              <p className="text-lg font-black tabular-nums">
                {(member.dunning_amount_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          )}
        </div>
        {member.dunning_started_at && (
          <p className="text-[11px] mt-2 opacity-70">
            Begonnen: {new Date(member.dunning_started_at).toLocaleDateString('de-DE')}
            {member.dunning_last_action_at && (
              <> · Letzte Aktion: {new Date(member.dunning_last_action_at).toLocaleDateString('de-DE')}</>
            )}
          </p>
        )}
      </div>

      {/* Action-Form */}
      {showForm ? (
        <div className="bg-zinc-50 rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-zinc-700 mb-3">{ACTION_LABELS[showForm]?.label} erfassen</p>
          {showForm !== 'note' && (
            <div className="mb-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                Offener Betrag {showForm === 'payment_received' ? '(eingegangen)' : '(Rückstand)'}
              </label>
              <div className="flex items-center gap-1">
                <input type="text" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-32 px-3 py-2 rounded-lg border border-zinc-200 text-sm font-mono focus:border-amber-400 focus:ring-1 focus:ring-amber-200 outline-none" />
                <span className="text-sm text-zinc-500">€</span>
              </div>
            </div>
          )}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value.slice(0, 2000))}
            placeholder="Notiz / Begründung (optional)"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-200 outline-none mb-3"
          />
          <div className="flex gap-2">
            <button onClick={() => { setShowForm(null); setAmount(''); setNotes('') }}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg">
              Abbrechen
            </button>
            <button onClick={() => logAction(showForm)}
              disabled={busy === showForm}
              className="px-4 py-1.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg disabled:bg-zinc-400 inline-flex items-center gap-1.5">
              {busy === showForm ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Speichern
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {level < 3 && (
            <ActionBtn label="Mahnung erfassen" tone="amber" icon={<AlertTriangle size={13} />}
              onClick={() => setShowForm(level === 0 ? 'first_reminder' : level === 1 ? 'second_reminder' : 'final_warning')} />
          )}
          {level === 2 && (
            <ActionBtn label="Inkasso übergeben" tone="rose" icon={<FileWarning size={13} />}
              onClick={() => setShowForm('collection_handoff')} />
          )}
          {level > 0 && (
            <ActionBtn label="Zahlung erhalten" tone="emerald" icon={<Check size={13} />}
              onClick={() => setShowForm('payment_received')} />
          )}
          <ActionBtn label="Notiz hinzufügen" tone="zinc" icon={<span>📝</span>}
            onClick={() => setShowForm('note')} />
        </div>
      )}

      {/* History */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Verlauf ({actions.length})</p>
        {loading && <p className="text-xs text-zinc-400">Lädt...</p>}
        {!loading && actions.length === 0 && (
          <p className="text-xs text-zinc-400 italic">Keine Aktionen erfasst.</p>
        )}
        <ul className="space-y-2">
          {actions.map(a => {
            const cfg = ACTION_LABELS[a.action_type] ?? { label: a.action_type, tone: 'zinc' as const, icon: '•' }
            return (
              <li key={a.id} className="flex items-start gap-2 text-xs">
                <span className="text-base">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-zinc-800">{cfg.label}</span>
                    <span className="text-zinc-400 tabular-nums">{new Date(a.performed_at).toLocaleDateString('de-DE')}</span>
                  </div>
                  {a.amount_cents != null && (
                    <p className="text-zinc-600 mt-0.5 tabular-nums">
                      {(a.amount_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </p>
                  )}
                  {a.notes && <p className="text-zinc-500 mt-0.5 italic">&bdquo;{a.notes}&ldquo;</p>}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function ActionBtn({ label, tone, icon, onClick }: { label: string; tone: 'amber' | 'rose' | 'emerald' | 'zinc'; icon: React.ReactNode; onClick: () => void }) {
  const colors = {
    amber:   'border-amber-200 text-amber-700 hover:bg-amber-50',
    rose:    'border-rose-200 text-rose-700 hover:bg-rose-50',
    emerald: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
    zinc:    'border-zinc-200 text-zinc-700 hover:bg-zinc-50',
  }[tone]
  return (
    <button onClick={onClick}
      className={`flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg border transition-colors ${colors}`}>
      {icon} {label}
    </button>
  )
}
