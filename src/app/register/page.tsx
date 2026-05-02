'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LogoMark } from '@/components/Logo'
import { ArrowRight, Check } from 'lucide-react'

const PERKS = [
  'Kostenlos bis 30 Mitglieder',
  'Keine Kreditkarte nötig',
  'In 10 Minuten live',
  'DSGVO-konform · Made in Germany',
]

export default function RegisterPage() {
  const router = useRouter()
  const [gymName,  setGymName]  = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Registrierung fehlgeschlagen')
      setLoading(false); return
    }

    const { error: gymError } = await supabase.from('gyms').insert({ owner_id: data.user.id, name: gymName })
    if (gymError) { setError(gymError.message); setLoading(false); return }

    router.push('/dashboard')
    router.refresh()
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
        <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
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
  )
}
