'use client'

import { Check, X } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const PLAN_ORDER: Record<string, number> = { free: 0, starter: 1, grow: 2, pro: 3 }

export function UpgradeModal({ currentPlan, loadingPlan, onUpgrade, onClose }: {
  currentPlan: string
  loadingPlan: string | null
  onUpgrade: (plan: string) => void
  onClose: () => void
}) {
  const { lang, t } = useLanguage()
  const currentRank = PLAN_ORDER[currentPlan] ?? 0

  const UPGRADE_PLANS = [
    {
      name: 'Free',
      planKey: 'free',
      price: '0',
      period: '',
      members: lang === 'en' ? 'Up to 30 members' : 'Bis zu 30 Mitglieder',
      highlight: false,
      features: lang === 'en'
        ? ['Member management', 'Belt tracking & promotions', 'Attendance & GPS check-in', 'Schedule & iCal export', 'Public gym page + embedding', 'Member portal: booking & check-in', 'Lead management & pipeline']
        : ['Mitgliederverwaltung', 'Belt-Tracking & Promotions', 'Anwesenheit & GPS Check-in', 'Stundenplan & iCal-Export', 'Öffentliche Gym-Seite + Einbettung', 'Member-Portal: Buchung & Check-in', 'Lead-Management & Pipeline'],
    },
    {
      name: 'Starter',
      planKey: 'starter',
      price: '29',
      period: lang === 'en' ? '/month' : '/Monat',
      members: lang === 'en' ? 'Up to 50 members' : 'Bis zu 50 Mitglieder',
      highlight: false,
      features: lang === 'en'
        ? ['Everything in Free', 'Automatic payment reminders', 'Birthday emails', '1 trainer account']
        : ['Alles aus Free', 'Automatische Zahlungserinnerungen', 'Geburtstags-E-Mails', '1 Trainer-Account'],
    },
    {
      name: 'Grow',
      planKey: 'grow',
      price: '59',
      period: lang === 'en' ? '/month' : '/Monat',
      members: lang === 'en' ? 'Up to 150 members' : 'Bis zu 150 Mitglieder',
      highlight: true,
      features: lang === 'en'
        ? ['Everything in Starter', 'Unlimited trainer accounts', 'Advanced reports']
        : ['Alles aus Starter', 'Unbegrenzte Trainer-Accounts', 'Erweiterte Berichte'],
    },
    {
      name: 'Pro',
      planKey: 'pro',
      price: '99',
      period: lang === 'en' ? '/month' : '/Monat',
      members: lang === 'en' ? 'Unlimited members' : 'Unbegrenzte Mitglieder',
      highlight: false,
      features: lang === 'en'
        ? ['Everything in Grow', 'Unlimited members', 'Priority support', 'Early access to new features']
        : ['Alles aus Grow', 'Unbegrenzte Mitglieder', 'Prioritäts-Support', 'Frühzeitiger Zugang zu neuen Features'],
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
          <div>
            <h2 className="text-lg font-black text-zinc-900 tracking-tight">{t('settings', 'selectPlan')}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{t('settings', 'selectPlanDesc')}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Plans grid */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {UPGRADE_PLANS.map(plan => {
            const rank = PLAN_ORDER[plan.planKey] ?? 0
            const isCurrent = plan.planKey === currentPlan
            const isLower = rank < currentRank
            const isUpgrade = rank > currentRank
            return (
              <div key={plan.planKey} className={`rounded-2xl border-2 p-5 flex flex-col relative transition-all ${
                plan.highlight && isUpgrade ? 'border-amber-400 shadow-amber-100/80 shadow-lg' :
                isCurrent ? 'border-amber-300 bg-amber-50/50' :
                isLower ? 'border-zinc-100 opacity-50' : 'border-zinc-100'
              }`}>
                {plan.highlight && isUpgrade && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-zinc-950 text-[10px] font-black px-3 py-1 rounded-full tracking-wide whitespace-nowrap">
                    {t('settings', 'popular')}
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-700 text-white text-[10px] font-black px-3 py-1 rounded-full tracking-wide whitespace-nowrap">
                    {t('settings', 'current')}
                  </div>
                )}
                <div className="mb-4">
                  <p className="font-bold text-zinc-400 text-[10px] uppercase tracking-widest mb-1">{plan.name}</p>
                  <div className="flex items-end gap-0.5 mb-0.5">
                    <span className="text-3xl font-black text-zinc-900 tracking-tight">€{plan.price}</span>
                    <span className="text-zinc-400 text-xs pb-1.5">{plan.period}</span>
                  </div>
                  <p className="text-zinc-400 text-[11px]">{plan.members}</p>
                </div>
                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                      <Check size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="w-full text-center py-2 rounded-xl text-xs font-bold text-zinc-400 bg-zinc-100">
                    {t('settings', 'currentPlanLabel')}
                  </div>
                ) : isLower ? (
                  <div className="w-full text-center py-2 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-50">
                    {t('settings', 'downgrade')}
                  </div>
                ) : (
                  <button
                    onClick={() => onUpgrade(plan.planKey)}
                    disabled={loadingPlan === plan.planKey}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-60 ${
                      plan.highlight
                        ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                        : 'bg-zinc-900 hover:bg-zinc-700 text-white'
                    }`}
                  >
                    {loadingPlan === plan.planKey ? t('settings', 'loading') : t('settings', 'choosePlan').replace('{name}', plan.name)}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs text-zinc-400 pb-6">{t('settings', 'upgradeModalFooter')}</p>
      </div>
    </div>
  )
}
