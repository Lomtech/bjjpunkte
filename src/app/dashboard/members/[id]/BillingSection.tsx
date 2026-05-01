'use client'

import { useState } from 'react'
import { CreditCard, Send, ExternalLink, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Payment = { id: string; amount_cents: number; status: string; paid_at: string | null; created_at: string }

const STATUS_COLORS: Record<string, string> = {
  paid:     'bg-green-50 text-green-700 border-green-200',
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  failed:   'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-slate-100 text-slate-500 border-slate-200',
}
const STATUS_LABELS: Record<string, string> = {
  paid: 'Bezahlt', pending: 'Ausstehend', failed: 'Fehlgeschlagen', refunded: 'Erstattet',
}

export function BillingSection({ memberId, gymId, memberEmail, memberName, subscriptionStatus, stripeCustomerId, monthlyFeeCents, payments: initialPayments }: {
  memberId: string; gymId: string; memberEmail: string | null; memberName: string
  subscriptionStatus: string; stripeCustomerId: string | null; monthlyFeeCents: number
  payments: Payment[]
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function sendPaymentLink() {
    if (!memberEmail) { setError('Mitglied hat keine E-Mail-Adresse.'); return }
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ memberId, gymId, memberEmail, memberName, amountCents: monthlyFeeCents }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fehler beim Erstellen des Zahlungslinks')
      setCheckoutUrl(data.url)
      // Refresh payments list
      const supabase = createClient()
      const { data: updated } = await supabase.from('payments').select('*').eq('member_id', memberId).order('created_at', { ascending: false }).limit(10)
      if (updated) setPayments(updated as Payment[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    }
    setLoading(false)
  }

  async function deletePayment(paymentId: string) {
    if (!confirm('Zahlung wirklich löschen?')) return
    setDeletingId(paymentId)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Fehler beim Löschen')
      setPayments(prev => prev.filter(p => p.id !== paymentId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    }
    setDeletingId(null)
  }

  if (monthlyFeeCents === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-5">
        <h2 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
          <CreditCard size={16} className="text-slate-400" />
          Mitgliedsbeitrag
        </h2>
        <p className="text-slate-400 text-sm">
          Bitte zuerst den monatlichen Beitrag in den{' '}
          <a href="/dashboard/settings" className="text-amber-600 hover:text-amber-500 font-medium">Einstellungen</a> festlegen.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <CreditCard size={16} className="text-slate-400" />
          Mitgliedsbeitrag
        </h2>
        <span className="text-sm font-semibold text-slate-700">
          {(monthlyFeeCents / 100).toFixed(2).replace('.', ',')} €/Monat
        </span>
      </div>

      {checkoutUrl ? (
        <div className="p-4 bg-green-50 rounded-xl border border-green-200 mb-4">
          <p className="text-green-800 text-sm font-medium mb-2">Zahlungslink erstellt!</p>
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-500 text-sm font-medium"
          >
            <ExternalLink size={14} />
            Link öffnen / kopieren
          </a>
          <button
            onClick={() => { navigator.clipboard.writeText(checkoutUrl) }}
            className="ml-4 text-slate-500 hover:text-slate-700 text-sm"
          >
            Kopieren
          </button>
          <button
            onClick={() => setCheckoutUrl('')}
            className="ml-4 text-slate-400 hover:text-slate-600 text-sm"
          >
            Neuer Link
          </button>
        </div>
      ) : (
        <button
          onClick={sendPaymentLink}
          disabled={loading || !memberEmail}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 mb-4"
        >
          <Send size={14} />
          {loading ? 'Wird erstellt...' : 'Zahlungslink erstellen'}
        </button>
      )}

      {!memberEmail && (
        <p className="text-slate-400 text-xs mb-3">Keine E-Mail-Adresse hinterlegt.</p>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-3">{error}</div>
      )}

      {payments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Zahlungshistorie</p>
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${STATUS_COLORS[p.status] ?? STATUS_COLORS.pending}`}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
                <span className="text-slate-700 text-sm font-semibold flex-shrink-0">
                  {(p.amount_cents / 100).toFixed(2).replace('.', ',')} €
                </span>
                <span className="text-slate-400 text-xs flex-1 min-w-0 text-right truncate">
                  {new Date(p.paid_at ?? p.created_at).toLocaleDateString('de-DE')}
                </span>
                {p.status !== 'paid' && (
                  <button
                    onClick={() => deletePayment(p.id)}
                    disabled={deletingId === p.id}
                    title="Zahlung löschen"
                    className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40 flex-shrink-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
