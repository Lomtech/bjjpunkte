'use client'

import { useState } from 'react'
import { Mail, ArrowRight, Check } from 'lucide-react'

/**
 * Newsletter-Anmeldeformular mit Double-Opt-In.
 *
 * Verwendung:
 *   <NewsletterSignup source="landing-footer" />
 *   <NewsletterSignup source="blog-index" variant="hero" />
 */

interface Props {
  source: string
  variant?: 'compact' | 'hero'
  title?: string
  description?: string
}

export function NewsletterSignup({ source, variant = 'compact', title, description }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (status === 'submitting' || status === 'success') return
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Bitte eine gültige E-Mail-Adresse eingeben.')
      setStatus('error')
      return
    }
    setStatus('submitting')
    setErrorMsg('')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Fehler bei der Anmeldung')
      }
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setStatus('error')
    }
  }

  if (variant === 'hero') {
    return (
      <div className="bg-zinc-950 rounded-2xl p-8 sm:p-10 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 100% 0%, rgba(251,191,36,0.10) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-md">
          <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1 mb-5">
            <Mail size={11} className="text-amber-400" />
            <span className="text-amber-300 text-[10px] font-bold uppercase tracking-wider">Newsletter</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tighter mb-3">
            {title ?? 'Praxis-Tipps für Kampfsport-Vereine.'}
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            {description ?? 'DSGVO, DATEV, SEPA, Mitgliederverwaltung — höchstens 1× pro Woche, sofort abbestellbar.'}
          </p>
          <SignupForm
            email={email}
            setEmail={setEmail}
            status={status}
            errorMsg={errorMsg}
            onSubmit={handleSubmit}
            theme="dark"
          />
        </div>
      </div>
    )
  }

  // Compact variant — same brand as hero, but lighter
  return (
    <div className="bg-white border-2 border-amber-200 rounded-2xl p-5 sm:p-6">
      <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mb-3">
        <Mail size={11} className="text-amber-600" />
        <span className="text-amber-700 text-[10px] font-bold uppercase tracking-wider">Newsletter</span>
      </div>
      <h3 className="font-black text-zinc-950 text-lg mb-1.5 tracking-tight">
        {title ?? 'Bleib auf dem Laufenden'}
      </h3>
      <p className="text-sm text-zinc-500 leading-relaxed mb-4">
        {description ?? 'Praxis-Tipps für Kampfsport-Vereine — höchstens 1× pro Woche.'}
      </p>
      <SignupForm
        email={email}
        setEmail={setEmail}
        status={status}
        errorMsg={errorMsg}
        onSubmit={handleSubmit}
        theme="light"
      />
    </div>
  )
}

function SignupForm({
  email, setEmail, status, errorMsg, onSubmit, theme,
}: {
  email: string
  setEmail: (v: string) => void
  status: 'idle' | 'submitting' | 'success' | 'error'
  errorMsg: string
  onSubmit: (e: React.FormEvent) => void
  theme: 'light' | 'dark'
}) {
  if (status === 'success') {
    return (
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3.5 ${
        theme === 'dark' ? 'bg-emerald-900/30 border border-emerald-800/50' : 'bg-emerald-50 border border-emerald-200'
      }`}>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
          theme === 'dark' ? 'bg-emerald-500' : 'bg-emerald-500'
        }`}>
          <Check size={14} className="text-white" />
        </div>
        <div>
          <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-emerald-100' : 'text-emerald-900'}`}>
            Bestätigungs-Mail unterwegs
          </p>
          <p className={`text-xs ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}`}>
            Klick den Link in der Mail, um deine Anmeldung zu bestätigen.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="deine@email.de"
          autoComplete="email"
          required
          disabled={status === 'submitting'}
          className={`flex-1 px-4 py-3 rounded-xl text-[16px] sm:text-sm transition-colors focus:outline-none focus:ring-2 ${
            theme === 'dark'
              ? 'bg-white/10 border border-white/20 text-white placeholder-zinc-400 focus:ring-amber-400/40 focus:border-amber-400'
              : 'bg-white border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:ring-amber-200 focus:border-amber-400'
          }`}
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="flex items-center justify-center gap-2 font-bold px-5 py-3 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 bg-amber-400 hover:bg-amber-300 text-zinc-950"
        >
          {status === 'submitting' ? 'Wird gesendet…' : <>Abonnieren <ArrowRight size={14} /></>}
        </button>
      </div>
      {status === 'error' && errorMsg && (
        <p className="text-xs text-rose-500">{errorMsg}</p>
      )}
      <p className={`text-[11px] leading-relaxed ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
        Mit der Anmeldung akzeptierst du unsere <a href="/datenschutz" className={`underline ${theme === 'dark' ? 'hover:text-zinc-300' : 'hover:text-zinc-600'}`}>Datenschutzerklärung</a>.
        Abmeldung jederzeit per 1-Klick-Link in jeder Mail.
      </p>
    </form>
  )
}
