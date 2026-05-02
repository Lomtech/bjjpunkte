'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LogoMark } from '@/components/Logo'
import { ArrowRight } from 'lucide-react'

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
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-amber-400 group-hover:bg-amber-300 flex items-center justify-center transition-colors">
            <LogoMark className="w-4 h-3 text-zinc-950" />
          </div>
          <span className="font-black text-lg tracking-tight text-zinc-950">Osss</span>
        </Link>
        <Link href="/register" className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
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
  )
}
