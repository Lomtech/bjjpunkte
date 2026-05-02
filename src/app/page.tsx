'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { OsssLogo, LogoMark } from '@/components/Logo'
import {
  Users, CreditCard, Smartphone, Calendar, Target, Award,
  FileSpreadsheet, Globe, FileEdit, FileText, Shield, Headphones,
  CheckCircle, ArrowRight, Zap, Check,
} from 'lucide-react'

// ── Data ──────────────────────────────────────────────────────────────────────

type SportId = 'bjj' | 'judo' | 'karate' | 'mma' | 'muaythai' | 'boxing' | 'wrestling' | 'taekwondo'

const SPORTS: { id: SportId; label: string; belt: boolean }[] = [
  { id: 'bjj',       label: 'BJJ',       belt: true  },
  { id: 'judo',      label: 'Judo',      belt: true  },
  { id: 'karate',    label: 'Karate',    belt: true  },
  { id: 'taekwondo', label: 'Taekwondo', belt: true  },
  { id: 'mma',       label: 'MMA',       belt: false },
  { id: 'muaythai',  label: 'Muay Thai', belt: false },
  { id: 'boxing',    label: 'Boxen',     belt: false },
  { id: 'wrestling', label: 'Ringen',    belt: false },
]

const SPORT_FEATURES: Record<SportId, { title: string; items: string[] }> = {
  bjj:       { title: 'Für BJJ optimiert',          items: ['5-Gürtel-System (Weiß bis Schwarz)', 'Streifen-Tracking bis 4 Stufen', 'Gi / No-Gi Klassen-Typen', 'Promotions mit Verlauf & Datum'] },
  judo:      { title: 'Für Judo konfiguriert',      items: ['7-Stufen Kyu-System', 'Gelb bis Schwarz vorkonfiguriert', 'Wettkampf-Klassen-Typen', 'Dan-Grade frei erweiterbar'] },
  karate:    { title: 'Für Karate konfiguriert',    items: ['8 Kyu-Stufen vorkonfiguriert', 'Kata & Kumite Klassen-Typen', 'Prüfungsprotokoll per Promotion', 'Farben & Labels anpassbar'] },
  taekwondo: { title: 'Für Taekwondo konfiguriert', items: ['6 Gürtelfarben vorkonfiguriert', 'Poomse & Sparring Klassen', 'Prüfungsprotokoll', 'Dan-Grade frei erweiterbar'] },
  mma:       { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Fokus auf Anwesenheit & Zahlungen', 'Sparring & Klassen verwalten', 'Mitglieder-Portal ohne Gürtel'] },
  muaythai:  { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Pad Work & Sparring Klassen', 'Anwesenheit & Beiträge', 'Eigene Klassen-Typen konfigurierbar'] },
  boxing:    { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Boxklassen & Sparring verwalten', 'Wettkampf-Tracking per Notiz', 'Monatsbeiträge per Stripe'] },
  wrestling: { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Ringen & Freistil Klassen', 'Gewichtsklassen als Notiz', 'Anwesenheit & Mitglieder'] },
}

const PAIN_POINTS = [
  { icon: FileSpreadsheet, title: 'Excel & WhatsApp',   desc: 'Mitgliederlisten in Tabellen, Zahlungserinnerungen per Chat — fehleranfällig, zeitaufwändig, nicht skalierbar.' },
  { icon: Globe,           title: 'US-Tools für €200+', desc: 'Mindbody, Glofox & Co. — auf Englisch, ohne deutsches Rechnungswesen und ohne DSGVO-Compliance.' },
  { icon: FileEdit,        title: 'Rechnungen manuell', desc: 'Jeden Monat Rechnungen per Hand — besonders als Kleinunternehmer ein bürokratischer Albtraum.' },
]

const FEATURES = [
  { icon: Users,      title: 'Mitgliederverwaltung',   desc: 'Alle Mitglieder auf einen Blick. Gürtel-Tracking, Familienmitglieder, Notizen — alles an einem Ort.' },
  { icon: CreditCard, title: 'Zahlungen & Rechnungen', desc: 'Beiträge per Stripe einziehen. Automatische Rechnungen — DSGVO-konform, Kleinunternehmer-ready.' },
  { icon: Smartphone, title: 'Member-Portal',          desc: 'Deine Mitglieder checken per QR-Code ein, buchen Kurse und sehen ihre Trainingshistorie — ohne App.' },
  { icon: Calendar,   title: 'Stundenplan',             desc: 'Kursplan verwalten und direkt auf deiner Website einbetten. Inklusive iCal-Export für Google Calendar.' },
  { icon: Target,     title: 'Lead-Pipeline',           desc: 'Interessenten verfolgen von der ersten Anfrage bis zur Mitgliedschaft. Nie wieder einen Lead verlieren.' },
  { icon: Award,      title: 'Gürtel-Tracking',         desc: 'Promotions dokumentieren mit Datum und Verlauf — für alle Gürtelsysteme konfigurierbar.' },
]

const GERMAN_FEATURES = [
  { icon: FileText,   title: 'Kleinunternehmer-Rechnungen', desc: 'Automatische §19 UStG Rechnungen — du trägst einmal deine Daten ein, den Rest erledigt Osss.' },
  { icon: Shield,     title: 'DSGVO von Anfang an',         desc: 'Daten auf europäischen Servern. Einwilligungs-Tracking beim Mitglieds-Signup inklusive.' },
  { icon: Headphones, title: 'Support auf Deutsch',         desc: 'Kein englisches Support-Ticket. Direkt, schnell, verständlich — support@osss.pro.' },
]

const STEPS = [
  { num: '01', title: 'Konto erstellen',        desc: 'In 2 Minuten registriert — kostenlos, keine Kreditkarte.' },
  { num: '02', title: 'Mitglieder importieren', desc: 'CSV-Upload oder manuell eintragen. Bestehende Daten kommen direkt rein.' },
  { num: '03', title: 'Gym läuft',              desc: 'Zahlungen, Stundenplan, Portale — alles sofort einsatzbereit.' },
]

const MARQUEE_ITEMS = [
  'BJJ', 'MMA', 'Judo', 'Karate', 'Muay Thai', 'Boxen', 'Ringen', 'Taekwondo',
  'Hamburg', 'München', 'Berlin', 'Köln', 'Frankfurt', 'Stuttgart', 'Leipzig', 'Dresden',
  'BJJ', 'MMA', 'Judo', 'Karate', 'Muay Thai', 'Boxen', 'Ringen', 'Taekwondo',
  'Hamburg', 'München', 'Berlin', 'Köln', 'Frankfurt', 'Stuttgart', 'Leipzig', 'Dresden',
]

// ── Variants ──────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
}
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.07 } },
}

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.section ref={ref} variants={stagger} initial="hidden" animate={inView ? 'show' : 'hidden'} className={className}>
      {children}
    </motion.section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [checked, setChecked]   = useState(false)
  const [activeSport, setActiveSport] = useState<SportId>('bjj')

  useEffect(() => {
    try {
      createClient().auth.getSession().then(({ data: { session } }) => {
        setLoggedIn(!!session); setChecked(true)
      })
    } catch { setChecked(true) }
  }, [])

  const features = SPORT_FEATURES[activeSport]
  const hasBelt  = SPORTS.find(s => s.id === activeSport)?.belt ?? false

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">

      {/* ── NAV ── */}
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100"
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <OsssLogo variant="light" />
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden sm:block">Preise</Link>
            <a href="mailto:support@osss.pro" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden md:block">Kontakt</a>
            {checked && (loggedIn
              ? <Link href="/dashboard" className="bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-2 rounded-lg transition-colors">Dashboard</Link>
              : <>
                  <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden sm:block">Anmelden</Link>
                  <Link href="/register" className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">Kostenlos starten</Link>
                </>
            )}
          </div>
        </div>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative bg-white overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[88vh]">

          {/* Left — text */}
          <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20 py-20 lg:py-24 relative">
            {/* Soft amber glow */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 0% 0%, rgba(251,191,36,0.07) 0%, transparent 70%)' }} />

            <motion.div variants={stagger} initial="hidden" animate="show" className="relative max-w-xl">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-8">
                <Shield size={11} className="text-amber-600" />
                <span className="text-amber-700 text-xs font-semibold tracking-wide">Made in Germany · DSGVO-konform</span>
              </motion.div>

              <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-[4.5rem] xl:text-[5rem] font-black tracking-tighter leading-[0.9] mb-6 text-zinc-950">
                Schluss mit Excel.<br />
                <span className="text-amber-500">Dein Gym läuft</span><br />
                in 10 Minuten.
              </motion.h1>

              <motion.p variants={fadeUp} className="text-zinc-500 text-lg mb-8 leading-relaxed">
                Mitglieder, Beiträge, Stundenplan — alles in einer Software. Auf Deutsch. Für Kampfsport-Gyms.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link href="/register"
                  className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/20">
                  <Zap size={16} className="text-amber-400" />
                  Jetzt kostenlos starten
                </Link>
                <Link href="/pricing"
                  className="border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold px-8 py-3.5 rounded-xl text-base transition-all flex items-center justify-center gap-2">
                  Preise ansehen <ArrowRight size={15} />
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} className="flex flex-wrap gap-x-7 gap-y-3">
                {[
                  { val: '€0',     label: 'Startkosten' },
                  { val: '10 Min', label: 'Setup' },
                  { val: '2%',     label: 'Plattformgebühr' },
                  { val: 'DSGVO',  label: 'konform' },
                ].map(s => (
                  <div key={s.label}>
                    <span className="text-zinc-950 font-black text-lg tracking-tight">{s.val}</span>
                    <span className="text-zinc-400 text-xs ml-1.5 tracking-wide">{s.label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>

          {/* Right — photo */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden lg:block"
          >
            <Image
              src="/tournament-podium.jpg"
              alt="Wettkampf Siegerehrung"
              fill
              className="object-cover object-top"
              priority
            />
            {/* Left fade to white */}
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.15) 0%, transparent 20%)' }} />
            {/* Bottom caption */}
            <div className="absolute bottom-8 left-8">
              <span className="text-white text-xs font-bold bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                Spring Nationals · Podium
              </span>
            </div>
          </motion.div>

          {/* Mobile: photo below text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative lg:hidden h-72 sm:h-96"
          >
            <Image
              src="/tournament-podium.jpg"
              alt="Wettkampf Siegerehrung"
              fill
              className="object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent" />
          </motion.div>

        </div>
      </section>

      {/* ── TRUST MARQUEE ── */}
      <div className="bg-zinc-50 border-y border-zinc-100 py-5 overflow-hidden">
        <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em] text-center mb-3">
          Von Kampfsport-Gyms in ganz Deutschland genutzt
        </p>
        <div className="relative overflow-hidden">
          <div className="animate-marquee">
            {MARQUEE_ITEMS.map((item, i) => (
              <span key={i} className="inline-flex items-center mx-5 text-zinc-400 text-sm font-medium whitespace-nowrap">
                <span className="inline-block w-1 h-1 rounded-full bg-amber-400 mr-5" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── PHOTO SECTION ── */}
      <section className="relative h-[55vh] min-h-[380px] overflow-hidden">
        <video
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover object-center"
        >
          <source src="/competition-mat.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-zinc-950/55" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5">
          <p className="text-amber-400 font-bold text-[10px] uppercase tracking-[0.25em] mb-4">Echtes Training. Echter Wettkampf.</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight max-w-xl">
            Für Gyms, die gewinnen wollen.
          </h2>
          <p className="text-zinc-300 text-sm mt-5 max-w-sm leading-relaxed">
            Osss hält den Alltag im Griff — damit du dich aufs Training konzentrieren kannst.
          </p>
        </div>
        <div className="absolute bottom-5 right-5">
          <span className="text-white text-xs font-bold bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
            Wettkampf · Submission Grappling
          </span>
        </div>
      </section>

      {/* ── SPORTS ── */}
      <section className="bg-zinc-50 px-5 py-24 border-b border-zinc-100">
        <div className="max-w-5xl mx-auto">
          <Section className="text-center mb-12">
            <motion.p variants={fadeUp} className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">Für jede Kampfsportart</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">Was trainierst du?</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-sm mx-auto text-sm leading-relaxed">
              Osss konfiguriert sich automatisch — mit oder ohne Gürtelsystem.
            </motion.p>
          </Section>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {SPORTS.map(s => (
              <button key={s.id} onClick={() => setActiveSport(s.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold tracking-wide transition-all border ${
                  activeSport === s.id
                    ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                    : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-800'
                }`}>
                {s.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeSport}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white border border-zinc-200 rounded-2xl p-7 md:p-9 shadow-sm"
            >
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-5 flex-wrap">
                    <h3 className="text-xl font-black text-zinc-950">{features.title}</h3>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border tracking-wide ${
                      hasBelt ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                    }`}>
                      {hasBelt ? 'Mit Gürtelsystem' : 'Ohne Gürtelsystem'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {features.items.map(item => (
                      <div key={item} className="flex items-start gap-3 text-sm">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          hasBelt ? 'bg-amber-100' : 'bg-zinc-100'
                        }`}>
                          <Check size={9} className={hasBelt ? 'text-amber-600' : 'text-zinc-400'} />
                        </div>
                        <span className="text-zinc-600 leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 self-end md:self-center">
                  <Link href="/register"
                    className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap">
                    Jetzt testen <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── PAIN POINTS ── */}
      <Section className="py-24 px-5 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">Das Problem</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">Kennst du das?</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              Die meisten Gym-Softwares sind zu teuer, zu komplex oder nicht auf Deutschland ausgelegt.
            </motion.p>
          </div>
          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PAIN_POINTS.map(p => (
              <motion.div key={p.title} variants={fadeUp} className="bg-zinc-50 rounded-2xl p-7 border border-zinc-100">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-5">
                  <p.icon size={18} className="text-red-500" />
                </div>
                <p className="font-bold text-zinc-900 mb-2">{p.title}</p>
                <p className="text-sm text-zinc-500 leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ── HOW IT WORKS ── */}
      <Section className="py-24 px-5 bg-amber-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-amber-700 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">So einfach geht&apos;s</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">In 3 Schritten fertig</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-sm mx-auto text-sm leading-relaxed">
              Kein langer Onboarding-Prozess. Du bist in unter 10 Minuten live.
            </motion.p>
          </div>
          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {STEPS.map(step => (
              <motion.div key={step.num} variants={fadeUp}>
                <div className="bg-white rounded-2xl p-7 border border-amber-100 shadow-sm h-full">
                  <div className="text-amber-500 font-black text-4xl tracking-tighter leading-none mb-5">{step.num}</div>
                  <p className="font-bold text-zinc-900 mb-2">{step.title}</p>
                  <p className="text-sm text-zinc-500 leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ── FEATURES ── */}
      <Section className="py-24 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <motion.p variants={fadeUp} className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">Features</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">Alles was dein Gym braucht</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              Von der Mitgliederverwaltung bis zur automatischen Rechnung — in einer Software.
            </motion.p>
          </div>
          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <motion.div key={f.title} variants={fadeUp}
                className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-7 hover:border-amber-200 hover:bg-white hover:shadow-sm transition-all duration-200 group">
                <div className="w-10 h-10 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center mb-5 transition-colors">
                  <f.icon size={18} className="text-amber-700" />
                </div>
                <p className="font-bold text-zinc-900 mb-2">{f.title}</p>
                <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ── SCHEDULE SCREENSHOT ── */}
      <Section className="py-24 px-5 bg-zinc-50 overflow-hidden border-y border-zinc-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            <div>
              <motion.p variants={fadeUp} className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">Stundenplan</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-5">
                Kursplan direkt auf deiner Website
              </motion.h2>
              <motion.p variants={fadeUp} className="text-zinc-500 mb-8 leading-relaxed text-sm">
                Stundenplan verwalten und per iframe einbetten. Mitglieder sehen immer den aktuellen Plan — ohne Pflege einer zweiten Seite.
              </motion.p>
              <motion.ul variants={stagger} className="space-y-3.5">
                {['Wochenansicht mit Kursdetails', 'Öffentlicher Embed-Link', 'iCal-Export für Google Calendar', 'Online-Buchung für Mitglieder'].map(item => (
                  <motion.li key={item} variants={fadeUp} className="flex items-center gap-3 text-sm text-zinc-700">
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={11} className="text-amber-600" />
                    </div>
                    {item}
                  </motion.li>
                ))}
              </motion.ul>
            </div>
            <motion.div variants={fadeUp} className="rounded-2xl overflow-hidden border border-zinc-200 shadow-xl shadow-zinc-200/60">
              <Image src="/screenshot_stundenplan.png" alt="Stundenplan" width={2912} height={896} className="w-full" />
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── GERMAN FEATURES ── */}
      <Section className="py-24 px-5 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            <div>
              <motion.p variants={fadeUp} className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">Nur bei Osss</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-8">
                Gemacht für<br />deutsche Gyms
              </motion.h2>
              <motion.div variants={stagger} className="space-y-6">
                {GERMAN_FEATURES.map(item => (
                  <motion.div key={item.title} variants={fadeUp} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                      <item.icon size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900 mb-1">{item.title}</p>
                      <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Invoice card — light version */}
            <motion.div variants={fadeUp} className="bg-zinc-50 rounded-2xl p-7 border border-zinc-200">
              <div className="flex items-center gap-3 mb-6 pb-5 border-b border-zinc-200">
                <div className="w-9 h-9 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
                  <LogoMark className="w-4 h-3 text-zinc-950" />
                </div>
                <div>
                  <p className="text-zinc-900 font-bold text-sm">Osss</p>
                  <p className="text-zinc-400 text-xs">Automatische Rechnung</p>
                </div>
                <div className="ml-auto">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">Bezahlt</span>
                </div>
              </div>
              <div className="space-y-3.5">
                {[
                  ['Rechnungsnummer', 'OSS-2026-047'],
                  ['Mitglied',        'Max Mustermann'],
                  ['Leistung',        'Monatsbeitrag Mai 2026'],
                  ['Betrag',          '€ 89,00'],
                  ['Steuerhinweis',   '§19 UStG — keine USt.'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm border-b border-zinc-200/80 pb-3.5">
                    <span className="text-zinc-400">{label}</span>
                    <span className="text-zinc-900 font-medium">{val}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 text-emerald-700 text-xs font-semibold">
                <CheckCircle size={12} />
                Automatisch erstellt und archiviert
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── PRICING TEASER ── */}
      <Section className="py-24 px-5 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <motion.p variants={fadeUp} className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">Preise</motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">Faire Preise. Kein Kleingedrucktes.</motion.h2>
          <motion.p variants={fadeUp} className="text-zinc-500 mb-10 text-sm leading-relaxed">Starte kostenlos mit bis zu 30 Mitgliedern. Zahle erst wenn du wächst.</motion.p>
          <motion.div variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { name: 'Free',    price: '€0',  members: '30 Mitgl.',  highlight: false },
              { name: 'Starter', price: '€29', members: '50 Mitgl.',  highlight: false },
              { name: 'Grow',    price: '€59', members: '150 Mitgl.', highlight: true  },
              { name: 'Pro',     price: '€99', members: 'Unbegrenzt', highlight: false },
            ].map(p => (
              <motion.div key={p.name} variants={fadeUp}
                className={`rounded-2xl p-5 border-2 text-center transition-all ${
                  p.highlight ? 'border-amber-400 bg-amber-400 shadow-lg shadow-amber-100' : 'border-zinc-100 bg-zinc-50 hover:border-zinc-200'
                }`}>
                <p className={`text-[11px] font-bold mb-1 tracking-wide uppercase ${p.highlight ? 'text-zinc-950/60' : 'text-zinc-400'}`}>{p.name}</p>
                <p className={`text-2xl font-black tracking-tight ${p.highlight ? 'text-zinc-950' : 'text-zinc-900'}`}>{p.price}</p>
                <p className={`text-xs mt-1 ${p.highlight ? 'text-zinc-950/60' : 'text-zinc-400'}`}>{p.members}</p>
              </motion.div>
            ))}
          </motion.div>
          <motion.div variants={fadeUp}>
            <Link href="/pricing" className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-700 font-semibold text-sm transition-colors">
              Alle Features im Detail vergleichen <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </Section>

      {/* ── FINAL CTA — full amber ── */}
      <section className="py-28 px-5 bg-amber-400 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 110%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
        <div className="max-w-xl mx-auto relative">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-zinc-950 mb-5">Bereit loszulegen?</h2>
          <p className="text-zinc-800 text-lg mb-10 leading-relaxed">
            Dein Gym läuft in 10 Minuten.<br />Keine Kreditkarte, keine Mindestlaufzeit.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-10 py-4 rounded-xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/25">
            <Zap size={18} className="text-amber-400" />
            Jetzt kostenlos starten
          </Link>
          <p className="text-zinc-700 text-xs mt-5 tracking-wide">Keine Kreditkarte · Keine Mindestlaufzeit · Jederzeit kündbar</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-zinc-100">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-10 mb-12">
            <div className="sm:col-span-2">
              <OsssLogo variant="light" />
              <p className="text-zinc-400 text-sm mt-4 leading-relaxed max-w-xs">
                Die Gym-Management-Software für Kampfsport — auf Deutsch, DSGVO-konform, ab €0.
              </p>
            </div>
            <div>
              <p className="font-bold text-zinc-900 text-sm mb-4 tracking-wide">Produkt</p>
              <ul className="space-y-3">
                {[{ label: 'Preise', href: '/pricing' }, { label: 'Anmelden', href: '/login' }, { label: 'Registrieren', href: '/register' }].map(l => (
                  <li key={l.label}><Link href={l.href} className="text-zinc-500 hover:text-zinc-900 text-sm transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-bold text-zinc-900 text-sm mb-4 tracking-wide">Rechtliches</p>
              <ul className="space-y-3">
                {[{ label: 'Datenschutz', href: '/datenschutz' }, { label: 'Impressum', href: '/impressum' }, { label: 'Kontakt', href: 'mailto:support@osss.pro' }].map(l => (
                  <li key={l.label}><Link href={l.href} className="text-zinc-500 hover:text-zinc-900 text-sm transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-zinc-400 text-xs">© {new Date().getFullYear()} Osss · Die Kampfsport-Gym-Software</p>
            <p className="text-zinc-300 text-xs">Made in Germany · DSGVO-konform · Daten auf EU-Servern</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
