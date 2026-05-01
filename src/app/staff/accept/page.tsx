'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type StaffInfo = {
  email: string
  name: string
  invite_token: string
  gyms: { name: string } | null
}

export default function StaffAcceptPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [staff, setStaff] = useState<StaffInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Kein Einladungs-Token gefunden.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    supabase
      .from('gym_staff')
      .select('email, name, invite_token, gyms(name)')
      .eq('invite_token', token)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError('Einladungs-Link ungültig oder abgelaufen.')
        } else {
          setStaff(data as StaffInfo)
        }
        setLoading(false)
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!staff || !token) return
    if (password.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    if (password !== confirm) {
      setError('Passwörter stimmen nicht überein.')
      return
    }

    setSubmitting(true)
    setError(null)

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: staff.email,
      password,
    })

    if (signUpError) {
      // If user already exists, try sign in instead
      if (signUpError.message.toLowerCase().includes('already registered')) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: staff.email,
          password,
        })
        if (signInError) {
          setError('Anmeldung fehlgeschlagen: ' + signInError.message)
          setSubmitting(false)
          return
        }
        if (signInData.user) {
          await fetch('/api/staff/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviteToken: token, userId: signInData.user.id }),
          })
          router.replace('/dashboard/attendance/kiosk')
          return
        }
      }
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    if (data.user) {
      await fetch('/api/staff/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteToken: token, userId: data.user.id }),
      })
      router.replace('/dashboard/attendance/kiosk')
    }
  }

  const gymName = staff?.gyms?.name ?? 'deinem Gym'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]">
        <p className="text-gray-500">Einladung wird geladen…</p>
      </div>
    )
  }

  if (error && !staff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]">
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full text-center">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5] px-4">
      <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-[#0f172a] border border-amber-500/30 flex flex-col items-center justify-center flex-shrink-0 gap-0.5">
            <span className="text-[11px] font-black text-amber-400 italic leading-none tracking-tight">oss</span>
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-amber-500 opacity-70" />
              ))}
            </div>
          </div>
          <div>
            <p className="font-black text-gray-900 text-base leading-none tracking-tight italic">Osss</p>
            <p className="text-[10px] text-gray-400 mt-0.5 tracking-wider uppercase">Gym Software</p>
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Willkommen bei {gymName}!
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Hallo {staff?.name}, erstelle dein Passwort für den Trainer-Zugang.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={staff?.email ?? ''}
              readOnly
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Mindestens 8 Zeichen"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Passwort bestätigen</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Passwort wiederholen"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none text-sm"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {submitting ? 'Wird aktiviert…' : 'Zugang aktivieren →'}
          </button>
        </form>
      </div>
    </div>
  )
}
