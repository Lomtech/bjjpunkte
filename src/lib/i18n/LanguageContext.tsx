'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { translations } from './translations'
import type { Lang } from './translations'

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (section: string, key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LangCtx>({
  lang: 'de',
  setLang: () => {},
  t: (_s, k) => k,
})

function buildT(lang: Lang) {
  return function t(section: string, key: string, vars?: Record<string, string | number>): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sectionObj = (translations as any)[section]
    if (!sectionObj) return key
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (sectionObj as any)[key]
    if (!entry) return key
    let str: string = entry[lang] ?? entry['de'] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }
}

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode
  /** When set (e.g. from RSC server-side detection), seed the state instead of defaulting to 'de'. */
  initialLang?: Lang
}) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? 'de')
  const router = useRouter()

  useEffect(() => {
    // Sync to localStorage on first mount, but only if no SSR-provided initialLang
    // already matches (avoids hydration flicker).
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('lang') : null) as Lang | null
    if ((saved === 'en' || saved === 'de') && saved !== lang) setLangState(saved)
    // Mirror state to cookie so future RSC renders see the same lang.
    if (typeof document !== 'undefined') {
      document.cookie = `lang=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }
    // Intentionally only on mount — setLang handles updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setLang(l: Lang) {
    if (l === lang) return
    setLangState(l)
    if (typeof window !== 'undefined') {
      localStorage.setItem('lang', l)
      document.cookie = `lang=${l}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    }
    // RSC-Pages (Landing, About) lesen die Sprache via getServerLang() aus der
    // Cookie. Ohne router.refresh() bleiben sie auf der alten Sprache bis zum
    // nächsten Page-Load, weil RSC-Output bereits gerendert ist. router.refresh()
    // invalidiert den RSC-Cache und holt frische HTML mit neuer Cookie.
    // Client-only-Pages (Dashboard, Pricing, etc.) sind davon nicht betroffen —
    // sie reagieren sofort auf den State-Change. Refresh ist für sie no-op.
    router.refresh()
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: buildT(lang) }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

/** Tiny helper for non-component contexts — reads lang from localStorage directly */
export function getLang(): Lang {
  if (typeof window === 'undefined') return 'de'
  const s = localStorage.getItem('lang')
  return s === 'en' ? 'en' : 'de'
}
