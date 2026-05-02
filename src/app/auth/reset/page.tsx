'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth/update-password',
    })
    if (resetError) {
      setError(resetError.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex flex-col items-center justify-center w-20 h-20 rounded-3xl bg-[#0f172a] shadow-xl mb-4 gap-1.5">
            <span className="text-3xl font-black text-amber-400 italic tracking-tight leading-none">oss</span>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-amber-500 opacity-75" />)}
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tight">Osss</h1>
          <p className="text-slate-500 mt-1 text-sm tracking-wide">Passwort zurücksetzen</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-slate-900">E-Mail gesendet!</p>
              <p className="text-slate-500 text-sm">Prüfe dein Postfach und klicke den Link zum Zurücksetzen deines Passworts.</p>
              <Link href="/login" className="block text-center text-sm text-amber-600 hover:text-amber-500 font-medium mt-2">
                Zurück zum Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                {loading ? 'Wird gesendet…' : 'Reset-Link senden'}
              </button>

              <p className="text-center text-sm text-slate-500">
                <Link href="/login" className="text-amber-600 hover:text-amber-500 font-medium">
                  Zurück zum Login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
