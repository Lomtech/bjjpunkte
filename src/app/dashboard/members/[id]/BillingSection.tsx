'use client'

import { useState } from 'react'
import { CreditCard, Send, ExternalLink, Trash2, Copy, MessageCircle, RefreshCw, X, FileText, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toWaPhone } from '@/lib/phone'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { ConfirmModal } from '@/components/ConfirmModal'

type Payment = { id: string; amount_cents: number; status: string; paid_at: string | null; created_at: string }

const STATUS_COLORS: Record<string, string> = {
  paid:     'bg-zinc-100 text-zinc-700 border-zinc-200',
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  failed:   'bg-zinc-100 text-zinc-500 border-zinc-200',
  refunded: 'bg-zinc-100 text-zinc-400 border-zinc-200',
}
// STATUS_LABELS are now resolved via t('paymentStatus', ...) inside the component

export function BillingSection({ memberId, gymId, memberEmail, memberPhone, memberName, subscriptionStatus, stripeCustomerId, monthlyFeeCents, payments: initialPayments, stripeSubscriptionId }: {
  memberId: string; gymId: string; memberEmail: string | null; memberPhone?: string | null; memberName: string
  subscriptionStatus: string; stripeCustomerId: string | null; monthlyFeeCents: number
  payments: Payment[]; stripeSubscriptionId?: string | null
}) {
  const { t, lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'
  const [loading, setLoading] = useState(false)
  const [subLoading, setSubLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [linkType, setLinkType] = useState<'onetime' | 'subscription'>('onetime')
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; description?: string; confirmLabel?: string; danger?: boolean; icon?: React.ReactNode; onConfirm: () => void
  }>({ open: false, title: '', onConfirm: () => {} })
  function askConfirm(opts: { title: string; description?: string; confirmLabel?: string; danger?: boolean; icon?: React.ReactNode; onConfirm: () => void }) {
    setConfirmState({ ...opts, open: true })
  }
  function closeConfirm() { setConfirmState(s => ({ ...s, open: false })) }

  async function sendPaymentLink() {
    if (!memberEmail) { setError(t('billing', 'noEmailError')); return }
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
      if (!res.ok) throw new Error(data.error || t('billing', 'otLinkCreated'))
      setCheckoutUrl(data.url)
      setLinkType('onetime')
      // Refresh payments list
      const supabase = createClient()
      const { data: updated } = await supabase.from('payments').select('*').eq('member_id', memberId).order('created_at', { ascending: false }).limit(10)
      if (updated) setPayments(updated as Payment[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    }
    setLoading(false)
  }

  async function setupSubscription() {
    if (!memberEmail) { setError(t('billing', 'noEmailError')); return }
    setSubLoading(true); setError('')
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch('/api/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ memberId, gymId, memberEmail, memberName, amountCents: monthlyFeeCents }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setCheckoutUrl(data.url)
      setLinkType('subscription')
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler') }
    setSubLoading(false)
  }

  function cancelSubscription() {
    askConfirm({
      title: t('billing', 'confirmCancelSub'),
      confirmLabel: lang === 'en' ? 'Cancel subscription' : 'Abo kündigen',
      danger: true,
      icon: '⚠️',
      onConfirm: () => { closeConfirm(); doCancelSubscription() },
    })
  }

  async function doCancelSubscription() {
    setSubLoading(true); setError('')
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch('/api/stripe/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ memberId }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Fehler') }
    setSubLoading(false)
  }

  function deletePayment(paymentId: string) {
    askConfirm({
      title: t('billing', 'confirmDeletePayment'),
      confirmLabel: lang === 'en' ? 'Delete' : 'Löschen',
      danger: true,
      icon: '🗑️',
      onConfirm: () => { closeConfirm(); doDeletePayment(paymentId) },
    })
  }

  async function doDeletePayment(paymentId: string) {
    setDeletingId(paymentId)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('billing', 'confirmDeletePayment'))
      setPayments(prev => prev.filter(p => p.id !== paymentId))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('billing', 'confirmDeletePayment'))
    }
    setDeletingId(null)
  }

  if (monthlyFeeCents === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm mb-5">
        <h2 className="font-semibold text-zinc-900 mb-2 flex items-center gap-2">
          <CreditCard size={16} className="text-zinc-400" />
          {t('billing', 'memberFee')}
        </h2>
        <p className="text-zinc-400 text-sm">
          {lang === 'en'
            ? <>Please first set the monthly fee in <a href="/dashboard/settings" className="text-amber-600 hover:text-amber-500 font-medium">Settings</a>.</>
            : <>Bitte zuerst den monatlichen Beitrag in den <a href="/dashboard/settings" className="text-amber-600 hover:text-amber-500 font-medium">Einstellungen</a> festlegen.</>
          }
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm mb-5">
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Abbrechen'}
        danger={confirmState.danger}
        icon={confirmState.icon}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
          <CreditCard size={16} className="text-zinc-400" />
          {t('billing', 'memberFee')}
        </h2>
        <span className="text-sm font-semibold text-zinc-700">
          {(monthlyFeeCents / 100).toFixed(2).replace('.', ',')} {t('billing', 'perMonth')}
        </span>
      </div>

      {checkoutUrl ? (
        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 mb-4">
          <p className="text-zinc-800 text-sm font-medium mb-0.5">
            {linkType === 'subscription' ? t('billing', 'subLinkCreated') : t('billing', 'otLinkCreated')}
          </p>
          <p className="text-zinc-600 text-xs mb-3">
            {linkType === 'subscription'
              ? t('billing', 'subLinkDesc')
              : t('billing', 'otLinkDesc')}
          </p>
          <div className="flex flex-col gap-2">
            {memberPhone && (
              <a href={`https://wa.me/${toWaPhone(memberPhone)}?text=${encodeURIComponent(
                linkType === 'subscription'
                  ? `Hallo ${memberName.split(' ')[0]}! 🥋 Bitte richte hier einmalig die automatische Beitragszahlung ein:\n${checkoutUrl}\n\nNach der Einrichtung läuft die Abbuchung jeden Monat automatisch.`
                  : `Hallo ${memberName.split(' ')[0]}! Hier ist dein Zahlungslink für den Monatsbeitrag:\n${checkoutUrl}`
              )}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe57] text-white text-sm font-semibold transition-colors">
                <MessageCircle size={14} /> {t('billing', 'sendWhatsApp')}
              </a>
            )}
            {memberEmail && (
              <a href={`mailto:${memberEmail}?subject=${encodeURIComponent(
                linkType === 'subscription' ? 'Automatische Beitragszahlung einrichten' : 'Dein Zahlungslink'
              )}&body=${encodeURIComponent(
                linkType === 'subscription'
                  ? `Hallo ${memberName.split(' ')[0]}!\n\nBitte richte hier einmalig die automatische Beitragszahlung ein:\n${checkoutUrl}\n\nNach der Einrichtung läuft die Abbuchung monatlich automatisch.`
                  : `Hallo ${memberName.split(' ')[0]}!\n\nHier ist dein Zahlungslink:\n${checkoutUrl}`
              )}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-sm font-semibold transition-colors">
                {t('billing', 'sendEmail')}
              </a>
            )}
            <div className="flex gap-2">
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-xs font-medium transition-colors">
                <ExternalLink size={12} /> {t('billing', 'openLink')}
              </a>
              <button onClick={() => {
                  navigator.clipboard.writeText(checkoutUrl)
                  setCopiedLink(true)
                  setTimeout(() => setCopiedLink(false), 2000)
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${copiedLink ? 'border-green-200 bg-green-50 text-green-700' : 'border-zinc-200 hover:bg-zinc-50 text-zinc-600'}`}>
                {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                {copiedLink ? t('billing', 'copiedLink') : t('billing', 'copyLink')}
              </button>
              <button onClick={() => { setCheckoutUrl(''); setLinkType('onetime') }}
                className="flex-1 flex items-center justify-center px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-400 text-xs transition-colors">
                {t('billing', 'newLink')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-zinc-400 mb-3 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            {t('billing', 'acceptedMethods')}
          </p>
          {/* Subscription status */}
          {stripeSubscriptionId ? (
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-200">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className="text-zinc-500" />
                <span className="text-zinc-800 text-sm font-semibold">{t('billing', 'autoChargeActive')}</span>
              </div>
              <button onClick={cancelSubscription} disabled={subLoading}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50">
                <X size={12} /> {t('billing', 'cancelSub')}
              </button>
            </div>
          ) : (
            <button onClick={setupSubscription} disabled={subLoading || !memberEmail}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              <RefreshCw size={14} />
              {subLoading ? t('billing', 'openingStripe') : t('billing', 'setupAutoCharge')}
            </button>
          )}

          {/* One-time link */}
          <button onClick={sendPaymentLink} disabled={loading || !memberEmail}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-sm font-semibold transition-colors disabled:opacity-50">
            <Send size={14} />
            {loading ? t('billing', 'creating') : t('billing', 'createOneTime')}
          </button>
        </div>
      )}

      {!memberEmail && (
        <p className="text-zinc-400 text-xs mb-3">{t('billing', 'noEmail')}</p>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm mb-3">{error}</div>
      )}

      {payments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">{t('billing', 'paymentHistory')}</p>
          <div className="space-y-2">
            {payments.map(p => (
              <div key={p.id} className="flex items-center gap-2 py-2 border-b border-zinc-100 last:border-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${STATUS_COLORS[p.status] ?? STATUS_COLORS.pending}`}>
                  {t('paymentStatus', p.status) || p.status}
                </span>
                <span className="text-zinc-700 text-sm font-semibold flex-shrink-0">
                  {(p.amount_cents / 100).toFixed(2).replace('.', ',')} €
                </span>
                <span className="text-zinc-400 text-xs flex-1 min-w-0 text-right truncate">
                  {new Date(p.paid_at ?? p.created_at).toLocaleDateString(locale)}
                </span>
                {p.status === 'paid' && (
                  <a
                    href={`/api/invoices/${p.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t('billing', 'viewInvoice')}
                    className="text-zinc-300 hover:text-zinc-600 transition-colors flex-shrink-0"
                  >
                    <FileText size={13} />
                  </a>
                )}
                {p.status !== 'paid' && (
                  <button
                    onClick={() => deletePayment(p.id)}
                    disabled={deletingId === p.id}
                    title={t('billing', 'confirmDeletePayment')}
                    className="text-zinc-300 hover:text-red-400 transition-colors disabled:opacity-40 flex-shrink-0"
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
