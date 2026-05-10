'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X, Zap } from 'lucide-react'
import { OsssLogo } from '@/components/Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { ContactModal } from '@/app/_landing/ContactModal'

/**
 * Einheitliche Top-Navigation für alle öffentlichen Pages.
 *
 * - Logo links → Klick führt zur Startseite
 * - Hauptnav (Preise · Blog · Ressourcen · Kontakt) ab md:
 * - Sprachschalter DE/EN
 * - CTA rechts: "Dashboard" wenn eingeloggt, sonst "Kostenlos starten"
 * - Mobile Hamburger-Menü mit allen Links + CTA
 *
 * Auf der Landing-Page wird sie nicht verwendet (dort ist die Nav inline,
 * mit zusätzlichem "Anmelden"-Link).
 */

interface Props {
  /** Optional: zusätzlicher Zurück-Link links neben Logo (z.B. "← Blog" auf Article-Pages) */
  back?: { href: string; label: string }
}

export function TopNav({ back }: Props) {
  const { lang } = useLanguage()
  const [loggedIn, setLoggedIn] = useState(false)
  const [checked, setChecked] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    try {
      createClient().auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return
        setLoggedIn(!!session)
        setChecked(true)
      }).catch(() => { if (!cancelled) setChecked(true) })
    } catch {
      setChecked(true)
    }
    return () => { cancelled = true }
  }, [])

  const linkClass = 'text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium'

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">

        {/* Left: optional Back-Link + Logo */}
        <div className="flex items-center gap-3 min-w-0">
          {back && (
            <>
              <Link href={back.href}
                className="text-sm text-zinc-400 hover:text-zinc-900 transition-colors font-medium flex items-center gap-1"
              >
                ← {back.label}
              </Link>
              <span className="text-zinc-200 hidden sm:inline">|</span>
            </>
          )}
          <Link href="/" aria-label="Zur Startseite">
            <OsssLogo variant="dark" />
          </Link>
        </div>

        {/* Center/Right: Main Nav (Desktop) */}
        {/* Reihenfolge + Breakpoints SPIEGELN HeroAnimations.tsx —
             damit der Menübalken zwischen Landing und Subseiten konsistent ist
             (sonst springen die Items beim Klicken durch die Pages). */}
        <div className="flex items-center gap-5 sm:gap-6">
          <Link href="/pricing"     className={`${linkClass} hidden sm:block`}>{lang === 'en' ? 'Pricing' : 'Preise'}</Link>
          <Link href="/about"       className={`${linkClass} hidden sm:block`}>{lang === 'en' ? 'About' : 'Über'}</Link>
          <Link href="/blog"        className={`${linkClass} hidden lg:block`}>Blog</Link>
          <Link href="/ressourcen"  className={`${linkClass} hidden xl:block`}>{lang === 'en' ? 'Resources' : 'Ressourcen'}</Link>
          <button
            type="button"
            onClick={() => setContactOpen(true)}
            className={`${linkClass} hidden lg:block`}
          >
            {lang === 'en' ? 'Contact' : 'Kontakt'}
          </button>

          <LanguageSwitcher variant="minimal" />

          {/* CTA — symmetrisch zur Logged-in-Variante. Plain <a> statt <Link>
              für Cross-Page-Hash umgeht Next.js-Prefetch-Cache (Prefetch
              hatte sonst stale-language-Version geladen). */}
          {checked && (loggedIn ? (
            <Link href="/dashboard"
              className="bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-2 rounded-lg transition-colors">
              Dashboard
            </Link>
          ) : (
            <a href="/#book-demo" data-track="cta_demo_topnav"
              className="bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 hidden sm:inline-flex">
              <Zap size={13} />
              {lang === 'en' ? 'Book demo' : 'Demo buchen'}
            </a>
          ))}

          {/* Mobile Hamburger — sm:hidden matched HeroAnimations damit Items erst ab sm: zeigen */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-zinc-100 transition-colors"
            aria-label="Menü"
          >
            {menuOpen
              ? <X size={20} className="text-zinc-700" />
              : <Menu size={20} className="text-zinc-700" />}
          </button>
        </div>
      </div>

      {/* Kontakt-Modal — In-App-Formular statt mailto:-Sprung in die native Mail-App */}
      {contactOpen && <ContactModal lang={lang} onClose={() => setContactOpen(false)} />}

      {/* Mobile Menü — sm:hidden gleich wie HeroAnimations */}
      {menuOpen && (
        <div className="sm:hidden border-t border-zinc-100 bg-white px-5 py-4 flex flex-col gap-1">
          <Link href="/pricing"    onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50">{lang === 'en' ? 'Pricing' : 'Preise'}</Link>
          <Link href="/about"      onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50">{lang === 'en' ? 'About' : 'Über uns'}</Link>
          <Link href="/blog"       onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50">Blog</Link>
          <Link href="/ressourcen" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50">{lang === 'en' ? 'Resources' : 'Ressourcen'}</Link>
          <Link href="/rechner"    onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50">{lang === 'en' ? 'Cost calculator' : 'Kostenrechner'}</Link>
          <button
            type="button"
            onClick={() => { setMenuOpen(false); setContactOpen(true) }}
            className="text-left text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50"
          >
            {lang === 'en' ? 'Contact' : 'Kontakt'}
          </button>
          {checked && !loggedIn && (
            <Link href="/login" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-700 py-2.5 px-3 rounded-lg hover:bg-zinc-50">{lang === 'en' ? 'Log in' : 'Anmelden'}</Link>
          )}
          <div className="pt-1">
            {checked && (loggedIn ? (
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="block text-center bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-3 rounded-xl">Dashboard</Link>
            ) : (
              <a href="/#book-demo" onClick={() => setMenuOpen(false)} className="block text-center bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-bold px-4 py-3 rounded-xl">{lang === 'en' ? 'Book demo' : 'Demo buchen'}</a>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
