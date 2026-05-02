'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, ExternalLink, QrCode, ArrowRight, UserPlus } from 'lucide-react'

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
    <div className="p-4 md:p-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <UserPlus size={18} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Mitglieder-Anmeldelink</h1>
          <p className="text-zinc-400 text-xs mt-0.5">Teile diesen Link — neue Mitglieder registrieren sich selbst</p>
        </div>
      </div>

      {/* Link card */}
      {signupUrl ? (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden mb-6">
          <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Dein Link</p>
            <p className="text-sm text-zinc-700 font-mono break-all leading-relaxed">{signupUrl}</p>
          </div>
          <div className="flex gap-3 p-4">
            <button
              onClick={copy}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-zinc-950 hover:bg-zinc-800 text-white'
              }`}
            >
              {copied ? <><Check size={15} /> Kopiert!</> : <><Copy size={15} /> Link kopieren</>}
            </button>
            <a
              href={signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 text-sm font-medium transition-colors"
            >
              <ExternalLink size={14} /> Öffnen
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8 text-center mb-6">
          <QrCode size={32} className="text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Kein Link verfügbar. Bitte Onboarding abschließen.</p>
        </div>
      )}

      {/* How it works */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 mb-5">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">So funktioniert es</p>
        <div className="space-y-4">
          {[
            { n: '01', title: 'Link teilen', desc: 'Per WhatsApp, Instagram oder als QR-Code im Gym aufhängen.' },
            { n: '02', title: 'Formular ausfüllen', desc: 'Name, Adresse, Geburtsdatum — alles digital, kein Papierkram.' },
            { n: '03', title: 'Vertrag unterschreiben', desc: 'Mitglied liest deinen Vertrag und unterschreibt per Finger oder Maus.' },
            { n: '04', title: 'Du aktivierst', desc: 'Erscheint in deiner Mitgliederliste — du aktivierst mit einem Klick.' },
          ].map(step => (
            <div key={step.n} className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-600 text-xs font-black">{step.n}</span>
              </div>
              <div className="pt-1">
                <p className="font-semibold text-zinc-900 text-sm">{step.title}</p>
                <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR tip */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <QrCode size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-semibold text-sm mb-1">QR-Code erstellen</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              Kopiere deinen Link und erstelle kostenlos einen QR-Code auf{' '}
              <a href="https://www.qr-code-generator.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                qr-code-generator.com
              </a>
              {' '}— ausdrucken und am Empfang aufhängen.
            </p>
            <a href="https://www.qr-code-generator.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-amber-700 hover:text-amber-900 text-xs font-semibold transition-colors">
              QR-Code erstellen <ArrowRight size={11} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
