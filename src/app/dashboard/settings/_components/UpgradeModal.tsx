'use client'

import { Check, X, Zap } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { STANDARD_TIER, savingsAnnualEUR } from '@/lib/pricing'

/**
 * 2026-05 Single-Tier Upgrade-Modal.
 *
 * Vor dem Realignment war das ein 4-Spalten-Tier-Picker (Free/Starter/Grow/Pro).
 * Mit dem neuen Single-Tier-Modell zeigt das Modal nur noch 2 Optionen:
 * Monthly vs Annual. Die Tier-Choice gibt's nicht mehr — alle Features sind
 * auf dem Standard-Plan freigeschaltet.
 *
 * `onUpgrade` callback signature unverändert für API-Compat. Übergibt
 * 'standard' als planKey — der Server-Code routed das auf den Stripe-Checkout
 * mit dem entsprechenden Billing-Intervall (annual flag).
 */
export function UpgradeModal({ currentPlan, loadingPlan, onUpgrade, onClose }: {
  currentPlan: string
  loadingPlan: string | null
  onUpgrade: (plan: string, annual?: boolean) => void
  onClose: () => void
}) {
  const { lang } = useLanguage()
  const en = lang === 'en'

  const isPaid = currentPlan === 'standard' || currentPlan === 'starter' || currentPlan === 'grow' || currentPlan === 'pro'
  const monthlyEUR = Math.round(STANDARD_TIER.monthlyCents / 100)
  const annualMonthlyEUR = Math.round(STANDARD_TIER.annualMonthlyCents / 100)
  const yearlySavings = savingsAnnualEUR()

  const FEATURES = en ? [
    'All features unlocked',
    'Unlimited members',
    '0 % platform fee on member dues',
    'DATEV CSV export',
    '§19 UStG-compliant invoices',
    'Multi-location support',
    'GDPR/DSGVO with DPA',
    'Cancel anytime',
  ] : [
    'Alle Features freigeschaltet',
    'Unbegrenzte Mitglieder',
    '0 % Plattformgebühr auf Beiträge',
    'DATEV-CSV-Export',
    '§19 UStG-konforme Rechnungen',
    'Multi-Location-Support',
    'DSGVO mit AVV',
    'Jederzeit kündbar',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
          <div>
            <h2 className="text-lg font-black text-zinc-900 tracking-tight">
              {isPaid
                ? (en ? 'Manage subscription' : 'Abo verwalten')
                : (en ? 'Subscribe to Osss' : 'Osss abonnieren')}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {en
                ? 'Pick monthly or annual billing. Same product, same features.'
                : 'Wähle monatliche oder jährliche Abrechnung. Gleiches Produkt, gleiche Features.'}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Two-column billing options */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Monthly */}
          <div className="rounded-2xl border-2 border-zinc-100 p-6 flex flex-col">
            <p className="font-bold text-zinc-400 text-[10px] uppercase tracking-widest mb-2">{en ? 'Monthly' : 'Monatlich'}</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-zinc-900 tracking-tight">{monthlyEUR} €</span>
              <span className="text-zinc-400 text-xs pb-2">{en ? '/month' : '/Monat'}</span>
            </div>
            <p className="text-zinc-400 text-[11px] mb-5">{en ? 'Billed monthly, cancel anytime' : 'Monatlich abgerechnet, jederzeit kündbar'}</p>
            <ul className="space-y-2 flex-1 mb-5">
              {FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                  <Check size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onUpgrade('standard', false)}
              disabled={loadingPlan === 'standard-monthly'}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 bg-zinc-900 hover:bg-zinc-700 text-white"
            >
              {loadingPlan === 'standard-monthly'
                ? (en ? 'Loading…' : 'Lädt…')
                : (en ? 'Choose monthly' : 'Monatlich wählen')}
            </button>
          </div>

          {/* Annual */}
          <div className="rounded-2xl border-2 border-amber-400 p-6 flex flex-col relative shadow-amber-100/80 shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-zinc-950 text-[10px] font-black px-3 py-1 rounded-full tracking-wide whitespace-nowrap">
              {en ? `Save ${yearlySavings} €/year` : `Spare ${yearlySavings} €/Jahr`}
            </div>
            <p className="font-bold text-amber-700 text-[10px] uppercase tracking-widest mb-2">{en ? 'Annual' : 'Jährlich'}</p>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-black text-zinc-900 tracking-tight">{annualMonthlyEUR} €</span>
              <span className="text-zinc-400 text-xs pb-2">{en ? '/month' : '/Monat'}</span>
            </div>
            <p className="text-amber-700 text-[11px] mb-5">
              {en
                ? `Billed annually (${annualMonthlyEUR * 12} € upfront)`
                : `Jährlich abgerechnet (${annualMonthlyEUR * 12} € im Voraus)`}
            </p>
            <ul className="space-y-2 flex-1 mb-5">
              {FEATURES.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                  <Check size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onUpgrade('standard', true)}
              disabled={loadingPlan === 'standard-annual'}
              className="w-full py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 bg-amber-400 hover:bg-amber-300 text-zinc-950 inline-flex items-center justify-center gap-1.5"
            >
              <Zap size={13} />
              {loadingPlan === 'standard-annual'
                ? (en ? 'Loading…' : 'Lädt…')
                : (en ? 'Choose annual' : 'Jährlich wählen')}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-400 pb-6 px-6 leading-relaxed">
          {en
            ? 'Stripe Checkout opens in a new tab. EU VAT calculated automatically. Cancel anytime.'
            : 'Stripe-Checkout öffnet sich im neuen Tab. EU-USt. wird automatisch berechnet. Jederzeit kündbar.'}
        </p>
      </div>
    </div>
  )
}
