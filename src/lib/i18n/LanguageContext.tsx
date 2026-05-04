'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Lang } from './translations'

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (section: string, key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LangCtx>({
  lang: 'de',
  setLang: () => {},
  t: (_s, _k) => '',
})

// Flat import so we can navigate by section.key at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _translations: any = null
async function getTranslations() {
  if (!_translations) {
    _translations = (await import('./translations')).translations
  }
  return _translations
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trans, setTrans] = useState<any>(null)

  useEffect(() => {
    // Read from localStorage
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('lang') : null) as Lang | null
    if (saved === 'en' || saved === 'de') setLangState(saved)
    // Load translations
    getTranslations().then(setTrans)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    if (typeof window !== 'undefined') localStorage.setItem('lang', l)
  }

  function t(section: string, key: string, vars?: Record<string, string | number>): string {
    if (!trans) return key
    const sectionObj = trans[section]
    if (!sectionObj) return key
    const entry = sectionObj[key]
    if (!entry) return key
    let str: string = entry[lang] ?? entry['de'] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
