'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { LogoMark } from '@/components/Logo'
import { ArrowRight, Check } from 'lucide-react'

const BULLETS = [
  'Mitglieder & Beiträge auf einen Blick',
  'Zahlungen per Stripe — automatisch',
  'Member-Portal ohne App',
  'Stundenplan & Gürtel-Tracking',
]

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
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
            Willkommen<br />
            <span className="text-amber-400">zurück.</span>
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8 max-w-xs">
            Dein Gym wartet. Alles was du brauchst auf einen Blick.
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
          <Link href="/register" className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors lg:px-6 lg:py-4">
            Noch kein Konto? <span className="text-amber-600 font-semibold">Registrieren</span>
          </Link>
        </div>

        {/* Center card */}
        <div className="flex-1 flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h1 className="text-2xl font-black text-zinc-950 tracking-tight mb-1">Willkommen zurück</h1>
              <p className="text-zinc-400 text-sm">Meld dich in deinem Gym-Account an.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">E-Mail</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all text-sm"
                  placeholder="coach@mygym.de"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-zinc-700">Passwort</label>
                  <Link href="/auth/reset" className="text-xs text-zinc-400 hover:text-amber-600 transition-colors">Passwort vergessen?</Link>
                </div>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
              )}

              <button
                type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold transition-all text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
              >
                {loading ? 'Wird angemeldet…' : <>Anmelden <ArrowRight size={15} /></>}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-zinc-100 text-center">
              <p className="text-zinc-400 text-xs">Durch das Anmelden stimmst du den <Link href="/datenschutz" className="underline hover:text-zinc-700">Datenschutzbestimmungen</Link> zu.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
