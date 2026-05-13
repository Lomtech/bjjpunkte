'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { Calculator, ArrowRight, Clock, Euro, TrendingDown, Zap } from 'lucide-react'
import { TopNav } from '@/components/TopNav'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import {
  STANDARD_TIER,
  FREE_TRIAL_DAYS,
} from '@/lib/pricing'

/**
 * Gym-Software-Kosten-Rechner mit MAAT-Direktvergleich.
 *
 * 2026-05-10 Refactor:
 *   - Single-Tier-Pricing-Realignment: nur noch Osss Standard 49 €/Mo monatlich
 *     bzw. 39 €/Mo jährlich (kein Free-Tier mehr, 14-Tage-Trial stattdessen)
 *   - MAAT (49 €/Mo + 1 %) als primärer Wettbewerbsvergleich (war: Eversports)
 *   - i18n DE/EN via useLanguage()
 *   - 4 Ergebnis-Karten: Manuell / MAAT / Osss Monatlich / Osss Jährlich
 *
 * Audit 2026-05-13: PILOT10-Lifetime-Discount entfernt — Single-Tier-
 * Preise (49/39 €/Mo) sind jetzt die einzigen Anker.
 *
 * Conversion-Hook: am Ende der Berechnung CTA zu /register.
 *
 * Preis-Logik kommt zentral aus src/lib/pricing.ts — nicht hardcoden,
 * sonst driftet der Rechner beim nächsten Pricing-Realignment auseinander.
 */

// MAAT Pricing-Modell: 49 €/Mo Basis + 1 % auf Mitglieds-Beiträge.
// Quelle: maatapp.com (Stand Mai 2026, jährliche Abrechnung).
function getMaatMonthly(members: number, avgFee: number): number {
  const base = 49
  const platformFee = members * avgFee * 0.01
  return base + platformFee
}

export default function RechnerPage() {
  const { lang } = useLanguage()
  const en = lang === 'en'

  const [members, setMembers] = useState(50)
  const [hoursPerWeek, setHoursPerWeek] = useState(3)
  const [hourlyRate, setHourlyRate] = useState(40)
  const [avgFee, setAvgFee] = useState(60)

  // Berechnungen
  const calc = useMemo(() => {
    const annualHours = hoursPerWeek * 50 // 50 Arbeitswochen
    const annualLaborCost = annualHours * hourlyRate

    // Osss Single-Tier (Source-of-Truth: src/lib/pricing.ts)
    const osssMonthlyCost = STANDARD_TIER.monthlyCents / 100
    const osssAnnualMonthlyCost = STANDARD_TIER.annualMonthlyCents / 100
    const osssMonthlyAnnual = osssMonthlyCost * 12
    const osssAnnualAnnual = osssAnnualMonthlyCost * 12
    // Audit 2026-05-13: Pilot-Discount-Berechnung entfernt.

    // MAAT
    const maatMonthly = getMaatMonthly(members, avgFee)
    const maatAnnual = maatMonthly * 12
    const maatPlatformFee = members * avgFee * 0.01 * 12

    // Ersparnis: vs. Manuell + vs. MAAT (für Osss Jährlich, der günstigste reale Plan)
    const savingsVsManual = annualLaborCost - osssAnnualAnnual
    const savingsVsMaat = maatAnnual - osssAnnualAnnual

    return {
      annualHours,
      annualLaborCost,
      osssMonthlyCost,
      osssAnnualMonthlyCost,
      osssMonthlyAnnual,
      osssAnnualAnnual,
      maatMonthly,
      maatAnnual,
      maatPlatformFee,
      savingsVsManual,
      savingsVsMaat,
      monthlyRevenue: members * avgFee,
    }
  }, [members, hoursPerWeek, hourlyRate, avgFee])

  // suppressHydrationWarning-sicher: Intl.NumberFormat statt toLocaleString,
  // damit Server (Node.js/Vercel) und Browser identische Strings erzeugen.
  const locale = en ? 'en-IE' : 'de-DE'
  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
  const fmtPrecise = (n: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €'

  return (
    <div className="min-h-screen bg-white flex flex-col">

      <TopNav />

      <main className="flex-1 max-w-4xl mx-auto px-5 py-12 sm:py-16 w-full">

        {/* Header */}
        <div className="mb-10">
          <p className="text-emerald-600 font-bold text-[10px] uppercase tracking-[0.3em] mb-3">
            {en ? 'Tool · Calculator' : 'Tool · Rechner'}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-zinc-950 tracking-tighter mb-4">
            {en ? 'What does Excel cost you?' : 'Was kostet dich Excel?'}
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed max-w-2xl">
            {en ? (
              <>Enter your numbers — get the <strong>real annual cost</strong> of manual admin compared to Osss and MAAT.</>
            ) : (
              <>Trag deine Zahlen ein — bekommst sofort die <strong>echten Jahres-Kosten</strong> deiner manuellen Verwaltung im Vergleich zu Osss und MAAT.</>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">

          {/* Inputs */}
          <div className="bg-zinc-50 rounded-2xl p-5 sm:p-7 border border-zinc-200">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-5 flex items-center gap-2">
              <Calculator size={14} /> {en ? 'Your numbers' : 'Deine Zahlen'}
            </h2>

            <Field
              label={en ? 'Member count' : 'Mitgliederzahl'}
              value={members} unit={en ? 'members' : 'Mitglieder'}
              min={10} max={500} step={10} onChange={setMembers}
            />
            <Field
              label={en ? 'Admin hours / week' : 'Stunden / Woche für Verwaltung'}
              value={hoursPerWeek} unit={en ? 'h/week' : 'h/Woche'}
              min={0.5} max={20} step={0.5} onChange={setHoursPerWeek}
            />
            <Field
              label={en ? 'Your hourly rate' : 'Dein Stundensatz'}
              value={hourlyRate} unit="€/h"
              min={20} max={150} step={5} onChange={setHourlyRate}
            />
            <Field
              label={en ? 'Average member fee' : 'Ø Mitgliedsbeitrag'}
              value={avgFee} unit={en ? '€/month' : '€/Monat'}
              min={20} max={200} step={5} onChange={setAvgFee}
            />

            <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
              {en ? (
                <>💡 Hourly rate = what your time is worth (not what you earn). Coach with full-time job: 40-60 €/h. Solo owner: 50-80 €/h.</>
              ) : (
                <>💡 Stundensatz = was deine Arbeitszeit dir Wert ist (nicht was du verdienst). Coach mit Vollzeit-Job: 40-60 €/h. Solo-Inhaber: 50-80 €/h.</>
              )}
            </p>
          </div>

          {/* Results */}
          <div className="space-y-3">

            {/* Manual cost */}
            <ResultCard
              tone="rose"
              icon={<Clock size={18} />}
              title={en ? 'Excel / manual' : 'Excel / manuell'}
              value={fmt(calc.annualLaborCost)}
              sub={`${calc.annualHours} ${en ? 'h/year' : 'h/Jahr'} × ${hourlyRate} €/h`}
              note={en ? 'Your time, calculated.' : 'Deine Lebenszeit, hochgerechnet.'}
            />

            {/* MAAT — primärer Konkurrenz-Vergleich */}
            <ResultCard
              tone="amber"
              icon={<Euro size={18} />}
              title="MAAT"
              value={fmt(calc.maatAnnual)}
              sub={en
                ? `49 €/mo base + 1 % of ${fmt(calc.monthlyRevenue * 12)} dues`
                : `49 €/Mo Basis + 1 % von ${fmt(calc.monthlyRevenue * 12)} Beiträgen`}
              note={en
                ? `Platform fee alone: ${fmt(calc.maatPlatformFee)}/year`
                : `Plattform-Gebühr allein: ${fmt(calc.maatPlatformFee)}/Jahr`}
            />

            {/* Osss Monatlich */}
            <ResultCard
              tone="emerald"
              icon={<Zap size={18} />}
              title={en ? 'Osss · Monthly' : 'Osss · Monatlich'}
              value={fmt(calc.osssMonthlyAnnual)}
              sub={`${calc.osssMonthlyCost} €/${en ? 'month' : 'Monat'} · 0 % ${en ? 'platform fee' : 'Plattformgebühr'}`}
              note={en
                ? `Cancel anytime. ${FREE_TRIAL_DAYS}-day free trial.`
                : `Jederzeit kündbar. ${FREE_TRIAL_DAYS}-Tage-Trial.`}
            />

            {/* Osss Jährlich — highlighted */}
            <ResultCard
              tone="emerald"
              icon={<Zap size={18} />}
              title={en ? 'Osss · Annual ★' : 'Osss · Jährlich ★'}
              value={fmt(calc.osssAnnualAnnual)}
              sub={`${calc.osssAnnualMonthlyCost} €/${en ? 'month' : 'Monat'} · 0 % ${en ? 'platform fee' : 'Plattformgebühr'}`}
              note={en
                ? `Save 120 €/year vs. monthly billing.`
                : `Spare 120 €/Jahr gegenüber monatlich.`}
              highlight
            />

            {/* Audit 2026-05-13: PILOT10-Hint entfernt. */}

            {/* Savings */}
            <div className="bg-zinc-950 text-white rounded-2xl p-5 sm:p-6 mt-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown size={16} className="text-amber-400" />
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  {en ? 'Your annual savings (vs. Osss Annual)' : 'Deine Ersparnis pro Jahr (vs. Osss Jährlich)'}
                </p>
              </div>
              <div className="space-y-2">
                <SavingsRow
                  label={en ? 'vs. Excel/manual' : 'vs. Excel/manuell'}
                  value={fmt(Math.max(0, calc.savingsVsManual))}
                  pct={calc.annualLaborCost > 0
                    ? Math.round((calc.savingsVsManual / calc.annualLaborCost) * 100)
                    : 0}
                />
                <SavingsRow
                  label="vs. MAAT"
                  value={fmt(Math.max(0, calc.savingsVsMaat))}
                  pct={calc.maatAnnual > 0
                    ? Math.round((calc.savingsVsMaat / calc.maatAnnual) * 100)
                    : 0}
                />
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8 text-center mb-10">
          <h3 className="text-2xl font-black text-zinc-950 tracking-tight mb-2">
            {en ? 'Sounds like a deal worth taking?' : 'Klingt das nach einer Rechnung, die sich lohnt?'}
          </h3>
          <p className="text-zinc-700 leading-relaxed mb-5 max-w-xl mx-auto">
            {en ? (
              <>{FREE_TRIAL_DAYS} days free, no credit card. You can install Osss tonight and
              work with it tomorrow — no contract, cancel anytime.</>
            ) : (
              <>{FREE_TRIAL_DAYS} Tage gratis, ohne Kreditkarte. Du kannst Osss heute Abend installieren
              und morgen damit arbeiten — keine Vertragsbindung, jederzeit kündbar.</>
            )}
          </p>
          <Link
            href="/register"
            data-track="cta_signup_rechner"
            className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-7 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/20"
          >
            <Zap size={16} className="text-amber-400" />
            {en ? `Start ${FREE_TRIAL_DAYS}-day trial` : `${FREE_TRIAL_DAYS}-Tage-Trial starten`}
            <ArrowRight size={15} />
          </Link>
        </div>

        {/* Newsletter */}
        <div className="mb-12">
          <NewsletterSignup
            source="rechner"
            title={en ? 'More tools like this?' : 'Mehr Tools wie dieses?'}
            description={en
              ? 'We publish free practical tools for martial-arts gyms regularly. Straight to your inbox.'
              : 'Wir veröffentlichen regelmäßig kostenlose Praxis-Tools für Kampfsport-Vereine. Direkt im Postfach.'}
          />
        </div>

        {/* Disclaimer */}
        <div className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-100 pt-6">
          <p className="mb-1"><strong>{en ? 'Assumptions:' : 'Annahmen für die Rechnung:'}</strong></p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>{en ? '50 working weeks per year (2 weeks vacation)' : '50 Arbeitswochen pro Jahr (2 Wochen Urlaub)'}</li>
            <li>{en
              ? 'MAAT estimate: 49 €/mo base + 1 % platform fee on member dues (annual billing, public Stand May 2026)'
              : 'MAAT-Schätzung: 49 €/Mo Basis + 1 % Plattformgebühr auf Mitglieds-Beiträge (jährliche Abrechnung, öffentlicher Stand Mai 2026)'}</li>
            <li>{en
              ? 'Stripe card-processing fees on member dues are NOT included — they apply identically to every provider (~1.4 % + 0.25 €)'
              : 'Stripe-Karten-Gebühren auf Mitgliedsbeiträge sind in keiner Vergleichszahl enthalten — die fallen bei jedem Anbieter gleich an (~1,4 % + 0,25 €)'}</li>
            <li>{en
              ? 'Numbers are for orientation. Actual prices vary by provider and negotiation.'
              : 'Daten dienen der Orientierung. Tatsächliche Preise je nach Anbieter und Verhandlungsstand.'}</li>
          </ul>
        </div>

      </main>

      <footer className="bg-white border-t border-zinc-100 py-6 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} Osss · {en ? 'The martial arts gym software' : 'Die Kampfsport-Gym-Software'}</p>
          <div className="flex gap-5">
            <Link href="/" className="hover:text-zinc-700 transition-colors">{en ? 'Home' : 'Start'}</Link>
            <Link href="/ressourcen" className="hover:text-zinc-700 transition-colors">{en ? 'Resources' : 'Ressourcen'}</Link>
            <Link href="/blog" className="hover:text-zinc-700 transition-colors">Blog</Link>
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">{en ? 'Privacy' : 'Datenschutz'}</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}

// ─── Sub-Components ────────────────────────────────────────────────────────

function Field({
  label, value, unit, min, max, step, onChange,
}: {
  label: string; value: number; unit: string; min: number; max: number; step: number;
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-semibold text-zinc-700">{label}</label>
        <span className="text-sm font-mono text-zinc-900 tabular-nums">
          <strong>{value}</strong> <span className="text-zinc-400 text-xs">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-zinc-200 accent-amber-500"
      />
    </div>
  )
}

function ResultCard({
  tone, icon, title, value, sub, note, highlight,
}: {
  tone: 'rose' | 'amber' | 'emerald'
  icon: React.ReactNode
  title: string
  value: string
  sub: string
  note?: string
  highlight?: boolean
}) {
  const colors = {
    rose:    { border: 'border-rose-200',    bg: 'bg-rose-50',    icon: 'text-rose-600',    val: 'text-rose-700' },
    amber:   { border: 'border-amber-200',   bg: 'bg-amber-50',   icon: 'text-amber-600',   val: 'text-amber-700' },
    emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50', icon: 'text-emerald-600', val: 'text-emerald-700' },
  }[tone]
  return (
    <div className={`rounded-2xl border-2 p-5 ${highlight ? `${colors.border} ${colors.bg}` : `border-zinc-200 bg-white`}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={colors.icon}>{icon}</span>
        <p className="font-bold text-zinc-900">{title}</p>
      </div>
      <p className={`text-3xl font-black tabular-nums tracking-tight ${highlight ? colors.val : 'text-zinc-900'}`}>
        {value}
      </p>
      <p className="text-xs text-zinc-500 mt-1">{sub}</p>
      {note && <p className="text-[11px] text-zinc-400 mt-1.5 italic">{note}</p>}
    </div>
  )
}

function SavingsRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-300">{label}</span>
      <span className="font-bold text-amber-400 tabular-nums">
        {value} <span className="text-zinc-500 font-normal text-xs">({pct}%)</span>
      </span>
    </div>
  )
}
