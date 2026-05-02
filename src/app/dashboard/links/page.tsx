'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, Link2, QrCode, ExternalLink, Users, UserPlus } from 'lucide-react'

interface LinkRow {
  label: string
  url: string
  description: string
  icon: React.ReactNode
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }
  return { copied, copy }
}

function LinkCard({ label, url, description, icon }: LinkRow) {
  const { copied, copy } = useCopy()

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900 text-sm">{label}</p>
          <p className="text-zinc-400 text-xs mt-0.5">{description}</p>
        </div>
      </div>

      {/* URL display */}
      <div className="flex items-center gap-2 bg-zinc-50 rounded-xl px-3 py-2.5 mb-3 border border-zinc-100">
        <span className="text-xs text-zinc-500 truncate flex-1 font-mono">{url}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => copy(url, label)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            copied === label
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-zinc-950 hover:bg-zinc-800 text-white'
          }`}>
          {copied === label ? <><Check size={14} /> Kopiert!</> : <><Copy size={14} /> Link kopieren</>}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-medium transition-colors">
          <ExternalLink size={13} /> Öffnen
        </a>
      </div>
    </div>
  )
}

export default function LinksPage() {
  const [signupUrl, setSignupUrl] = useState<string | null>(null)
  const [gymUrl,    setGymUrl]    = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: gym } = await (supabase as any)
        .from('gyms')
        .select('signup_token, slug')
        .single()

      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://osss.pro'

      if (gym?.signup_token) {
        setSignupUrl(`${origin}/signup/${gym.signup_token}`)
      }
      if (gym?.slug) {
        setGymUrl(`${origin}/gym/${gym.slug}`)
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Lädt…</div>
    )
  }

  const links: LinkRow[] = [
    ...(signupUrl ? [{
      label: 'Mitglieder-Anmeldelink',
      url: signupUrl,
      description: 'Neue Mitglieder füllen online den Vertrag aus und unterschreiben digital.',
      icon: <UserPlus size={16} className="text-amber-600" />,
    }] : []),
    ...(gymUrl ? [{
      label: 'Öffentliche Gym-Seite',
      url: gymUrl,
      description: 'Interessenten sehen deinen Stundenplan, Preise und können Probetraining anfragen.',
      icon: <Users size={16} className="text-amber-600" />,
    }] : []),
  ]

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <Link2 size={18} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Zugänge & Links</h1>
          <p className="text-zinc-400 text-xs mt-0.5">Deine öffentlichen Links — teile sie mit Interessenten und Mitgliedern</p>
        </div>
      </div>

      {links.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-zinc-50 flex items-center justify-center mx-auto mb-3">
            <QrCode size={20} className="text-zinc-400" />
          </div>
          <p className="text-zinc-900 font-semibold text-sm mb-1">Keine Links verfügbar</p>
          <p className="text-zinc-400 text-xs">Schließe das Onboarding ab, um deine Links zu aktivieren.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {links.map(link => (
            <LinkCard key={link.label} {...link} />
          ))}

          {/* Tip */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-amber-800 mb-1">Tipp: QR-Code erstellen</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              Drucke einen QR-Code für deinen Anmeldelink aus und hänge ihn im Gym auf —
              neue Interessenten können sich direkt selbst registrieren.
              Einfach den Link in einen kostenlosen QR-Generator (z.B. qr-code-generator.com) eingeben.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
