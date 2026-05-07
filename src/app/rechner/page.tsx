'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { OsssLogo } from '@/components/Logo'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { ArrowLeft, Calculator, ArrowRight, Clock, Euro, TrendingDown, Zap } from 'lucide-react'

/**
 * Gym-Software-Kosten-Rechner
 *
 * Interaktives Tool: Coach trägt Mitgliederzahl + Stunden für manuelle
 * Verwaltung ein, sieht sofort die jährlichen Kosten der Manuell-Verwaltung
 * vs. Software wie Osss.
 *
 * Conversion-Hook: am Ende der Berechnung CTA zu /register.
 */

function getOsssMonthly(members: number): number {
  if (members <= 30) return 0
  if (members <= 50) return 29
  if (members <= 150) return 59
  return 99
}

function getEversportsMonthly(members: number, avgFee: number): number {
  // Eversports: Basisplan ~49 €/mo + 1.5% Plattformgebühr auf Beiträge
  const base = 49
  const platformFee = members * avgFee * 0.015
  return base + platformFee
}

export default function RechnerPage() {
  const [members, setMembers] = useState(50)
  const [hoursPerWeek, setHoursPerWeek] = useState(3)
  const [hourlyRate, setHourlyRate] = useState(40)
  const [avgFee, setAvgFee] = useState(60)

  // Berechnungen
  const calc = useMemo(() => {
    const annualHours = hoursPerWeek * 50 // 50 Wochen
    const annualLaborCost = annualHours * hourlyRate

    const osssMonthly = getOsssMonthly(members)
    const osssAnnual = osssMonthly * 12

    const eversportsMonthly = getEversportsMonthly(members, avgFee)
    const eversportsAnnual = eversportsMonthly * 12

    const savingsVsManual = annualLaborCost - osssAnnual
    const savingsVsEversports = eversportsAnnual - osssAnnual

    return {
      annualHours,
      annualLaborCost,
      osssMonthly,
      osssAnnual,
      eversportsMonthly,
      eversportsAnnual,
      savingsVsManual,
      savingsVsEversports,
      monthlyRevenue: members * avgFee,
      eversportsPlatformFee: members * avgFee * 0.015 * 12,
    }
  }, [members, hoursPerWeek, hourlyRate, avgFee])

  const fmt = (n: number) => Math.round(n).toLocaleString('de-DE') + ' €'

  return (
    <div className="min-h-screen bg-white flex flex-col">

      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/ressourcen" className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium">
            <ArrowLeft size={15} /> Ressourcen
          </Link>
          <OsssLogo variant="dark" />
          <Link href="/register" className="hidden sm:inline-block bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
            Kostenlos starten
          </Link>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto px-5 py-12 sm:py-16 w-full">

        {/* Header */}
        <div className="mb-10">
          <p className="text-emerald-600 font-bold text-[10px] uppercase tracking-[0.3em] mb-3">Tool · Rechner</p>
          <h1 className="text-4xl sm:text-5xl font-black text-zinc-950 tracking-tighter mb-4">
            Was kostet dich Excel?
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed max-w-2xl">
            Trag deine Zahlen ein — bekommst sofort die <strong>echten Jahres-Kosten</strong> deiner
            manuellen Verwaltung im Vergleich zu Osss und Eversports.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">

          {/* Inputs */}
          <div className="bg-zinc-50 rounded-2xl p-5 sm:p-7 border border-zinc-200">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-5 flex items-center gap-2">
              <Calculator size={14} /> Deine Zahlen
            </h2>

            <Field label="Mitgliederzahl" value={members} unit="Mitglieder" min={10} max={500} step={10} onChange={setMembers} />
            <Field label="Stunden / Woche für Verwaltung" value={hoursPerWeek} unit="h/Woche" min={0.5} max={20} step={0.5} onChange={setHoursPerWeek} />
            <Field label="Dein Stundensatz" value={hourlyRate} unit="€/h" min={20} max={150} step={5} onChange={setHourlyRate} />
            <Field label="Ø Mitgliedsbeitrag" value={avgFee} unit="€/Monat" min={20} max={200} step={5} onChange={setAvgFee} />

            <p className="text-xs text-zinc-400 mt-4 leading-relaxed">
              💡 Stundensatz = was deine Arbeitszeit dir Wert ist (nicht was du verdienst).
              Coach mit Vollzeit-Job: 40-60 €/h. Solo-Inhaber: 50-80 €/h.
            </p>
          </div>

          {/* Results */}
          <div className="space-y-3">

              {/* Manual cost */}
              <ResultCard
                tone="rose"
                icon={<Clock size={18} />}
                title="Excel / manuell"
                value={fmt(calc.annualLaborCost)}
                sub={`${calc.annualHours} h/Jahr × ${hourlyRate} €/h`}
                note="Deine Lebenszeit, hochgerechnet."
              />

              {/* Eversports cost */}
              <ResultCard
                tone="amber"
                icon={<Euro size={18} />}
                title="Eversports & Co."
                value={fmt(calc.eversportsAnnual)}
                sub={`49 €/Mo Basis + 1,5% von ${fmt(calc.monthlyRevenue * 12)} Beiträgen`}
                note={`Plattform-Gebühr allein: ${fmt(calc.eversportsPlatformFee)}/Jahr`}
              />

              {/* Osss cost */}
              <ResultCard
                tone="emerald"
                icon={<Zap size={18} />}
                title="Osss"
                value={calc.osssAnnual === 0 ? 'Kostenlos' : fmt(calc.osssAnnual)}
                sub={calc.osssMonthly === 0 ? 'Bis 30 Mitglieder gratis' : `${calc.osssMonthly} €/Monat · 0% Plattformgebühr`}
                note="Stripe-Standard-Gebühren auf Beiträge (1,4% + 0,25 €), wie überall."
                highlight
              />

              {/* Savings */}
              <div className="bg-zinc-950 text-white rounded-2xl p-5 sm:p-6 mt-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={16} className="text-amber-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Deine Ersparnis pro Jahr</p>
                </div>
                <div className="space-y-2">
                  <SavingsRow
                    label="vs. Excel/manuell"
                    value={fmt(Math.max(0, calc.savingsVsManual))}
                    pct={calc.annualLaborCost > 0 ? Math.round((calc.savingsVsManual / calc.annualLaborCost) * 100) : 0}
                  />
                  <SavingsRow
                    label="vs. Eversports & Co."
                    value={fmt(Math.max(0, calc.savingsVsEversports))}
                    pct={calc.eversportsAnnual > 0 ? Math.round((calc.savingsVsEversports / calc.eversportsAnnual) * 100) : 0}
                  />
                </div>
              </div>
            </div>
        </div>

        {/* CTA */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-8 text-center mb-10">
          <h3 className="text-2xl font-black text-zinc-950 tracking-tight mb-2">
            Klingt das nach einer Rechnung, die sich lohnt?
          </h3>
          <p className="text-zinc-700 leading-relaxed mb-5 max-w-xl mx-auto">
            Bis 30 Mitglieder kostet Osss nichts. Du kannst es heute Abend installieren und morgen
            damit arbeiten — keine Vertragsbindung, keine Kreditkarte zum Start.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-7 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/20">
            <Zap size={16} className="text-amber-400" /> Kostenlos starten <ArrowRight size={15} />
          </Link>
        </div>

        {/* Newsletter */}
        <div className="mb-12">
          <NewsletterSignup
            source="rechner"
            title="Mehr Tools wie dieses?"
            description="Wir veröffentlichen regelmäßig kostenlose Praxis-Tools für Kampfsport-Vereine. Direkt im Postfach."
          />
        </div>

        {/* Disclaimer */}
        <div className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-100 pt-6">
          <p className="mb-1"><strong>Annahmen für die Rechnung:</strong></p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>50 Arbeitswochen pro Jahr (2 Wochen Urlaub)</li>
            <li>Eversports-Schätzung: 49 €/Mo Basisplan + 1,5% Plattformgebühr (öffentlicher Standard, kann variieren)</li>
            <li>Stripe-Gebühren auf Mitgliedsbeiträge sind in <strong>keiner</strong> Vergleichszahl enthalten — die fallen bei jedem Anbieter gleich an</li>
            <li>Daten dienen der Orientierung. Tatsächliche Preise je nach Anbieter und Verhandlungsstand</li>
          </ul>
        </div>

      </main>

      <footer className="bg-white border-t border-zinc-100 py-6 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} Osss · Die Kampfsport-Gym-Software</p>
          <div className="flex gap-5">
            <Link href="/" className="hover:text-zinc-700 transition-colors">Start</Link>
            <Link href="/ressourcen" className="hover:text-zinc-700 transition-colors">Ressourcen</Link>
            <Link href="/blog" className="hover:text-zinc-700 transition-colors">Blog</Link>
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">Datenschutz</Link>
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
