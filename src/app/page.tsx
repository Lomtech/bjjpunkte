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
  CheckCircle, ArrowRight, Zap, Check, Menu, X, Download, Link2,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { NewsletterSignup } from '@/components/NewsletterSignup'

// ── Data ──────────────────────────────────────────────────────────────────────

type SportId = 'bjj' | 'judo' | 'karate' | 'mma' | 'muaythai' | 'boxing' | 'wrestling' | 'taekwondo' | 'wingtsun' | 'kungfu'

const SPORTS: { id: SportId; label: string; belt: boolean }[] = [
  { id: 'bjj',       label: 'BJJ',       belt: true  },
  { id: 'judo',      label: 'Judo',      belt: true  },
  { id: 'karate',    label: 'Karate',    belt: true  },
  { id: 'taekwondo', label: 'Taekwondo', belt: true  },
  { id: 'wingtsun',  label: 'Wing Tsun', belt: true  },
  { id: 'kungfu',    label: 'Kung Fu',   belt: true  },
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
  wingtsun:  { title: 'Für Wing Tsun konfiguriert', items: ['Schülergrade 1-12 + 4 Technikergrade', 'EWTO-kompatibles Stufensystem', 'Chi Sao & Lat Sao Klassen-Typen', 'Lehrerprüfungen mit Datum & Notizen'] },
  kungfu:    { title: 'Für Kung Fu konfiguriert',   items: ['Sash-Farben (Weiß bis Schwarz)', 'Wushu, Wing Chun, Sanda kompatibel', 'Forms & Sparring Klassen-Typen', 'Belt-System pro Schule deaktivierbar'] },
  mma:       { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Fokus auf Anwesenheit & Zahlungen', 'Sparring & Klassen verwalten', 'Mitglieder-Portal ohne Gürtel'] },
  muaythai:  { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Pad Work & Sparring Klassen', 'Anwesenheit & Beiträge', 'Eigene Klassen-Typen konfigurierbar'] },
  boxing:    { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Boxklassen & Sparring verwalten', 'Wettkampf-Tracking per Notiz', 'Monatsbeiträge per Stripe'] },
  wrestling: { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Ringen & Freistil Klassen', 'Gewichtsklassen als Notiz', 'Anwesenheit & Mitglieder'] },
}

const PAIN_POINTS = [
  { icon: FileSpreadsheet, title: 'Excel & WhatsApp',     desc: 'Mitgliederlisten in Tabellen, Zahlungserinnerungen per Chat. Drei Tools, kein Überblick — und am Monatsende die Stress-Buchhaltung.' },
  { icon: Globe,           title: 'Internationale Tools', desc: 'Mindbody, Glofox & Co. — englische UI, kein DATEV-Export, kein deutsches Rechnungs-Layout.' },
  { icon: FileEdit,        title: 'Rechnungen per Hand',  desc: 'Jeden Monat dieselbe Stunde nur für Rechnungen. Sechs Stunden im Jahr für Routine, die Software längst übernehmen sollte.' },
]

const FEATURES = [
  { icon: Users,      title: 'Mitglieder verwalten',    desc: 'Stammdaten, Verträge, Familienmitglieder, Belts, Notizen — pro Mitglied eine Karte, alles an einem Ort.' },
  { icon: CreditCard, title: 'Beiträge per SEPA',       desc: 'Stripe-Lastschrift einrichten, Mitglieder zahlen automatisch. Du erstellst nie wieder eine Rechnung von Hand.' },
  { icon: Smartphone, title: 'Member-Portal',           desc: 'Mitglieder checken per QR-Code oder GPS ein, buchen Kurse, sehen ihre Trainingshistorie. Browser-basiert — keine App-Installation.' },
  { icon: Link2,      title: 'Öffentliche Gym-Seite',   desc: 'osss.pro/gym/dein-name — Stundenplan, Preise, Fotos, Probetraining-Buchung. In 10 Minuten konfiguriert, ohne eine Zeile Code.' },
  { icon: Target,     title: 'Lead-Pipeline',           desc: 'Anfragen aus deiner Website fließen direkt rein. Status, Notizen, Folge-Termine — vom Erstkontakt bis zum Mitglieds-Vertrag.' },
  { icon: Award,      title: 'Belt-Tracking',           desc: 'Schülergrade, Kyu-Stufen, Sash-Farben — vorkonfiguriert für 6 Sportarten. Promotions mit Datum und Verlauf.' },
]

const GERMAN_FEATURES = [
  { icon: FileText,   title: '§19 UStG Rechnungen', desc: 'Kleinunternehmer-konforme Rechnungen — Pflichtangaben, fortlaufende Nummerierung, automatischer Versand. Einmal Daten eintragen, fertig.' },
  { icon: Download,   title: 'DATEV-Export',         desc: 'Buchungsdaten als DATEV-CSV exportieren. Ein Klick, eine Datei — dein Steuerberater importiert sie direkt. Sonst niemand im Markt.' },
  { icon: Shield,     title: 'DSGVO ab Tag eins',    desc: 'Daten in der EU/UK (London, Adequacy Decision der EU-Kommission). Auftragsverarbeitungsvertrag elektronisch im Dashboard. Keine Cookie-Banner-Tricks.' },
  { icon: Headphones, title: 'Support auf Deutsch', desc: 'Kein Support-Ticket-System auf Englisch. Schreib uns direkt — oss@osss.pro.' },
]

const STEPS = [
  { num: '01', title: 'Account anlegen',        desc: 'E-Mail, Passwort, Sportart auswählen. Keine Kreditkarte. Keine Verkaufs-Demo.' },
  { num: '02', title: 'Mitglieder importieren', desc: 'CSV-Upload aus deinem alten Tool oder manuell. Belts und Verträge bleiben erhalten.' },
  { num: '03', title: 'Gym geht live',          desc: 'Stripe verbinden, Stundenplan füllen, Mitglieder-Portal teilen. Fertig.' },
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
  const [contactOpen, setContactOpen] = useState(false)
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
    { icon: FileSpreadsheet, title: 'Excel & WhatsApp',     desc: 'Member lists in spreadsheets, payment reminders in chat. Three tools, no overview — and the monthly accounting chaos at the end.' },
    { icon: Globe,           title: 'International tools',  desc: 'Mindbody, Glofox & co. — English-only UI, no DATEV export, no German invoice layout.' },
    { icon: FileEdit,        title: 'Manual invoices',      desc: 'The same hour every month, just for invoices. Six hours a year on routine work software should have automated long ago.' },
  ] : PAIN_POINTS

  const FEATURES_DATA = lang === 'en' ? [
    { icon: Users,      title: 'Manage members',        desc: 'Profiles, contracts, family members, belts, notes — one card per member, everything in one place.' },
    { icon: CreditCard, title: 'Collect dues via SEPA', desc: 'Set up Stripe direct debit. Members pay automatically. You never write an invoice by hand again.' },
    { icon: Smartphone, title: 'Member portal',         desc: 'Members check in via QR or GPS, book classes, view training history. Browser-based — no app install.' },
    { icon: Link2,      title: 'Public gym website',    desc: 'osss.pro/gym/your-name — schedule, pricing, photos, trial-class booking. Configured in 10 minutes, no code.' },
    { icon: Target,     title: 'Lead pipeline',         desc: 'Enquiries from your website flow in. Status, notes, follow-ups — from first contact to signed contract.' },
    { icon: Award,      title: 'Belt tracking',         desc: 'Kyu grades, student grades, sash colours — pre-configured for 6 martial arts. Promotions with date and history.' },
  ] : FEATURES

  const GERMAN_FEATURES_DATA = lang === 'en' ? [
    { icon: FileText,   title: 'German-spec invoices', desc: 'Compliant invoices for small businesses (§19 UStG) — required fields, sequential numbering, automatic dispatch. Set it up once, done.' },
    { icon: Download,   title: 'DATEV export',         desc: 'Export booking data as DATEV CSV. One click, one file — your accountant imports it directly. Nobody else on the market offers this.' },
    { icon: Shield,     title: 'GDPR from day one',    desc: 'Data in EU/UK (London, EU adequacy decision). DPA signed electronically in your dashboard. No cookie-banner workarounds.' },
    { icon: Headphones, title: 'Direct support',       desc: 'No English-only ticketing system. Write us directly — oss@osss.pro.' },
  ] : GERMAN_FEATURES

  const STEPS_DATA = lang === 'en' ? [
    { num: '01', title: 'Create account',     desc: 'Email, password, pick your sport. No credit card. No sales demo.' },
    { num: '02', title: 'Import members',     desc: 'CSV upload from your old tool or enter manually. Belts and contracts carry over.' },
    { num: '03', title: 'Gym goes live',      desc: 'Connect Stripe, fill the schedule, share the member portal. Done.' },
  ] : STEPS

  const SPORT_FEATURES_DATA: Record<SportId, { title: string; items: string[] }> = lang === 'en' ? {
    bjj:       { title: 'Optimised for BJJ',       items: ['5-belt system (White to Black)', 'Stripe tracking up to 4 levels', 'Gi / No-Gi class types', 'Promotions with history & date'] },
    judo:      { title: 'Configured for Judo',      items: ['7-level Kyu system', 'Yellow to Black pre-configured', 'Competition class types', 'Dan grades freely extendable'] },
    karate:    { title: 'Configured for Karate',    items: ['8 Kyu levels pre-configured', 'Kata & Kumite class types', 'Exam log per promotion', 'Colours & labels customisable'] },
    taekwondo: { title: 'Configured for Taekwondo', items: ['6 belt colours pre-configured', 'Poomsae & Sparring classes', 'Exam log', 'Dan grades freely extendable'] },
    wingtsun:  { title: 'Configured for Wing Tsun', items: ['Student grades 1-12 + 4 technician grades', 'EWTO-compatible level system', 'Chi Sao & Lat Sao class types', 'Teacher exams with date & notes'] },
    kungfu:    { title: 'Configured for Kung Fu',   items: ['Sash colours (White to Black)', 'Wushu, Wing Chun, Sanda compatible', 'Forms & Sparring class types', 'Belt system can be disabled per school'] },
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
            <Link href="/blog" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden md:block">Blog</Link>
            <Link href="/ressourcen" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden lg:block">{lang === 'en' ? 'Resources' : 'Ressourcen'}</Link>
            <button onClick={() => setContactOpen(true)} data-track="cta_contact_header" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden md:block">{lang === 'en' ? 'Contact' : 'Kontakt'}</button>
            <LanguageSwitcher variant="minimal" />
            {checked && (loggedIn
              ? <Link href="/dashboard" className="bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-2 rounded-lg transition-colors">Dashboard</Link>
              : <>
                  <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden sm:block">{lang === 'en' ? 'Log in' : 'Anmelden'}</Link>
                  <Link href="/register" data-track="cta_signup_header" className="bg-zinc-900 hover:bg-zinc-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors hidden sm:block">{lang === 'en' ? 'Get started free' : 'Kostenlos starten'}</Link>
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
              <Link href="/blog" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50 transition-colors">Blog</Link>
              <Link href="/ressourcen" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50 transition-colors">{lang === 'en' ? 'Resources' : 'Ressourcen'}</Link>
              <Link href="/rechner" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50 transition-colors">{lang === 'en' ? 'Cost calculator' : 'Kostenrechner'}</Link>
              <button onClick={() => { setMenuOpen(false); setContactOpen(true) }} className="text-left text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50 transition-colors">{lang === 'en' ? 'Contact' : 'Kontakt'}</button>
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
            alt="Kampfsport-Wettkampf Siegerehrung"
            fill
            sizes="100vw"
            className="object-cover object-top"
            priority
            fetchPriority="high"
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
                <span className="text-amber-700 text-xs font-semibold tracking-wide">{lang === 'en' ? 'Made in Germany · For martial arts gyms' : 'Made in Germany · Für Kampfsport-Gyms'}</span>
              </motion.div>

              <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-[4.5rem] xl:text-[5rem] font-black tracking-tighter leading-[0.9] mb-6 text-zinc-950">
                {lang === 'en' ? <>Members. Belts. Payments.<br /><span className="text-amber-500">Live in 10 minutes.</span></> : <>Mitglieder. Belts. Beiträge.<br /><span className="text-amber-500">Live in 10 Minuten.</span></>}
              </motion.h1>

              <motion.p variants={fadeUp} className="text-zinc-500 text-lg mb-8 leading-relaxed">
                {lang === 'en' ? 'The German software for martial arts gyms — with belt system, DATEV export and SEPA, built in.' : 'Die deutsche Software für Kampfsport-Gyms — mit Belt-System, DATEV-Export und SEPA. Alles direkt eingebaut.'}
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link href="/register" data-track="cta_signup_hero"
                  className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/20">
                  <Zap size={16} className="text-amber-400" />
                  {lang === 'en' ? 'Get started free' : 'Jetzt kostenlos starten'}
                </Link>
                <Link href="/pricing" data-track="cta_pricing_hero"
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
                  { val: '30',      label: 'free members forever' },
                  { val: '0%',      label: 'platform fee' },
                  { val: 'DATEV',   label: 'export' },
                  { val: 'GDPR',    label: 'compliant' },
                ] : [
                  { val: '30',      label: 'Mitglieder dauerhaft gratis' },
                  { val: '0%',      label: 'Plattformgebühr' },
                  { val: 'DATEV',   label: 'Export' },
                  { val: 'DSGVO',   label: 'konform' },
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
                sizes="(max-width: 1024px) 0vw, 50vw"
                className="w-full"
                priority
                fetchPriority="high"
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
                  sizes="(max-width: 1024px) 0vw, 25vw"
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
            loading="lazy"
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
            <p className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.25em] mb-3">{lang === 'en' ? 'Your dashboard' : 'Dein Dashboard'}</p>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
              {lang === 'en' ? 'The whole gym, at a glance.' : 'Das ganze Gym auf einen Blick.'}
            </h2>
            <p className="text-zinc-500 mt-3 text-sm max-w-sm mx-auto leading-relaxed">
              {lang === 'en' ? 'Members, revenue, belt distribution — updated live as people train and pay.' : 'Mitglieder, Einnahmen, Belt-Verteilung — live aktualisiert, während trainiert und gezahlt wird.'}
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
              alt="Osss Dashboard mit Mitgliedern, Beiträgen und Belt-Verteilung"
              width={1796}
              height={876}
              sizes="(max-width: 1024px) 90vw, 1024px"
              className="w-full"
              loading="lazy"
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
            <motion.p variants={fadeUp} className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">{lang === 'en' ? '10 martial arts pre-configured' : '10 Kampfsportarten vorkonfiguriert'}</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">{lang === 'en' ? 'What do you train?' : 'Was trainierst du?'}</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-sm mx-auto text-sm leading-relaxed">
              {lang === 'en' ? 'Pick your sport. Osss sets up the belt system, class types and member fields automatically.' : 'Wähle deine Sportart. Osss konfiguriert Gürtelsystem, Klassen-Typen und Mitgliederfelder automatisch.'}
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
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">{lang === 'en' ? 'Three problems we solved' : 'Drei Probleme, die wir gelöst haben'}</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              {lang === 'en' ? 'Gym software is either too expensive, too complex, or not built for the German market.' : 'Gym-Software ist zu teuer, zu komplex — oder nicht für den deutschen Markt gebaut.'}
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
            <motion.p variants={fadeUp} className="text-amber-700 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">{lang === 'en' ? 'How it works' : 'So funktioniert\'s'}</motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">{lang === 'en' ? 'From signup to live in 10 minutes' : 'Vom Account zum Live-Gym in 10 Minuten'}</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-sm mx-auto text-sm leading-relaxed">
              {lang === 'en' ? 'No sales call. No 14-day onboarding. Sign up, import, start.' : 'Kein Verkaufs-Call. Kein 14-Tage-Onboarding. Anmelden, importieren, loslegen.'}
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
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">{lang === 'en' ? 'Six tools. One system.' : 'Sechs Werkzeuge. Ein System.'}</motion.h2>
            <motion.p variants={fadeUp} className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              {lang === 'en' ? 'No add-ons to buy. No integrations to glue together. Everything works out of the box.' : 'Keine Add-Ons zu kaufen. Keine Integrationen zu basteln. Alles direkt einsatzbereit.'}
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
              <Image src="/screenshot_stundenplan.png" alt="Wochenstundenplan mit Klassen-Buchungen" width={2912} height={896} sizes="(max-width: 768px) 90vw, 50vw" loading="lazy" className="w-full" />
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── PUBLIC GYM WEBSITE ── */}
      <Section className="py-24 px-5 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            {/* URL bar mockup */}
            <motion.div variants={fadeUp} className="order-1 md:order-2">
              <div className="rounded-2xl border border-zinc-200 shadow-xl shadow-zinc-200/60 overflow-hidden bg-zinc-50">
                <div className="flex items-center gap-2 px-4 py-3 bg-zinc-100 border-b border-zinc-200">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
                  </div>
                  <div className="flex-1 bg-white rounded-md px-3 py-1 text-[11px] font-mono text-zinc-500 border border-zinc-200">
                    osss.pro/gym/<span className="text-amber-600 font-semibold">dein-gym</span>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="h-28 rounded-xl bg-zinc-200 flex items-center justify-center">
                    <Globe size={28} className="text-zinc-400" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-zinc-200 rounded-full w-2/3" />
                    <div className="h-3 bg-zinc-100 rounded-full w-full" />
                    <div className="h-3 bg-zinc-100 rounded-full w-4/5" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {['Stundenplan', 'Mitgliedschaft', 'Kontakt'].map(label => (
                      <div key={label} className="h-8 bg-zinc-100 rounded-lg flex items-center justify-center">
                        <span className="text-[9px] text-zinc-400 font-medium">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="order-2 md:order-1">
              <motion.p variants={fadeUp} className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">
                {lang === 'en' ? 'Public Gym Website' : 'Öffentliche Gym-Seite'}
              </motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-5">
                {lang === 'en'
                  ? <>Your gym gets<br />its own website</>
                  : <>Dein Gym bekommt<br />eine eigene Website</>}
              </motion.h2>
              <motion.p variants={fadeUp} className="text-zinc-500 mb-8 leading-relaxed text-sm">
                {lang === 'en'
                  ? 'Prospects land on your gym page, see the schedule and prices, and book a trial class directly — without WhatsApp back-and-forth.'
                  : 'Interessenten landen auf deiner Gym-Seite, sehen den Stundenplan und die Preise, und buchen direkt ein Probetraining — ohne WhatsApp hin und her.'}
              </motion.p>
              <motion.ul variants={stagger} className="space-y-3.5">
                {(lang === 'en'
                  ? ['Custom URL: osss.pro/gym/your-name', 'Schedule, pricing, gallery, about section', 'Trial class booking with lead capture', 'iCal export for Google Calendar', 'Embed as iframe on your own website']
                  : ['Eigene URL: osss.pro/gym/dein-name', 'Stundenplan, Preise, Galerie, About-Sektion', 'Probetraining-Buchung mit Lead-Erfassung', 'iCal-Export für Google Calendar', 'Als iframe auf deiner eigenen Website einbettbar']
                ).map(item => (
                  <motion.li key={item} variants={fadeUp} className="flex items-center gap-3 text-sm text-zinc-700">
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={11} className="text-amber-600" />
                    </div>
                    {item}
                  </motion.li>
                ))}
              </motion.ul>
            </div>
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
                {lang === 'en' ? <>What no other<br />gym tool can do</> : <>Was kein anderes<br />Gym-Tool kann</>}
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

      {/* ── DATEV HIGHLIGHT ── */}
      <Section className="py-20 px-5 bg-zinc-950">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <motion.p variants={fadeUp} className="text-amber-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">
                {lang === 'en' ? 'Unique feature' : 'Einzigartiges Feature'}
              </motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-5">
                {lang === 'en'
                  ? <>DATEV export —<br />one click, done</>
                  : <>DATEV-Export —<br />ein Klick, fertig</>}
              </motion.h2>
              <motion.p variants={fadeUp} className="text-zinc-400 mb-8 leading-relaxed text-sm">
                {lang === 'en'
                  ? 'Export your payment data as a DATEV-compatible CSV file — your tax advisor imports it directly into their system. No other gym management tool in Germany offers this.'
                  : 'Exportiere deine Zahlungsdaten als DATEV-kompatible CSV-Datei — dein Steuerberater importiert sie direkt in sein System. Kein anderes Gym-Management-Tool in Deutschland bietet das.'}
              </motion.p>
              <motion.div variants={fadeUp} className="flex items-center gap-3 text-sm text-zinc-300">
                <CheckCircle size={14} className="text-amber-400 flex-shrink-0" />
                {lang === 'en' ? 'DATEV Buchungsdatei format 1.0' : 'DATEV Buchungsdatei Format 1.0'}
              </motion.div>
              <motion.div variants={fadeUp} className="flex items-center gap-3 text-sm text-zinc-300 mt-2">
                <CheckCircle size={14} className="text-amber-400 flex-shrink-0" />
                {lang === 'en' ? 'Configurable tax account length (4 or 8 digits)' : 'Konfigurierbare Sachkontenlänge (4 oder 8 Stellen)'}
              </motion.div>
              <motion.div variants={fadeUp} className="flex items-center gap-3 text-sm text-zinc-300 mt-2">
                <CheckCircle size={14} className="text-amber-400 flex-shrink-0" />
                {lang === 'en' ? 'Filter by month — just share with your accountant' : 'Nach Monat filtern — einfach an Steuerberater weitergeben'}
              </motion.div>
            </div>

            {/* DATEV export card mockup */}
            <motion.div variants={fadeUp} className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-zinc-800">
                <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
                  <Download size={14} className="text-zinc-950" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{lang === 'en' ? 'DATEV Export' : 'DATEV-Export'}</p>
                  <p className="text-zinc-500 text-xs">{lang === 'en' ? 'Booking data CSV' : 'Buchungsdaten CSV'}</p>
                </div>
              </div>
              <div className="font-mono text-[10px] text-zinc-400 space-y-1.5 mb-5">
                <p className="text-zinc-600">{lang === 'en' ? '// DATEV Buchungsdatei' : '// DATEV Buchungsdatei'}</p>
                <p><span className="text-amber-400">Umsatz</span>;Gegenkonto;Belegdatum;Buchungstext</p>
                <p suppressHydrationWarning>89,00;8000;{new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })};Monatsbeitrag Max M.</p>
                <p suppressHydrationWarning>89,00;8000;{new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })};Monatsbeitrag Jana K.</p>
                <p suppressHydrationWarning>89,00;8000;{new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })};Monatsbeitrag Tom R.</p>
                <p className="text-zinc-600">…</p>
              </div>
              <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-400 text-zinc-950 text-sm font-bold">
                <Download size={13} />
                {lang === 'en' ? 'Download DATEV CSV' : 'DATEV CSV herunterladen'}
              </button>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ── PRICING TEASER ── */}
      <Section className="py-24 px-5 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <motion.p variants={fadeUp} className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">{lang === 'en' ? 'Pricing' : 'Preise'}</motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">{lang === 'en' ? 'Four plans. Zero hidden costs.' : 'Vier Pläne. Keine Versteckkosten.'}</motion.h2>
          <motion.p variants={fadeUp} className="text-zinc-500 mb-10 text-sm leading-relaxed">{lang === 'en' ? 'Free up to 30 members. Pay only as your gym grows.' : 'Bis 30 Mitglieder kostenlos. Du zahlst erst, wenn dein Gym wächst.'}</motion.p>
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

      {/* ── COST PROOF + Calculator-Teaser ── */}
      <Section className="py-20 px-5 bg-zinc-50 border-y border-zinc-100">
        <div className="max-w-4xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-10">
            <p className="text-emerald-600 font-bold text-[10px] uppercase tracking-[0.25em] mb-3">
              {lang === 'en' ? 'Real numbers' : 'Echte Zahlen'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">
              {lang === 'en' ? 'What does Excel really cost you?' : 'Was kostet dich Excel wirklich?'}
            </h2>
            <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">
              {lang === 'en'
                ? 'Example: 50 members, 3h/week admin, €40/h. The numbers below are not estimates — they\'re math.'
                : 'Beispiel: 50 Mitglieder, 3 h/Woche Verwaltung, 40 €/h Stundensatz. Die Zahlen unten sind keine Schätzung — das ist Mathematik.'}
            </p>
          </motion.div>

          <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {/* Excel/Manuell */}
            <motion.div variants={fadeUp} className="bg-white rounded-2xl p-6 border-2 border-rose-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-2">
                {lang === 'en' ? 'Excel / manual' : 'Excel / manuell'}
              </p>
              <p className="text-3xl font-black text-zinc-900 tabular-nums tracking-tight">6.000 €</p>
              <p className="text-xs text-zinc-400 mt-1">
                {lang === 'en' ? '150 h/year × €40' : '150 h/Jahr × 40 €'}
              </p>
              <p className="text-[11px] text-zinc-400 mt-2 italic">
                {lang === 'en' ? 'Your time, calculated.' : 'Deine Lebenszeit, hochgerechnet.'}
              </p>
            </motion.div>

            {/* Eversports */}
            <motion.div variants={fadeUp} className="bg-white rounded-2xl p-6 border-2 border-amber-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2">Eversports &amp; Co.</p>
              <p className="text-3xl font-black text-zinc-900 tabular-nums tracking-tight">1.128 €</p>
              <p className="text-xs text-zinc-400 mt-1">
                {lang === 'en' ? '€49/mo + 1.5% platform fee' : '49 €/Mo + 1,5 % Plattformgebühr'}
              </p>
              <p className="text-[11px] text-zinc-400 mt-2 italic">
                {lang === 'en' ? 'Platform fee alone: €540/year.' : 'Plattformgebühr allein: 540 €/Jahr.'}
              </p>
            </motion.div>

            {/* Osss */}
            <motion.div variants={fadeUp} className="bg-emerald-50 rounded-2xl p-6 border-2 border-emerald-300 relative">
              <div className="absolute -top-2.5 left-6 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                {lang === 'en' ? 'Osss' : 'Osss'}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-2">Osss</p>
              <p className="text-3xl font-black text-emerald-700 tabular-nums tracking-tight">348 €</p>
              <p className="text-xs text-emerald-700 mt-1">
                {lang === 'en' ? '€29/month · 0% platform fee' : '29 €/Monat · 0 % Plattformgebühr'}
              </p>
              <p className="text-[11px] text-emerald-700 mt-2 italic">
                {lang === 'en' ? 'Up to 30 members forever free.' : 'Bis 30 Mitglieder dauerhaft gratis.'}
              </p>
            </motion.div>
          </motion.div>

          <motion.div variants={fadeUp} className="text-center">
            <Link href="/rechner"
              className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
              {lang === 'en' ? 'Calculate with your numbers' : 'Mit deinen Zahlen rechnen'} <ArrowRight size={14} />
            </Link>
            <p className="text-xs text-zinc-400 mt-3">
              {lang === 'en'
                ? 'Slider-based — interactive, takes 30 seconds.'
                : 'Mit Slidern — interaktiv, dauert 30 Sekunden.'}
            </p>
          </motion.div>
        </div>
      </Section>

      {/* ── FINAL CTA — full amber ── */}
      <section className="py-28 px-5 bg-amber-400 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 70% at 50% 110%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
        <div className="max-w-xl mx-auto relative">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter text-zinc-950 mb-5">{lang === 'en' ? 'Your gym in 10 minutes.' : 'Dein Gym in 10 Minuten.'}</h2>
          <p className="text-zinc-800 text-lg mb-10 leading-relaxed">
            {lang === 'en' ? <>Free forever up to 30 members.<br />Above that: €29-99/month, no minimum term.</> : <>Bis 30 Mitglieder dauerhaft gratis.<br />Danach: €29-99/Monat, keine Mindestlaufzeit.</>}
          </p>
          <Link href="/register" data-track="cta_signup_bottom"
            className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-10 py-4 rounded-xl text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-zinc-900/25">
            <Zap size={18} className="text-amber-400" />
            {lang === 'en' ? 'Start free now' : 'Jetzt kostenlos starten'}
          </Link>
          <p className="text-zinc-700 text-xs mt-5 tracking-wide">{lang === 'en' ? 'Free up to 30 members · No credit card · Cancel anytime' : 'Bis 30 Mitglieder gratis · Keine Kreditkarte · Jederzeit kündbar'}</p>
        </div>
      </section>

      {/* ── NEWSLETTER ── */}
      <Section className="py-20 px-5 bg-white border-b border-zinc-100">
        <div className="max-w-3xl mx-auto">
          <NewsletterSignup
            source="landing-footer"
            variant="hero"
            title={lang === 'en' ? 'Practical tips for martial arts gyms.' : 'Praxis-Tipps für Kampfsport-Vereine.'}
            description={lang === 'en'
              ? 'GDPR, DATEV, SEPA, member management — at most 1× per week, unsubscribe instantly.'
              : 'DSGVO, DATEV, SEPA, Mitgliederverwaltung — höchstens 1× pro Woche, sofort abbestellbar.'}
          />
        </div>
      </Section>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-zinc-100">
        <div className="max-w-5xl mx-auto px-5 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-10 mb-12">
            <div className="sm:col-span-2">
              <OsssLogo variant="dark" />
              <p className="text-zinc-400 text-sm mt-4 leading-relaxed max-w-xs">
                {lang === 'en' ? 'The gym software for martial arts. Made in Germany. GDPR + DATEV included.' : 'Die Gym-Software für Kampfsport. Made in Germany. DSGVO + DATEV inklusive.'}
              </p>
            </div>
            <div>
              <p className="font-bold text-zinc-900 text-sm mb-4 tracking-wide">{lang === 'en' ? 'Product' : 'Produkt'}</p>
              <ul className="space-y-3">
                {(lang === 'en'
                  ? [
                      { label: 'Pricing',     href: '/pricing' },
                      { label: 'Resources',   href: '/ressourcen' },
                      { label: 'Cost calc.',  href: '/rechner' },
                      { label: 'Blog',        href: '/blog' },
                      { label: 'Log in',      href: '/login' },
                      { label: 'Register',    href: '/register' },
                    ]
                  : [
                      { label: 'Preise',         href: '/pricing' },
                      { label: 'Ressourcen',     href: '/ressourcen' },
                      { label: 'Kostenrechner',  href: '/rechner' },
                      { label: 'Blog',           href: '/blog' },
                      { label: 'Anmelden',       href: '/login' },
                      { label: 'Registrieren',   href: '/register' },
                    ]
                ).map(l => (
                  <li key={l.label}><Link href={l.href} className="text-zinc-500 hover:text-zinc-900 text-sm transition-colors">{l.label}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-bold text-zinc-900 text-sm mb-4 tracking-wide">{lang === 'en' ? 'Legal' : 'Rechtliches'}</p>
              <ul className="space-y-3">
                {(lang === 'en'
                  ? [{ label: 'Privacy policy', href: '/datenschutz' }, { label: 'Imprint', href: '/impressum' }]
                  : [{ label: 'Datenschutz', href: '/datenschutz' }, { label: 'Impressum', href: '/impressum' }]
                ).map(l => (
                  <li key={l.label}><Link href={l.href} className="text-zinc-500 hover:text-zinc-900 text-sm transition-colors">{l.label}</Link></li>
                ))}
                <li>
                  <button onClick={() => setContactOpen(true)} className="text-zinc-500 hover:text-zinc-900 text-sm transition-colors text-left">
                    {lang === 'en' ? 'Contact' : 'Kontakt'}
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-zinc-400 text-xs" suppressHydrationWarning>© {new Date().getFullYear()} Osss · {lang === 'en' ? 'The martial arts gym software' : 'Die Kampfsport-Gym-Software'}</p>
            <p className="text-zinc-300 text-xs">{lang === 'en' ? 'Made in Germany · GDPR-compliant · Data in EU/UK' : 'Made in Germany · DSGVO-konform · Daten in EU/UK'}</p>
          </div>
        </div>
      </footer>

      {/* In-Page Kontakt-Modal — kein mailto-Sprung in eine externe Mail-App */}
      {contactOpen && (
        <ContactModal lang={lang} onClose={() => setContactOpen(false)} />
      )}

    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Contact Modal — Inline-Formular auf der Landing-Page mit Honeypot-Spam-Schutz
// ──────────────────────────────────────────────────────────────────────────────
function ContactModal({ lang, onClose }: { lang: 'de' | 'en'; onClose: () => void }) {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [hp, setHp]           = useState('')  // Honeypot — bleibt leer bei echten Usern
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [done, setDone]       = useState(false)

  const isEn = lang === 'en'

  const valid = name.trim().length >= 2 && email.includes('@') && message.trim().length >= 10

  async function send() {
    if (!valid) {
      setError(isEn ? 'Please fill name, email and message (min. 10 chars).' : 'Bitte Name, E-Mail und Nachricht (min. 10 Zeichen) ausfüllen.')
      return
    }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          subject: subject.trim() || undefined,
          message: message.trim(),
          hp,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDone(true)
      setTimeout(onClose, 2200)
    } catch (e) {
      setError(e instanceof Error ? e.message : (isEn ? 'Sending failed' : 'Versand fehlgeschlagen'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
         onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-zinc-100">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-500">{isEn ? 'Contact' : 'Kontakt'}</p>
            <h2 className="text-xl font-black text-zinc-950 mt-0.5">{isEn ? 'How can we help?' : 'Wie können wir helfen?'}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 disabled:opacity-50 text-xl leading-none">✕</button>
        </div>

        {done ? (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="font-bold text-zinc-900 text-base">{isEn ? 'Message sent!' : 'Nachricht verschickt!'}</p>
            <p className="text-sm text-zinc-500 mt-1">{isEn ? 'We typically reply within 24 hours.' : 'Wir antworten meist innerhalb 24 Stunden.'}</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">{isEn ? 'Name *' : 'Name *'}</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value.slice(0, 200))}
                  placeholder={isEn ? 'Max Mustermann' : 'Max Mustermann'}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">{isEn ? 'Email *' : 'E-Mail *'}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value.slice(0, 254))}
                  placeholder="max@example.com"
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">{isEn ? 'Phone (optional)' : 'Telefon (optional)'}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.slice(0, 50))}
                  placeholder="+49 …"
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">{isEn ? 'Subject (optional)' : 'Betreff (optional)'}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value.slice(0, 200))}
                  placeholder={isEn ? 'Trial / pricing / etc.' : 'Demo / Preise / …'}
                  className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">{isEn ? 'Your message *' : 'Dein Anliegen *'}</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, 10000))}
                rows={5}
                placeholder={isEn ? 'Tell us what you need…' : 'Schreib uns, was du brauchst…'}
                className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-y"
              />
              <p className="text-[10px] text-zinc-400 mt-1">{message.length}/10.000 {isEn ? 'characters' : 'Zeichen'}</p>
            </div>
            {/* Honeypot — versteckt vor Usern, aber Bots füllen alle Felder */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={hp}
              onChange={e => setHp(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
              aria-hidden="true"
            />
            {error && (
              <div className="text-xs p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>
            )}
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              {isEn
                ? <>Your data is sent to <strong>oss@osss.pro</strong> only — no marketing list, no third parties. <Link href="/datenschutz" className="underline">Privacy policy</Link>.</>
                : <>Deine Angaben gehen nur an <strong>oss@osss.pro</strong> — keine Liste, keine Dritten. <Link href="/datenschutz" className="underline">Datenschutz</Link>.</>}
            </p>
            <div className="flex gap-2 pt-2">
              <button onClick={onClose} disabled={busy}
                className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50">
                {isEn ? 'Cancel' : 'Abbrechen'}
              </button>
              <button onClick={send} disabled={busy || !valid}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-300 disabled:cursor-not-allowed text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                {busy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-zinc-700 border-t-transparent rounded-full animate-spin" />
                    {isEn ? 'Sending…' : 'Sende…'}
                  </>
                ) : (
                  isEn ? 'Send message →' : 'Nachricht senden →'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
