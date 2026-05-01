'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, useInView, useScroll, useTransform } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import {
  Users, CreditCard, Smartphone, Calendar, Target, Award,
  FileSpreadsheet, Globe, FileEdit, FileText, Shield, Headphones,
  CheckCircle, ArrowRight, Zap, ChevronRight, Check, X,
} from 'lucide-react'

// ── data ──────────────────────────────────────────────────────────────────────

type SportId = 'bjj' | 'judo' | 'karate' | 'mma' | 'muaythai' | 'boxing' | 'wrestling' | 'taekwondo'

const SPORTS: { id: SportId; label: string; emoji: string; belt: boolean }[] = [
  { id: 'bjj',       label: 'BJJ',        emoji: '🥋', belt: true  },
  { id: 'judo',      label: 'Judo',       emoji: '🥋', belt: true  },
  { id: 'karate',    label: 'Karate',     emoji: '🥋', belt: true  },
  { id: 'taekwondo', label: 'Taekwondo',  emoji: '🥋', belt: true  },
  { id: 'mma',       label: 'MMA',        emoji: '🥊', belt: false },
  { id: 'muaythai',  label: 'Muay Thai',  emoji: '🤜', belt: false },
  { id: 'boxing',    label: 'Boxen',      emoji: '🥊', belt: false },
  { id: 'wrestling', label: 'Ringen',     emoji: '🤼', belt: false },
]

const SPORT_FEATURES: Record<SportId, { title: string; items: string[] }> = {
  bjj:       { title: 'BJJ-optimiert', items: ['5-Gürtel-System (Weiß → Schwarz)', 'Streifen-Tracking bis 4 Stufen', 'Gi / No-Gi Klassen-Typen', 'Promotions mit Verlauf & Datum'] },
  judo:      { title: 'Judo-optimiert', items: ['7-Stufen Kyu-System', 'Gelb bis Schwarz vorkonfiguriert', 'Wettkampf-Klassen-Typen', 'Dan-Grade frei erweiterbar'] },
  karate:    { title: 'Karate-optimiert', items: ['8 Kyu-Stufen vorkonfiguriert', 'Kata & Kumite Klassen-Typen', 'Prüfungsprotokoll per Promotion', 'Farben & Labels anpassbar'] },
  taekwondo: { title: 'Taekwondo-optimiert', items: ['6 Gürtelfarben vorkonfiguriert', 'Poomse & Sparring Klassen', 'Prüfungsprotokoll', 'Dan-Grade frei erweiterbar'] },
  mma:       { title: 'Kein Gürtelsystem nötig', items: ['Belt-Tracking deaktiviert', 'Fokus auf Anwesenheit & Zahlungen', 'Sparring & Klassen verwalten', 'Mitglieder-Portal ohne Gürtel'] },
  muaythai:  { title: 'Kein Gürtelsystem nötig', items: ['Belt-Tracking deaktiviert', 'Pad Work & Sparring Klassen', 'Anwesenheit & Beiträge', 'Mongkon / Prajiad — eigene Felder'] },
  boxing:    { title: 'Kein Gürtelsystem nötig', items: ['Belt-Tracking deaktiviert', 'Boxklassen & Sparring', 'Wettkampf-Tracking', 'Monatsbeiträge per Stripe'] },
  wrestling: { title: 'Kein Gürtelsystem nötig', items: ['Belt-Tracking deaktiviert', 'Ringen & Freistil Klassen', 'Gewichtsklassen als Notiz', 'Anwesenheit & Mitglieder'] },
}

const PAIN_POINTS = [
  { icon: FileSpreadsheet, title: 'Excel & WhatsApp',   desc: 'Mitgliederlisten in Tabellen, Zahlungserinnerungen per Chat. Fehleranfällig, zeitaufwändig, unprofessionell.' },
  { icon: Globe,           title: 'US-Tools für €200+', desc: 'Mindbody, Glofox & Co. — auf Englisch, ohne deutsches Rechnungswesen und DSGVO-Compliance.' },
  { icon: FileEdit,        title: 'Rechnungen manuell', desc: 'Jeden Monat Rechnungen per Hand — besonders als Kleinunternehmer ein bürokratischer Albtraum.' },
]

const FEATURES = [
  { icon: Users,       title: 'Mitgliederverwaltung',  desc: 'Alle Mitglieder auf einen Blick. Gürtel-Tracking, Familienmitglieder, Notizen — alles an einem Ort.' },
  { icon: CreditCard,  title: 'Zahlungen & Rechnungen', desc: 'Beiträge per Stripe einziehen. Automatische Rechnungen — DSGVO-konform, Kleinunternehmer-ready.' },
  { icon: Smartphone,  title: 'Member-Portal',          desc: 'Deine Mitglieder checken per QR-Code ein, buchen Kurse und sehen ihre Trainingshistorie — ohne App.' },
  { icon: Calendar,    title: 'Stundenplan',             desc: 'Kursplan verwalten und direkt auf deiner Website einbetten. Inklusive iCal-Export für Google Calendar.' },
  { icon: Target,      title: 'Lead-Pipeline',           desc: 'Interessenten verfolgen von der ersten Anfrage bis zur Mitgliedschaft. Nie wieder einen Lead verlieren.' },
  { icon: Award,       title: 'Gürtel-Tracking',         desc: 'Promotions dokumentieren mit Datum und Belt-Verlauf. Für BJJ, Judo, Karate und alle Gürtelsysteme.' },
]

const GERMAN_FEATURES = [
  { icon: FileText,   title: 'Kleinunternehmer-Rechnungen', desc: 'Automatische §19 UStG Rechnungen — du trägst einmal deine Daten ein, den Rest erledigt Osss.' },
  { icon: Shield,     title: 'DSGVO von Anfang an',         desc: 'Daten auf europäischen Servern. Einwilligungs-Tracking beim Mitglieds-Signup inklusive.' },
  { icon: Headphones, title: 'Support auf Deutsch',         desc: 'Kein englisches Support-Ticket. Direkt, schnell, verständlich.' },
]

const STEPS = [
  { num: '01', title: 'Konto erstellen',       desc: 'In 2 Minuten registriert — kostenlos, keine Kreditkarte.' },
  { num: '02', title: 'Mitglieder importieren', desc: 'CSV-Upload oder manuell eintragen. Bestehende Daten kommen direkt rein.' },
  { num: '03', title: 'Gym läuft',              desc: 'Zahlungen, Stundenplan, Portale — alles sofort einsatzbereit.' },
]

// ── animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
}

const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
}

const staggerFast = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.06 } },
}

// ── scroll section wrapper ────────────────────────────────────────────────────

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.section
      ref={ref}
      variants={stagger}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      className={className}
    >
      {children}
    </motion.section>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [checked, setChecked]   = useState(false)
  const [activeSport, setActiveSport] = useState<SportId>('bjj')

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

  // Hero parallax
  const heroRef  = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const screenshotY = useTransform(scrollYProgress, [0, 1], [0, 80])

  const sport = SPORTS.find(s => s.id === activeSport)!
  const features = SPORT_FEATURES[activeSport]

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">

      {/* NAV */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100"
      >
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-[9px] font-black text-white italic">oss</span>
            </div>
            <span className="font-black text-lg italic text-slate-900">Osss</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">Preise</Link>
            <a href="mailto:support@osss.pro" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden md:block">Kontakt</a>
            {checked && (
              loggedIn
                ? <Link href="/dashboard" className="bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Dashboard →</Link>
                : <>
                    <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">Login</Link>
                    <Link href="/register" className="bg-slate-900 hover:bg-slate-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Kostenlos starten</Link>
                  </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* HERO */}
      <section ref={heroRef} className="bg-slate-900 text-white px-5 pt-16 pb-0 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="text-center max-w-3xl mx-auto mb-10"
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-4 py-1.5 mb-6">
              <Shield size={12} className="text-amber-400" />
              <span className="text-amber-400 text-xs font-semibold">Made in Germany · DSGVO-konform</span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-5">
              Schluss mit Excel.<br />Dein Gym läuft in{' '}
              <span className="text-amber-400">10 Minuten.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-slate-300 text-lg max-w-xl mx-auto mb-6">
              Mitglieder, Beiträge, Stundenplan — alles in einer Software. Auf Deutsch. Für Kampfsport-Gyms gemacht.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-8">
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
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
              <Link href="/register"
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-colors flex items-center justify-center gap-2">
                <Zap size={16} /> Jetzt kostenlos starten
              </Link>
              <Link href="/pricing"
                className="w-full sm:w-auto border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors flex items-center justify-center gap-2">
                Preise ansehen <ChevronRight size={15} />
              </Link>
            </motion.div>
            <motion.p variants={fadeUp} className="text-slate-600 text-xs">Keine Kreditkarte. Kein Risiko. Jederzeit kündbar.</motion.p>
          </motion.div>

          {/* App screenshot with parallax */}
          <motion.div
            style={{ y: screenshotY }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative mx-auto max-w-5xl"
          >
            <div className="bg-slate-800 rounded-t-2xl border border-slate-700 border-b-0 px-4 pt-3 pb-0">
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
              <Image src="/screenshot_betrieb.png" alt="Osss Dashboard" width={1706} height={922} className="w-full rounded-t-lg" priority />
            </div>
          </motion.div>
        </div>
      </section>

      {/* SPORT PICKER */}
      <section className="bg-slate-950 px-5 py-16">
        <div className="max-w-5xl mx-auto">
          <Section className="text-center mb-10">
            <motion.p variants={fadeUp} className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-2">Für jede Kampfsportart</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-white mb-3">Was trainierst du?</motion.h2>
            <motion.p variants={fadeUp} className="text-slate-400 max-w-lg mx-auto">
              Wähle deine Sportart — Osss konfiguriert sich automatisch. Mit oder ohne Gürtelsystem.
            </motion.p>
          </Section>

          {/* Sport buttons */}
          <Section className="mb-8">
            <motion.div variants={staggerFast} className="flex flex-wrap justify-center gap-2">
              {SPORTS.map(s => (
                <motion.button
                  key={s.id}
                  variants={fadeUp}
                  onClick={() => setActiveSport(s.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                    activeSport === s.id
                      ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <span>{s.emoji}</span>
                  {s.label}
                </motion.button>
              ))}
            </motion.div>
          </Section>

          {/* Animated feature panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSport}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8"
            >
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                    sport.belt ? 'bg-amber-500/20' : 'bg-slate-500/20'
                  }`}>
                    {sport.emoji}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <h3 className="text-xl font-black text-white">{features.title}</h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      sport.belt
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                    }`}>
                      {sport.belt ? '🥋 Mit Gürtelsystem' : '🚫 Kein Gürtelsystem'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {features.items.map(item => (
                      <div key={item} className="flex items-center gap-2.5 text-sm">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                          sport.belt ? 'bg-amber-500/20' : 'bg-slate-600'
                        }`}>
                          {sport.belt
                            ? <Check size={10} className="text-amber-400" />
                            : <Check size={10} className="text-slate-400" />
                          }
                        </div>
                        <span className="text-slate-300">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 self-center md:self-start">
                  <Link href="/register"
                    className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap">
                    Jetzt testen <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* PAIN POINTS */}
      <Section className="py-16 px-5 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 variants={fadeUp} className="text-2xl font-black text-slate-900 mb-3">Kennst du das?</motion.h2>
          <motion.p variants={fadeUp} className="text-slate-500 mb-10 max-w-xl mx-auto">Die meisten Gym-Software-Lösungen sind zu teuer, zu komplex oder nicht auf Deutschland ausgelegt.</motion.p>
          <motion.div variants={staggerFast} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PAIN_POINTS.map(p => (
              <motion.div key={p.title} variants={fadeUp} className="bg-slate-50 rounded-2xl p-6 text-left">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                  <p.icon size={20} className="text-red-400" />
                </div>
                <p className="font-bold text-slate-900 mb-1">{p.title}</p>
                <p className="text-sm text-slate-500">{p.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section className="py-16 px-5 bg-amber-50">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2 variants={fadeUp} className="text-3xl font-black text-slate-900 mb-3">In 3 Schritten fertig</motion.h2>
          <motion.p variants={fadeUp} className="text-slate-500 mb-12 max-w-lg mx-auto">Kein langer Onboarding-Prozess. Du bist in unter 10 Minuten live.</motion.p>
          <motion.div variants={staggerFast} className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <motion.div key={step.num} variants={fadeUp} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-7 left-[calc(50%+2rem)] right-[-50%] h-px bg-amber-200" />
                )}
                <div className="bg-white rounded-2xl p-6 border border-amber-100 text-left relative z-10">
                  <span className="text-amber-400 font-black text-3xl">{step.num}</span>
                  <p className="font-bold text-slate-900 mt-2 mb-1">{step.title}</p>
                  <p className="text-sm text-slate-500">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* FEATURES */}
      <Section className="py-16 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <motion.h2 variants={fadeUp} className="text-3xl font-black text-slate-900 mb-3">Alles was dein Gym braucht</motion.h2>
            <motion.p variants={fadeUp} className="text-slate-500 max-w-lg mx-auto">Von der Mitgliederverwaltung bis zur automatischen Rechnung — in einer Software, ab €0/Monat.</motion.p>
          </div>
          <motion.div variants={staggerFast} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <motion.div key={f.title} variants={fadeUp}
                className="rounded-2xl border border-slate-200 p-6 hover:border-amber-300 hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-xl bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center mb-4 transition-colors">
                  <f.icon size={20} className="text-amber-600" />
                </div>
                <p className="font-bold text-slate-900 mb-1.5">{f.title}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* SCREENSHOT — Stundenplan */}
      <Section className="py-16 px-5 bg-slate-900 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="text-white">
              <motion.div variants={fadeUp} className="text-amber-400 font-bold text-sm mb-2 uppercase tracking-wider">Stundenplan</motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl font-black mb-4">Kursplan — auf deiner Website eingebettet</motion.h2>
              <motion.p variants={fadeUp} className="text-slate-300 mb-6 leading-relaxed">
                Stundenplan verwalten und per iframe direkt auf deiner Website einbetten. Deine Mitglieder sehen immer den aktuellen Plan.
              </motion.p>
              <motion.ul variants={staggerFast} className="space-y-2">
                {['Kalenderansicht nach Woche', 'Öffentlicher Embed-Link', 'iCal-Export', 'Online-Buchung für Mitglieder'].map(item => (
                  <motion.li key={item} variants={fadeUp} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle size={14} className="text-amber-400 flex-shrink-0" /> {item}
                  </motion.li>
                ))}
              </motion.ul>
            </div>
            <motion.div variants={fadeUp} className="rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
              <Image src="/screenshot_stundenplan.png" alt="Stundenplan" width={2912} height={896} className="w-full" />
            </motion.div>
          </div>
        </div>
      </Section>

      {/* DSGVO + Kleinunternehmer */}
      <Section className="py-16 px-5 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <motion.div variants={fadeUp} className="text-amber-600 font-bold text-sm mb-2 uppercase tracking-wider">Nur bei Osss</motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl font-black text-slate-900 mb-5">Gemacht für deutsche Gyms</motion.h2>
              <motion.div variants={staggerFast} className="space-y-5">
                {GERMAN_FEATURES.map(i => (
                  <motion.div key={i.title} variants={fadeUp} className="flex gap-4">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <i.icon size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{i.title}</p>
                      <p className="text-slate-500 text-sm">{i.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
            <motion.div variants={fadeUp} className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
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
                <CheckCircle size={12} /> Automatisch erstellt & archiviert
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* PRICING TEASER */}
      <Section className="py-16 px-5 bg-slate-50">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2 variants={fadeUp} className="text-3xl font-black text-slate-900 mb-3">Faire Preise. Kein Kleingedrucktes.</motion.h2>
          <motion.p variants={fadeUp} className="text-slate-600 mb-8">Starte kostenlos mit bis zu 30 Mitgliedern. Zahle erst wenn du wächst.</motion.p>
          <motion.div variants={staggerFast} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { name: 'Free',    price: '€0',  members: '30 Mitgl.' },
              { name: 'Starter', price: '€29', members: '50 Mitgl.' },
              { name: 'Grow',    price: '€59', members: '150 Mitgl.', highlight: true },
              { name: 'Pro',     price: '€99', members: 'Unbegrenzt' },
            ].map(p => (
              <motion.div key={p.name} variants={fadeUp}
                className={`rounded-xl p-4 border-2 text-center ${p.highlight ? 'border-amber-400 bg-amber-500 text-white' : 'border-slate-200 bg-white'}`}>
                <p className={`text-xs font-bold mb-1 ${p.highlight ? 'text-amber-100' : 'text-slate-500'}`}>{p.name}</p>
                <p className={`text-2xl font-black ${p.highlight ? 'text-white' : 'text-slate-900'}`}>{p.price}</p>
                <p className={`text-xs mt-1 ${p.highlight ? 'text-amber-100' : 'text-slate-400'}`}>{p.members}</p>
              </motion.div>
            ))}
          </motion.div>
          <motion.div variants={fadeUp}>
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-700 font-semibold text-sm transition-colors">
              Alle Features vergleichen <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </Section>

      {/* FINAL CTA */}
      <Section className="py-20 px-5 bg-slate-900 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <motion.h2 variants={fadeUp} className="text-4xl font-black mb-4">Bereit loszulegen?</motion.h2>
          <motion.p variants={fadeUp} className="text-slate-300 text-lg mb-8">Kostenlos starten, keine Kreditkarte nötig. Dein Gym läuft in 10 Minuten.</motion.p>
          <motion.div variants={fadeUp}>
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold px-10 py-4 rounded-xl text-lg transition-colors">
              <Zap size={18} /> Jetzt kostenlos starten
            </Link>
          </motion.div>
          <motion.p variants={fadeUp} className="text-slate-600 text-sm mt-4">Keine Kreditkarte · Keine Mindestlaufzeit · Jederzeit kündbar</motion.p>
        </div>
      </Section>

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
