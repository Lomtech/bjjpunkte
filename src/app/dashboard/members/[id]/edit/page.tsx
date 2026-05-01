'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Save } from 'lucide-react'
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

export default function EditMemberPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    date_of_birth: '', join_date: '', belt: 'white' as Belt, stripes: 0,
    notes: '', contract_end_date: '',
    address: '', emergency_contact_name: '', emergency_contact_phone: '',
    monthly_fee_override_cents: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('members').select('*').eq('id', id).single()
      if (data) {
        const d = data as Record<string, unknown>
        setForm({
          first_name:                String(d.first_name ?? ''),
          last_name:                 String(d.last_name ?? ''),
          email:                     String(d.email ?? ''),
          phone:                     String(d.phone ?? ''),
          date_of_birth:             String(d.date_of_birth ?? ''),
          join_date:                 String(d.join_date ?? ''),
          belt:                      (d.belt as Belt) ?? 'white',
          stripes:                   Number(d.stripes ?? 0),
          notes:                     String(d.notes ?? ''),
          contract_end_date:         String(d.contract_end_date ?? ''),
          address:                   String(d.address ?? ''),
          emergency_contact_name:    String(d.emergency_contact_name ?? ''),
          emergency_contact_phone:   String(d.emergency_contact_phone ?? ''),
          monthly_fee_override_cents: d.monthly_fee_override_cents
            ? String(Number(d.monthly_fee_override_cents) / 100)
            : '',
        })
      }
      setLoading(false)
    }
    load()
  }, [id])

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const supabase = createClient()

    const overrideCents = form.monthly_fee_override_cents
      ? Math.round(parseFloat(form.monthly_fee_override_cents.replace(',', '.')) * 100)
      : null

    const { error: err } = await (supabase.from('members') as any).update({
      first_name:                form.first_name.trim(),
      last_name:                 form.last_name.trim(),
      email:                     form.email.trim().toLowerCase() || null,
      phone:                     form.phone.trim() || null,
      date_of_birth:             form.date_of_birth || null,
      join_date:                 form.join_date,
      belt:                      form.belt,
      stripes:                   form.stripes,
      notes:                     form.notes.trim() || null,
      contract_end_date:         form.contract_end_date || null,
      address:                   form.address.trim() || null,
      emergency_contact_name:    form.emergency_contact_name.trim() || null,
      emergency_contact_phone:   form.emergency_contact_phone.trim() || null,
      monthly_fee_override_cents: overrideCents,
    }).eq('id', id)

    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/dashboard/members/${id}`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Lädt…</div>
  )

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="mb-6">
        <Link href={`/dashboard/members/${id}`} className="text-slate-400 hover:text-slate-600 text-sm">← Zurück</Link>
        <h1 className="text-xl font-bold text-slate-900 mt-3">Mitglied bearbeiten</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Personal data */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Persönliche Daten</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vorname *" value={form.first_name} onChange={v => set('first_name', v)} required />
            <Field label="Nachname *" value={form.last_name} onChange={v => set('last_name', v)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="E-Mail" type="email" value={form.email} onChange={v => set('email', v)} placeholder="max@gym.de" />
            <Field label="Telefon" value={form.phone} onChange={v => set('phone', v)} placeholder="+49 170 1234567" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Geburtsdatum" type="date" value={form.date_of_birth} onChange={v => set('date_of_birth', v)} />
            <Field label="Mitglied seit *" type="date" value={form.join_date} onChange={v => set('join_date', v)} required />
          </div>
          <Field label="Adresse" value={form.address} onChange={v => set('address', v)} placeholder="Musterstraße 1, 80331 München" />
        </div>

        {/* Emergency contact */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notfallkontakt</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={form.emergency_contact_name} onChange={v => set('emergency_contact_name', v)} placeholder="Anna Mustermann" />
            <Field label="Telefon" value={form.emergency_contact_phone} onChange={v => set('emergency_contact_phone', v)} placeholder="+49 170 9876543" />
          </div>
        </div>

        {/* Belt */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gürtel & Stripes</p>
          <div className="flex flex-wrap gap-2">
            {BELTS.map(b => (
              <button key={b} type="button" onClick={() => set('belt', b)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${BELT_CLASSES[b]} ${
                  form.belt === b ? 'ring-2 ring-amber-400 ring-offset-1 scale-105' : 'opacity-60 hover:opacity-100'
                }`}>
                {BELT_LABELS[b]}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Stripes: <span className="text-amber-600 font-bold">{form.stripes}</span>
            </label>
            <input type="range" min={0} max={4} value={form.stripes}
              onChange={e => set('stripes', Number(e.target.value))}
              className="w-full accent-amber-500" />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              {[0,1,2,3,4].map(n => <span key={n}>{n}</span>)}
            </div>
          </div>
        </div>

        {/* Contract & billing */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vertrag & Beitrag</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vertragsende" type="date" value={form.contract_end_date} onChange={v => set('contract_end_date', v)} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Individueller Beitrag (€)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                <input
                  type="text"
                  value={form.monthly_fee_override_cents}
                  onChange={e => set('monthly_fee_override_cents', e.target.value)}
                  placeholder="Standard"
                  className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Leer lassen = Gym-Standard</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">Notizen</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Verletzungen, Ziele, besondere Hinweise…"
            className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 resize-none"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold transition-colors flex items-center justify-center gap-2 text-sm">
            <Save size={15} />
            {saving ? 'Wird gespeichert…' : 'Änderungen speichern'}
          </button>
          <Link href={`/dashboard/members/${id}`}
            className="px-5 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors">
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
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-sm"
      />
    </div>
  )
}
