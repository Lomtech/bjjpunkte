import Link from 'next/link'
import type { Metadata } from 'next'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { Shield, Calculator, ArrowRight, Download, FileText } from 'lucide-react'
import { TopNav } from '@/components/TopNav'
import { getServerLang } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: 'Kostenlose Ressourcen für Kampfsport-Vereine',
  description:
    'DSGVO-Checkliste, Gym-Software-Kostenrechner, DATEV-Anleitungen — kostenlose Praxis-Tools für Vereinsvorstände und Gym-Inhaber.',
  alternates: { canonical: '/ressourcen' },
  openGraph: {
    title: 'Kostenlose Ressourcen für Kampfsport-Vereine',
    description: 'DSGVO-Checkliste, Software-Kostenrechner und mehr — direkt zum Download.',
    url: 'https://www.osss.pro/ressourcen',
    type: 'website',
    locale: 'de_DE',
  },
  robots: { index: true, follow: true },
}

export default async function RessourcenPage() {
  const lang = await getServerLang()
  const en = lang === 'en'

  // Resources sind DACH-spezifisch (DSGVO, Excel-Vergleich für deutsche Studios).
  // Wir lokalisieren die Card-Beschreibungen, der Inhalt der Sub-Pages bleibt
  // weiterhin DE — DSGVO ist deutsches Recht, würde sinnlos in EN sein.
  const RESOURCES = [
    {
      href: '/ressourcen/dsgvo-checkliste',
      icon: Shield,
      label: en ? 'Checklist' : 'Checkliste',
      title: en ? 'GDPR checklist for martial-arts clubs' : 'DSGVO-Checkliste für Kampfsport-Vereine',
      description: en
        ? 'The honest must-do list: privacy policy, data-processing agreement, processing register, deletion process. No lawyer-speak. Print- and PDF-ready. (German content — DSGVO is German law.)'
        : 'Die ehrliche Pflicht-Liste: Datenschutzerklärung, AVV, Verarbeitungsverzeichnis, Lösch-Prozess. Ohne Anwaltsfloskeln. Druck- und PDF-fähig.',
      cta: en ? 'Open checklist' : 'Checkliste öffnen',
      color: 'amber',
    },
    {
      href: '/rechner',
      icon: Calculator,
      label: en ? 'Tool' : 'Tool',
      title: en ? 'Gym-software cost calculator' : 'Gym-Software-Kosten-Rechner',
      description: en
        ? 'What does Excel/manual admin really cost you per year? Enter member count + hours — get savings vs. software.'
        : 'Was kostet dich Excel/manuelle Verwaltung wirklich pro Jahr? Trag deine Mitgliederzahl + Stunden ein — bekommst Ersparnis-Rechnung im Vergleich zu Software.',
      cta: en ? 'Calculate now' : 'Jetzt rechnen',
      color: 'emerald',
    },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col">

      <TopNav />

      {/* Header */}
      <header className="border-b border-zinc-100 bg-white">
        <div className="max-w-3xl mx-auto px-5 py-16 sm:py-20">
          <p className="text-amber-500 font-bold text-[10px] uppercase tracking-[0.3em] mb-4">
            {en ? 'Resources' : 'Ressourcen'}
          </p>
          <h1 className="text-4xl sm:text-5xl font-black text-zinc-950 tracking-tighter mb-4">
            {en ? 'Free tools for martial-arts clubs.' : 'Kostenlose Tools für Kampfsport-Vereine.'}
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed">
            {en
              ? 'Practical helpers for gym owners and club boards. No lead-magnet sales trick — just the things we’d use ourselves.'
              : 'Praxis-Hilfen für Gym-Inhaber und Vereinsvorstände. Kein Lead-Magnet-Verkäufer-Trick — nur die Sachen, die wir selbst nutzen würden.'}
          </p>
        </div>
      </header>

      {/* Resources grid */}
      <main className="flex-1 max-w-3xl mx-auto px-5 py-14 w-full">
        <div className="grid grid-cols-1 gap-5">
          {RESOURCES.map(r => (
            <Link
              key={r.href}
              href={r.href}
              className={`group block bg-white border-2 rounded-2xl p-6 sm:p-7 transition-all hover:shadow-lg ${
                r.color === 'amber'
                  ? 'border-amber-100 hover:border-amber-300 hover:shadow-amber-100/50'
                  : 'border-emerald-100 hover:border-emerald-300 hover:shadow-emerald-100/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  r.color === 'amber' ? 'bg-amber-100' : 'bg-emerald-100'
                }`}>
                  <r.icon size={22} className={r.color === 'amber' ? 'text-amber-700' : 'text-emerald-700'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                    r.color === 'amber' ? 'text-amber-700' : 'text-emerald-700'
                  }`}>{r.label}</p>
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight mb-2 group-hover:text-amber-600 transition-colors">
                    {r.title}
                  </h2>
                  <p className="text-zinc-500 text-sm leading-relaxed mb-4">
                    {r.description}
                  </p>
                  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                    r.color === 'amber' ? 'text-amber-700 group-hover:text-amber-900' : 'text-emerald-700 group-hover:text-emerald-900'
                  }`}>
                    {r.cta} <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Coming soon teaser */}
        <div className="mt-10 bg-zinc-50 rounded-2xl p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
            {en ? 'Coming soon' : 'Bald verfügbar'}
          </p>
          <p className="text-sm text-zinc-600 mb-4">
            <span className="inline-flex items-center gap-1.5 mr-3"><FileText size={13} /> {en ? 'SEPA mandate template' : 'SEPA-Mandats-Vorlage'}</span>
            <span className="inline-flex items-center gap-1.5 mr-3"><Download size={13} /> {en ? 'DPA generator' : 'AVV-Generator'}</span>
            <span className="inline-flex items-center gap-1.5"><FileText size={13} /> {en ? 'Sign-up form template' : 'Anmelde-Formular-Template'}</span>
          </p>
          <p className="text-xs text-zinc-400">
            {en
              ? 'Be first to know via newsletter when new resources go live.'
              : 'Erfahre als Erste:r per Newsletter, wenn neue Ressourcen live gehen.'}
          </p>
        </div>

        {/* Newsletter */}
        <div className="mt-12">
          <NewsletterSignup source="ressourcen-hub" />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-100 py-6 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} Osss · {en ? 'The martial arts gym software' : 'Die Kampfsport-Gym-Software'}</p>
          <div className="flex gap-5">
            <Link href="/" className="hover:text-zinc-700 transition-colors">{en ? 'Home' : 'Start'}</Link>
            <Link href="/blog" className="hover:text-zinc-700 transition-colors">Blog</Link>
            <Link href="/pricing" className="hover:text-zinc-700 transition-colors">{en ? 'Pricing' : 'Preise'}</Link>
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">{en ? 'Privacy' : 'Datenschutz'}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
