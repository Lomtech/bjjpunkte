'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const SPORTS = [
  { emoji: '🥋', name: 'BJJ' },
  { emoji: '🥊', name: 'MMA' },
  { emoji: '🦵', name: 'Kickboxen' },
  { emoji: '🥋', name: 'Judo' },
  { emoji: '🤼', name: 'Ringen' },
  { emoji: '🥋', name: 'Karate' },
  { emoji: '🥷', name: 'Muay Thai' },
  { emoji: '🥋', name: 'Taekwondo' },
]

const FEATURES = [
  {
    icon: '👥',
    title: 'Mitgliederverwaltung',
    desc: 'Alle Mitglieder auf einen Blick. Gürtel-Tracking, Familienmitglieder, Notizen — alles an einem Ort.',
  },
  {
    icon: '💳',
    title: 'Zahlungen & Rechnungen',
    desc: 'Beiträge per Stripe einziehen. Automatische Rechnungen — DSGVO-konform, Kleinunternehmer-ready.',
  },
  {
    icon: '📱',
    title: 'Member-Portal',
    desc: 'Deine Mitglieder checken per QR-Code ein, buchen Kurse und sehen ihre Trainingshistorie — ohne App.',
  },
  {
    icon: '📅',
    title: 'Stundenplan',
    desc: 'Kursplan verwalten und direkt auf deiner Website einbetten. Inklusive iCal-Export für Google Calendar.',
  },
  {
    icon: '🎯',
    title: 'Lead-Pipeline',
    desc: 'Interessenten verfolgen von der ersten Anfrage bis zur Mitgliedschaft. Nie wieder einen Lead verlieren.',
  },
  {
    icon: '🏆',
    title: 'Gürtel-Tracking',
    desc: 'Promotions dokumentieren mit Datum und Belt-Verlauf. Für BJJ, Judo, Karate und alle Gürtelsysteme.',
  },
]

const TESTIMONIALS = [
  { name: 'Marco R.', gym: 'Fight Club München', text: 'Endlich eine Software die auf Deutsch ist und unsere Kleinunternehmer-Rechnungen automatisch erstellt. Spart mir 3 Stunden im Monat.' },
  { name: 'Jana K.', gym: 'BJJ Berlin', text: 'Der QR-Check-in am Kiosk ist ein Game-Changer. Kein Papierbuch mehr, keine manuellen Listen.' },
  { name: 'Ali M.', gym: 'Kickbox Academy Hamburg', text: 'Günstigste Lösung die ich gefunden habe — und die einzige die wirklich für kleine Gyms gemacht ist.' },
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
            <span className="text-amber-400 text-xs font-semibold">🇩🇪 Made in Germany · DSGVO-konform</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-5">
            Die Gym-Software<br />für <span className="text-amber-400">Kampfsport</span>
          </h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto mb-8">
            Mitglieder verwalten, Beiträge einziehen, Stundenpläne organisieren — alles in einer Software. Auf Deutsch. Für kleine Gyms gemacht.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/register"
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors">
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
      <section className="bg-amber-500 py-4">
        <div className="flex gap-6 items-center justify-center flex-wrap px-5">
          {SPORTS.map(s => (
            <span key={s.name} className="flex items-center gap-1.5 text-white font-bold text-sm whitespace-nowrap">
              <span>{s.emoji}</span> {s.name}
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
            {[
              { icon: '😤', title: 'Excel & WhatsApp', desc: 'Mitgliederlisten in Excel, Zahlungserinnerungen per WhatsApp. Fehleranfällig, zeitaufwändig, unprofessionell.' },
              { icon: '💸', title: 'Mindbody & Co.', desc: 'US-Tools für €200+/Monat, auf Englisch, ohne deutsches Rechnungswesen und DSGVO-Compliance.' },
              { icon: '🧾', title: 'Rechnungen manuell', desc: 'Jeden Monat Rechnungen per Hand erstellen — besonders als Kleinunternehmer ein bürokratischer Alptraum.' },
            ].map(p => (
              <div key={p.title} className="bg-white rounded-2xl p-6 border border-slate-200 text-left">
                <div className="text-3xl mb-3">{p.icon}</div>
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
              <div key={f.title} className="rounded-2xl border border-slate-200 p-6 hover:border-amber-300 hover:shadow-sm transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
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
                {[
                  { icon: '🧾', title: 'Kleinunternehmer-Rechnungen', desc: 'Automatische §19 UStG Rechnungen — du trägst einmal deine Daten ein, den Rest erledigt Osss.' },
                  { icon: '🔒', title: 'DSGVO von Anfang an', desc: 'Daten auf europäischen Servern. Einwilligungs-Tracking beim Mitglieds-Signup inklusive.' },
                  { icon: '💬', title: 'Support auf Deutsch', desc: 'Kein englisches Support-Ticket. Direkt, schnell, verständlich.' },
                ].map(i => (
                  <div key={i.title} className="flex gap-3">
                    <span className="text-2xl flex-shrink-0">{i.icon}</span>
                    <div>
                      <p className="font-bold">{i.title}</p>
                      <p className="text-slate-400 text-sm">{i.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
              <p className="text-slate-400 text-sm mb-4 font-medium">Automatische Rechnung</p>
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
              <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-green-400 text-xs font-medium text-center">
                ✓ Automatisch erstellt & archiviert
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
              { name: 'Free', price: '€0', members: '30 Mitgl.' },
              { name: 'Starter', price: '€29', members: '50 Mitgl.' },
              { name: 'Grow', price: '€59', members: '150 Mitgl.', highlight: true },
              { name: 'Pro', price: '€99', members: 'Unbegrenzt' },
            ].map(p => (
              <div key={p.name} className={`rounded-xl p-4 border-2 text-center ${p.highlight ? 'border-amber-400 bg-amber-500 text-white' : 'border-slate-200 bg-white'}`}>
                <p className={`text-xs font-bold mb-1 ${p.highlight ? 'text-amber-100' : 'text-slate-500'}`}>{p.name}</p>
                <p className={`text-2xl font-black ${p.highlight ? 'text-white' : 'text-slate-900'}`}>{p.price}</p>
                <p className={`text-xs mt-1 ${p.highlight ? 'text-amber-100' : 'text-slate-400'}`}>{p.members}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-semibold text-sm transition-colors">
            Alle Features vergleichen →
          </Link>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 px-5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-slate-900 text-center mb-10">Was Gym-Betreiber sagen</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <p className="text-slate-600 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-slate-400 text-xs">{t.gym}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 px-5 bg-slate-900 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-black mb-4">Bereit loszulegen?</h2>
          <p className="text-slate-300 text-lg mb-8">Kostenlos starten, keine Kreditkarte nötig. Dein Gym läuft in 10 Minuten.</p>
          <Link href="/register"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-white font-bold px-10 py-4 rounded-xl text-lg transition-colors">
            Jetzt kostenlos starten →
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
