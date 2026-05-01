'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  Users, CreditCard, Smartphone, Calendar, Target, Award,
  FileSpreadsheet, Globe, FileEdit, FileText, Shield, Headphones,
  CheckCircle, ArrowRight, Zap, ChevronRight,
} from 'lucide-react'

const SPORTS = ['BJJ', 'MMA', 'Kickboxen', 'Judo', 'Ringen', 'Karate', 'Muay Thai', 'Taekwondo']

const FEATURES = [
  { icon: Users,       title: 'Mitgliederverwaltung',  desc: 'Alle Mitglieder auf einen Blick. Gürtel-Tracking, Familienmitglieder, Notizen — alles an einem Ort.' },
  { icon: CreditCard,  title: 'Zahlungen & Rechnungen', desc: 'Beiträge per Stripe einziehen. Automatische Rechnungen — DSGVO-konform, Kleinunternehmer-ready.' },
  { icon: Smartphone,  title: 'Member-Portal',          desc: 'Deine Mitglieder checken per QR-Code ein, buchen Kurse und sehen ihre Trainingshistorie — ohne App.' },
  { icon: Calendar,    title: 'Stundenplan',             desc: 'Kursplan verwalten und direkt auf deiner Website einbetten. Inklusive iCal-Export für Google Calendar.' },
  { icon: Target,      title: 'Lead-Pipeline',           desc: 'Interessenten verfolgen von der ersten Anfrage bis zur Mitgliedschaft. Nie wieder einen Lead verlieren.' },
  { icon: Award,       title: 'Gürtel-Tracking',         desc: 'Promotions dokumentieren mit Datum und Belt-Verlauf. Für BJJ, Judo, Karate und alle Gürtelsysteme.' },
]

const PAIN_POINTS = [
  { icon: FileSpreadsheet, title: 'Excel & WhatsApp',   desc: 'Mitgliederlisten in Tabellen, Zahlungserinnerungen per Chat. Fehleranfällig, zeitaufwändig, unprofessionell.' },
  { icon: Globe,           title: 'US-Tools für €200+', desc: 'Mindbody, Glofox & Co. — auf Englisch, ohne deutsches Rechnungswesen und DSGVO-Compliance.' },
  { icon: FileEdit,        title: 'Rechnungen manuell', desc: 'Jeden Monat Rechnungen per Hand — besonders als Kleinunternehmer ein bürokratischer Albtraum.' },
]

const GERMAN_FEATURES = [
  { icon: FileText,   title: 'Kleinunternehmer-Rechnungen', desc: 'Automatische §19 UStG Rechnungen — du trägst einmal deine Daten ein, den Rest erledigt Osss.' },
  { icon: Shield,     title: 'DSGVO von Anfang an',         desc: 'Daten auf europäischen Servern. Einwilligungs-Tracking beim Mitglieds-Signup inklusive.' },
  { icon: Headphones, title: 'Support auf Deutsch',         desc: 'Kein englisches Support-Ticket. Direkt, schnell, verständlich.' },
]

const STEPS = [
  { num: '01', title: 'Konto erstellen', desc: 'In 2 Minuten registriert — kostenlos, keine Kreditkarte.' },
  { num: '02', title: 'Mitglieder importieren', desc: 'CSV-Upload oder manuell eintragen. Bestehende Daten kommen direkt rein.' },
  { num: '03', title: 'Gym läuft', desc: 'Zahlungen, Stundenplan, Portale — alles sofort einsatzbereit.' },
]


export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    try {
      createClient().auth.getSession().then(({ data: { session } }) => {
        setLoggedIn(!!session)
        setChecked(true)
      })
    } catch {
      setChecked(true)
    }
  }, [])

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-[9px] font-black text-white italic">oss</span>
            </div>
            <span className="font-black text-lg italic text-slate-900">Osss</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
              Preise
            </Link>
            <a href="mailto:support@osss.pro" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden md:block">
              Kontakt
            </a>
            {checked && (
              loggedIn
                ? <Link href="/dashboard" className="bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                    Dashboard →
                  </Link>
                : <>
                    <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
                      Login
                    </Link>
                    <Link href="/register" className="bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                      Kostenlos starten
                    </Link>
                  </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-slate-900 text-white px-5 pt-16 pb-0 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5 mb-6">
              <Shield size={12} className="text-amber-400" />
              <span className="text-amber-400 text-xs font-semibold">Made in Germany · DSGVO-konform</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-5">
              Schluss mit Excel.<br />Dein Gym läuft in{' '}
              <span className="text-amber-400">10 Minuten.</span>
            </h1>
            <p className="text-slate-300 text-lg max-w-xl mx-auto mb-6">
              Mitglieder, Beiträge, Stundenplan — alles in einer Software. Auf Deutsch. Für Kampfsport-Gyms gemacht.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8">
              {[
                { val: '€0',    label: 'Startkosten' },
                { val: '10 Min', label: 'Setup' },
                { val: '2%',    label: 'Plattformgebühr' },
                { val: '100%',  label: 'DSGVO-konform' },
              ].map(s => (
                <div key={s.label} className="flex items-baseline gap-1.5">
                  <span className="text-amber-400 font-black text-lg">{s.val}</span>
                  <span className="text-slate-400 text-sm">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
              <Link href="/register"
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors flex items-center justify-center gap-2">
                <Zap size={16} />
                Jetzt kostenlos starten
              </Link>
              <Link href="/pricing"
                className="w-full sm:w-auto border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors flex items-center justify-center gap-2">
                Preise ansehen
                <ChevronRight size={15} />
              </Link>
            </div>
            <p className="text-slate-600 text-xs">Keine Kreditkarte. Kein Risiko. Jederzeit kündbar.</p>
          </div>

          {/* App screenshot */}
          <div className="relative mx-auto max-w-5xl">
            <div className="bg-slate-800 rounded-t-2xl border border-slate-700 border-b-0 px-4 pt-3 pb-0">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-slate-600" />
                  <div className="w-3 h-3 rounded-full bg-slate-600" />
                  <div className="w-3 h-3 rounded-full bg-slate-600" />
                </div>
                <div className="flex-1 bg-slate-700 rounded-md h-5 flex items-center px-3">
                  <span className="text-slate-400 text-[10px]">app.osss.pro/dashboard</span>
                </div>
              </div>
              <Image
                src="/screenshot_betrieb.png"
                alt="Osss Dashboard"
                width={1706}
                height={922}
                className="w-full rounded-t-lg"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* SPORTS BANNER */}
      <section className="bg-amber-500 py-3 overflow-hidden">
        <div className="animate-marquee">
          {[...SPORTS, ...SPORTS].map((s, i) => (
            <span key={i} className="flex items-center text-white font-bold text-sm uppercase tracking-widest whitespace-nowrap px-8">
              {s}
              <span className="ml-8 w-1 h-1 rounded-full bg-white/40 inline-block" />
            </span>
          ))}
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="py-16 px-5 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-black text-slate-900 mb-3">Kennst du das?</h2>
          <p className="text-slate-500 mb-10 max-w-xl mx-auto">Die meisten Gym-Software-Lösungen sind zu teuer, zu komplex oder nicht auf Deutschland ausgelegt.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PAIN_POINTS.map(p => (
              <div key={p.title} className="bg-slate-50 rounded-2xl p-6 text-left">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                  <p.icon size={20} className="text-red-400" />
                </div>
                <p className="font-bold text-slate-900 mb-1">{p.title}</p>
                <p className="text-sm text-slate-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 px-5 bg-amber-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-black text-slate-900 mb-3">In 3 Schritten fertig</h2>
          <p className="text-slate-500 mb-12 max-w-lg mx-auto">Kein langer Onboarding-Prozess. Du bist in unter 10 Minuten live.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-7 left-[calc(50%+2rem)] right-[-50%] h-px bg-amber-200" />
                )}
                <div className="bg-white rounded-2xl p-6 border border-amber-100 text-left relative z-10">
                  <span className="text-amber-400 font-black text-3xl">{step.num}</span>
                  <p className="font-bold text-slate-900 mt-2 mb-1">{step.title}</p>
                  <p className="text-sm text-slate-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-16 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 mb-3">Alles was dein Gym braucht</h2>
            <p className="text-slate-500 max-w-lg mx-auto">Von der Mitgliederverwaltung bis zur automatischen Rechnung — in einer Software, ab €0/Monat.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-2xl border border-slate-200 p-6 hover:border-amber-300 hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-xl bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center mb-4 transition-colors">
                  <f.icon size={20} className="text-amber-600" />
                </div>
                <p className="font-bold text-slate-900 mb-1.5">{f.title}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCREENSHOT — Stundenplan */}
      <section className="py-16 px-5 bg-slate-900 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="text-white">
              <div className="text-amber-400 font-bold text-sm mb-2 uppercase tracking-wider">Stundenplan</div>
              <h2 className="text-3xl font-black mb-4">Kursplan — auf deiner Website eingebettet</h2>
              <p className="text-slate-300 mb-6 leading-relaxed">
                Stundenplan verwalten und per iframe direkt auf deiner Website einbetten. Deine Mitglieder sehen immer den aktuellen Plan. Inklusive iCal-Export für Google Calendar & Apple Kalender.
              </p>
              <ul className="space-y-2">
                {['Kalenderansicht nach Woche', 'Öffentlicher Embed-Link', 'iCal-Export', 'Online-Buchung für Mitglieder'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle size={14} className="text-amber-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
              <Image
                src="/screenshot_stundenplan.png"
                alt="Stundenplan"
                width={2912}
                height={896}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* DSGVO + Kleinunternehmer */}
      <section className="py-16 px-5 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-amber-600 font-bold text-sm mb-2 uppercase tracking-wider">Nur bei Osss</div>
              <h2 className="text-3xl font-black text-slate-900 mb-5">Gemacht für deutsche Gyms</h2>
              <div className="space-y-5">
                {GERMAN_FEATURES.map(i => (
                  <div key={i.title} className="flex gap-4">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <i.icon size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{i.title}</p>
                      <p className="text-slate-500 text-sm">{i.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={14} className="text-slate-400" />
                <p className="text-slate-400 text-sm font-medium">Automatische Rechnung</p>
              </div>
              <div className="space-y-2.5">
                {[
                  ['Rechnungsnummer', 'OSS-2026-047'],
                  ['Mitglied', 'Max Mustermann'],
                  ['Leistung', 'Monatsbeitrag Mai 2026'],
                  ['Betrag', '€ 89,00'],
                  ['Hinweis', '§19 UStG — keine USt.'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm border-b border-slate-800 pb-2.5">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-white font-medium">{val}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 flex items-center justify-center gap-2 text-green-400 text-xs font-medium">
                <CheckCircle size={12} />
                Automatisch erstellt & archiviert
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="py-16 px-5 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-black text-slate-900 mb-3">Faire Preise. Kein Kleingedrucktes.</h2>
          <p className="text-slate-600 mb-8">Starte kostenlos mit bis zu 30 Mitgliedern. Zahle erst wenn du wächst.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { name: 'Free',    price: '€0',  members: '30 Mitgl.' },
              { name: 'Starter', price: '€29', members: '50 Mitgl.' },
              { name: 'Grow',    price: '€59', members: '150 Mitgl.', highlight: true },
              { name: 'Pro',     price: '€99', members: 'Unbegrenzt' },
            ].map(p => (
              <div key={p.name} className={`rounded-xl p-4 border-2 text-center ${p.highlight ? 'border-amber-400 bg-amber-500 text-white' : 'border-slate-200 bg-white'}`}>
                <p className={`text-xs font-bold mb-1 ${p.highlight ? 'text-amber-100' : 'text-slate-500'}`}>{p.name}</p>
                <p className={`text-2xl font-black ${p.highlight ? 'text-white' : 'text-slate-900'}`}>{p.price}</p>
                <p className={`text-xs mt-1 ${p.highlight ? 'text-amber-100' : 'text-slate-400'}`}>{p.members}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-700 font-semibold text-sm transition-colors">
            Alle Features vergleichen <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 px-5 bg-slate-900 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-black mb-4">Bereit loszulegen?</h2>
          <p className="text-slate-300 text-lg mb-8">Kostenlos starten, keine Kreditkarte nötig. Dein Gym läuft in 10 Minuten.</p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold px-10 py-4 rounded-xl text-lg transition-colors">
            <Zap size={18} />
            Jetzt kostenlos starten
          </Link>
          <p className="text-slate-600 text-sm mt-4">Keine Kreditkarte · Keine Mindestlaufzeit · Jederzeit kündbar</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-5 border-t border-slate-100 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
              <span className="text-[7px] font-black text-white italic">oss</span>
            </div>
            <span className="font-bold text-slate-600 italic">Osss</span>
            <span>· Die Kampfsport-Gym-Software</span>
          </div>
          <div className="flex gap-5">
            <Link href="/pricing" className="hover:text-slate-700 transition-colors">Preise</Link>
            <Link href="/datenschutz" className="hover:text-slate-700 transition-colors">Datenschutz</Link>
            <Link href="/login" className="hover:text-slate-700 transition-colors">Login</Link>
            <a href="mailto:support@osss.pro" className="hover:text-slate-700 transition-colors">Kontakt</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
