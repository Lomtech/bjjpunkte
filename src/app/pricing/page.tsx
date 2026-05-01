'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Check, Zap } from 'lucide-react'

const PLANS = [
  {
    name: 'Free',
    price: '0',
    period: '',
    members: 'Bis zu 30 Mitglieder',
    color: 'border-slate-200',
    badge: '',
    planKey: 'free',
    features: [
      'Mitgliederverwaltung',
      'Belt-Tracking & Promotions',
      'Anwesenheit & Kiosk-Modus',
      'Stundenplan',
      'Member-Portal (tokenbasiert)',
      '2% Plattformgebühr bei Zahlungen',
    ],
    notIncluded: [
      'Zahlungserinnerungen',
      'Lead-Management',
      'Rechnungsgenerierung',
    ],
    cta: 'Kostenlos starten',
    ctaHref: '/register',
    ctaStyle: 'border-2 border-slate-200 text-slate-700 hover:bg-slate-50',
  },
  {
    name: 'Starter',
    price: '29',
    period: '/Monat',
    members: 'Bis zu 50 Mitglieder',
    color: 'border-slate-200',
    badge: '',
    planKey: 'starter',
    features: [
      'Alles aus Free',
      'Automatische Zahlungserinnerungen',
      'Geburtstags-E-Mails',
      'Rechnungsgenerierung (Kleinunternehmer)',
      'Lead-Management & Pipeline',
      'Trainer-Accounts',
      '2% Plattformgebühr',
    ],
    notIncluded: [],
    cta: 'Starter wählen',
    ctaHref: '/register?plan=starter',
    ctaStyle: 'bg-slate-900 text-white hover:bg-slate-700',
  },
  {
    name: 'Grow',
    price: '59',
    period: '/Monat',
    members: 'Bis zu 150 Mitglieder',
    color: 'border-amber-400',
    badge: 'Beliebt',
    planKey: 'grow',
    features: [
      'Alles aus Starter',
      'WhatsApp-Vorlagen & Direktnachrichten',
      'Öffentlicher Stundenplan (Embed)',
      'QR-Code Check-in',
      'CSV & iCal-Export',
      'Eltern-Kind-Verknüpfung',
      '2% Plattformgebühr',
    ],
    notIncluded: [],
    cta: 'Grow wählen',
    ctaHref: '/register?plan=grow',
    ctaStyle: 'bg-amber-500 text-white hover:bg-amber-400',
  },
  {
    name: 'Pro',
    price: '99',
    period: '/Monat',
    members: 'Unbegrenzte Mitglieder',
    color: 'border-slate-200',
    badge: '',
    planKey: 'pro',
    features: [
      'Alles aus Grow',
      'Unbegrenzte Mitglieder',
      'Mehrere Trainer-Accounts',
      'Prioritäts-Support',
      'Frühzeitiger Zugang zu neuen Features',
      '2% Plattformgebühr',
      'Custom Branding (coming soon)',
    ],
    notIncluded: [],
    cta: 'Pro wählen',
    ctaHref: '/register?plan=pro',
    ctaStyle: 'bg-slate-900 text-white hover:bg-slate-700',
  },
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
    a: 'Ja. Alle Daten liegen auf europäischen Servern (Supabase EU). Beim Mitglieds-Signup wird die Einwilligung inklusive IP-Adresse dokumentiert.',
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
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={15} />
              Zurück
            </button>
            <span className="text-slate-200">|</span>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
                <span className="text-[9px] font-black text-white italic">oss</span>
              </div>
              <span className="font-black text-lg italic text-slate-900">Osss</span>
            </Link>
          </div>
          <Link href="/register" className="bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
            <Zap size={13} />
            Kostenlos starten
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-slate-900 text-white px-5 pt-14 pb-16 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5 mb-5">
            <span className="text-amber-400 text-xs font-semibold">Keine versteckten Gebühren</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4">Einfache, faire Preise</h1>
          <p className="text-slate-300 text-lg">
            Starte kostenlos mit bis zu 30 Mitgliedern. Zahle erst wenn dein Gym wächst.
          </p>
        </div>
      </div>

      {/* Plans grid */}
      <div className="max-w-5xl mx-auto px-5 -mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`bg-white rounded-2xl border-2 ${plan.color} p-6 flex flex-col relative shadow-sm ${plan.badge ? 'shadow-amber-100' : ''}`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}
              <div className="mb-5">
                <p className="font-bold text-slate-900 text-lg">{plan.name}</p>
                <div className="flex items-end gap-0.5 mt-1">
                  <span className="text-3xl font-black text-slate-900">€{plan.price}</span>
                  <span className="text-slate-400 text-sm pb-1">{plan.period}</span>
                </div>
                <p className="text-slate-500 text-xs mt-1">{plan.members}</p>
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check size={13} className="text-green-500 mt-0.5 flex-shrink-0" />
                    {f}
                  </li>
                ))}
                {plan.notIncluded.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-300 line-through">
                    <span className="mt-0.5 flex-shrink-0 w-3 h-3" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.planKey === 'free' ? (
                <Link
                  href={plan.ctaHref}
                  className={`block text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${plan.ctaStyle}`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.planKey)}
                  disabled={loadingPlan === plan.planKey}
                  className={`block w-full text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${plan.ctaStyle}`}
                >
                  {loadingPlan === plan.planKey ? 'Wird geladen…' : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Trust strip */}
      <div className="max-w-5xl mx-auto px-5 mt-8 mb-4">
        <div className="bg-slate-50 rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-slate-500">
          {[
            '✓  Keine Kreditkarte beim Start',
            '✓  Jederzeit kündbar',
            '✓  DSGVO-konform · Daten in der EU',
            '✓  Stripe-zertifiziert',
          ].map(t => (
            <span key={t} className="font-medium">{t}</span>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto px-5 py-16">
        <h2 className="text-2xl font-black text-slate-900 text-center mb-8">Häufige Fragen</h2>
        <div className="divide-y divide-slate-100">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left py-4 flex items-center justify-between gap-4 group"
              >
                <span className="font-semibold text-slate-900 group-hover:text-amber-600 transition-colors text-sm">{faq.q}</span>
                <span className={`text-slate-400 text-lg flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-45' : ''}`}>+</span>
              </button>
              {openFaq === i && (
                <p className="pb-4 text-sm text-slate-500 leading-relaxed">{faq.a}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-slate-400 text-sm">
            Weitere Fragen?{' '}
            <a href="mailto:support@osss.pro" className="text-amber-600 hover:underline font-medium">
              support@osss.pro
            </a>
          </p>
        </div>
      </div>

      {/* Final CTA */}
      <div className="bg-slate-900 text-white text-center px-5 py-16">
        <h2 className="text-3xl font-black mb-3">Bereit loszulegen?</h2>
        <p className="text-slate-300 mb-6 max-w-md mx-auto">Kostenlos starten — kein Risiko, keine Kreditkarte. Dein Gym läuft in 10 Minuten.</p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors"
        >
          <Zap size={16} />
          Jetzt kostenlos starten
        </Link>
      </div>
    </div>
  )
}
