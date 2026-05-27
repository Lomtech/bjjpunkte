'use client'

import { useState } from 'react'
import { Ticket, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'

interface Props {
  memberId: string
  initialRemaining: number | null
  initialTotal: number | null
  initialPurchasedAt: string | null
}

/**
 * 10er-Karte (Punch-Card) Verwaltung pro Mitglied.
 * - Wenn remaining=null: Mitglied hat keine Punch-Card → Button "10er-Karte aktivieren"
 * - Wenn remaining>=0: Anzeige X von Y + "Aufladen"-Button mit Modal
 *
 * Bei jedem GPS-Checkin wird automatisch 1 Einheit dekrementiert (siehe
 * src/app/api/attendance/gps/route.ts → consume_punch_unit RPC).
 */
export function PunchCardSection({ memberId, initialRemaining, initialTotal, initialPurchasedAt }: Props) {
  const [remaining, setRemaining] = useState<number | null>(initialRemaining)
  const [total, setTotal] = useState<number | null>(initialTotal)
  const [purchasedAt, setPurchasedAt] = useState<string | null>(initialPurchasedAt)
  const [showModal, setShowModal] = useState(false)
  const [units, setUnits] = useState(10)
  const [amount, setAmount] = useState<string>('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  async function recharge() {
    if (units < 1 || units > 1000) {
      toast.error('Anzahl muss zwischen 1 und 1000 liegen')
      return
    }
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Nicht autorisiert'); return }

      const amountCents = amount.trim() ? Math.round(Number(amount.replace(',', '.')) * 100) : 0
      const res = await fetch(`/api/members/${memberId}/punch-card/recharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ units, amount_cents: amountCents, note: note.trim() || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Aufladen fehlgeschlagen')
        return
      }
      setRemaining(json.punch_units_remaining)
      setTotal(json.punch_units_total)
      setPurchasedAt(new Date().toISOString())
      setShowModal(false)
      setUnits(10); setAmount(''); setNote('')
      toast.success(`+${units} Einheiten aufgeladen. Neuer Stand: ${json.punch_units_remaining}`)
    } finally {
      setSubmitting(false)
    }
  }

  const isActive = remaining !== null
  const usedUp = isActive && remaining! <= 0
  const pct = isActive && total && total > 0 ? Math.max(0, Math.min(100, (remaining! / total) * 100)) : 0

  return (
    <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Ticket size={13} className="text-amber-600" />
          </span>
          <h2 className="text-sm font-semibold text-zinc-800">10er-Karte</h2>
        </div>
        {isActive && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition"
          >
            <Plus size={12} /> Aufladen
          </button>
        )}
      </div>

      {!isActive && (
        <div className="text-xs text-zinc-500">
          <p className="mb-3">Dieses Mitglied hat keine 10er-Karte. Aktiviere eine, um pro Check-in automatisch eine Einheit abzuziehen.</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition"
          >
            <Plus size={12} /> 10er-Karte aktivieren
          </button>
        </div>
      )}

      {isActive && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <span className={`text-2xl font-semibold ${usedUp ? 'text-red-600' : 'text-zinc-900'}`}>{remaining}</span>
              {total != null && <span className="text-sm text-zinc-500"> von {total}</span>}
              <span className="text-xs text-zinc-500 ml-2">Einheiten verbleibend</span>
            </div>
            {usedUp && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700">aufgebraucht</span>
            )}
          </div>
          {total != null && total > 0 && (
            <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className={`h-full transition-all ${usedUp ? 'bg-red-400' : 'bg-amber-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {purchasedAt && (
            <p className="text-xs text-zinc-400 mt-2">Letzte Aufladung: {new Date(purchasedAt).toLocaleDateString('de-DE')}</p>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !submitting && setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-800">{isActive ? '10er-Karte aufladen' : '10er-Karte aktivieren'}</h3>
              <button onClick={() => setShowModal(false)} disabled={submitting} className="text-zinc-400 hover:text-zinc-700">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Anzahl Einheiten</label>
                <div className="flex gap-2 mb-2">
                  {[10, 20, 30].map(n => (
                    <button
                      key={n}
                      onClick={() => setUnits(n)}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        units === n ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <input
                  type="number" min={1} max={1000} value={units}
                  onChange={e => setUnits(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Betrag (€, optional)</label>
                <input
                  type="text" inputMode="decimal" value={amount} placeholder="0,00"
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Notiz (optional)</label>
                <input
                  type="text" value={note} placeholder="z.B. bar bezahlt"
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)} disabled={submitting}
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-medium hover:bg-zinc-50 transition"
              >
                Abbrechen
              </button>
              <button
                onClick={recharge} disabled={submitting}
                className="flex-1 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Lädt…' : 'Aufladen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
