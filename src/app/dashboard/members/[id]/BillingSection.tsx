'use client'

import { useState } from 'react'
import { CreditCard, Send, ExternalLink } from 'lucide-react'
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

export function BillingSection({ memberId, gymId, memberEmail, memberName, subscriptionStatus, stripeCustomerId, monthlyFeeCents, payments }: {
  memberId: string; gymId: string; memberEmail: string | null; memberName: string
  subscriptionStatus: string; stripeCustomerId: string | null; monthlyFeeCents: number
  payments: Payment[]
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    }
    setLoading(false)
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
            onClick={() => { navigator.clipboard.writeText(checkoutUrl); }}
            className="ml-4 text-slate-500 hover:text-slate-700 text-sm"
          >
            Kopieren
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
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[p.status] ?? STATUS_COLORS.pending}`}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                  <span className="text-slate-700 text-sm font-medium">
                    {(p.amount_cents / 100).toFixed(2).replace('.', ',')} €
                  </span>
                </div>
                <span className="text-slate-400 text-xs">
                  {new Date(p.paid_at ?? p.created_at).toLocaleDateString('de-DE')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
