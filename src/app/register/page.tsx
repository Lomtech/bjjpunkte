'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [gymName, setGymName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Registrierung fehlgeschlagen')
      setLoading(false)
      return
    }

    const { error: gymError } = await supabase.from('gyms').insert({
      owner_id: data.user.id,
      name: gymName,
    })

    if (gymError) {
      setError(gymError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500 mb-4 shadow-lg">
            <span className="text-lg font-black text-white tracking-tight">RC</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">RollCall</h1>
          <p className="text-slate-500 mt-1 text-sm">Gym kostenlos registrieren</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gym-Name</label>
            <input
              type="text"
              value={gymName}
              onChange={e => setGymName(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              placeholder="Mein BJJ Gym"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              placeholder="coach@mygym.de"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              placeholder="Mindestens 6 Zeichen"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold transition-colors shadow-sm"
          >
            {loading ? 'Wird erstellt...' : 'Gym erstellen'}
          </button>
        </form>

        <p className="text-center mt-5 text-slate-500 text-sm">
          Bereits registriert?{' '}
          <Link href="/login" className="text-amber-600 hover:text-amber-500 font-medium">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  )
}
