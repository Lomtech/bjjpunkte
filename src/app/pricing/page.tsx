'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Zap, Shield, CreditCard, Clock, Sparkles } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { TopNav } from '@/components/TopNav'
import {
  PRICING_TIERS,
  LIFETIME_PILOT_SLOTS,
  formatPriceEURShort,
  savingsAnnualEUR,
  annualPriceCents,
  type PricingTier,
} from '@/lib/pricing'

export default function PricingPage() {
  const router = useRouter()
  const { lang } = useLanguage()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [annual, setAnnual] = useState(false)

  const en = lang === 'en'

  // Per-tier feature lists are display copy (heavily localised + bullet-style),
  // so they live next to the page rather than in pricing.ts. The numeric
  // pricing comes from PRICING_TIERS — see src/lib/pricing.ts.
  const FEATURE_LISTS: Record<string, { en: string[]; de: string[] }> = {
    free: {
      en: [
        'Member management',
        'Belt tracking & promotions',
        'Attendance & GPS check-in',
        'Schedule & iCal export',
        'Public gym page + schedule embed',
        'Digital member sign-up link',
        'Member portal: booking & check-in per class',
        'Lead management & pipeline',
        'Invoice generation & CSV export',
        'Email support',
      ],
      de: [
        'Mitgliederverwaltung',
        'Belt-Tracking & Promotions',
        'Anwesenheit & GPS Check-in',
        'Stundenplan & iCal-Export',
        'Öffentliche Gym-Seite + Stundenplan-Einbettung',
        'Digitaler Mitglieder-Anmeldelink',
        'Member-Portal: Buchung & Check-in per Klasse',
        'Lead-Management & Pipeline',
        'Rechnungsgenerierung & CSV-Export',
        'Email-Support',
      ],
    },
    starter: {
      en: [
        'Everything in Free',
        'GDPR Premium (encryption, eIDAS-signed DPA)',
        'Wellpass / Hansefit / EGYM integration',
        'Automatic dunning & SEPA workflow',
        'Birthday & retention emails',
        'Email support · 48h reply',
      ],
      de: [
        'Alles aus Free',
        'DSGVO-Premium (Encryption, eIDAS-signierter AVV)',
        'Wellpass / Hansefit / EGYM-Integration',
        'Automatischer Mahn- & SEPA-Workflow',
        'Geburtstags- & Reaktivierungs-Mails',
        'Email-Support · 48 h Antwort',
      ],
    },
    grow: {
      en: [
        'Everything in Starter',
        'Multi-location (up to 2 sites)',
        'DATEV export',
        'Customisable dunning PDF templates',
        'Announcements & noticeboard',
        'Priority support · 24h reply',
      ],
      de: [
        'Alles aus Starter',
        'Multi-Standort (bis zu 2 Standorte)',
        'DATEV-Export',
        'Anpassbare Mahn-PDF-Vorlagen',
        'Ankündigungen & Pinnwand',
        'Priority-Support · 24 h Antwort',
      ],
    },
    pro: {
      en: [
        'Everything in Grow',
        'Multi-location (unlimited)',
        'Custom branding (your logo on emails & PDFs)',
        'Priority support · 4h reply',
        'Quarterly 1-on-1 with the founder',
        'Custom integrations on request',
      ],
      de: [
        'Alles aus Grow',
        'Multi-Standort (unbegrenzt)',
        'Custom-Branding (eigenes Logo in Mails & PDFs)',
        'Priority-Support · 4 h Antwort',
        'Quartals-1on1 mit dem Founder',
        'Custom-Integrationen auf Anfrage',
      ],
    },
  }

  function memberRange(tier: PricingTier): string {
    if (tier.planKey === 'free') return en ? 'Up to 30 members' : 'Bis zu 30 Mitglieder'
    if (tier.membersTo === null) return en ? `${tier.membersFrom}+ members` : `Ab ${tier.membersFrom} Mitgliedern`
    return en
      ? `${tier.membersFrom}–${tier.membersTo} members`
      : `${tier.membersFrom}–${tier.membersTo} Mitglieder`
  }

  function ctaLabel(tier: PricingTier): string {
    if (tier.planKey === 'free') return en ? 'Start for free' : 'Kostenlos starten'
    return en ? `Choose ${tier.name}` : `${tier.name} wählen`
  }

  const TRUST = [
    { icon: CreditCard, label: en ? 'No credit card to start' : 'Keine Kreditkarte beim Start' },
    { icon: Clock,      label: en ? 'Cancel any time' : 'Jederzeit kündbar' },
    { icon: Shield,     label: en ? 'GDPR compliant · Data in the EU' : 'DSGVO-konform · Daten in der EU' },
    { icon: Zap,        label: en ? 'Payments via Stripe' : 'Zahlungen via Stripe' },
  ]

  // Competitor benchmarks — public list prices on competitor websites,
  // last verified 2026-05-08. Update with the rationale doc when refreshed.
  const COMPETITORS = [
    {
      name: 'Osss',
      lo: 49,
      hi: 149,
      free: en ? 'Free up to 30 members' : 'Gratis bis 30 Mitglieder',
      fee: en ? '0% platform fee' : '0 % Plattformgebühr',
      isUs: true,
    },
    {
      name: 'Magicline',
      lo: 99,
      hi: 300,
      free: en ? 'No free tier' : 'Kein Free-Tier',
      fee: en ? 'Setup fee + ~1.5% on top' : 'Setup-Gebühr + ca. 1,5 % oben drauf',
      isUs: false,
    },
    {
      name: 'Aidoo',
      lo: 69,
      hi: 149,
      free: en ? 'No free tier' : 'Kein Free-Tier',
      fee: en ? 'Min. 12-month term' : 'Mindestlaufzeit 12 Monate',
      isUs: false,
    },
    {
      name: 'Eversports',
      lo: 49,
      hi: 149,
      free: en ? 'No free tier' : 'Kein Free-Tier',
      fee: en ? '~1.5% platform fee on payments' : 'ca. 1,5 % Plattformgebühr auf Zahlungen',
      isUs: false,
    },
  ]

  const FAQS = [
    {
      q: en
        ? 'What happens when I exceed the member limit on my plan?'
        : 'Was passiert, wenn ich das Mitgliederlimit überschreite?',
      a: en
        ? 'You get a friendly notice in the dashboard and 14 days to either upgrade or trim inactive members. We never lock you out mid-month. If you do nothing, you keep working — we just nudge you again at the next billing cycle.'
        : 'Du bekommst einen freundlichen Hinweis im Dashboard und 14 Tage Zeit, um entweder zu upgraden oder inaktive Mitglieder zu entfernen. Wir sperren dich nie mitten im Monat aus. Wenn du nichts tust, arbeitest du weiter — wir erinnern dich beim nächsten Abrechnungszyklus.',
    },
    {
      q: en ? 'Can I cancel at any time?' : 'Kann ich jederzeit kündigen?',
      a: en
        ? 'Yes. Monthly subscriptions run until the end of the paid month, annual until the end of the paid year. After that you automatically switch to the Free plan — your data stays intact.'
        : 'Ja. Monatliche Abos laufen bis zum Ende des bezahlten Monats, Jahresabos bis zum Ende des bezahlten Jahres. Danach wechselst du automatisch auf den Free-Plan — deine Daten bleiben erhalten.',
    },
    {
      q: en
        ? 'Does Stripe SEPA processing cost extra?'
        : 'Kostet die Stripe-SEPA-Verarbeitung extra?',
      a: en
        ? 'No extra fee from us. Osss adds 0% platform fee on member payments — you keep everything except Stripe\'s standard processing (~0.35 € per SEPA debit, ~1.4% + 0.25 € on EU cards). Magicline, Aidoo and Eversports typically add 1–1.5% on top of Stripe.'
        : 'Keine Extragebühr von uns. Osss addiert 0 % Plattformgebühr auf Mitgliedszahlungen — du behältst alles außer der Stripe-Standardverarbeitung (ca. 0,35 € pro SEPA-Lastschrift, ca. 1,4 % + 0,25 € bei EU-Karten). Magicline, Aidoo und Eversports schlagen typischerweise 1–1,5 % auf Stripe oben drauf.',
    },
    {
      q: en
        ? 'What about Wellpass / Hansefit / EGYM members?'
        : 'Was passiert mit Wellpass-/Hansefit-/EGYM-Mitgliedern?',
      a: en
        ? 'Fully integrated from the Starter plan upward. Members count toward your tier limit, but the Wellpass invoice flow runs separately from your Stripe collections and is automated end-to-end.'
        : 'Ab dem Starter-Plan voll integriert. Mitglieder zählen für dein Tier-Limit, der Wellpass-Abrechnungs-Flow läuft aber getrennt von deinem Stripe-Einzug und ist End-to-End automatisiert.',
    },
    {
      q: en ? 'Are there any setup fees?' : 'Gibt es Setup-Gebühren?',
      a: en
        ? 'No. Magicline charges 500–1,500 € one-off; Aidoo bundles it into a 12-month term. With Osss you sign up, import members, and start. The migration concierge below is also free.'
        : 'Nein. Magicline verlangt 500–1.500 € einmalig; Aidoo bündelt das in eine 12-Monats-Laufzeit. Bei Osss registrierst du dich, importierst Mitglieder und legst los. Auch die Migrations-Begleitung unten kostet nichts.',
    },
    {
      q: en
        ? 'How does migration from Excel or Magicline work?'
        : 'Wie funktioniert die Migration von Excel oder Magicline?',
      a: en
        ? 'CSV upload supports name, email, phone, birthdate, belt, contract details and IBAN. We map fields automatically. For Magicline exports we provide a one-pager that walks through the export → upload step. If your dataset is messy, send it to oss@osss.pro — we clean and import for free during the launch phase.'
        : 'Per CSV-Upload werden Name, E-Mail, Telefon, Geburtsdatum, Gürtelgrad, Vertragsdetails und IBAN übernommen. Felder werden automatisch zugeordnet. Für Magicline-Exporte gibt es eine 1-Seiten-Anleitung Export → Upload. Wenn dein Datensatz unsauber ist, schick ihn an oss@osss.pro — wir bereinigen und importieren in der Launch-Phase kostenlos.',
    },
    {
      q: en ? 'Is Osss GDPR compliant?' : 'Ist Osss DSGVO-konform?',
      a: en
        ? 'Yes. Member data is stored in the EU/UK (Supabase London — covered by the EU adequacy decision for the UK, no SCCs needed). The DPA is signed electronically inside the dashboard, eIDAS-compliant. All six sub-processors (Supabase, Stripe, Vercel, Resend, Sentry, Upstash) are listed with country, purpose and safeguards.'
        : 'Ja. Mitgliederdaten liegen in der EU/UK (Supabase London — durch den EU-Angemessenheitsbeschluss für UK abgedeckt, keine SCCs nötig). Der AVV wird elektronisch im Dashboard unterzeichnet, eIDAS-konform. Alle sechs Sub-Auftragsverarbeiter (Supabase, Stripe, Vercel, Resend, Sentry, Upstash) sind mit Land, Zweck und Schutzmaßnahmen aufgeführt.',
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
      highPrice: '149',
      offerCount: PRICING_TIERS.length,
      offers: PRICING_TIERS.map(t => ({
        '@type': 'Offer',
        name: t.name,
        price: String(Math.round(t.monthlyCents / 100)),
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: `https://www.osss.pro/pricing#${t.planKey}`,
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

      <TopNav />

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
          {PRICING_TIERS.map(tier => {
            const features = FEATURE_LISTS[tier.planKey][lang === 'en' ? 'en' : 'de']
            const monthlyShort = formatPriceEURShort(tier.monthlyCents, lang)
            const annualEUR = Math.round(annualPriceCents(tier.monthlyCents) / 100)
            return (
              <div
                key={tier.planKey}
                id={tier.planKey}
                className={`bg-white rounded-2xl border-2 p-6 flex flex-col relative shadow-sm transition-all ${
                  tier.highlight
                    ? 'border-amber-400 shadow-amber-100/80 shadow-lg'
                    : 'border-zinc-100 hover:border-zinc-200'
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-zinc-950 text-[11px] font-black px-3 py-1 rounded-full tracking-wide">
                    {en ? 'POPULAR' : 'POPULÄR'}
                  </div>
                )}

                <div className="mb-6">
                  <p className="font-bold text-zinc-500 text-xs uppercase tracking-widest mb-2">{tier.name}</p>
                  {tier.monthlyCents === 0 ? (
                    <div className="flex items-end gap-0.5 mb-1">
                      <span className="text-4xl font-black text-zinc-900 tracking-tight">{en ? '€0' : '0 €'}</span>
                    </div>
                  ) : annual ? (
                    <div className="mb-1">
                      <div className="flex items-end gap-0.5">
                        <span className="text-4xl font-black text-zinc-900 tracking-tight">
                          {en ? `€${annualEUR}` : `${annualEUR} €`}
                        </span>
                        <span className="text-zinc-400 text-sm pb-1.5">{en ? '/year' : '/Jahr'}</span>
                      </div>
                      <p className="text-zinc-400 text-xs">
                        {en
                          ? `${monthlyShort}/month · save ${savingsAnnualEUR(tier.monthlyCents)} €`
                          : `${monthlyShort}/Monat · ${savingsAnnualEUR(tier.monthlyCents)} € Jahresvorteil`}
                      </p>
                    </div>
                  ) : (
                    <div className="mb-1">
                      <div className="flex items-end gap-0.5">
                        <span className="text-4xl font-black text-zinc-900 tracking-tight">{monthlyShort}</span>
                        <span className="text-zinc-400 text-sm pb-1.5">{en ? '/month' : '/Monat'}</span>
                      </div>
                      {tier.previousMonthlyEUR !== null && (
                        <p className="text-zinc-400 text-[11px]">
                          {en
                            ? <>was <span className="line-through">€{tier.previousMonthlyEUR}</span> · now in line with the market</>
                            : <>vorher <span className="line-through">{tier.previousMonthlyEUR} €</span> · jetzt marktgerecht</>}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-zinc-400 text-xs">{memberRange(tier)}</p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-700">
                      <Check size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {tier.planKey === 'free' ? (
                  <Link
                    href="/register"
                    className={`block text-center px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      tier.highlight
                        ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                        : 'border-2 border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    {ctaLabel(tier)}
                  </Link>
                ) : (
                  <button
                    onClick={() => handleUpgrade(tier.planKey)}
                    disabled={loadingPlan === tier.planKey}
                    className={`block w-full text-center px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-60 ${
                      tier.highlight
                        ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                        : 'bg-zinc-900 hover:bg-zinc-700 text-white'
                    }`}
                  >
                    {loadingPlan === tier.planKey ? (en ? 'Loading…' : 'Wird geladen…') : ctaLabel(tier)}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Trust strip */}
      <div className="max-w-5xl mx-auto px-5 mb-12">
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

      {/* Competitor comparison */}
      <div className="max-w-4xl mx-auto px-5 pb-16">
        <div className="text-center mb-8">
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">
            {en ? 'Market check' : 'Markt-Vergleich'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight mb-2">
            {en ? 'How we compare to the rest' : 'So stehen wir im Vergleich da'}
          </h2>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            {en
              ? 'Public list prices, last verified May 2026. We sit at the lower end of the mid-tier and never charge platform fees on member payments.'
              : 'Öffentliche Listenpreise, zuletzt geprüft Mai 2026. Wir liegen am unteren Ende des Mid-Tiers und nehmen nie Plattformgebühren auf Mitgliedszahlungen.'}
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-zinc-100">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">{en ? 'Provider' : 'Anbieter'}</th>
                <th className="text-left px-4 py-3 font-semibold">{en ? 'Monthly range' : 'Monatlicher Preisrahmen'}</th>
                <th className="text-left px-4 py-3 font-semibold">{en ? 'Free tier' : 'Free-Tier'}</th>
                <th className="text-left px-4 py-3 font-semibold">{en ? 'Extras' : 'Extras'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {COMPETITORS.map(c => (
                <tr key={c.name} className={c.isUs ? 'bg-amber-50/60' : ''}>
                  <td className="px-4 py-3 font-bold text-zinc-900">
                    {c.name}
                    {c.isUs && (
                      <span className="ml-2 text-[10px] font-black tracking-wider text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                        {en ? 'YOU' : 'DU'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 tabular-nums">
                    {en ? `€${c.lo} – €${c.hi}` : `${c.lo} – ${c.hi} €`}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{c.free}</td>
                  <td className="px-4 py-3 text-zinc-600">{c.fee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lifetime Pilot block */}
      <div className="max-w-4xl mx-auto px-5 pb-16">
        <div className="bg-gradient-to-br from-amber-50 via-white to-amber-50 border-2 border-amber-200 rounded-3xl p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-amber-400 text-zinc-950 text-[10px] font-black px-3 py-1 rounded-full tracking-wider mb-4">
              <Sparkles size={12} />
              {en ? `LIFETIME PILOT · ${LIFETIME_PILOT_SLOTS} STUDIOS ONLY` : `LIFETIME-PILOT · NUR ${LIFETIME_PILOT_SLOTS} STUDIOS`}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight mb-3">
              {en ? 'Are you one of the first 10 studios?' : 'Bist du eines der ersten 10 Studios?'}
            </h2>
            <p className="text-zinc-700 text-sm sm:text-base leading-relaxed mb-5 max-w-2xl">
              {en ? (
                <>
                  Pioneering studios who help shape Osss in its launch phase
                  lock in <strong>40 % off their tier price — for life</strong>.
                  Starter at <strong>29 €/month</strong> instead of 49 €,
                  Grow at <strong>53 €/month</strong> instead of 89 €,
                  Pro at <strong>89 €/month</strong> instead of 149 €.
                  When prices go up later — and they will — your rate stays the same. Forever.
                </>
              ) : (
                <>
                  Pionier-Studios, die Osss in der Launch-Phase mitgestalten,
                  bekommen <strong>40 % auf ihren Tier-Preis — auf Lebenszeit</strong>.
                  Starter für <strong>29 €/Monat</strong> statt 49 €,
                  Grow für <strong>53 €/Monat</strong> statt 89 €,
                  Pro für <strong>89 €/Monat</strong> statt 149 €.
                  Wenn die Preise später steigen — und sie werden steigen — bleibt dein Tarif. Für immer.
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <Link
                href="/register?plan=pilot"
                className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles size={14} className="text-amber-400" />
                {en ? 'Apply for the pilot' : 'Pilot-Platz beantragen'}
              </Link>
              <p className="text-xs text-zinc-500">
                {en
                  ? `Slots remaining will be confirmed by email. Cap: ${LIFETIME_PILOT_SLOTS} studios.`
                  : `Verfügbare Plätze werden per Email bestätigt. Limit: ${LIFETIME_PILOT_SLOTS} Studios.`}
              </p>
            </div>
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
              ? 'Free forever up to 30 members. No credit card. Cancel any paid plan with one click — your data stays.'
              : 'Bis 30 Mitglieder dauerhaft kostenlos. Keine Kreditkarte. Jeden Bezahl-Plan in einem Klick kündigen — deine Daten bleiben.'}
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
