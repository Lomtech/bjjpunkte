'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OsssLogo } from '@/components/Logo'
import { ArrowLeft, Check, Zap, Shield, CreditCard, Clock } from 'lucide-react'

const PLANS = [
  {
    name: 'Free',
    price: '0',
    period: '',
    members: 'Bis zu 30 Mitglieder',
    planKey: 'free',
    highlight: false,
    features: [
      'Mitgliederverwaltung',
      'Belt-Tracking & Promotions',
      'Anwesenheit & Kiosk-Modus',
      'Stundenplan & iCal-Export',
      'Öffentliche Gym-Seite (gym.osss.pro/…)',
      'Digitaler Mitglieder-Anmeldelink',
      'Member-Portal (tokenbasiert)',
      'Lead-Management & Pipeline',
      'Rechnungsgenerierung & CSV-Export',
      '2% Plattformgebühr bei Zahlungen',
    ],
    cta: 'Kostenlos starten',
    ctaHref: '/register',
  },
  {
    name: 'Starter',
    price: '29',
    period: '/Monat',
    members: 'Bis zu 50 Mitglieder',
    planKey: 'starter',
    highlight: false,
    features: [
      'Alles aus Free',
      'Automatische Zahlungserinnerungen',
      'Geburtstags-E-Mails',
      '1 Trainer-Account',
      '2% Plattformgebühr',
    ],
    cta: 'Starter wählen',
    ctaHref: '/register?plan=starter',
  },
  {
    name: 'Grow',
    price: '59',
    period: '/Monat',
    members: 'Bis zu 150 Mitglieder',
    planKey: 'grow',
    highlight: true,
    features: [
      'Alles aus Starter',
      'Ankündigungen & Pinnwand',
      'Website-Embed für Stundenplan',
      'Unbegrenzte Trainer-Accounts',
      '2% Plattformgebühr',
    ],
    cta: 'Grow wählen',
    ctaHref: '/register?plan=grow',
  },
  {
    name: 'Pro',
    price: '99',
    period: '/Monat',
    members: 'Unbegrenzte Mitglieder',
    planKey: 'pro',
    highlight: false,
    features: [
      'Alles aus Grow',
      'Unbegrenzte Mitglieder',
      'Prioritäts-Support',
      'Frühzeitiger Zugang zu neuen Features',
      '2% Plattformgebühr',
    ],
    cta: 'Pro wählen',
    ctaHref: '/register?plan=pro',
  },
]

const TRUST = [
  { icon: CreditCard, label: 'Keine Kreditkarte beim Start' },
  { icon: Clock,      label: 'Jederzeit kündbar' },
  { icon: Shield,     label: 'DSGVO-konform · Daten in der EU' },
  { icon: Zap,        label: 'Zahlungen via Stripe' },
]

const FAQS = [
  {
    q: 'Kann ich jederzeit kündigen?',
    a: 'Ja. Monatliche Abos laufen bis zum Ende des bezahlten Monats. Danach wechselst du automatisch auf den Free-Plan — deine Daten bleiben erhalten.',
  },
  {
    q: 'Was ist die Plattformgebühr?',
    a: 'Osss berechnet 2% auf jeden Zahlungseingang deiner Mitglieder, der über Stripe abgewickelt wird. Zusätzlich fallen die üblichen Stripe-Gebühren (ca. 1,4% + 0,25€) an.',
  },
  {
    q: 'Brauche ich ein Stripe-Konto?',
    a: 'Nur wenn du Beiträge online einziehen möchtest. Mitgliederverwaltung, Stundenplan und Anwesenheit funktionieren auch ohne Stripe-Integration.',
  },
  {
    q: 'Ist Osss DSGVO-konform?',
    a: 'Ja. Alle Daten liegen auf europäischen Servern (Supabase EU). Mitgliederdaten werden ausschließlich für die Gym-Verwaltung verarbeitet und nicht an Dritte weitergegeben.',
  },
  {
    q: 'Funktioniert Osss für andere Kampfsportarten?',
    a: 'Absolut. BJJ, MMA, Kickboxen, Judo, Karate — Osss ist für alle Kampfsport-Gyms ausgelegt. Das Gürtelsystem ist flexibel konfigurierbar.',
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [annual, setAnnual] = useState(false)

  async function handleUpgrade(plan: string) {
    setLoadingPlan(plan)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push(`/register?plan=${plan}`); return }
    const res = await fetch('/api/stripe/owner-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setLoadingPlan(null)
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors font-medium"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Zurück</span>
            </button>
            <span className="text-zinc-200 hidden sm:block">|</span>
            <OsssLogo variant="light" />
          </div>
          <Link
            href="/register"
            className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Zap size={13} />
            Kostenlos starten
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-zinc-950 text-white px-5 pt-16 pb-20 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(251,191,36,0.12) 0%, transparent 65%)' }}
        />
        <div className="max-w-xl mx-auto relative">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
            <span className="text-zinc-300 text-xs font-semibold tracking-wide">Keine versteckten Gebühren</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter mb-4">
            Einfache, faire Preise
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed mb-8">
            Starte kostenlos mit bis zu 30 Mitgliedern.<br />Zahle erst wenn dein Gym wächst.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-semibold transition-colors ${!annual ? 'text-white' : 'text-zinc-500'}`}>Monatlich</span>
            <button
              onClick={() => setAnnual(a => !a)}
              className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-amber-400' : 'bg-zinc-700'}`}
              aria-label="Jährliche Abrechnung"
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? 'left-6' : 'left-0.5'}`} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${annual ? 'text-white' : 'text-zinc-500'}`}>
              Jährlich
            </span>
            {annual && (
              <span className="bg-amber-400 text-zinc-950 text-[10px] font-black px-2.5 py-1 rounded-full tracking-wide">
                2 MONATE GRATIS
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="max-w-5xl mx-auto px-5 -mt-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`bg-white rounded-2xl border-2 p-6 flex flex-col relative shadow-sm transition-all ${
                plan.highlight
                  ? 'border-amber-400 shadow-amber-100/80 shadow-lg'
                  : 'border-zinc-100 hover:border-zinc-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-zinc-950 text-[11px] font-black px-3 py-1 rounded-full tracking-wide">
                  BELIEBT
                </div>
              )}

              <div className="mb-6">
                <p className="font-bold text-zinc-500 text-xs uppercase tracking-widest mb-2">{plan.name}</p>
                {plan.price === '0' ? (
                  <div className="flex items-end gap-0.5 mb-1">
                    <span className="text-4xl font-black text-zinc-900 tracking-tight">€0</span>
                    <span className="text-zinc-400 text-sm pb-1.5"></span>
                  </div>
                ) : annual ? (
                  <div className="mb-1">
                    <div className="flex items-end gap-0.5">
                      <span className="text-4xl font-black text-zinc-900 tracking-tight">
                        €{Math.round(parseInt(plan.price) * 10)}
                      </span>
                      <span className="text-zinc-400 text-sm pb-1.5">/Jahr</span>
                    </div>
                    <p className="text-zinc-400 text-xs">€{plan.price}/Monat · 2 Monate gratis</p>
                  </div>
                ) : (
                  <div className="flex items-end gap-0.5 mb-1">
                    <span className="text-4xl font-black text-zinc-900 tracking-tight">€{plan.price}</span>
                    <span className="text-zinc-400 text-sm pb-1.5">{plan.period}</span>
                  </div>
                )}
                <p className="text-zinc-400 text-xs">{plan.members}</p>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-700">
                    <Check size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.planKey === 'free' ? (
                <Link
                  href={plan.ctaHref}
                  className={`block text-center px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    plan.highlight
                      ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                      : 'border-2 border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.planKey)}
                  disabled={loadingPlan === plan.planKey}
                  className={`block w-full text-center px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 ${
                    plan.highlight
                      ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                      : 'bg-zinc-900 hover:bg-zinc-700 text-white'
                  }`}
                >
                  {loadingPlan === plan.planKey ? 'Wird geladen…' : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Trust strip */}
      <div className="max-w-5xl mx-auto px-5 mb-4">
        <div className="bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TRUST.map(t => (
              <div key={t.label} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center flex-shrink-0">
                  <t.icon size={13} className="text-zinc-500" />
                </div>
                <span className="text-zinc-600 text-xs font-medium leading-tight">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-5 py-20">
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight text-center mb-10">
          Häufige Fragen
        </h2>
        <div className="divide-y divide-zinc-100">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left py-5 flex items-center justify-between gap-4 group"
              >
                <span className="font-semibold text-zinc-900 group-hover:text-amber-600 transition-colors text-sm">
                  {faq.q}
                </span>
                <span className={`text-zinc-400 text-xl flex-shrink-0 transition-transform duration-200 leading-none ${openFaq === i ? 'rotate-45' : ''}`}>
                  +
                </span>
              </button>
              {openFaq === i && (
                <p className="pb-5 text-sm text-zinc-500 leading-relaxed">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <p className="text-zinc-400 text-sm">
            Weitere Fragen?{' '}
            <a href="mailto:oss@osss.pro" className="text-amber-600 hover:text-amber-700 font-semibold transition-colors">
              oss@osss.pro
            </a>
          </p>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-zinc-950 text-white text-center px-5 py-20 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 110%, rgba(251,191,36,0.08) 0%, transparent 65%)' }}
        />
        <div className="max-w-md mx-auto relative">
          <h2 className="text-3xl font-black tracking-tight mb-3">Bereit loszulegen?</h2>
          <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
            Kostenlos starten — kein Risiko, keine Kreditkarte. Dein Gym läuft in 10 Minuten.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Zap size={16} />
            Jetzt kostenlos starten
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-100 py-6 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} Osss · Die Kampfsport-Gym-Software</p>
          <div className="flex gap-5">
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">Datenschutz</Link>
            <Link href="/impressum" className="hover:text-zinc-700 transition-colors">Impressum</Link>
            <a href="mailto:oss@osss.pro" className="hover:text-zinc-700 transition-colors">Kontakt</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
