// /vs-maat — Battle-Page für „Wechsel von MAAT zu Osss".
//
// Conversion-Strategie:
//   1. Hero macht in 2 Sätzen klar warum (Preis + Heimat).
//   2. Big Comparison Table (15 Zeilen) — der Hauptlast-Trager. Owner scrollt
//      durch und sieht in jedem Punkt einen klaren Osss-Vorteil.
//   3. „Was du sparst" — Nummern-Block mit 3 Studio-Größen (50/100/200 Mitgl.).
//   4. „Von MAAT zu Osss in 3 Schritten" — Migrations-Garantie. Reduziert
//      Switching-Cost-Angst.
//   5. FAQ — adressiert die typischen Bedenken (Datenmigration, Vertrag,
//      Verlust von MAAT-Features).
//   6. Final CTA → /register + /demo + persönlicher Founder-Email-Link.
//
// SEO-Optik: H1/H2 enthalten „MAAT alternative" + „MAAT Wechsel" — das sind
// die Long-Tail-Keywords die Studio-Owner googeln wenn sie eh schon
// evaluieren („Mindbody alternative", „MAAT Erfahrungen"). Pure RSC für
// Schnell-Indexierung und 0 JS-Bundle.

import Link from 'next/link'
import type { Metadata } from 'next'
import { TopNav } from '@/components/TopNav'
import { OsssLogo } from '@/components/Logo'
import { getServerLang } from '@/lib/i18n/server'
import {
  CheckCircle, ArrowRight, Zap, MapPin, Headphones,
  CreditCard, FileSpreadsheet, Shield, Globe, Award,
  AlertCircle,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Osss vs MAAT — Die deutsche Alternative · 0 % Plattformgebühr · DATEV-Export',
  description: 'Wechsel von MAAT zu Osss: 0 % statt 1 % Plattformgebühr, echter DATEV-Export, Support auf Deutsch. Bei 50 Mitgliedern sparst du ~720 €/Jahr. CSV-Migration + persönlicher Setup-Call inklusive.',
  openGraph: {
    title: 'Osss vs MAAT — Die deutsche Alternative',
    description: '0 % statt 1 %. DATEV inklusive. Support auf Deutsch. Wechsel mit CSV-Import + persönlicher Hilfe.',
    type: 'website',
  },
  alternates: {
    canonical: 'https://osss.pro/vs-maat',
  },
}

export default async function VsMaatPage() {
  const lang = await getServerLang()
  const en = lang === 'en'

  // Vergleichs-Datenquelle. „Stand Mai 2026" — sollte alle 6 Monate gegen
  // maatapp.com gegen-gecheckt werden (Pricing & Feature-Liste).
  const ROWS: Array<{
    icon: typeof CheckCircle
    label: { de: string; en: string }
    osss: { de: string; en: string; positive: boolean }
    maat: { de: string; en: string; positive: boolean }
  }> = [
    {
      icon: CreditCard,
      label: { de: 'Plattformgebühr auf Mitgliedszahlungen', en: 'Platform fee on member dues' },
      osss: { de: '0 % — für immer', en: '0 % — forever', positive: true },
      maat: { de: '1 % auf jede Beitragszahlung', en: '1 % on every payment', positive: false },
    },
    {
      icon: CheckCircle,
      label: { de: 'Monatspreis', en: 'Monthly price' },
      osss: { de: '49 € / 39 € jährlich', en: '49 € / 39 € annual', positive: true },
      maat: { de: '59 € / 49 € jährlich', en: '59 € / 49 € annual', positive: false },
    },
    {
      icon: FileSpreadsheet,
      label: { de: 'DATEV-Export für Steuerberater', en: 'DATEV export for accountants' },
      osss: { de: 'Nativ, ein Klick', en: 'Native, one click', positive: true },
      maat: { de: 'Nicht nativ — manueller Export', en: 'Not native — manual export', positive: false },
    },
    {
      icon: Headphones,
      label: { de: 'Support-Sprache', en: 'Support language' },
      osss: { de: 'Deutsch · Englisch', en: 'German · English', positive: true },
      maat: { de: 'Englisch primär (DE-Lokalisierung partiell)', en: 'English primary (partial DE)', positive: false },
    },
    {
      icon: MapPin,
      label: { de: 'Founder erreichbar', en: 'Founder reachable' },
      osss: { de: 'Direkt (1 h von München)', en: 'Direct (1 h from Munich)', positive: true },
      maat: { de: 'WhatsApp-Support (Italien/UK-Team)', en: 'WhatsApp support (Italy/UK team)', positive: false },
    },
    {
      icon: Shield,
      label: { de: 'DSGVO-Verträge (AVV)', en: 'GDPR DPA' },
      osss: { de: 'Im Dashboard signiert', en: 'Signed in dashboard', positive: true },
      maat: { de: 'Nicht im Dashboard signierbar', en: 'No in-dashboard signing', positive: false },
    },
    {
      icon: Award,
      label: { de: 'Belt-/Gürtel-Tracking für Kampfsport', en: 'Belt tracking for martial arts' },
      osss: { de: '6 Sportarten vorkonfiguriert', en: '6 sports pre-configured', positive: true },
      maat: { de: 'Allgemein, nicht kampfsport-spezifisch', en: 'Generic, not martial-arts-specific', positive: false },
    },
    {
      icon: Globe,
      label: { de: 'Öffentliche Gym-Seite (osss.pro/gym/dein-name)', en: 'Public gym page' },
      osss: { de: 'Inklusive, in 10 Min konfiguriert', en: 'Included, set up in 10 min', positive: true },
      maat: { de: 'Eigene Domain notwendig', en: 'Own domain required', positive: false },
    },
    {
      icon: CreditCard,
      label: { de: 'SEPA-Lastschrift', en: 'SEPA direct debit' },
      osss: { de: 'Stripe Connect direkt aufs Gym-Konto', en: 'Stripe Connect → gym\'s bank', positive: true },
      maat: { de: 'Über MAAT-Account, dann Auszahlung', en: 'Via MAAT account, then payout', positive: false },
    },
    {
      icon: CheckCircle,
      label: { de: 'GPS- & QR-Check-in', en: 'GPS & QR check-in' },
      osss: { de: 'Mitglieder-Portal, browser-basiert', en: 'Member portal, browser-based', positive: true },
      maat: { de: 'Eigene App-Installation', en: 'App install required', positive: false },
    },
    {
      icon: CheckCircle,
      label: { de: 'Trial-Klassen-Buchung', en: 'Trial class booking' },
      osss: { de: 'Auf der Gym-Seite eingebaut', en: 'Built into gym page', positive: true },
      maat: { de: 'Manuelles Eintragen', en: 'Manual entry', positive: false },
    },
    {
      icon: Zap,
      label: { de: 'Setup-Zeit bis Live-Gym', en: 'Time to live gym' },
      osss: { de: '< 10 Minuten', en: '< 10 minutes', positive: true },
      maat: { de: '14 Tage Onboarding-Prozess', en: '14-day onboarding process', positive: false },
    },
    {
      icon: AlertCircle,
      label: { de: 'Klassen-Buchung im Voraus', en: 'Class-booking horizon' },
      osss: { de: 'Beliebig weit (Schedule + iCal)', en: 'Unlimited (schedule + iCal)', positive: true },
      maat: { de: 'Limit ~2 Wochen im Voraus', en: 'Limited ~2 weeks ahead', positive: false },
    },
    {
      icon: AlertCircle,
      label: { de: 'Vertragsbindung', en: 'Contract commitment' },
      osss: { de: 'Keine — monatlich kündbar', en: 'None — cancel monthly', positive: true },
      maat: { de: 'Jahresvertrag günstiger, Details auf Anfrage', en: 'Annual cheaper, details on request', positive: false },
    },
    {
      icon: CheckCircle,
      label: { de: 'Migration aus MAAT', en: 'Migration from MAAT' },
      osss: { de: 'CSV-Import + 1:1-Setup-Call gratis', en: 'CSV import + free 1:1 setup call', positive: true },
      maat: { de: '—', en: '—', positive: false },
    },
    {
      icon: Shield,
      label: { de: 'Daten-Standort', en: 'Data location' },
      osss: { de: 'EU/UK (London — Adequacy Decision)', en: 'EU/UK (London — Adequacy Decision)', positive: true },
      maat: { de: 'Nicht öffentlich dokumentiert', en: 'Not publicly disclosed', positive: false },
    },
  ]

  // Savings-Berechnung: 49 € MAAT-Basis * 12 + 1 % * Members * AvgFee * 12
  // Osss jährlich: 39 € * 12 = 468 €.
  // Differenz = MAAT-Annual - Osss-Annual (jeweils inklusive Plattformgebühr für MAAT)
  const AVG_FEE_EUR = 100
  const STUDIO_SIZES = [50, 100, 200]
  const savings = STUDIO_SIZES.map(members => {
    const maatBase = 49 * 12
    const maatFee = members * AVG_FEE_EUR * 0.01 * 12
    const maatTotal = maatBase + maatFee
    const osssTotal = 39 * 12
    return {
      members,
      maat: maatTotal,
      osss: osssTotal,
      saved: maatTotal - osssTotal,
    }
  })

  const fmt = (n: number) => new Intl.NumberFormat(en ? 'en-GB' : 'de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(n)

  const FAQ = en ? [
    {
      q: 'How does the migration from MAAT to Osss actually work?',
      a: 'Three steps: (1) export your members + payments as CSV from MAAT (Settings → Export). (2) Send the file to oss@osss.pro or upload via the Osss dashboard import wizard. (3) We schedule a 30-min call to verify everything carried over correctly. Average migration time: 2-3 days end-to-end. Cost: 0 €.',
    },
    {
      q: 'I have a 12-month contract with MAAT. Can I still switch?',
      a: 'Yes — you can run both in parallel during the trial. We set up Osss alongside MAAT, you migrate your members, and once your MAAT contract expires you cancel without overlap. We don\'t need exclusivity to start. Many studios use the trial period to verify Osss before their MAAT renewal date.',
    },
    {
      q: 'Will I lose any features by switching?',
      a: 'Honest answer: depends on your setup. Osss has a tighter feature scope focused on small-to-medium martial-arts gyms. We don\'t do multi-location franchises or POS-integrated retail (yet). For 95 % of MAAT users in Germany this is non-issue — but if you have specific MAAT features you depend on, schedule a 20-min demo and we\'ll check together.',
    },
    {
      q: 'Why is Osss cheaper than MAAT? What\'s the catch?',
      a: 'No catch. Osss is built solo by one engineer (me) with low overhead — no UK/Italian office, no marketing department, no VC investors expecting 30 % revenue growth (MAAT raised ~$225 k pre-seed in June 2024 and lists ~18 employees on LinkedIn — small for SaaS, but still 18× my fixed cost). The 0 % platform fee model is sustainable because we earn from subscriptions, not by skimming member payments. As long as the subscription pays for hosting + my time, the math works.',
    },
    {
      q: 'Is my data safe? GDPR-compliant?',
      a: 'Yes. Data sits in Supabase EU/UK (London region, EU Adequacy Decision). Stripe Connect routes member payments directly to your gym\'s bank — Osss never holds member money. The DPA (Auftragsverarbeitungsvertrag) is signed electronically in your dashboard. No US sub-processors that need SCCs.',
    },
  ] : [
    {
      q: 'Wie funktioniert die Migration von MAAT zu Osss konkret?',
      a: 'Drei Schritte: (1) Du exportierst deine Mitglieder + Zahlungen als CSV aus MAAT (Einstellungen → Export). (2) Du schickst die Datei an oss@osss.pro oder lädst sie über den Osss-Dashboard-Import-Wizard hoch. (3) Wir machen einen 30-Minuten-Call und checken, dass alles korrekt übernommen wurde. Durchschnittliche Migrations-Dauer: 2-3 Tage end-to-end. Kosten: 0 €.',
    },
    {
      q: 'Ich habe einen 12-Monats-Vertrag mit MAAT. Kann ich trotzdem wechseln?',
      a: 'Ja — du kannst beide während der Trial-Phase parallel laufen lassen. Wir setzen Osss neben MAAT auf, du migrierst deine Mitglieder, und sobald dein MAAT-Vertrag ausläuft, kündigst du ohne Überlapp. Wir brauchen keine Exklusivität zum Start. Viele Studios nutzen die Trial-Phase, um Osss vor dem MAAT-Verlängerungsdatum zu testen.',
    },
    {
      q: 'Verliere ich Features wenn ich wechsle?',
      a: 'Ehrliche Antwort: hängt von deinem Setup ab. Osss hat einen engeren Feature-Scope, fokussiert auf kleine bis mittelgroße Kampfsport-Studios. Wir haben kein Multi-Location-Franchise und keine POS-integrierte Retail-Funktion (noch nicht). Für 95 % der MAAT-Nutzer in Deutschland ist das egal — wenn du aber spezifische MAAT-Features brauchst, buch eine 20-Min-Demo und wir checken zusammen.',
    },
    {
      q: 'Warum ist Osss günstiger als MAAT? Wo ist der Haken?',
      a: 'Keinen Haken. Osss wird solo von einem Ingenieur (mir) gebaut, mit niedrigen Fixkosten — kein UK/Italien-Büro, keine Marketing-Abteilung, keine VC-Investoren die 30 % Umsatz-Wachstum erwarten (MAAT hat im Juni 2024 ~225 k$ Pre-Seed eingesammelt und listet ~18 Mitarbeiter auf LinkedIn — klein für SaaS, aber immer noch 18× mein Fixkostenblock). Das 0-%-Plattformgebühr-Modell ist nachhaltig, weil wir an Abos verdienen, nicht am Mitglied. Solange das Abo Hosting + meine Zeit deckt, geht die Rechnung auf.',
    },
    {
      q: 'Sind meine Daten sicher? DSGVO-konform?',
      a: 'Ja. Daten liegen in Supabase EU/UK (London-Region, EU-Adequacy Decision). Stripe Connect leitet Mitglieds-Zahlungen direkt aufs Gym-Konto — Osss hält nie Mitglieds-Gelder. Der AVV (Auftragsverarbeitungsvertrag) wird elektronisch im Dashboard unterschrieben. Keine US-Sub-Processoren die SCCs brauchen.',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <TopNav />

      {/* ── HERO ── */}
      <section className="relative bg-white overflow-hidden border-b border-zinc-100">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(251,191,36,0.08) 0%, transparent 60%)' }} />

        <div className="max-w-4xl mx-auto px-5 py-20 sm:py-28 relative text-center">
          <p className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-5">
            {en ? 'Osss vs MAAT · Side-by-side comparison' : 'Osss vs MAAT · Direkter Vergleich'}
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-zinc-950 tracking-tighter leading-[0.95] mb-6">
            {en
              ? <>The German alternative<br />to <span className="text-amber-500">MAAT</span>.</>
              : <>Die deutsche Alternative<br />zu <span className="text-amber-500">MAAT</span>.</>}
          </h1>
          <p className="text-zinc-500 text-lg leading-relaxed max-w-xl mx-auto mb-8">
            {en
              ? <>0 % platform fee instead of 1 %. DATEV export built-in. Support in German, same-day. CSV migration + 1:1 setup call — free.</>
              : <>0 % Plattformgebühr statt 1 %. DATEV-Export inklusive. Support auf Deutsch, am selben Tag. CSV-Migration + 1:1-Setup-Call — gratis.</>}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" data-track="cta_signup_vsmaat_hero"
              className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-7 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/20">
              <Zap size={16} className="text-amber-400" />
              {en ? 'Free trial — no credit card' : '14 Tage gratis — ohne Kreditkarte'}
            </Link>
            <Link href="#vergleich" data-track="cta_jump_to_table_vsmaat"
              className="inline-flex items-center gap-2 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold px-7 py-3.5 rounded-xl text-base transition-all">
              {en ? 'Jump to comparison' : 'Zur Vergleichstabelle'} <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── SAVINGS-BLOCK — Drei Studio-Größen, MAAT vs. Osss in € ── */}
      <section className="py-20 px-5 bg-zinc-50 border-b border-zinc-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-emerald-600 font-bold text-[10px] uppercase tracking-[0.25em] mb-3">
              {en ? 'Real numbers' : 'Echte Zahlen'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">
              {en ? 'What you save per year' : 'Was du pro Jahr sparst'}
            </h2>
            <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              {en
                ? `Average member fee: ${fmt(AVG_FEE_EUR)}/month. MAAT: 49 €/mo base + 1 % platform fee. Osss: 39 €/mo annual, 0 % platform fee.`
                : `Durchschnittsbeitrag pro Mitglied: ${fmt(AVG_FEE_EUR)}/Monat. MAAT: 49 €/Mo Basis + 1 % Plattformgebühr. Osss: 39 €/Mo jährlich, 0 % Plattformgebühr.`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {savings.map(s => (
              <div key={s.members} className="bg-white rounded-2xl p-7 border-2 border-emerald-200 relative">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-3">
                  {s.members} {en ? 'members' : 'Mitglieder'}
                </p>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-zinc-400 text-sm line-through tabular-nums">{fmt(s.maat)}</span>
                  <span className="text-zinc-400 text-[10px]">MAAT</span>
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-emerald-700 text-base font-semibold tabular-nums">{fmt(s.osss)}</span>
                  <span className="text-emerald-700 text-[10px]">Osss</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                  {en ? 'You save' : 'Du sparst'}
                </p>
                <p className="text-3xl font-black text-emerald-600 tabular-nums tracking-tight">
                  {fmt(s.saved)}
                  <span className="text-sm text-emerald-500 font-bold ml-1">/{en ? 'yr' : 'Jahr'}</span>
                </p>
              </div>
            ))}
          </div>

          <p className="text-zinc-400 text-xs text-center mt-8 max-w-md mx-auto leading-relaxed">
            {en
              ? 'Stripe\'s own card-processing fees (~1.4 % + 0.25 €) apply identically to both. Osss takes 0 % above that, MAAT takes another 1 % on top.'
              : 'Stripe-eigene Karten-Gebühren (~1,4 % + 0,25 €) fallen bei beiden identisch an. Osss nimmt 0 % darauf, MAAT nimmt nochmal 1 % obendrauf.'}
          </p>

          <div className="text-center mt-8">
            <Link href="/rechner" className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-900 font-bold text-sm transition-colors">
              {en ? 'Calculate with your numbers' : 'Mit deinen Zahlen rechnen'} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── VERGLEICHS-TABELLE ── */}
      <section id="vergleich" className="py-20 px-5 bg-white border-b border-zinc-100 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">
              {en ? 'Detailed comparison' : 'Detaillierter Vergleich'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">
              {en ? '15 ways Osss beats MAAT' : '15 Punkte, in denen Osss MAAT schlägt'}
            </h2>
            <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              {en
                ? 'Stand May 2026, public information from maatapp.com. Updated quarterly.'
                : 'Stand Mai 2026, öffentliche Daten von maatapp.com. Quartalsweise aktualisiert.'}
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="text-left px-5 py-4 font-bold text-zinc-500 text-[11px] uppercase tracking-wider min-w-[200px]">
                    {en ? 'Feature' : 'Feature'}
                  </th>
                  <th className="text-left px-5 py-4 font-bold text-emerald-700 text-[11px] uppercase tracking-wider min-w-[220px] bg-emerald-50">
                    Osss
                  </th>
                  <th className="text-left px-5 py-4 font-bold text-zinc-500 text-[11px] uppercase tracking-wider min-w-[220px]">
                    MAAT
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => {
                  const Icon = row.icon
                  return (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}>
                      <td className="px-5 py-4 font-semibold text-zinc-900 align-top">
                        <div className="flex items-start gap-2">
                          <Icon size={14} className="text-zinc-400 mt-1 flex-shrink-0" />
                          <span>{en ? row.label.en : row.label.de}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top bg-emerald-50/40">
                        <div className="flex items-start gap-2">
                          {row.osss.positive && (
                            <CheckCircle size={14} className="text-emerald-600 mt-1 flex-shrink-0" />
                          )}
                          <span className="text-zinc-900 font-medium">{en ? row.osss.en : row.osss.de}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top text-zinc-500">
                        {en ? row.maat.en : row.maat.de}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── MIGRATIONS-3-SCHRITTE ── */}
      <section className="py-20 px-5 bg-amber-50 border-b border-amber-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-amber-700 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">
              {en ? 'Migration' : 'Migration'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">
              {en ? 'From MAAT to Osss in 3 steps' : 'Von MAAT zu Osss in 3 Schritten'}
            </h2>
            <p className="text-zinc-600 max-w-md mx-auto text-sm leading-relaxed">
              {en
                ? 'Free, takes 2-3 days end-to-end, with a 1:1 setup call to verify everything carried over.'
                : 'Kostenlos, dauert 2-3 Tage end-to-end, mit 1:1-Setup-Call zur Verifizierung.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {(en ? [
              { num: '01', title: 'Export from MAAT',
                desc: 'In MAAT: Settings → Export → CSV. You get a member list + payment history. Takes 2 minutes.' },
              { num: '02', title: 'Import to Osss',
                desc: 'In Osss dashboard: Settings → Import. Upload the CSV — members, contracts and payment status carry over automatically.' },
              { num: '03', title: '1:1 verification call',
                desc: '30-minute call with me. We check that every member migrated correctly, set up SEPA via Stripe Connect, and connect your Gym page.' },
            ] : [
              { num: '01', title: 'Export aus MAAT',
                desc: 'In MAAT: Einstellungen → Export → CSV. Du bekommst Mitgliederliste + Zahlungshistorie. Dauert 2 Minuten.' },
              { num: '02', title: 'Import in Osss',
                desc: 'Im Osss-Dashboard: Einstellungen → Import. CSV hochladen — Mitglieder, Verträge und Zahlungsstatus werden automatisch übernommen.' },
              { num: '03', title: '1:1-Verifikations-Call',
                desc: '30-Minuten-Call mit mir. Wir checken, dass jedes Mitglied korrekt migriert wurde, richten SEPA via Stripe Connect ein und verbinden deine Gym-Seite.' },
            ]).map(step => (
              <div key={step.num} className="bg-white rounded-2xl p-7 border border-amber-200 shadow-sm">
                <div className="text-amber-500 font-black text-4xl tracking-tighter leading-none mb-5">{step.num}</div>
                <p className="font-bold text-zinc-900 mb-2">{step.title}</p>
                <p className="text-sm text-zinc-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="mailto:oss@osss.pro?subject=MAAT-Migration"
              data-track="cta_mailto_migration_vsmaat"
              className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
              {en ? 'Email me to start the migration' : 'Mail mir und wir starten die Migration'} <ArrowRight size={14} />
            </Link>
            <p className="text-zinc-500 text-xs mt-3">
              {en ? 'Reply usually within a day. No sales pitch.' : 'Antwort meist am selben Tag. Kein Sales-Pitch.'}
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-5 bg-white border-b border-zinc-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] text-center mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight text-center mb-10">
            {en ? 'Common concerns' : 'Häufige Bedenken'}
          </h2>

          {/* RSC-only — wir verzichten auf Akkordeon-Toggle, weil das eine
              Client-Komponente erfordern würde. Alle Antworten offen sichtbar
              ist SEO-stärker (vollständig indexiert) und besser für Skim-
              Readers (Owner überfliegen, klicken nicht). */}
          <div className="space-y-6">
            {FAQ.map((faq, i) => (
              <div key={i} className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100">
                <p className="font-bold text-zinc-900 mb-2">{faq.q}</p>
                <p className="text-sm text-zinc-600 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-5 bg-amber-400 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 110%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
        <div className="max-w-xl mx-auto relative">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-zinc-950 mb-5">
            {en ? 'Ready to switch?' : 'Bereit zum Wechseln?'}
          </h2>
          <p className="text-zinc-800 text-lg mb-10 leading-relaxed">
            {en
              ? <>14 days free trial — no credit card.<br />Then 49 €/month, or 39 €/month annually. Cancel anytime.</>
              : <>14 Tage gratis testen — ohne Kreditkarte.<br />Danach 49 €/Monat oder 39 €/Monat im Jahresabo. Jederzeit kündbar.</>}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register" data-track="cta_signup_vsmaat_bottom"
              className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/25">
              <Zap size={16} className="text-amber-400" />
              {en ? 'Free account in 60 sec' : 'Gratis Account in 60 Sek.'}
            </Link>
            <Link href="/#book-demo" data-track="cta_demo_vsmaat_bottom"
              className="inline-flex items-center gap-2 bg-zinc-900/10 hover:bg-zinc-900/20 text-zinc-900 font-semibold px-7 py-3.5 rounded-xl text-base transition-all">
              {en ? 'Or: 20-min demo' : 'Oder: 20-Min-Demo'} <ArrowRight size={15} />
            </Link>
          </div>
          <p className="text-zinc-700 text-xs mt-6 tracking-wide">
            {en ? '14 days free · No credit card · CSV migration + setup call included' : '14 Tage gratis · Keine Kreditkarte · CSV-Migration + Setup-Call inklusive'}
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-zinc-50 border-t border-zinc-100 py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <OsssLogo variant="dark" />
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-zinc-400">
            <Link href="/" className="hover:text-zinc-700 transition-colors">{en ? 'Home' : 'Start'}</Link>
            <Link href="/pricing" className="hover:text-zinc-700 transition-colors">{en ? 'Pricing' : 'Preise'}</Link>
            <Link href="/about" className="hover:text-zinc-700 transition-colors">{en ? 'About' : 'Über'}</Link>
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">{en ? 'Privacy' : 'Datenschutz'}</Link>
            <Link href="/impressum" className="hover:text-zinc-700 transition-colors">Impressum</Link>
          </div>
          <p className="text-zinc-400 text-xs">
            <a href="mailto:oss@osss.pro" className="hover:text-zinc-700 transition-colors">oss@osss.pro</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
