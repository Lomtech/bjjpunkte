'use client'

import { useState } from 'react'
import { ContactModal } from './ContactModal'

/**
 * Standalone "Contact" trigger — used in the footer of the landing page so the
 * footer can stay an RSC. The hero/nav has its own modal state inside
 * HeroAnimations; the footer link uses this lightweight wrapper instead.
 */
interface Props {
  lang: 'de' | 'en'
  className?: string
}

export function ContactButton({ lang, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'text-zinc-500 hover:text-zinc-900 text-sm transition-colors text-left'}
      >
        {lang === 'en' ? 'Contact' : 'Kontakt'}
      </button>
      {open && <ContactModal lang={lang} onClose={() => setOpen(false)} />}
    </>
  )
}
