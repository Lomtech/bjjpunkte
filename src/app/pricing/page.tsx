'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, Zap, Shield, CreditCard, Clock, Sparkles } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { TopNav } from '@/components/TopNav'
import { ContactModal } from '@/app/_landing/ContactModal'
import {
  STANDARD_TIER,
  FREE_TRIAL_DAYS,
  formatPriceEURShort,
  savingsAnnualEUR,
} from '@/lib/pricing'

/**
 * Pricing-Page (Single-Tier-Modell, 2026-05 realignment).
 *
 * Layout-Inspiration: maatapp.com/#pricing — eine Karte, Toggle Monthly/Annual,
 * Feature-Liste, Trial-CTA. Wir hauen unseren Differentiator (0 % Plattformgebühr)
 * UNTERHALB der Karte raus, weil das der entscheidende Hebel gegen MAAT ist.
 */
export default function PricingPage() {
  const router = useRouter()
  const { lang } = useLanguage()
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [annual, setAnnual] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)

  const en = lang === 'en'

  // Effective monthly price displayed in the hero card.
  const displayCents = annual ? STANDARD_TIER.annualMonthlyCents : STANDARD_TIER.monthlyCents
  const annualSavings = savingsAnnualEUR()
  // Audit 2026-05-13: Pilot-Discount-Berechnungen entfernt.

  const FEATURES = en ? [
    'All features unlocked from day 1',
    'Unlimited members',
    'Belt tracking & promotions',
    'Attendance & GPS check-in',
    'Schedule with iCal export + iframe embed',
    'Public gym page + signup link',
    'Member portal (booking, check-in, history)',
    'Lead pipeline + cold-outreach tools',
    'SEPA direct debit via Stripe Connect',
    'DATEV CSV export',
    '§19 UStG-compliant invoices',
    'GDPR/DSGVO setup with DPA',
    'German support — by Lom, the founder',
    'Multi-location support',
    'Custom branding (own domain, logo)',
    'Cancel anytime, your data stays',
  ] : [
    'Alle Features freigeschaltet ab Tag 1',
    'Unbegrenzte Mitglieder',
    'Belt-Tracking & Promotions',
    'Anwesenheit & GPS-Check-in',
    'Stundenplan mit iCal-Export + iframe-Embed',
    'Öffentliche Gym-Seite + Signup-Link',
    'Member-Portal (Buchung, Check-in, Historie)',
    'Lead-Pipeline + Cold-Outreach-Tools',
    'SEPA-Lastschrift via Stripe Connect',
    'DATEV-CSV-Export',
    '§19 UStG-konforme Rechnungen',
    'DSGVO-Setup mit AVV',
    'Deutscher Support — von Lom, dem Founder',
    'Multi-Location-Support',
    'Custom Branding (eigene Domain, Logo)',
    'Jederzeit kündbar, deine Daten bleiben',
  ]

  async function startCheckout() {
    setLoadingCheckout(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // Not logged in: send to register, then to checkout after signup.
        router.push(`/register?next=/pricing&plan=standard&annual=${annual ? '1' : '0'}`)
        return
      }
      const res = await fetch('/api/stripe/owner-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: 'standard', annual }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Checkout fehlgeschlagen')
        return
      }
      const { url } = await res.json()
      if (url) window.location.href = url
    } finally {
      setLoadingCheckout(false)
    }
  }

  const FAQS = en ? [
    {
      q: 'How does the 14-day trial work?',
      a: 'You sign up with email + password (no credit card needed). For 14 days you get full access — all features unlocked, unlimited members. After the trial you can choose to subscribe or cancel. Your data stays for 30 days after cancellation in case you change your mind.',
    },
    {
      q: 'Why is there only one plan?',
      a: 'Decision-paralysis kills conversions. We picked the price-feature combo that fits the median European martial-arts gym (50–250 active members) and stripped out tier-shopping. You pay one price, you get everything. No "upgrade for DATEV", no "Multi-location is Pro-only".',
    },
    {
      q: 'How does the 0 % platform fee compare to competitors?',
      a: 'Most German gym tools charge 1–3 % on member payments. At 100 members × 100 €/month dues = 10 000 € monthly volume, that\'s 100–300 €/month in fees PLUS subscription. With Osss you pay 49 € flat. Stripe\'s own card-processing fees (~1.4 % + 0.25 €) still apply — those go to Stripe, not us.',
    },
    {
      q: 'Can I switch from monthly to annual later?',
      a: 'Yes. In your dashboard → Settings → Billing → "Switch to annual billing". Stripe pro-rates the change and credits unused monthly time toward the annual upfront payment. No phone call, no discount-retention department.',
    },
    {
      q: 'What happens if I cancel?',
      a: 'You keep access until the end of your current billing period (next month for monthly, next year for annual). Your data stays for 30 days after that — you can re-activate at any time and pick up where you left off. After 30 days, account-level data is deleted (we keep audited transaction records as required by §147 AO).',
    },
    {
      q: 'Is there a free tier?',
      a: 'Not anymore. We had one (free up to 30 members) but found it didn\'t convert — studios stayed at 25 members forever to avoid the upgrade. The 14-day trial is the new entry point: full access, no card, no commitment.',
    },
  ] : [
    {
      q: 'Wie funktioniert der 14-Tage-Trial?',
      a: 'Du meldest dich mit E-Mail + Passwort an (ohne Kreditkarte). 14 Tage lang bekommst du den vollen Zugang — alle Features freigeschaltet, unbegrenzte Mitglieder. Nach dem Trial kannst du das Abo abschließen oder einfach kündigen. Deine Daten bleiben 30 Tage nach Kündigung erhalten, falls du es dir anders überlegst.',
    },
    {
      q: 'Warum gibt es nur einen Plan?',
      a: 'Entscheidungs-Paralyse killt Conversions. Wir haben die Preis-Feature-Kombination gewählt, die zum medianen europäischen Kampfsport-Studio passt (50–250 aktive Mitglieder) und Tier-Shopping eliminiert. Ein Preis, alles dabei. Kein "Upgrade für DATEV", kein "Multi-Location nur im Pro-Plan".',
    },
    {
      q: 'Wie steht 0 % Plattformgebühr gegen Wettbewerb?',
      a: 'Die meisten deutschen Gym-Tools nehmen 1–3 % auf Mitglieds-Zahlungen. Bei 100 Mitgliedern × 100 €/Monat = 10 000 € Monats-Volumen sind das 100–300 €/Monat NUR an Plattformgebühr, plus Abo-Kosten. Bei Osss zahlst du 49 € pauschal. Stripe-eigene Karten-Gebühren (~1,4 % + 0,25 €) fallen weiterhin an — die gehen an Stripe, nicht an uns.',
    },
    {
      q: 'Kann ich später von monatlich auf jährlich wechseln?',
      a: 'Ja. Im Dashboard → Einstellungen → Abrechnung → "Auf Jährlich wechseln". Stripe rechnet pro-rata: ungenutzte Monatszeit wird auf die Jahres-Vorauszahlung angerechnet. Kein Telefonat, keine Retention-Abteilung.',
    },
    {
      q: 'Was passiert bei Kündigung?',
      a: 'Du behältst Zugang bis zum Ende der aktuellen Abrechnungsperiode (nächster Monat bei monatlich, nächstes Jahr bei jährlich). Daten bleiben 30 Tage nach Ablauf — du kannst jederzeit reaktivieren und weitermachen wo du aufgehört hast. Nach 30 Tagen werden Account-Daten gelöscht (Transaktions-Belege bleiben gemäß §147 AO).',
    },
    {
      q: 'Gibt es einen Free-Tier?',
      a: 'Nicht mehr. Wir hatten einen (gratis bis 30 Mitglieder), aber er konvertierte nicht — Studios blieben dauerhaft bei 25 Mitgliedern um das Upgrade zu vermeiden. Der 14-Tage-Trial ist der neue Einstieg: voller Zugang, keine Kreditkarte, kein Commitment.',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <TopNav />

      {/* HERO + Pricing card */}
      <section className="relative bg-gradient-to-b from-zinc-50 to-white px-5 pt-20 pb-10 sm:pt-28 overflow-hidden">
        {/* Soft amber radial */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(251,191,36,0.08) 0%, transparent 60%)' }} />

        <div className="max-w-4xl mx-auto relative">
          <p className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] text-center mb-4">
            {en ? 'Pricing — One plan, all features' : 'Pricing — Ein Plan, alles dabei'}
          </p>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-center text-zinc-950 leading-[1]">
            {en ? <>One simple price.<br /><span className="text-amber-500">Everything included.</span></>
                : <>Ein einfacher Preis.<br /><span className="text-amber-500">Alles inklusive.</span></>}
          </h1>
          <p className="text-zinc-500 text-base sm:text-lg mt-6 text-center max-w-xl mx-auto leading-relaxed">
            {en
              ? `${FREE_TRIAL_DAYS} days free trial — no credit card. Then ${formatPriceEURShort(STANDARD_TIER.monthlyCents, 'en')}/month or save 120 €/year with annual billing.`
              : `${FREE_TRIAL_DAYS} Tage gratis testen — ohne Kreditkarte. Danach ${formatPriceEURShort(STANDARD_TIER.monthlyCents, 'de')}/Monat oder spare 120 €/Jahr mit Jahresabo.`}
          </p>

          {/* Monthly/Annual toggle */}
          <div className="flex items-center justify-center mt-10 mb-8">
            <div className="inline-flex bg-zinc-100 rounded-full p-1.5 relative">
              <button
                onClick={() => setAnnual(true)}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${annual ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                {en ? 'Yearly' : 'Jährlich'}
                <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-black ${annual ? 'bg-amber-100 text-amber-700' : 'bg-zinc-200 text-zinc-500'}`}>
                  −120 €
                </span>
              </button>
              <button
                onClick={() => setAnnual(false)}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${!annual ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                {en ? 'Monthly' : 'Monatlich'}
              </button>
            </div>
          </div>

          {/* Pricing card */}
          <div className="max-w-2xl mx-auto bg-white rounded-3xl border-2 border-amber-300 shadow-xl shadow-amber-100/40 p-8 sm:p-12 relative">
            {annual && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[11px] font-black px-4 py-1.5 rounded-full uppercase tracking-wider">
                {en ? `Save ${annualSavings} € /year` : `Spare ${annualSavings} € /Jahr`}
              </div>
            )}

            {/* Price display */}
            <div className="text-center mb-8">
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-7xl sm:text-8xl font-black text-zinc-950 tracking-tighter tabular-nums">
                  {Math.round(displayCents / 100)}
                </span>
                <span className="text-4xl sm:text-5xl font-black text-zinc-950 tracking-tight">€</span>
              </div>
              <p className="text-zinc-500 text-sm mt-3">
                {annual
                  ? (en ? `per month, billed annually (${Math.round(STANDARD_TIER.annualMonthlyCents * 12 / 100)} € upfront, VAT excl.)`
                        : `pro Monat, jährlich abgerechnet (${Math.round(STANDARD_TIER.annualMonthlyCents * 12 / 100)} € im Voraus, zzgl. USt.)`)
                  : (en ? 'per month, billed monthly (VAT excl.)'
                        : 'pro Monat, monatlich abgerechnet (zzgl. USt.)')}
              </p>
            </div>

            {/* Differentiator badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8 pb-8 border-b border-zinc-100">
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5 text-xs font-bold text-emerald-700">
                <Sparkles size={12} /> 0 % {en ? 'platform fee' : 'Plattformgebühr'}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-700">
                <Zap size={12} /> {en ? `${FREE_TRIAL_DAYS}-day trial` : `${FREE_TRIAL_DAYS} Tage Trial`}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-700">
                <Shield size={12} /> {en ? 'No credit card' : 'Ohne Kreditkarte'}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-700">
                <Clock size={12} /> {en ? 'Cancel anytime' : 'Jederzeit kündbar'}
              </span>
            </div>

            {/* Feature list — two columns on sm+ */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-10">
              {FEATURES.map(f => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check size={11} className="text-emerald-600" strokeWidth={3} />
                  </div>
                  <span className="text-zinc-700 leading-snug">{f}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              type="button"
              disabled={loadingCheckout}
              onClick={startCheckout}
              data-track="cta_pricing_trial"
              className="w-full bg-amber-400 hover:bg-amber-300 disabled:bg-zinc-300 disabled:cursor-not-allowed text-zinc-950 font-black px-6 py-4 rounded-2xl text-base transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {loadingCheckout
                ? (en ? 'Loading…' : 'Lädt…')
                : (
                  <>
                    <Zap size={16} />
                    {en ? `Start ${FREE_TRIAL_DAYS}-day free trial` : `${FREE_TRIAL_DAYS}-Tage-Trial starten`}
                  </>
                )}
            </button>
            <p className="text-zinc-400 text-xs text-center mt-4">
              {en
                ? 'No credit card · Cancel anytime · Your data stays'
                : 'Ohne Kreditkarte · Jederzeit kündbar · Deine Daten bleiben'}
            </p>
          </div>

          {/* Audit 2026-05-13: Pilot-Discount-Strip (PILOT10, 40 %) entfernt. */}
        </div>
      </section>

      {/* Vs. competitors strip */}
      <section className="bg-zinc-50 border-y border-zinc-100 py-16 px-5">
        <div className="max-w-4xl mx-auto">
          <p className="text-emerald-600 font-bold text-[10px] uppercase tracking-[0.25em] text-center mb-3">
            {en ? 'Real numbers' : 'Echte Zahlen'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight text-center mb-3">
            {en ? 'Why one price beats four' : 'Warum ein Preis vier schlägt'}
          </h2>
          <p className="text-zinc-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed text-center mb-10">
            {en
              ? '100-member gym with €100/month dues = €10 000 monthly volume. Here\'s what each tool actually costs you per year.'
              : '100-Mitglieder-Studio mit 100 €/Monat Beitrag = 10 000 € Monats-Volumen. Hier was jedes Tool dich wirklich pro Jahr kostet.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* MAAT */}
            <div className="bg-white rounded-2xl p-6 border-2 border-zinc-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">MAAT</p>
              <p className="text-3xl font-black text-zinc-900 tabular-nums tracking-tight">1.788 €</p>
              <p className="text-xs text-zinc-400 mt-1">
                {en ? '49 €/mo + 1% on dues' : '49 €/Mo + 1 % auf Beiträge'}
              </p>
              <p className="text-[11px] text-zinc-400 mt-2 italic leading-snug">
                {en ? 'Platform fee at scale: 1 200 €/year just for collecting dues.' : 'Plattformgebühr at scale: 1 200 €/Jahr nur fürs Beitragseinziehen.'}
              </p>
            </div>

            {/* Eversports */}
            <div className="bg-white rounded-2xl p-6 border-2 border-amber-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2">Eversports &amp; Co.</p>
              <p className="text-3xl font-black text-zinc-900 tabular-nums tracking-tight">2.388 €</p>
              <p className="text-xs text-zinc-400 mt-1">
                {en ? '99 €/mo + 1.5% on dues' : '99 €/Mo + 1,5 % auf Beiträge'}
              </p>
              <p className="text-[11px] text-zinc-400 mt-2 italic leading-snug">
                {en ? 'Higher base + higher fee = double-hit at scale.' : 'Höhere Basis + höhere Gebühr = doppelt bestraft bei Wachstum.'}
              </p>
            </div>

            {/* Osss */}
            <div className="bg-emerald-50 rounded-2xl p-6 border-2 border-emerald-300 relative">
              <div className="absolute -top-2.5 left-6 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Osss
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-2">
                {en ? 'Osss (annual)' : 'Osss (jährlich)'}
              </p>
              <p className="text-3xl font-black text-emerald-700 tabular-nums tracking-tight">468 €</p>
              <p className="text-xs text-emerald-700 mt-1">
                {en ? '39 €/mo · 0 % on dues' : '39 €/Mo · 0 % auf Beiträge'}
              </p>
              <p className="text-[11px] text-emerald-700 mt-2 italic leading-snug">
                {en ? `Save ${1788 - 468} € vs. MAAT and ${2388 - 468} € vs. Eversports — every year.` : `Sparst ${1788 - 468} € gegen MAAT und ${2388 - 468} € gegen Eversports — jedes Jahr.`}
              </p>
            </div>
          </div>

          <p className="text-zinc-400 text-xs text-center mt-8 max-w-md mx-auto leading-relaxed">
            {en
              ? 'Numbers above include the platform tools\' subscription + their take on member payments. Stripe\'s own card-processing fees (~1.4 % + 0.25 €) apply identically to all three.'
              : 'Zahlen oben enthalten die Tool-Abos + deren Kürzung von Mitglieds-Zahlungen. Stripe-eigene Karten-Gebühren (~1,4 % + 0,25 €) fallen bei allen drei gleich an.'}
          </p>

          {/* ── DETAIL-VERGLEICHS-TABELLE ──
              € allein reicht nicht — Owner wollen wissen ob das billigere Tool
              auch das was sie brauchen kann. Tabelle deckt die 10 Buying-
              Concerns ab, die in Sales-Calls regelmäßig kommen. Stand Mai 2026
              — quartalsweise gegen maatapp.com / eversports.de gegen-checken. */}
          <div className="mt-12 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left px-5 py-4 font-bold text-zinc-500 text-[11px] uppercase tracking-wider min-w-[180px]">
                    {en ? 'Feature' : 'Feature'}
                  </th>
                  <th className="text-left px-4 py-4 font-bold text-emerald-700 text-[11px] uppercase tracking-wider min-w-[140px] bg-emerald-50">
                    Osss
                  </th>
                  <th className="text-left px-4 py-4 font-bold text-zinc-500 text-[11px] uppercase tracking-wider min-w-[140px]">
                    MAAT
                  </th>
                  <th className="text-left px-4 py-4 font-bold text-zinc-500 text-[11px] uppercase tracking-wider min-w-[140px]">
                    Eversports &amp; Co.
                  </th>
                </tr>
              </thead>
              <tbody>
                {([
                  {
                    label: { de: 'Plattformgebühr auf Beiträge', en: 'Platform fee on dues' },
                    osss: { de: '0 %', en: '0 %' },
                    maat: { de: '1 %', en: '1 %' },
                    evs:  { de: '1,5 %', en: '1.5 %' },
                  },
                  {
                    label: { de: 'Monatspreis (jährliche Abrechnung)', en: 'Monthly price (annual billing)' },
                    osss: { de: '39 €', en: '39 €' },
                    maat: { de: '49 €', en: '49 €' },
                    evs:  { de: '99 €', en: '99 €' },
                  },
                  {
                    label: { de: 'Mindest-Vertragslaufzeit', en: 'Min. contract term' },
                    osss: { de: 'keine', en: 'none' },
                    maat: { de: '12 Monate', en: '12 months' },
                    evs:  { de: '12 Monate', en: '12 months' },
                  },
                  {
                    label: { de: 'DATEV-Export nativ', en: 'Native DATEV export' },
                    osss: { de: 'inklusive', en: 'included' },
                    maat: { de: '— manuell', en: '— manual' },
                    evs:  { de: 'kostenpflichtiges Add-on', en: 'paid add-on' },
                  },
                  {
                    label: { de: '§19 UStG-Rechnungen', en: '§19 UStG invoices' },
                    osss: { de: 'inklusive', en: 'included' },
                    maat: { de: 'generisch', en: 'generic' },
                    evs:  { de: 'generisch', en: 'generic' },
                  },
                  {
                    label: { de: 'Support-Sprache', en: 'Support language' },
                    osss: { de: 'Deutsch · Englisch', en: 'German · English' },
                    maat: { de: 'Englisch · Italienisch', en: 'English · Italian' },
                    evs:  { de: 'Englisch · Deutsch', en: 'English · German' },
                  },
                  {
                    label: { de: 'Founder direkt erreichbar', en: 'Founder directly reachable' },
                    osss: { de: 'ja — selber Tag', en: 'yes — same day' },
                    maat: { de: 'Ticket-System', en: 'ticket system' },
                    evs:  { de: 'Ticket-System', en: 'ticket system' },
                  },
                  {
                    label: { de: 'Belt-Tracking für Kampfsport', en: 'Martial-arts belt tracking' },
                    osss: { de: '6 Sportarten vorkonfiguriert', en: '6 sports pre-configured' },
                    maat: { de: '— generisch', en: '— generic' },
                    evs:  { de: '— Studio-Software, kein KS', en: '— studio SW, not MA' },
                  },
                  {
                    label: { de: 'GPS-/QR-Check-in', en: 'GPS/QR check-in' },
                    osss: { de: 'Browser, ohne App', en: 'browser, no app' },
                    maat: { de: 'eigene App-Installation', en: 'app install required' },
                    evs:  { de: 'eigene App', en: 'own app' },
                  },
                  {
                    label: { de: 'Migration aus altem Tool', en: 'Migration from old tool' },
                    osss: { de: 'CSV + 1:1-Setup-Call', en: 'CSV + 1:1 setup call' },
                    maat: { de: 'self-serve only', en: 'self-serve only' },
                    evs:  { de: 'self-serve only', en: 'self-serve only' },
                  },
                ] as const).map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}>
                    <td className="px-5 py-3 font-semibold text-zinc-900 align-top">
                      {en ? row.label.en : row.label.de}
                    </td>
                    <td className="px-4 py-3 align-top bg-emerald-50/40 text-emerald-800 font-medium">
                      {en ? row.osss.en : row.osss.de}
                    </td>
                    <td className="px-4 py-3 align-top text-zinc-500">
                      {en ? row.maat.en : row.maat.de}
                    </td>
                    <td className="px-4 py-3 align-top text-zinc-500">
                      {en ? row.evs.en : row.evs.de}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-8">
            <Link href="/vs-maat" data-track="cta_vs_maat_from_pricing"
              className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
              {en ? 'Full MAAT comparison' : 'Vollständiger MAAT-Vergleich'} <Sparkles size={14} className="text-amber-300" />
            </Link>
            <p className="text-zinc-400 text-xs mt-3">
              {en
                ? 'Migration guide, savings calculator and 15-row comparison.'
                : 'Migrations-Anleitung, Spar-Rechner und 15-Zeilen-Vergleich.'}
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20 px-5 border-b border-zinc-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] text-center mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight text-center mb-12">
            {en ? 'Questions answered' : 'Häufige Fragen'}
          </h2>

          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="border-b border-zinc-100 last:border-0">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left hover:text-amber-600 transition-colors"
                >
                  <span className="text-base font-bold text-zinc-900">{faq.q}</span>
                  <span className={`text-zinc-400 text-2xl flex-shrink-0 transition-transform duration-200 leading-none ${openFaq === i ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <p className="pb-5 text-sm text-zinc-600 leading-relaxed">{faq.a}</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-zinc-400 text-sm">
              {en ? 'More questions?' : 'Weitere Fragen?'}{' '}
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="text-amber-600 hover:text-amber-700 font-semibold transition-colors"
              >
                {en ? 'Talk to me directly' : 'Schreib mir direkt'}
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-zinc-950 text-white text-center px-5 py-20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 110%, rgba(251,191,36,0.08) 0%, transparent 65%)' }} />
        <div className="max-w-md mx-auto relative">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            {en ? `Try ${FREE_TRIAL_DAYS} days, decide after.` : `${FREE_TRIAL_DAYS} Tage testen, dann entscheiden.`}
          </h2>
          <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
            {en
              ? 'Full access. No card. Cancel any time without phone-call retention.'
              : 'Voller Zugang. Keine Kreditkarte. Kündigung in einem Klick — ohne Verkaufs-Anruf.'}
          </p>
          <button
            type="button"
            onClick={startCheckout}
            disabled={loadingCheckout}
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-950 font-black px-8 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Zap size={16} />
            {en ? `Start ${FREE_TRIAL_DAYS}-day free trial` : `${FREE_TRIAL_DAYS}-Tage-Trial starten`}
          </button>
        </div>
      </section>

      {/* Footer (slim) */}
      <footer className="bg-white border-t border-zinc-100 py-6 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <p suppressHydrationWarning>© {new Date().getFullYear()} Osss · {en ? 'The martial arts gym software' : 'Die Kampfsport-Gym-Software'}</p>
          <div className="flex gap-5">
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">{en ? 'Privacy' : 'Datenschutz'}</Link>
            <Link href="/impressum" className="hover:text-zinc-700 transition-colors">Impressum</Link>
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="hover:text-zinc-700 transition-colors"
            >
              {en ? 'Contact' : 'Kontakt'}
            </button>
          </div>
        </div>
      </footer>

      {contactOpen && <ContactModal lang={en ? 'en' : 'de'} onClose={() => setContactOpen(false)} />}

      {/* Schema.org Product/Offer for SEO + rich pricing snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'Osss — Gym Management Software for Martial Arts',
            description: en
              ? 'All-in-one gym management for BJJ, MMA, Karate and other martial arts studios. 0% platform fee, DATEV export, GDPR-ready.'
              : 'All-in-One Gym-Management für BJJ, MMA, Karate und andere Kampfsport-Studios. 0 % Plattformgebühr, DATEV-Export, DSGVO-fertig.',
            brand: { '@type': 'Brand', name: 'Osss' },
            offers: [
              {
                '@type': 'Offer',
                name: 'Standard (monthly billing)',
                priceCurrency: 'EUR',
                price: (STANDARD_TIER.monthlyCents / 100).toFixed(2),
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: (STANDARD_TIER.monthlyCents / 100).toFixed(2),
                  priceCurrency: 'EUR',
                  unitText: 'MONTH',
                },
              },
              {
                '@type': 'Offer',
                name: 'Standard (annual billing)',
                priceCurrency: 'EUR',
                price: (STANDARD_TIER.annualMonthlyCents * 12 / 100).toFixed(2),
                priceSpecification: {
                  '@type': 'UnitPriceSpecification',
                  price: (STANDARD_TIER.annualMonthlyCents * 12 / 100).toFixed(2),
                  priceCurrency: 'EUR',
                  unitText: 'ANN',
                },
              },
            ],
          }),
        }}
      />
    </div>
  )
}
