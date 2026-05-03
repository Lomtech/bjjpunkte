'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, ExternalLink, QrCode, ArrowRight, UserPlus, Dumbbell } from 'lucide-react'

interface LinkCardProps {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  title: string
  description: string
  url: string | null
  emptyText: string
  copied: boolean
  onCopy: () => void
}

function LinkCard({ icon, iconBg, iconColor, title, description, url, emptyText, copied, onCopy }: LinkCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-zinc-100">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <p className="font-bold text-zinc-900 text-sm">{title}</p>
          <p className="text-zinc-400 text-xs mt-0.5">{description}</p>
        </div>
      </div>

      {url ? (
        <>
          <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50">
            <p className="text-xs text-zinc-500 font-mono break-all leading-relaxed">{url}</p>
          </div>
          <div className="flex gap-3 p-4">
            <button
              onClick={onCopy}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-zinc-950 hover:bg-zinc-800 text-white'
              }`}
            >
              {copied ? <><Check size={15} /> Kopiert!</> : <><Copy size={15} /> Link kopieren</>}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 text-sm font-medium transition-colors"
            >
              <ExternalLink size={14} /> Öffnen
            </a>
          </div>
        </>
      ) : (
        <div className="px-5 py-8 text-center">
          <QrCode size={28} className="text-zinc-200 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">{emptyText}</p>
        </div>
      )}
    </div>
  )
}

export default function LinksPage() {
  const [signupUrl,  setSignupUrl]  = useState<string | null>(null)
  const [trialUrl,   setTrialUrl]   = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [copiedSignup, setCopiedSignup] = useState(false)
  const [copiedTrial,  setCopiedTrial]  = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase
        .from('gyms')
        .select('signup_token, slug')
        .single()

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://osss.pro'
      if (gym?.signup_token) setSignupUrl(`${origin}/signup/${gym.signup_token}`)
      if ((gym as any)?.slug) setTrialUrl(`${origin}/gym/${(gym as any).slug}`)
      setLoading(false)
    }
    load()
  }, [])

  function copy(url: string, which: 'signup' | 'trial') {
    navigator.clipboard.writeText(url)
    if (which === 'signup') {
      setCopiedSignup(true)
      setTimeout(() => setCopiedSignup(false), 2000)
    } else {
      setCopiedTrial(true)
      setTimeout(() => setCopiedTrial(false), 2000)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Lädt…</div>
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Zugänge & Links</h1>
        <p className="text-zinc-400 text-xs mt-0.5 font-medium">Teile diese Links — für neue Mitglieder und Interessenten</p>
      </div>

      {/* Two link cards */}
      <div className="space-y-4 mb-8">
        <LinkCard
          icon={<UserPlus size={17} />}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          title="Anmeldelink"
          description="Neue Mitglieder registrieren sich selbst — mit Vertrag & Unterschrift"
          url={signupUrl}
          emptyText="Kein Link verfügbar. Bitte Onboarding abschließen."
          copied={copiedSignup}
          onCopy={() => signupUrl && copy(signupUrl, 'signup')}
        />

        <LinkCard
          icon={<Dumbbell size={17} />}
          iconBg="bg-zinc-100"
          iconColor="text-zinc-600"
          title="Probetraining-Link"
          description="Interessenten sehen dein Gym und buchen ein Probetraining"
          url={trialUrl}
          emptyText="Noch kein Gym-Slug eingerichtet. Unter Einstellungen → Zugänge konfigurieren."
          copied={copiedTrial}
          onCopy={() => trialUrl && copy(trialUrl, 'trial')}
        />
      </div>

      {/* How it works — two columns */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <UserPlus size={14} className="text-amber-600" />
            </div>
            <p className="text-xs font-semibold text-zinc-700">Anmeldelink — Ablauf</p>
          </div>
          <div className="space-y-3">
            {[
              { n: '01', title: 'Link teilen', desc: 'Per WhatsApp, Instagram oder als Aushang.' },
              { n: '02', title: 'Formular ausfüllen', desc: 'Name, Adresse, Geburtsdatum — komplett digital.' },
              { n: '03', title: 'Vertrag unterschreiben', desc: 'Mitglied liest Vertrag und unterschreibt.' },
              { n: '04', title: 'Du aktivierst', desc: 'Erscheint in der Mitgliederliste — ein Klick.' },
            ].map(s => (
              <div key={s.n} className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600 text-[10px] font-black mt-0.5">{s.n}</span>
                <div>
                  <p className="font-semibold text-zinc-900 text-xs">{s.title}</p>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
              <Dumbbell size={14} className="text-zinc-600" />
            </div>
            <p className="text-xs font-semibold text-zinc-700">Probetraining — Ablauf</p>
          </div>
          <div className="space-y-3">
            {[
              { n: '01', title: 'Link teilen', desc: 'Instagram-Bio, Stories oder direkt per WhatsApp.' },
              { n: '02', title: 'Gym entdecken', desc: 'Interessent sieht dein Gym, Stundenplan & Preise.' },
              { n: '03', title: 'Klasse buchen', desc: 'Interessent trägt sich für ein Probetraining ein.' },
              { n: '04', title: 'Du siehst es', desc: 'Neuer Lead erscheint automatisch unter Interessenten.' },
            ].map(s => (
              <div key={s.n} className="flex gap-2.5 items-start">
                <span className="w-5 h-5 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center flex-shrink-0 text-zinc-600 text-[10px] font-black mt-0.5">{s.n}</span>
                <div>
                  <p className="font-semibold text-zinc-900 text-xs">{s.title}</p>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QR tip */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <QrCode size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-semibold text-sm mb-1">QR-Code erstellen</p>
            <p className="text-amber-700 text-xs leading-relaxed">
              Kopiere einen der Links und erstelle kostenlos einen QR-Code auf{' '}
              <a href="https://www.qr-code-generator.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                qr-code-generator.com
              </a>
              {' '}— ausdrucken und am Empfang oder auf Social Media teilen.
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
