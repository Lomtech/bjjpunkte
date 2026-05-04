'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, useInView, useScroll, useTransform } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { OsssLogo, LogoMark } from '@/components/Logo'
import {
  Users, CreditCard, Smartphone, Calendar, Target, Award,
  FileSpreadsheet, Globe, FileEdit, FileText, Shield, Headphones,
  CheckCircle, ArrowRight, Zap, Check, Menu, X,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

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
  { icon: Calendar,   title: 'Stundenplan & Gym-Seite', desc: 'Kursplan verwalten und als öffentliche Gym-Seite teilen. Interessenten sehen direkt alles — inkl. iCal-Export.' },
  { icon: Target,     title: 'Lead-Pipeline',           desc: 'Interessenten verfolgen von der ersten Anfrage bis zur Mitgliedschaft. Nie wieder einen Lead verlieren.' },
  { icon: Award,      title: 'Gürtel-Tracking',         desc: 'Promotions dokumentieren mit Datum und Verlauf — für alle Gürtelsysteme konfigurierbar.' },
]

const GERMAN_FEATURES = [
  { icon: FileText,   title: 'Kleinunternehmer-Rechnungen', desc: 'Automatische §19 UStG Rechnungen — du trägst einmal deine Daten ein, den Rest erledigt Osss.' },
  { icon: Shield,     title: 'DSGVO von Anfang an',         desc: 'Daten auf europäischen Servern (Supabase EU). Keine Weitergabe an Dritte. Datenschutzerklärung inklusive.' },
  { icon: Headphones, title: 'Support auf Deutsch',         desc: 'Kein englisches Support-Ticket. Direkt, schnell, verständlich — oss@osss.pro.' },
]

const STEPS = [
  { num: '01', title: 'Konto erstellen',        desc: 'In 2 Minuten registriert — kostenlos, keine Kreditkarte.' },
  { num: '02', title: 'Mitglieder importieren', desc: 'CSV-Upload oder manuell eintragen. Bestehende Daten kommen direkt rein.' },
  { num: '03', title: 'Gym läuft',              desc: 'Zahlungen, Stundenplan, Portale — alles sofort einsatzbereit.' },
]

const MARQUEE_ITEMS_DE = [
  'BJJ', 'MMA', 'Judo', 'Karate', 'Muay Thai', 'Boxen', 'Ringen', 'Taekwondo',
  'Hamburg', 'München', 'Berlin', 'Köln', 'Frankfurt', 'Stuttgart', 'Leipzig', 'Dresden',
  'BJJ', 'MMA', 'Judo', 'Karate', 'Muay Thai', 'Boxen', 'Ringen', 'Taekwondo',
  'Hamburg', 'München', 'Berlin', 'Köln', 'Frankfurt', 'Stuttgart', 'Leipzig', 'Dresden',
]
const MARQUEE_ITEMS_EN = [
  'BJJ', 'MMA', 'Judo', 'Karate', 'Muay Thai', 'Boxing', 'Wrestling', 'Taekwondo',
  'Hamburg', 'Munich', 'Berlin', 'Cologne', 'Frankfurt', 'Stuttgart', 'Leipzig', 'Dresden',
  'BJJ', 'MMA', 'Judo', 'Karate', 'Muay Thai', 'Boxing', 'Wrestling', 'Taekwondo',
  'Hamburg', 'Munich', 'Berlin', 'Cologne', 'Frankfurt', 'Stuttgart', 'Leipzig', 'Dresden',
]

// ── Variants ──────────────────────────────────────────────────────────────────

// Schärfere Kurve: schneller rein, präzises Easing, leichter Blur für Tiefe
const EASE = [0.16, 1, 0.3, 1] as const
const fadeUp = {
  hidden: { opacity: 0, y: 16, scale: 0.985, filter: 'blur(3px)' },
  show:   { opacity: 1, y: 0,  scale: 1,     filter: 'blur(0px)',
    transition: { duration: 0.48, ease: EASE } },
}
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.055 } },
}

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [appInstalled, setAppInstalled] = useState(false)

  useEffect(() => {
    try {
      createClient().auth.getSession().then(({ data: { session } }) => {
        setLoggedIn(!!session); setChecked(true)
      })
    } catch { setChecked(true) }
  }, [])

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) { setAppInstalled(true); return }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIos) { setInstallPrompt('ios'); return }
    function onBeforeInstall(e: Event) { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  async function handleInstallClick() {
    if (installPrompt === 'ios') { setShowIosHint(true); return }
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setAppInstalled(true)
  }

  const { scrollY } = useScroll()
  const mobileImgOpacity  = useTransform(scrollY, [0, 280], [1, 0])
  const mobileImgY        = useTransform(scrollY, [0, 400], [0, -55])
  const mobileImgScale    = useTransform(scrollY, [0, 400], [1, 1.08])
  const podiumParallaxY   = useTransform(scrollY, [0, 1400], [0, 140])
  const podiumTextY       = useTransform(scrollY, [500, 1100], [0, -50])
  const dashboardImgY     = useTransform(scrollY, [1000, 1900], [60, -30])
  const videoParallaxY    = useTransform(scrollY, [1600, 2600], [0, 80])
  const videoScale        = useTransform(scrollY, [1600, 2200], [1.08, 1.0])

  const { lang } = useLanguage()

  const PAIN_POINTS_DATA = lang === 'en' ? [
    { icon: FileSpreadsheet, title: 'Excel & WhatsApp',  desc: 'Member lists in spreadsheets, payment reminders via chat — error-prone, time-consuming, not scalable.' },
    { icon: Globe,           title: 'US tools for €200+', desc: 'Mindbody, Glofox & co. — in English, without German invoicing or GDPR compliance.' },
    { icon: FileEdit,        title: 'Manual invoicing',   desc: 'Creating invoices by hand every month — a bureaucratic nightmare, especially for small businesses.' },
  ] : PAIN_POINTS

  const FEATURES_DATA = lang === 'en' ? [
    { icon: Users,      title: 'Member management',    desc: 'All members at a glance. Belt tracking, family members, notes — everything in one place.' },
    { icon: CreditCard, title: 'Payments & invoices',  desc: 'Collect dues via Stripe. Automatic invoices — GDPR-compliant, small-business ready.' },
    { icon: Smartphone, title: 'Member portal',        desc: 'Members check in via QR code, book classes and view their training history — no app needed.' },
    { icon: Calendar,   title: 'Schedule & gym page',  desc: 'Manage your timetable and share it as a public gym page. Prospects see everything — including iCal export.' },
    { icon: Target,     title: 'Lead pipeline',        desc: 'Track prospects from first enquiry to membership. Never lose a lead again.' },
    { icon: Award,      title: 'Belt tracking',        desc: 'Document promotions with date and history — configurable for all belt systems.' },
  ] : FEATURES

  const GERMAN_FEATURES_DATA = lang === 'en' ? [
    { icon: FileText,   title: 'German-compliant invoices', desc: 'Automatic §19 UStG invoices — enter your details once and Osss handles the rest.' },
    { icon: Shield,     title: 'GDPR from day one',         desc: 'Data on European servers (Supabase EU). No third-party sharing. Privacy policy included.' },
    { icon: Headphones, title: 'Support in your language',  desc: 'No English-only support ticket. Direct, fast, understandable — oss@osss.pro.' },
  ] : GERMAN_FEATURES

  const STEPS_DATA = lang === 'en' ? [
    { num: '01', title: 'Create account',     desc: 'Registered in 2 minutes — free, no credit card.' },
    { num: '02', title: 'Import members',     desc: 'CSV upload or manual entry. Existing data comes straight in.' },
    { num: '03', title: 'Your gym is live',   desc: 'Payments, schedule, portals — everything ready to go.' },
  ] : STEPS

  const SPORT_FEATURES_DATA: Record<SportId, { title: string; items: string[] }> = lang === 'en' ? {
    bjj:       { title: 'Optimised for BJJ',       items: ['5-belt system (White to Black)', 'Stripe tracking up to 4 levels', 'Gi / No-Gi class types', 'Promotions with history & date'] },
    judo:      { title: 'Configured for Judo',      items: ['7-level Kyu system', 'Yellow to Black pre-configured', 'Competition class types', 'Dan grades freely extendable'] },
    karate:    { title: 'Configured for Karate',    items: ['8 Kyu levels pre-configured', 'Kata & Kumite class types', 'Exam log per promotion', 'Colours & labels customisable'] },
    taekwondo: { title: 'Configured for Taekwondo', items: ['6 belt colours pre-configured', 'Poomsae & Sparring classes', 'Exam log', 'Dan grades freely extendable'] },
    mma:       { title: 'No belt system needed',    items: ['Belt tracking disabled', 'Focus on attendance & payments', 'Manage sparring & classes', 'Member portal without belts'] },
    muaythai:  { title: 'No belt system needed',    items: ['Belt tracking disabled', 'Pad work & sparring classes', 'Attendance & dues', 'Custom class types configurable'] },
    boxing:    { title: 'No belt system needed',    items: ['Belt tracking disabled', 'Manage boxing classes & sparring', 'Competition tracking via notes', 'Monthly dues via Stripe'] },
    wrestling: { title: 'No belt system needed',    items: ['Belt tracking disabled', 'Wrestling & freestyle classes', 'Weight classes as notes', 'Attendance & members'] },
  } : SPORT_FEATURES

  const features = SPORT_FEATURES_DATA[activeSport]
  const hasBelt  = SPORTS.find(s => s.id === activeSport)?.belt ?? false

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">

      {/* ── NAV ── */}
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100"
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <OsssLogo variant="dark" />
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden sm:block">{lang === 'en' ? 'Pricing' : 'Preise'}</Link>
            <a href="mailto:oss@osss.pro" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden md:block">{lang === 'en' ? 'Contact' : 'Kontakt'}</a>
            <LanguageSwitcher variant="minimal" />
            {checked && (loggedIn
              ? <Link href="/dashboard" className="bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-2 rounded-lg transition-colors">Dashboard</Link>
              : <>
                  <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden sm:block">{lang === 'en' ? 'Log in' : 'Anmelden'}</Link>
                  <Link href="/register" className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors hidden sm:block">{lang === 'en' ? 'Get started free' : 'Kostenlos starten'}</Link>
                </>
            )}
            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-zinc-100 transition-colors"
              aria-label="Menü"
            >
              {menuOpen ? <X size={20} className="text-zinc-700" /> : <Menu size={20} className="text-zinc-700" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="sm:hidden border-t border-zinc-100 bg-white px-5 py-4 flex flex-col gap-1"
            >
              <Link href="/pricing" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50 transition-colors">{lang === 'en' ? 'Pricing' : 'Preise'}</Link>
              <a href="mailto:oss@osss.pro" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50 transition-colors">{lang === 'en' ? 'Contact' : 'Kontakt'}</a>
              {checked && !loggedIn && (
                <Link href="/login" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50 transition-colors">{lang === 'en' ? 'Log in' : 'Anmelden'}</Link>
              )}
              <div className="pt-1">
                {checked && (loggedIn
                  ? <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block text-center bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-3 rounded-xl transition-colors">Dashboard</Link>
                  : <Link href="/register" onClick={() => setMenuOpen(false)} className="block text-center bg-zinc-950 hover:bg-zinc-800 text-white text-sm font-bold px-4 py-3 rounded-xl transition-colors">{lang === 'en' ? 'Get started free' : 'Kostenlos starten'}</Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── HERO ── */}
      <section className="relative bg-white overflow-hidden">

        {/* Mobile ghost photo — dissolves as you scroll */}
        <motion.div
          className="lg:hidden absolute top-0 left-0 right-0 h-[82vw] z-0 pointer-events-none"
          style={{ opacity: mobileImgOpacity, y: mobileImgY, scale: mobileImgScale }}
        >
          <Image
            src="/tournament-podium.jpg"
            alt="Wettkampf Siegerehrung"
            fill
            className="object-cover object-top"
            priority
          />
          {/* Dissolve gradient — top clear, bottom melts into white */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0.5) 60%, rgba(255,255,255,0.88) 75%, rgba(255,255,255,1) 90%)'
          }} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[88vh]">

          {/* Left — text */}
          <div className="flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20 pt-[68vw] pb-14 lg:py-24 relative">
            {/* Soft amber glow */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 0% 0%, rgba(251,191,36,0.07) 0%, transparent 70%)' }} />

            <motion.div variants={stagger} initial="hidden" animate="show" className="relative max-w-xl">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-8">
                <Shield size={11} className="text-amber-600" />
                <span className="text-amber-700 text-xs font-semibold tracking-wide">{lang === 'en' ? 'For martial arts gyms' : 'Für Kampfsport-Gyms'}</span>
              </motion.div>

              <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-[4.5rem] xl:text-[5rem] font-black tracking-tighter leading-[0.9] mb-6 text-zinc-950">
                {lang === 'en' ? <>No more spreadsheets.<br /><span className="text-amber-500">Your gym is live</span><br />in 10 minutes.</> : <>Schluss mit Excel.<br /><span className="text-amber-500">Dein Gym läuft</span><br />in 10 Minuten.</>}
              </motion.h1>

              <motion.p variants={fadeUp} className="text-zinc-500 text-lg mb-8 leading-relaxed">
                {lang === 'en' ? 'Members, dues, schedule — all in one software. In your language. For martial arts gyms.' : 'Mitglieder, Beiträge, Stundenplan — alles in einer Software. Auf Deutsch. Für Kampfsport-Gyms.'}
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link href="/register"
                  className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/20">
                  <Zap size={16} className="text-amber-400" />
                  {lang === 'en' ? 'Get started free' : 'Jetzt kostenlos starten'}
                </Link>
                <Link href="/pricing"
                  className="border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold px-8 py-3.5 rounded-xl text-base transition-all flex items-center justify-center gap-2">
                  {lang === 'en' ? 'View pricing' : 'Preise ansehen'} <ArrowRight size={15} />
                </Link>
                {!appInstalled && installPrompt !== null && (
                  <button onClick={handleInstallClick}
                    className="border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold px-8 py-3.5 rounded-xl text-base transition-all flex items-center justify-center gap-2">
                    {lang === 'en' ? 'Download app' : 'App herunterladen'} <ArrowRight size={15} />
                  </button>
                )}
              </motion.div>

              {showIosHint && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowIosHint(false)}>
                  <div className="bg-white rounded-t-3xl w-full max-w-sm px-6 pt-6 pb-10 shadow-xl" onClick={e => e.stopPropagation()}>
                    <div className="w-10 h-1 rounded-full bg-zinc-200 mx-auto mb-6" />
                    <h3 className="text-lg font-bold text-zinc-900 mb-1">{lang === 'en' ? 'Install Osss app' : 'Osss App installieren'}</h3>
                    <p className="text-zinc-500 text-sm mb-5">{lang === 'en' ? 'How it works on iPhone:' : 'So geht\'s auf dem iPhone:'}</p>
                    <ol className="space-y-3 text-sm text-zinc-700">
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                        <span>{lang === 'en' ? <>Tap the <strong>Share icon</strong> <span className="inline-block bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">⬆</span> in the browser toolbar</> : <>Tippe auf das <strong>Teilen-Symbol</strong> <span className="inline-block bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">⬆</span> in der Browserleiste</>}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                        <span>{lang === 'en' ? <>Scroll and tap <strong>"Add to Home Screen"</strong></> : <>Scrolle und tippe auf <strong>„Zum Home-Bildschirm"</strong></>}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                        <span>{lang === 'en' ? <>Tap <strong>"Add"</strong> in the top right</> : <>Oben rechts auf <strong>„Hinzufügen"</strong> tippen</>}</span>
                      </li>
                    </ol>
                    <button onClick={() => setShowIosHint(false)} className="mt-6 w-full py-3 rounded-2xl bg-zinc-900 text-white text-sm font-semibold">
                      {lang === 'en' ? 'Got it' : 'Verstanden'}
                    </button>
                  </div>
                </div>
              )}

              <motion.div variants={fadeUp} className="flex flex-wrap gap-x-7 gap-y-3">
                {(lang === 'en' ? [
                  { val: '€0',     label: 'Setup cost' },
                  { val: '10 min', label: 'Setup' },
                  { val: '0%',     label: 'Osss transaction fee' },
                  { val: 'GDPR',   label: 'compliant' },
                ] : [
                  { val: '€0',     label: 'Startkosten' },
                  { val: '10 Min', label: 'Setup' },
                  { val: '0%',     label: 'Osss-Transaktionsgebühr' },
                  { val: 'DSGVO',  label: 'konform' },
                ]).map(s => (
                  <div key={s.label}>
                    <span className="text-zinc-950 font-black text-lg tracking-tight">{s.val}</span>
                    <span className="text-zinc-400 text-xs ml-1.5 tracking-wide">{s.label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>

          {/* Right — Dashboard Screenshot + Podium float */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
            className="relative hidden lg:flex items-start justify-center bg-zinc-50 overflow-hidden pt-10"
          >
            {/* Dot grid background */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle, rgba(251,191,36,0.08) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, rgba(255,255,255,0.6) 0%, transparent 15%, transparent 85%, rgba(255,255,255,0.3) 100%)' }} />

            {/* Browser frame — pushed slightly left + up */}
            <div className="relative w-[88%] -ml-6 rounded-t-xl overflow-hidden shadow-2xl shadow-zinc-300/60 border border-zinc-200/80 ring-1 ring-zinc-200/50 z-10">
              <div className="bg-zinc-100 border-b border-zinc-200 px-4 py-2.5 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-3 bg-white rounded-md px-3 py-1 text-[10px] text-zinc-400 font-mono border border-zinc-200">
                  app.osss.pro/dashboard
                </div>
              </div>
              <Image
                src="/screenshot_betrieb.png"
                alt="Osss Dashboard — Mitgliederverwaltung, Zahlungen, Belt-Verteilung"
                width={1796}
                height={876}
                className="w-full"
                priority
              />
            </div>

            {/* Podium floating card */}
            <motion.div
              initial={{ opacity: 0, y: 60, rotate: -2 }}
              animate={{ opacity: 1, y: 0, rotate: -2 }}
              transition={{ duration: 0.9, delay: 0.65, ease: EASE }}
              className="absolute bottom-12 right-4 xl:right-8 z-20 w-[42%] xl:w-[38%]"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="relative rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.22)] border-[3px] border-white ring-1 ring-zinc-200/50"
              >
                <Image
                  src="/tournament-podium.jpg"
                  alt="Athleten auf dem Siegerpodest"
                  width={800}
                  height={600}
                  className="w-full object-cover object-top"
                />
                {/* Subtle amber overlay at bottom */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(to top, rgba(251,191,36,0.18) 0%, transparent 50%)' }} />
                {/* Badge */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                    <Award size={12} className="text-zinc-950" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-zinc-900 leading-tight">{lang === 'en' ? 'For competitors' : 'Für Wettkämpfer'}</p>
                    <p className="text-[9px] text-zinc-400 leading-tight">{lang === 'en' ? 'Promotions · History · Data' : 'Promotions · Verlauf · Daten'}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>

          </motion.div>

        </div>
      </section>

      {/* ── TRUST MARQUEE ── */}
      <div className="bg-zinc-50 border-y border-zinc-100 py-5 overflow-hidden">
        <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em] text-center mb-3">
          {lang === 'en' ? 'For martial arts gyms across Germany' : 'Für Kampfsport-Gyms in ganz Deutschland'}
        </p>
        <div className="relative overflow-hidden">
          <div className="animate-marquee">
            {(lang === 'en' ? MARQUEE_ITEMS_EN : MARQUEE_ITEMS_DE).map((item, i) => (
              <span key={i} className="inline-flex items-center mx-5 text-zinc-400 text-sm font-medium whitespace-nowrap">
                <span className="inline-block w-1 h-1 rounded-full bg-amber-400 mr-5" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── PODIUM SECTION ── */}
      <section className="relative h-[90vh] min-h-[560px] overflow-hidden">
        <motion.div className="absolute inset-0 scale-105" style={{ y: podiumParallaxY }}>
          <Image
            src="/tournament-podium.jpg"
            alt="Athleten auf dem Siegerpodest"
            fill sizes="100vw"
            className="object-cover brightness-[0.88]"
            style={{ objectPosition: 'center 15%' }}
            priority
          />
        </motion.div>

        {/* Dunkle Vignette — Rand abdunkeln, Mitte offen lassen */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: [
            'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0) 28%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.52) 100%)',
            'radial-gradient(ellipse 70% 55% at 50% 50%, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 100%)',
          ].join(', ')
        }} />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5">
          <motion.div style={{ y: podiumTextY }}>
            <motion.div
              initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <p className="text-amber-400 font-bold text-[10px] uppercase tracking-[0.3em] mb-4"
                style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
                {lang === 'en' ? 'Real training. Real competition.' : 'Echtes Training. Echter Wettkampf.'}
              </p>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter leading-none mb-5"
                style={{ textShadow: '0 2px 32px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.5)' }}>
                {lang === 'en' ? <>For gyms<br />that want to win.</> : <>Für Gyms,<br />die gewinnen wollen.</>}
              </h2>
              <p className="text-white/85 text-base max-w-md mx-auto leading-relaxed"
                style={{ textShadow: '0 1px 16px rgba(0,0,0,0.65)' }}>
                {lang === 'en' ? 'Osss handles the day-to-day — so you can focus on training.' : 'Osss hält den Alltag im Griff — damit du dich aufs Training konzentrieren kannst.'}
              </p>
            </motion.div>
          </motion.div>
        </div>

        <div className="absolute bottom-6 right-5">
          <span className="text-white/70 text-xs font-semibold bg-black/35 backdrop-blur-sm px-3 py-1.5 rounded-full tracking-wide">
            {lang === 'en' ? 'Competition · Submission Grappling' : 'Wettkampf · Submission Grappling'}
          </span>
        </div>
      </section>

      {/* ── DASHBOARD SHOWCASE ── */}
      <section className="bg-white py-24 px-5 overflow-hidden border-b border-zinc-100">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16, filter: 'blur(3px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.48, ease: EASE }}
            className="text-center mb-12"
          >
            <p className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.25em] mb-3">{lang === 'en' ? 'Your gym. Your dashboard.' : 'Dein Gym. Dein Dashboard.'}</p>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
              {lang === 'en' ? 'Everything at a glance.' : 'Alles auf einen Blick.'}
            </h2>
            <p className="text-zinc-500 mt-3 text-sm max-w-sm mx-auto leading-relaxed">
              {lang === 'en' ? 'Members, revenue, belt distribution — live and in real time.' : 'Mitglieder, Einnahmen, Belt-Verteilung — live und in Echtzeit.'}
            </p>
          </motion.div>

          {/* Dashboard screenshot — 3D fly-in + scroll parallax */}
          <motion.div
            initial={{ opacity: 0, y: 80, rotateX: 10, filter: 'blur(6px)' }}
            whileInView={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.85, ease: EASE, delay: 0.06 }}
            style={{ transformPerspective: 1400, y: dashboardImgY }}
            className="relative rounded-2xl overflow-hidden border border-zinc-200 shadow-[0_32px_80px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)]"
          >
            {/* Browser chrome — light */}
            <div className="bg-zinc-100 border-b border-zinc-200 px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-3 bg-white rounded-md px-3 py-1 text-[10px] text-zinc-400 font-mono border border-zinc-200">
                app.osss.pro/dashboard
              </div>
            </div>
            <Image
              src="/screenshot_betrieb.png"
              alt="Osss Dashboard"
              width={1796}
              height={876}
              className="w-full"
            />
          </motion.div>
        </div>
      </section>

      {/* ── VIDEO SECTION ── */}
      <section className="relative h-[85vh] min-h-[540px] overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{ y: videoParallaxY, scale: videoScale }}
        >
          <video autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover object-center brightness-[0.82]">
            <source src="/competition-mat.mp4" type="video/mp4" />
          </video>
        </motion.div>

        {/* Gleiche Vignette wie Podium — konsistent */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: [
            'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.55) 100%)',
            'radial-gradient(ellipse 65% 50% at 50% 50%, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 100%)',
          ].join(', ')
        }} />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5">
          <motion.div
            initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <p className="text-amber-400 font-bold text-[10px] uppercase tracking-[0.3em] mb-5"
              style={{ textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
              {lang === 'en' ? 'No paperwork. More training.' : 'Kein Papierkram. Mehr Training.'}
            </p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter leading-[0.92] max-w-2xl mx-auto"
              style={{ textShadow: '0 2px 32px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.5)' }}>
              {lang === 'en' ? <>Osss runs in the background.<br />You train in the foreground.</> : <>Osss läuft im Hintergrund.<br />Du trainierst im Vordergrund.</>}
            </h2>
          </motion.div>
        </div>
      </section>

      {/* ── SPORTS ── */}
      <section className="bg-zinc-50 px-5 py-24 border-b border-zinc-100">
        <div className="max-w-5xl mx-auto">
          <Section className="text-center mb-12">
            <motion.p variants={fadeUp} className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">{lang === 'en' ? 'For every martial art' : 'Für jede Kampfsportart'}</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">{lang === 'en' ? 'What do you train?' : 'Was trainierst du?'}</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-sm mx-auto text-sm leading-relaxed">
              {lang === 'en' ? 'Osss configures itself automatically — with or without a belt system.' : 'Osss konfiguriert sich automatisch — mit oder ohne Gürtelsystem.'}
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
                {s.id === 'boxing' ? (lang === 'en' ? 'Boxing' : 'Boxen') : s.id === 'wrestling' ? (lang === 'en' ? 'Wrestling' : 'Ringen') : s.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeSport}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="bg-white border border-zinc-200 rounded-2xl p-7 md:p-9 shadow-sm"
            >
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-5 flex-wrap">
                    <h3 className="text-xl font-black text-zinc-950">{features.title}</h3>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border tracking-wide ${
                      hasBelt ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                    }`}>
                      {hasBelt ? (lang === 'en' ? 'With belt system' : 'Mit Gürtelsystem') : (lang === 'en' ? 'Without belt system' : 'Ohne Gürtelsystem')}
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
                    {lang === 'en' ? 'Try it now' : 'Jetzt testen'} <ArrowRight size={14} />
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
            <motion.p variants={fadeUp} className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">{lang === 'en' ? 'The problem' : 'Das Problem'}</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">{lang === 'en' ? 'What really frustrates gym owners' : 'Kennst du das?'}</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              {lang === 'en' ? 'Most gym software is too expensive, too complex, or not built for your market.' : 'Die meisten Gym-Softwares sind zu teuer, zu komplex oder nicht auf Deutschland ausgelegt.'}
            </motion.p>
          </div>
          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PAIN_POINTS_DATA.map(p => (
              <motion.div key={p.title} variants={fadeUp} className="bg-zinc-50 rounded-2xl p-7 border border-zinc-100">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-5">
                  <p.icon size={18} className="text-zinc-500" />
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
            <motion.p variants={fadeUp} className="text-amber-700 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">{lang === 'en' ? 'That simple' : 'So einfach geht\'s'}</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">{lang === 'en' ? 'Live in 3 steps' : 'In 3 Schritten fertig'}</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-sm mx-auto text-sm leading-relaxed">
              {lang === 'en' ? 'No lengthy onboarding process. You\'re live in under 10 minutes.' : 'Kein langer Onboarding-Prozess. Du bist in unter 10 Minuten live.'}
            </motion.p>
          </div>
          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {STEPS_DATA.map(step => (
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
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">{lang === 'en' ? 'Everything in one platform' : 'Alles was dein Gym braucht'}</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              {lang === 'en' ? 'From member management to automatic invoices — in one software.' : 'Von der Mitgliederverwaltung bis zur automatischen Rechnung — in einer Software.'}
            </motion.p>
          </div>
          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES_DATA.map(f => (
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
              <motion.p variants={fadeUp} className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">{lang === 'en' ? 'Schedule' : 'Stundenplan'}</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-5">
                {lang === 'en' ? 'Schedule directly on your website' : 'Kursplan direkt auf deiner Website'}
              </motion.h2>
              <motion.p variants={fadeUp} className="text-zinc-500 mb-8 leading-relaxed text-sm">
                {lang === 'en' ? 'Manage your timetable and embed it via iframe. Members always see the current schedule — no need to maintain a second page.' : 'Stundenplan verwalten und per iframe einbetten. Mitglieder sehen immer den aktuellen Plan — ohne Pflege einer zweiten Seite.'}
              </motion.p>
              <motion.ul variants={stagger} className="space-y-3.5">
                {(lang === 'en' ? ['Weekly view with class details', 'Public embed link', 'iCal export for Google Calendar', 'Online booking for members'] : ['Wochenansicht mit Kursdetails', 'Öffentlicher Embed-Link', 'iCal-Export für Google Calendar', 'Online-Buchung für Mitglieder']).map(item => (
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
              <motion.p variants={fadeUp} className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">{lang === 'en' ? 'Only at Osss' : 'Nur bei Osss'}</motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-8">
                {lang === 'en' ? <>Built for<br />your market</> : <>Gemacht für<br />deutsche Gyms</>}
              </motion.h2>
              <motion.div variants={stagger} className="space-y-6">
                {GERMAN_FEATURES_DATA.map(item => (
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
                  <p className="text-zinc-400 text-xs">{lang === 'en' ? 'Automatic invoice' : 'Automatische Rechnung'}</p>
                </div>
                <div className="ml-auto">
                  <span className="text-[11px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 px-2.5 py-1 rounded-full">{lang === 'en' ? 'Paid' : 'Bezahlt'}</span>
                </div>
              </div>
              <div className="space-y-3.5">
                {(lang === 'en' ? [
                  ['Invoice no.', 'OSS-2026-047'],
                  ['Member',      'Max Mustermann'],
                  ['Service',     'Monthly fee May 2026'],
                  ['Amount',      '€ 89.00'],
                  ['Tax note',    '§19 UStG — VAT-exempt'],
                ] : [
                  ['Rechnungsnummer', 'OSS-2026-047'],
                  ['Mitglied',        'Max Mustermann'],
                  ['Leistung',        'Monatsbeitrag Mai 2026'],
                  ['Betrag',          '€ 89,00'],
                  ['Steuerhinweis',   '§19 UStG — keine USt.'],
                ]).map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm border-b border-zinc-200/80 pb-3.5">
                    <span className="text-zinc-400">{label}</span>
                    <span className="text-zinc-900 font-medium">{val}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 text-zinc-600 text-xs font-semibold">
                <CheckCircle size={12} />
                {lang === 'en' ? 'Automatically created and archived' : 'Automatisch erstellt und archiviert'}
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── PRICING TEASER ── */}
      <Section className="py-24 px-5 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <motion.p variants={fadeUp} className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">{lang === 'en' ? 'Pricing' : 'Preise'}</motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">{lang === 'en' ? 'Fair pricing. No fine print.' : 'Faire Preise. Kein Kleingedrucktes.'}</motion.h2>
          <motion.p variants={fadeUp} className="text-zinc-500 mb-10 text-sm leading-relaxed">{lang === 'en' ? 'Start free with up to 30 members. Pay only when you grow.' : 'Starte kostenlos mit bis zu 30 Mitgliedern. Zahle erst wenn du wächst.'}</motion.p>
          <motion.div variants={stagger} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { name: 'Free',    price: '€0',  members: lang === 'en' ? '30 mbrs.'   : '30 Mitgl.',  highlight: false },
              { name: 'Starter', price: '€29', members: lang === 'en' ? '50 mbrs.'   : '50 Mitgl.',  highlight: false },
              { name: 'Grow',    price: '€59', members: lang === 'en' ? '150 mbrs.'  : '150 Mitgl.', highlight: true  },
              { name: 'Pro',     price: '€99', members: lang === 'en' ? 'Unlimited'  : 'Unbegrenzt', highlight: false },
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
              {lang === 'en' ? 'Compare all features in detail' : 'Alle Features im Detail vergleichen'} <ArrowRight size={14} />
            </Link>
          </motion.div>
        </div>
      </Section>

      {/* ── FINAL CTA — full amber ── */}
      <section className="py-28 px-5 bg-amber-400 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 110%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
        <div className="max-w-xl mx-auto relative">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-zinc-950 mb-5">{lang === 'en' ? 'Ready to get started?' : 'Bereit loszulegen?'}</h2>
          <p className="text-zinc-800 text-lg mb-10 leading-relaxed">
            {lang === 'en' ? <>Your gym is live in 10 minutes.<br />No credit card, no minimum term.</> : <>Dein Gym läuft in 10 Minuten.<br />Keine Kreditkarte, keine Mindestlaufzeit.</>}
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-10 py-4 rounded-xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/25">
            <Zap size={18} className="text-amber-400" />
            {lang === 'en' ? 'Get started free' : 'Jetzt kostenlos starten'}
          </Link>
          <p className="text-zinc-700 text-xs mt-5 tracking-wide">{lang === 'en' ? 'No credit card · No minimum term · Cancel anytime' : 'Keine Kreditkarte · Keine Mindestlaufzeit · Jederzeit kündbar'}</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-zinc-100">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-10 mb-12">
            <div className="sm:col-span-2">
              <OsssLogo variant="dark" />
              <p className="text-zinc-400 text-sm mt-4 leading-relaxed max-w-xs">
                {lang === 'en' ? 'The gym management software for martial arts — GDPR-compliant, from €0.' : 'Die Gym-Management-Software für Kampfsport — auf Deutsch, DSGVO-konform, ab €0.'}
              </p>
            </div>
            <div>
              <p className="font-bold text-zinc-900 text-sm mb-4 tracking-wide">{lang === 'en' ? 'Product' : 'Produkt'}</p>
              <ul className="space-y-3">
                {(lang === 'en' ? [{ label: 'Pricing', href: '/pricing' }, { label: 'Log in', href: '/login' }, { label: 'Register', href: '/register' }] : [{ label: 'Preise', href: '/pricing' }, { label: 'Anmelden', href: '/login' }, { label: 'Registrieren', href: '/register' }]).map(l => (
                  <li key={l.label}><Link href={l.href} className="text-zinc-500 hover:text-zinc-900 text-sm transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-bold text-zinc-900 text-sm mb-4 tracking-wide">{lang === 'en' ? 'Legal' : 'Rechtliches'}</p>
              <ul className="space-y-3">
                {(lang === 'en' ? [{ label: 'Privacy policy', href: '/datenschutz' }, { label: 'Imprint', href: '/impressum' }, { label: 'Contact', href: 'mailto:oss@osss.pro' }] : [{ label: 'Datenschutz', href: '/datenschutz' }, { label: 'Impressum', href: '/impressum' }, { label: 'Kontakt', href: 'mailto:oss@osss.pro' }]).map(l => (
                  <li key={l.label}><Link href={l.href} className="text-zinc-500 hover:text-zinc-900 text-sm transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-zinc-400 text-xs">© {new Date().getFullYear()} Osss · {lang === 'en' ? 'The martial arts gym software' : 'Die Kampfsport-Gym-Software'}</p>
            <p className="text-zinc-300 text-xs">{lang === 'en' ? 'Made in Germany · GDPR-compliant · Data on EU servers' : 'Made in Germany · DSGVO-konform · Daten auf EU-Servern'}</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
