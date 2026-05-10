'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import { SPORTS, getSportFeatures, type SportId } from './data'

const EASE = [0.16, 1, 0.3, 1] as const

interface Props {
  lang: 'de' | 'en'
}

export function SportsTabs({ lang }: Props) {
  const [activeSport, setActiveSport] = useState<SportId>('bjj')
  const SPORT_FEATURES_DATA = getSportFeatures(lang)
  const features = SPORT_FEATURES_DATA[activeSport]
  const hasBelt  = SPORTS.find(s => s.id === activeSport)?.belt ?? false

  return (
    <>
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
              <Link href={`/register?sport=${activeSport}`} data-track="cta_signup_sports_tab"
                className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap">
                {lang === 'en' ? `Set up ${features.title} free` : `${features.title} gratis einrichten`} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
