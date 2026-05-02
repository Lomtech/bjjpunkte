'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, ExternalLink, QrCode, ArrowRight } from 'lucide-react'

export default function LinksPage() {
  const [signupUrl, setSignupUrl] = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [copied,    setCopied]    = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: gym } = await (supabase as any)
        .from('gyms')
        .select('signup_token')
        .single()

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://osss.pro'
      if (gym?.signup_token) setSignupUrl(`${origin}/signup/${gym.signup_token}`)
      setLoading(false)
    }
    load()
  }, [])

  function copy() {
    if (!signupUrl) return
    navigator.clipboard.writeText(signupUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Lädt…</div>
    )
  }

  return (
    <div className="min-h-full bg-zinc-950 text-white">

      {/* Hero section */}
      <div className="px-6 pt-10 pb-8 max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-6 h-px bg-amber-400" />
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">Mitglieder-Anmeldelink</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-3">
          Neue Mitglieder<br />
          <span className="text-amber-400">digital anmelden.</span>
        </h1>
        <p className="text-zinc-400 text-base leading-relaxed max-w-md">
          Teile diesen Link und neue Mitglieder können sich selbst registrieren,
          den Vertrag lesen und digital unterschreiben — ohne Papierkram.
        </p>
      </div>

      {/* Link card */}
      <div className="px-6 max-w-2xl">
        {signupUrl ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            {/* URL display */}
            <div className="px-5 pt-5 pb-4 border-b border-zinc-800">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Dein Link</p>
              <p className="text-sm text-zinc-300 font-mono break-all leading-relaxed">{signupUrl}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-4">
              <button
                onClick={copy}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                }`}
              >
                {copied ? <><Check size={15} /> Kopiert!</> : <><Copy size={15} /> Link kopieren</>}
              </button>
              <a
                href={signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm font-medium transition-colors"
              >
                <ExternalLink size={14} /> Öffnen
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <QrCode size={32} className="text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">Kein Link verfügbar. Bitte Onboarding abschließen.</p>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="px-6 py-10 max-w-2xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-6 h-px bg-amber-400" />
          <span className="text-amber-400 text-xs font-semibold uppercase tracking-widest">So funktioniert es</span>
        </div>

        <div className="space-y-4">
          {[
            { n: '01', title: 'Link teilen', desc: 'Schick den Link per WhatsApp, Instagram oder drucke einen QR-Code aus und häng ihn im Gym auf.' },
            { n: '02', title: 'Mitglied füllt Formular aus', desc: 'Name, Adresse, Geburtsdatum — alles wird digital erfasst. Kein Papierkram für dich.' },
            { n: '03', title: 'Vertrag unterschreiben', desc: 'Das Mitglied liest deinen Vertrag, bestätigt die AGB und unterschreibt digital per Finger oder Maus.' },
            { n: '04', title: 'Du aktivierst das Mitglied', desc: 'Nach dem Absenden erscheint das Mitglied in deiner Liste. Du aktivierst es mit einem Klick.' },
          ].map(step => (
            <div key={step.n} className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 text-xs font-black">{step.n}</span>
              </div>
              <div className="pt-1 min-w-0">
                <p className="font-bold text-white text-sm mb-0.5">{step.title}</p>
                <p className="text-zinc-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR tip */}
      <div className="px-6 pb-10 max-w-2xl">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <QrCode size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-bold text-sm mb-1">QR-Code erstellen</p>
              <p className="text-amber-400/80 text-sm leading-relaxed">
                Kopiere deinen Link und gib ihn auf{' '}
                <a
                  href="https://www.qr-code-generator.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-300"
                >
                  qr-code-generator.com
                </a>{' '}
                ein — kostenlos, in Sekunden. Drucke den QR-Code aus und hänge ihn am Empfang auf.
              </p>
              <a
                href="https://www.qr-code-generator.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
              >
                QR-Code erstellen <ArrowRight size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
