'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Belt } from '@/types/database'

const BELTS: Belt[] = ['white', 'blue', 'purple', 'brown', 'black']
const BELT_LABELS: Record<Belt, string> = { white: 'Weiss', blue: 'Blau', purple: 'Lila', brown: 'Braun', black: 'Schwarz' }
const BELT_CLASSES: Record<Belt, string> = {
  white:  'bg-slate-100 text-slate-700 border border-slate-300',
  blue:   'bg-blue-600 text-white',
  purple: 'bg-purple-600 text-white',
  brown:  'bg-amber-900 text-white',
  black:  'bg-slate-900 text-amber-400',
}

export default function NewMemberPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    date_of_birth: '', join_date: new Date().toISOString().split('T')[0],
    belt: 'white' as Belt, stripes: 0, notes: '',
  })

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: gym } = await supabase.from('gyms').select('id').single()
    if (!gym) { setError('Kein Gym gefunden'); setLoading(false); return }

    const { error } = await supabase.from('members').insert({
      gym_id: gym.id,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone || null,
      date_of_birth: form.date_of_birth || null,
      join_date: form.join_date,
      belt: form.belt,
      stripes: form.stripes,
      notes: form.notes || null,
      is_active: true,
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard/members')
    router.refresh()
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <Link href="/dashboard/members" className="text-slate-400 hover:text-slate-600 text-sm">← Zurück</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-3">Neues Mitglied</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Persönliche Daten</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vorname *" value={form.first_name} onChange={v => set('first_name', v)} required placeholder="Max" />
            <Field label="Nachname *" value={form.last_name} onChange={v => set('last_name', v)} required placeholder="Mustermann" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="E-Mail" value={form.email} onChange={v => set('email', v)} type="email" placeholder="max@gym.de" />
            <Field label="Telefon" value={form.phone} onChange={v => set('phone', v)} placeholder="+49 170 1234567" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Geburtsdatum" value={form.date_of_birth} onChange={v => set('date_of_birth', v)} type="date" />
            <Field label="Mitglied seit" value={form.join_date} onChange={v => set('join_date', v)} type="date" required />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Belt & Stripes</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Belt</label>
            <div className="flex flex-wrap gap-2">
              {BELTS.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => set('belt', b)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${BELT_CLASSES[b]} ${
                    form.belt === b ? 'ring-2 ring-amber-400 ring-offset-1 scale-105' : 'opacity-60 hover:opacity-90'
                  }`}
                >
                  {BELT_LABELS[b]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Stripes: <span className="text-amber-600 font-bold">{form.stripes}</span></label>
            <input
              type="range" min={0} max={4} value={form.stripes}
              onChange={e => set('stripes', Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              {[0,1,2,3,4].map(n => <span key={n}>{n}</span>)}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">Notizen</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 resize-none"
            placeholder="Verletzungen, Ziele, besondere Hinweise..."
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold transition-colors shadow-sm"
          >
            {loading ? 'Wird gespeichert...' : 'Mitglied speichern'}
          </button>
          <Link
            href="/dashboard/members"
            className="px-6 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-sm"
      />
    </div>
  )
}
