'use client'

import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  /** Visual style: 'pills' (default) = flag+label buttons, 'minimal' = just two letters */
  variant?: 'pills' | 'minimal'
  className?: string
}

export function LanguageSwitcher({ variant = 'pills', className = '' }: Props) {
  const { lang, setLang } = useLanguage()

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-1 text-xs font-semibold ${className}`}>
        <button
          onClick={() => setLang('de')}
          className={`px-1.5 py-0.5 rounded transition-colors ${lang === 'de' ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          DE
        </button>
        <span className="text-slate-300">|</span>
        <button
          onClick={() => setLang('en')}
          className={`px-1.5 py-0.5 rounded transition-colors ${lang === 'en' ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          EN
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={() => setLang('de')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
          lang === 'de'
            ? 'bg-amber-500 text-white'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        🇩🇪 DE
      </button>
      <button
        onClick={() => setLang('en')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
          lang === 'en'
            ? 'bg-amber-500 text-white'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        🇬🇧 EN
      </button>
    </div>
  )
}
