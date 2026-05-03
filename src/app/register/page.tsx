'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { LogoMark } from '@/components/Logo'
import { ArrowRight, Check } from 'lucide-react'

const PERKS = [
  'Kostenlos bis 30 Mitglieder',
  'Keine Kreditkarte nötig',
  'In 10 Minuten live',
  'DSGVO-konform · Made in Germany',
]

const BULLETS = [
  'Mitglieder & Beiträge auf einen Blick',
  'Zahlungen per Stripe — automatisch',
  'Member-Portal ohne App',
  'Stundenplan & Gürtel-Tracking',
]

export default function RegisterPage() {
  const router = useRouter()
  const [gymName,  setGymName]  = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)

  async function handleGoogle() {
    setOauthLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setOauthLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gymName, email, password }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Registrierung fehlgeschlagen')
      setLoading(false); return
    }

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError('Konto erstellt — bitte melde dich an.')
      setLoading(false)
      router.push('/login')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">

      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col bg-zinc-950 relative overflow-hidden">
        {/* Amber glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 50% at 20% 0%, rgba(251,191,36,0.10) 0%, transparent 60%)' }} />
        {/* Dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-30"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Logo */}
        <div className="relative px-10 pt-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center flex-shrink-0">
            <LogoMark className="w-4 h-3 text-zinc-950" />
          </div>
          <span className="font-black text-xl tracking-tight text-white">Osss</span>
        </div>

        {/* Headline + bullets */}
        <div className="relative flex-1 flex flex-col justify-center px-10 py-12">
          <h2 className="text-3xl xl:text-4xl font-black tracking-tight text-white mb-3 leading-tight">
            Dein Gym.<br />
            <span className="text-amber-400">Endlich organisiert.</span>
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8 max-w-xs">
            Alles was du für ein professionelles Gym brauchst — in einer Software.
          </p>
          <ul className="space-y-3">
            {BULLETS.map(b => (
              <li key={b} className="flex items-center gap-3 text-sm text-zinc-300">
                <div className="w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center flex-shrink-0">
                  <Check size={10} className="text-amber-400" />
                </div>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Screenshot preview */}
        <div className="relative mx-6 mb-0">
          <div className="rounded-t-xl overflow-hidden border border-zinc-700/60 shadow-2xl shadow-black/40">
            <div className="bg-zinc-800 px-4 py-2.5 flex items-center gap-2 border-b border-zinc-700/60">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-600" />
              </div>
              <div className="flex-1 mx-3 bg-zinc-900 rounded px-3 py-1 text-[10px] text-zinc-500 font-mono">
                app.osss.pro/dashboard
              </div>
            </div>
            <Image
              src="/screenshot_betrieb.png"
              alt="Osss Dashboard"
              width={1796}
              height={876}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex flex-col">
        {/* Top bar — safe-area-inset-top keeps content below iOS status bar in PWA mode */}
        <div className="flex items-center justify-between px-6 border-b border-zinc-100 lg:border-b-0 lg:justify-end"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: '1rem' }}>
          <Link href="/" className="flex items-center gap-2.5 group lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-amber-400 group-hover:bg-amber-300 flex items-center justify-center transition-colors">
              <LogoMark className="w-4 h-3 text-zinc-950" />
            </div>
            <span className="font-black text-lg tracking-tight text-zinc-950">Osss</span>
          </Link>
          <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors lg:px-6 lg:py-4">
            Bereits registriert? <span className="text-amber-600 font-semibold">Anmelden</span>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-2xl font-black text-zinc-950 tracking-tight mb-1">Gym kostenlos starten</h1>
              <p className="text-zinc-400 text-sm">Kein Risiko. In 10 Minuten live.</p>
            </div>

            {/* Perks */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              {PERKS.map(p => (
                <div key={p} className="flex items-start gap-2 text-xs text-zinc-500">
                  <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check size={9} className="text-amber-600" />
                  </div>
                  {p}
                </div>
              ))}
            </div>

            {/* Google OAuth — schnellste Möglichkeit zu starten */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-semibold text-sm transition-all disabled:opacity-50 shadow-sm mb-4"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                <path d="M47.532 24.552c0-1.636-.132-3.196-.388-4.692H24.48v9.13h12.985c-.572 2.992-2.244 5.524-4.764 7.22v5.996h7.708c4.508-4.156 7.123-10.28 7.123-17.654z" fill="#4285F4"/>
                <path d="M24.48 48c6.48 0 11.92-2.148 15.893-5.82l-7.708-5.996c-2.148 1.44-4.896 2.288-8.185 2.288-6.296 0-11.628-4.252-13.532-9.972H3.044v6.192C7.004 42.58 15.116 48 24.48 48z" fill="#34A853"/>
                <path d="M10.948 28.5A14.52 14.52 0 0 1 10.16 24c0-1.564.272-3.08.788-4.5V13.308H3.044A23.988 23.988 0 0 0 .48 24c0 3.876.924 7.548 2.564 10.692L10.948 28.5z" fill="#FBBC05"/>
                <path d="M24.48 9.528c3.548 0 6.728 1.22 9.232 3.62l6.908-6.908C36.392 2.38 30.96 0 24.48 0 15.116 0 7.004 5.42 3.044 13.308l7.904 6.192c1.904-5.72 7.236-9.972 13.532-9.972z" fill="#EA4335"/>
              </svg>
              {oauthLoading ? 'Weiterleitung…' : 'Mit Google registrieren'}
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-zinc-100" />
              <span className="text-xs text-zinc-400 font-medium">oder mit E-Mail</span>
              <div className="flex-1 h-px bg-zinc-100" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Gym-Name</label>
                <input
                  type="text" value={gymName} onChange={e => setGymName(e.target.value)} required
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all text-sm"
                  placeholder="Mein BJJ Gym"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">E-Mail</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all text-sm"
                  placeholder="coach@mygym.de"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Passwort</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all text-sm"
                  placeholder="Mindestens 6 Zeichen"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
              >
                {loading ? 'Wird erstellt…' : <>Gym erstellen <ArrowRight size={15} /></>}
              </button>
            </form>

            <p className="text-center mt-5 text-zinc-400 text-xs">
              Mit der Registrierung stimmst du den <Link href="/datenschutz" className="underline hover:text-zinc-700">Datenschutzbestimmungen</Link> zu.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
