'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Users, CreditCard, Smartphone, Calendar, Target, Award,
  FileSpreadsheet, Globe, FileEdit, FileText, Shield, Headphones,
  CheckCircle, ArrowRight, Zap,
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
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
              Preise
            </Link>
            {checked && (
              loggedIn
                ? <Link href="/dashboard" className="bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                    Dashboard →
                  </Link>
                : <>
                    <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
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
      <section className="bg-slate-900 text-white px-5 pt-20 pb-24 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5 mb-6">
            <Shield size={12} className="text-amber-400" />
            <span className="text-amber-400 text-xs font-semibold">Made in Germany · DSGVO-konform</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-5">
            Die Gym-Software<br />für <span className="text-amber-400">Kampfsport</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto mb-8">
            Mitglieder verwalten, Beiträge einziehen, Stundenpläne organisieren — alles in einer Software. Auf Deutsch. Für kleine Gyms gemacht.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register"
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors flex items-center justify-center gap-2">
              <Zap size={16} />
              Kostenlos starten — 30 Mitglieder gratis
            </Link>
            <Link href="/pricing"
              className="w-full sm:w-auto border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors">
              Preise ansehen
            </Link>
          </div>
          <p className="text-slate-500 text-xs mt-4">Keine Kreditkarte. Kein Risiko. Jederzeit kündbar.</p>
        </div>
      </section>

      {/* SPORTS BANNER */}
      <section className="bg-amber-500 py-3">
        <div className="flex gap-2 items-center justify-center flex-wrap px-5">
          {SPORTS.map(s => (
            <span key={s} className="text-white/90 font-bold text-xs px-3 py-1 rounded-full border border-white/20 whitespace-nowrap">
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="py-16 px-5 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-black text-slate-900 mb-3">Kennst du das?</h2>
          <p className="text-slate-500 mb-10 max-w-xl mx-auto">Die meisten Gym-Software-Lösungen sind zu teuer, zu komplex oder nicht auf Deutschland ausgelegt.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PAIN_POINTS.map(p => (
              <div key={p.title} className="bg-white rounded-2xl p-6 border border-slate-200 text-left">
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

      {/* FEATURES */}
      <section className="py-16 px-5">
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

      {/* DSGVO + Kleinunternehmer */}
      <section className="py-16 px-5 bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="text-amber-400 font-bold text-sm mb-2 uppercase tracking-wider">Nur bei Osss</div>
              <h2 className="text-3xl font-black mb-5">Gemacht für deutsche Gyms</h2>
              <div className="space-y-5">
                {GERMAN_FEATURES.map(i => (
                  <div key={i.title} className="flex gap-4">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                      <i.icon size={16} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="font-bold">{i.title}</p>
                      <p className="text-slate-400 text-sm">{i.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
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
                  <div key={label} className="flex justify-between text-sm border-b border-slate-700 pb-2.5">
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
      <section className="py-16 px-5 bg-amber-50">
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
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-5 border-t border-slate-200 bg-white">
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
            <Link href="/login" className="hover:text-slate-700 transition-colors">Login</Link>
            <a href="mailto:support@osss.pro" className="hover:text-slate-700 transition-colors">support@osss.pro</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
