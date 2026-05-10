'use client'

/**
 * Landing Hero — animation-heavy Client island.
 *
 * Wraps the parts of the original src/app/page.tsx that needed framer-motion,
 * scroll-driven parallax (`useScroll` / `useTransform`), iOS install-prompt
 * detection (`beforeinstallprompt`, display-mode standalone), the mobile menu
 * toggle and the contact-modal trigger. Static (non-animated) text and the
 * sections below the fold are rendered directly from the parent RSC page.
 *
 * Props:
 *   - lang: server-detected language (de/en) so the server-rendered HTML and
 *     the client hydration agree on the first paint.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { Shield, ArrowRight, Zap, Award, Menu, X } from 'lucide-react'
import { OsssLogo } from '@/components/Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { ContactModal } from './ContactModal'

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

interface Props {
  lang: 'de' | 'en'
}

export function HeroAnimations({ lang }: Props) {
  const [loggedIn, setLoggedIn]       = useState(false)
  const [checked, setChecked]         = useState(false)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showIosHint, setShowIosHint]     = useState(false)
  const [appInstalled, setAppInstalled]   = useState(false)

  useEffect(() => {
    // Dynamic-import keeps @supabase out of the landing page's initial chunk —
    // ~220 KB raw shaved off first-paint critical path.
    let cancelled = false
    import('@/lib/supabase/client')
      .then(({ createClient }) => createClient().auth.getSession())
      .then(({ data: { session } }) => {
        if (cancelled) return
        setLoggedIn(!!session); setChecked(true)
      })
      .catch(() => { if (!cancelled) setChecked(true) })
    return () => { cancelled = true }
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

  return (
    <>
      {/* ── NAV ── plain <nav> statt motion.nav: framer-motion's initial={{ opacity: 0 }}
           hat den Nav für ~400ms unsichtbar gemacht beim Direkt-Sprung auf Anchor wie
           /#book-demo (User klickt von Subseite → Page lädt → Browser auto-scrollt zu
           Anchor → User sieht Section ohne Nav weil Animation noch lief). Plus:
           framer-motion fügt inline transform=translate3d hinzu, was sticky-Verhalten
           in Edge/Safari instabil macht. */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <OsssLogo variant="dark" />
          <div className="flex items-center gap-5 sm:gap-6">
            <Link href="/pricing" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden sm:block">{lang === 'en' ? 'Pricing' : 'Preise'}</Link>
            <Link href="/about" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden sm:block">{lang === 'en' ? 'About' : 'Über'}</Link>
            <Link href="/blog" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden lg:block">Blog</Link>
            <Link href="/ressourcen" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden xl:block">{lang === 'en' ? 'Resources' : 'Ressourcen'}</Link>
            <button onClick={() => setContactOpen(true)} data-track="cta_contact_header" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden lg:block">{lang === 'en' ? 'Contact' : 'Kontakt'}</button>
            <LanguageSwitcher variant="minimal" />
            {/* Primary-CTA-Slot — symmetrisch zur Logged-in-Variante: gleiche Position
                + amber-Filled-Button. Demo buchen ersetzt „Kostenlos starten" weil
                Demo-Pfad konvertierungsstärker für Studio-Owner ist (warmer Lead). */}
            {checked && (loggedIn
              ? <Link href="/dashboard" className="bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-2 rounded-lg transition-colors">Dashboard</Link>
              : <>
                  <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium hidden sm:block">{lang === 'en' ? 'Log in' : 'Anmelden'}</Link>
                  <a href="#book-demo" data-track="cta_demo_header"
                    className="bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-2 rounded-lg transition-colors hidden sm:inline-flex items-center gap-1.5">
                    <Zap size={13} />
                    {lang === 'en' ? 'Book demo' : 'Demo buchen'}
                  </a>
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
              <Link href="/about" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50 transition-colors">{lang === 'en' ? 'About' : 'Über uns'}</Link>
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
                  : <a href="#book-demo" onClick={() => setMenuOpen(false)} className="block text-center bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-3 rounded-xl transition-colors">{lang === 'en' ? 'Book demo' : 'Demo buchen'}</a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

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
                {lang === 'en'
                  ? <>Save 8 h admin per&nbsp;month.<br /><span className="text-amber-500">Keep 100 % of your fees.</span></>
                  : <>Spar 8 Std. Admin pro&nbsp;Monat.<br /><span className="text-amber-500">Behalte jeden Euro Beitrag.</span></>}
              </motion.h1>

              <motion.p variants={fadeUp} className="text-zinc-500 text-lg mb-8 leading-relaxed">
                {lang === 'en'
                  ? <>Members, SEPA, schedule and belts — all in one tool. <span className="text-zinc-800 font-semibold">0 % platform fee</span> on payments. Free up to 30&nbsp;members.</>
                  : <>Mitglieder, SEPA, Stundenplan und Belts — alles in einem Tool. <span className="text-zinc-800 font-semibold">0 % Plattformgebühr</span> auf Beiträge. Bis 30&nbsp;Mitglieder gratis.</>}
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-3">
                <Link href="/register" data-track="cta_signup_hero"
                  className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/20">
                  <Zap size={16} className="text-amber-400" />
                  {lang === 'en' ? 'Free account in 60 sec' : 'Gratis Account in 60 Sek.'}
                </Link>
                <Link href="#book-demo" data-track="cta_demo_hero"
                  className="border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold px-8 py-3.5 rounded-xl text-base transition-all flex items-center justify-center gap-2">
                  {lang === 'en' ? 'Or: book a 20-min demo' : 'Oder: 20-Min-Demo buchen'} <ArrowRight size={15} />
                </Link>
              </motion.div>

              <motion.p variants={fadeUp} className="text-zinc-400 text-xs mb-8 tracking-wide">
                {lang === 'en'
                  ? 'No credit card · Free up to 30 members · Cancel anytime'
                  : 'Ohne Kreditkarte · Bis 30 Mitglieder gratis · Jederzeit kündbar'}
              </motion.p>

              {!appInstalled && installPrompt !== null && (
                <motion.div variants={fadeUp} className="mb-8">
                  <button onClick={handleInstallClick}
                    className="text-zinc-500 hover:text-zinc-900 text-xs font-medium underline decoration-dotted underline-offset-4 transition-colors">
                    {lang === 'en' ? 'Install as app on this device' : 'Als App auf diesem Gerät installieren'}
                  </button>
                </motion.div>
              )}

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
                        <span>{lang === 'en' ? <>Scroll and tap <strong>&quot;Add to Home Screen&quot;</strong></> : <>Scrolle und tippe auf <strong>„Zum Home-Bildschirm&quot;</strong></>}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                        <span>{lang === 'en' ? <>Tap <strong>&quot;Add&quot;</strong> in the top right</> : <>Oben rechts auf <strong>„Hinzufügen&quot;</strong> tippen</>}</span>
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
                  { val: '0 %',     label: 'platform fee on dues' },
                  { val: '30',      label: 'free members forever' },
                  { val: 'DATEV',   label: 'export built-in' },
                  { val: 'GDPR',    label: 'data in EU/UK' },
                ] : [
                  { val: '0 %',     label: 'Plattformgebühr auf Beiträge' },
                  { val: '30',      label: 'Mitglieder dauerhaft gratis' },
                  { val: 'DATEV',   label: 'Export inklusive' },
                  { val: 'DSGVO',   label: 'Daten in EU/UK' },
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

        {/* Dunkle Vignette */}
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

        {/* Same vignette as podium */}
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

      {/* In-Page Kontakt-Modal */}
      {contactOpen && (
        <ContactModal lang={lang} onClose={() => setContactOpen(false)} />
      )}
    </>
  )
}
