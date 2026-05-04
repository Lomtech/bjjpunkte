'use client'

import { createContext, useContext, useEffect, useState } from 'react'
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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de')

  useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('lang') : null) as Lang | null
    if (saved === 'en' || saved === 'de') setLangState(saved)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    if (typeof window !== 'undefined') localStorage.setItem('lang', l)
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
