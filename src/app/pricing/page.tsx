'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OsssLogo } from '@/components/Logo'
import { ArrowLeft, Check, Zap, Shield, CreditCard, Clock } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export default function PricingPage() {
  const router = useRouter()
  const { lang } = useLanguage()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [annual, setAnnual] = useState(false)

  const en = lang === 'en'

  const PLANS = [
    {
      name: 'Free',
      price: '0',
      period: '',
      members: en ? 'Up to 30 members' : 'Bis zu 30 Mitglieder',
      planKey: 'free',
      highlight: false,
      features: en
        ? [
            'Member management',
            'Belt tracking & promotions',
            'Attendance & GPS check-in',
            'Schedule & iCal export',
            'Public gym page + schedule embed',
            'Digital member sign-up link',
            'Member portal: booking & check-in per class',
            'Lead management & pipeline',
            'Invoice generation & CSV export',
          ]
        : [
            'Mitgliederverwaltung',
            'Belt-Tracking & Promotions',
            'Anwesenheit & GPS Check-in',
            'Stundenplan & iCal-Export',
            'Öffentliche Gym-Seite + Stundenplan-Einbettung',
            'Digitaler Mitglieder-Anmeldelink',
            'Member-Portal: Buchung & Check-in per Klasse',
            'Lead-Management & Pipeline',
            'Rechnungsgenerierung & CSV-Export',
          ],
      cta: en ? 'Start for free' : 'Kostenlos starten',
      ctaHref: '/register',
    },
    {
      name: 'Starter',
      price: '29',
      period: en ? '/month' : '/Monat',
      members: en ? 'Up to 50 members' : 'Bis zu 50 Mitglieder',
      planKey: 'starter',
      highlight: false,
      features: en
        ? [
            'Everything in Free',
            'Automatic payment reminders',
            'Birthday emails',
            '1 trainer account',
          ]
        : [
            'Alles aus Free',
            'Automatische Zahlungserinnerungen',
            'Geburtstags-E-Mails',
            '1 Trainer-Account',
          ],
      cta: en ? 'Choose Starter' : 'Starter wählen',
      ctaHref: '/register?plan=starter',
    },
    {
      name: 'Grow',
      price: '59',
      period: en ? '/month' : '/Monat',
      members: en ? 'Up to 150 members' : 'Bis zu 150 Mitglieder',
      planKey: 'grow',
      highlight: true,
      features: en
        ? [
            'Everything in Starter',
            'Announcements & noticeboard',
            'Unlimited trainer accounts',
          ]
        : [
            'Alles aus Starter',
            'Ankündigungen & Pinnwand',
            'Unbegrenzte Trainer-Accounts',
          ],
      cta: en ? 'Choose Grow' : 'Grow wählen',
      ctaHref: '/register?plan=grow',
    },
    {
      name: 'Pro',
      price: '99',
      period: en ? '/month' : '/Monat',
      members: en ? 'Unlimited members' : 'Unbegrenzte Mitglieder',
      planKey: 'pro',
      highlight: false,
      features: en
        ? [
            'Everything in Grow',
            'Unlimited members',
            'Priority support',
            'Early access to new features',
          ]
        : [
            'Alles aus Grow',
            'Unbegrenzte Mitglieder',
            'Prioritäts-Support',
            'Frühzeitiger Zugang zu neuen Features',
          ],
      cta: en ? 'Choose Pro' : 'Pro wählen',
      ctaHref: '/register?plan=pro',
    },
  ]

  const TRUST = [
    { icon: CreditCard, label: en ? 'No credit card to start' : 'Keine Kreditkarte beim Start' },
    { icon: Clock,      label: en ? 'Cancel any time' : 'Jederzeit kündbar' },
    { icon: Shield,     label: en ? 'GDPR compliant · Data in the EU' : 'DSGVO-konform · Daten in der EU' },
    { icon: Zap,        label: en ? 'Payments via Stripe' : 'Zahlungen via Stripe' },
  ]

  const FAQS = [
    {
      q: en ? 'Can I cancel at any time?' : 'Kann ich jederzeit kündigen?',
      a: en
        ? 'Yes. Monthly subscriptions run until the end of the paid month. After that you automatically switch to the Free plan — your data stays intact.'
        : 'Ja. Monatliche Abos laufen bis zum Ende des bezahlten Monats. Danach wechselst du automatisch auf den Free-Plan — deine Daten bleiben erhalten.',
    },
    {
      q: en ? 'Are there any transaction fees?' : 'Gibt es Transaktionsgebühren?',
      a: en
        ? 'No. Osss does not charge a fee on member payments. Standard Stripe fees (approx. 1.4% + €0.25 for EU cards) apply directly on your Stripe account.'
        : 'Nein. Osss erhebt keine Gebühr auf Mitgliedszahlungen. Die üblichen Stripe-Gebühren (ca. 1,4 % + 0,25 € für EU-Karten) fallen direkt auf deinem Stripe-Konto an.',
    },
    {
      q: en ? 'Do I need a Stripe account?' : 'Brauche ich ein Stripe-Konto?',
      a: en
        ? 'Only if you want to collect membership fees online. Member management, scheduling, and attendance all work without Stripe.'
        : 'Nur wenn du Beiträge online einziehen möchtest. Mitgliederverwaltung, Stundenplan und Anwesenheit funktionieren auch ohne Stripe-Integration.',
    },
    {
      q: en ? 'Is Osss GDPR compliant?' : 'Ist Osss DSGVO-konform?',
      a: en
        ? 'Yes. Member data is stored in the EU/UK (Supabase London — covered by the EU adequacy decision for the UK, no SCCs needed). Used exclusively for gym management, never shared with third parties.'
        : 'Ja. Mitgliederdaten liegen in der EU/UK (Supabase London — durch den EU-Angemessenheitsbeschluss für UK abgedeckt, keine SCCs nötig). Genutzt ausschließlich für die Gym-Verwaltung, niemals an Dritte weitergegeben.',
    },
    {
      q: en ? 'Does Osss work for other martial arts?' : 'Funktioniert Osss für andere Kampfsportarten?',
      a: en
        ? 'Yes — BJJ, Judo, Karate, Taekwondo, Wing Tsun, Kung Fu come pre-configured with the right belt system. MMA, Muay Thai, Boxing and Wrestling work without belts. The belt system can be customised or disabled per gym.'
        : 'Ja — BJJ, Judo, Karate, Taekwondo, Wing Tsun und Kung Fu kommen mit dem passenden Gürtelsystem vorkonfiguriert. MMA, Muay Thai, Boxen und Ringen laufen ohne Belts. Das Gürtelsystem ist pro Gym anpassbar oder deaktivierbar.',
    },
    {
      q: en ? 'Can I import my existing member data?' : 'Kann ich bestehende Mitgliederdaten importieren?',
      a: en
        ? 'Yes. CSV upload supports name, email, phone, birthdate, belt, contract details and more. We map fields automatically — you can also enter members manually if your dataset is small.'
        : 'Ja. Per CSV-Upload werden Name, E-Mail, Telefon, Geburtsdatum, Gürtelgrad, Vertragsdetails und mehr übernommen. Felder werden automatisch zugeordnet — bei kleinen Datenmengen geht auch manuelles Eintragen.',
    },
    {
      q: en ? 'Do you provide a Data Processing Agreement (DPA)?' : 'Gibt es einen Auftragsverarbeitungsvertrag (AVV)?',
      a: en
        ? 'Yes — and you can sign it electronically inside the dashboard (eIDAS Art. 25 compliant). All sub-processors (Supabase, Stripe, Vercel, Resend) are listed transparently. No paperwork, no email back-and-forth.'
        : 'Ja — und du unterzeichnest ihn elektronisch direkt im Dashboard (eIDAS Art. 25 konform). Alle Sub-Auftragsverarbeiter (Supabase, Stripe, Vercel, Resend) sind transparent gelistet. Kein Papierkram, kein E-Mail-Hin-und-Her.',
    },
  ]

  async function handleUpgrade(plan: string) {
    setLoadingPlan(plan)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push(`/register?plan=${plan}`); return }
    const res = await fetch('/api/stripe/owner-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan, annual }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setLoadingPlan(null)
  }

  // FAQ-Schema → Rich Snippets in Google. Hilft, dass die FAQs direkt
  // unter dem Such-Ergebnis erscheinen (höhere CTR, mehr SERP-Real-Estate).
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a,
      },
    })),
  }

  // Product/Offer-Schema für die 4 Pläne
  const offerSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Osss Gym-Software',
    description: en
      ? 'Gym management software for martial arts. Belt tracking, SEPA, DATEV, GDPR.'
      : 'Gym-Software für Kampfsport. Belt-Tracking, SEPA, DATEV, DSGVO.',
    brand: { '@type': 'Brand', name: 'Osss' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: '0',
      highPrice: '99',
      offerCount: 4,
      offers: PLANS.map(p => ({
        '@type': 'Offer',
        name: p.name,
        price: p.price,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: `https://www.osss.pro/pricing#${p.planKey}`,
      })),
    },
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Structured Data — FAQ + Offer für Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(offerSchema) }}
      />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors font-medium"
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">{en ? 'Back' : 'Zurück'}</span>
            </button>
            <span className="text-zinc-200 hidden sm:block">|</span>
            <OsssLogo variant="dark" />
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="minimal" />
            <Link
              href="/register"
              className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Zap size={13} />
              {en ? 'Start for free' : 'Kostenlos starten'}
            </Link>
          </div>
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
            <span className="text-zinc-300 text-xs font-semibold tracking-wide">
              {en ? '0% platform fee · Only Stripe processing applies' : '0% Plattformgebühr · Nur Stripe-Gebühren fallen an'}
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter mb-4">
            {en ? 'Four plans. Zero hidden costs.' : 'Vier Pläne. Keine Versteckkosten.'}
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed mb-8">
            {en
              ? <>Free up to 30 members.<br />Pay only as your gym grows.</>
              : <>Bis 30 Mitglieder kostenlos.<br />Du zahlst erst, wenn dein Gym wächst.</>
            }
          </p>

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-semibold transition-colors ${!annual ? 'text-white' : 'text-zinc-500'}`}>
              {en ? 'Monthly' : 'Monatlich'}
            </span>
            <button
              onClick={() => setAnnual(a => !a)}
              className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-amber-400' : 'bg-zinc-700'}`}
              aria-label={en ? 'Annual billing' : 'Jährliche Abrechnung'}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? 'left-6' : 'left-0.5'}`} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${annual ? 'text-white' : 'text-zinc-500'}`}>
              {en ? 'Annual' : 'Jährlich'}
            </span>
            {annual && (
              <span className="bg-amber-400 text-zinc-950 text-[10px] font-black px-2.5 py-1 rounded-full tracking-wide">
                {en ? '2 MONTHS FREE' : '2 MONATE GRATIS'}
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
                  {en ? 'POPULAR' : 'BELIEBT'}
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
                      <span className="text-zinc-400 text-sm pb-1.5">{en ? '/year' : '/Jahr'}</span>
                    </div>
                    <p className="text-zinc-400 text-xs">
                      {en
                        ? `€${plan.price}/month · 2 months free`
                        : `€${plan.price}/Monat · 2 Monate gratis`}
                    </p>
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
                  {loadingPlan === plan.planKey ? (en ? 'Loading…' : 'Wird geladen…') : plan.cta}
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
          {en ? 'Frequently asked questions' : 'Häufige Fragen'}
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
            {en ? 'More questions?' : 'Weitere Fragen?'}{' '}
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
          <h2 className="text-3xl font-black tracking-tight mb-3">
            {en ? 'Try it before you decide.' : 'Erst testen, dann entscheiden.'}
          </h2>
          <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
            {en
              ? '30 days free. No credit card. Cancel with one click — your data stays.'
              : '30 Tage gratis. Keine Kreditkarte. Kündigung in einem Klick — deine Daten bleiben.'}
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Zap size={16} />
            {en ? 'Start for free now' : 'Jetzt kostenlos starten'}
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-100 py-6 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} Osss · {en ? 'The martial arts gym software' : 'Die Kampfsport-Gym-Software'}</p>
          <div className="flex gap-5">
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">{en ? 'Privacy' : 'Datenschutz'}</Link>
            <Link href="/impressum" className="hover:text-zinc-700 transition-colors">{en ? 'Imprint' : 'Impressum'}</Link>
            <a href="mailto:oss@osss.pro" className="hover:text-zinc-700 transition-colors">{en ? 'Contact' : 'Kontakt'}</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
