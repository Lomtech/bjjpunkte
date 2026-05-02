'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { MapPin, Phone, Mail, Clock, Users, ChevronRight, Check } from 'lucide-react'

interface GymClass {
  id: string
  title: string
  class_type: string
  instructor: string | null
  starts_at: string
  ends_at: string
  max_capacity: number | null
}

interface Plan {
  id: string
  name: string
  description: string | null
  price_cents: number
  billing_interval: string
  contract_months: number
}

interface GymInfo {
  id: string
  name: string
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  class_types: string[] | null
  sport_type: string | null
  belt_system_enabled: boolean
}

type Step = 'landing' | 'form' | 'done'

const CLASS_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat',
  kids: 'Kids', competition: 'Competition',
}
const CLASS_COLORS: Record<string, string> = {
  gi: 'bg-blue-50 text-blue-700', 'no-gi': 'bg-slate-100 text-slate-600',
  'open mat': 'bg-amber-50 text-amber-700', kids: 'bg-green-50 text-green-700',
  competition: 'bg-red-50 text-red-700',
}

function formatInterval(interval: string) {
  if (interval === 'biannual') return '/ 6 Monate'
  if (interval === 'annual')   return '/ Jahr'
  return '/ Monat'
}

function groupByDay(classes: GymClass[]) {
  const groups: Record<string, GymClass[]> = {}
  for (const c of classes) {
    const day = new Date(c.starts_at).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups[day]) groups[day] = []
    groups[day].push(c)
  }
  return Object.entries(groups)
}

export default function PublicGymPage() {
  const { slug }                = useParams<{ slug: string }>()
  const [gym, setGym]           = useState<GymInfo | null>(null)
  const [classes, setClasses]   = useState<GymClass[]>([])
  const [plans, setPlans]       = useState<Plan[]>([])
  const [loading, setLoading]   = useState(true)
  const [step, setStep]         = useState<Step>('landing')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')
  const [form, setForm]         = useState({ first_name: '', last_name: '', email: '', phone: '', message: '' })

  useEffect(() => {
    fetch(`/api/public/gym/${slug}`)
      .then(r => r.json())
      .then(d => { setGym(d.gym); setClasses(d.classes ?? []); setPlans(d.plans ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')
    const res = await fetch(`/api/public/gym/${slug}/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setStep('done')
    } else {
      const d = await res.json()
      setFormError(d.error ?? 'Fehler beim Senden')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!gym) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-400 text-sm">
        Gym nicht gefunden
      </div>
    )
  }

  const days = groupByDay(classes)

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero */}
      <div className="bg-slate-950 text-white">
        <div className="max-w-2xl mx-auto px-5 py-10">
          <div className="flex items-center gap-4 mb-6">
            {gym.logo_url ? (
              <Image src={gym.logo_url} alt={gym.name} width={56} height={56}
                className="rounded-2xl object-cover border border-white/10 shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/10 shrink-0" />
            )}
            <div>
              <p className="text-white/50 text-xs uppercase tracking-widest mb-0.5">
                {gym.sport_type ?? 'Kampfsport'}
              </p>
              <h1 className="text-2xl font-black leading-tight">{gym.name}</h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-white/50">
            {gym.address && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} /> {gym.address}
              </span>
            )}
            {gym.phone && (
              <a href={`tel:${gym.phone}`} className="flex items-center gap-1.5 hover:text-white/80 transition-colors">
                <Phone size={13} /> {gym.phone}
              </a>
            )}
            {gym.email && (
              <a href={`mailto:${gym.email}`} className="flex items-center gap-1.5 hover:text-white/80 transition-colors">
                <Mail size={13} /> {gym.email}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">

        {/* CTA card */}
        {step === 'landing' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-bold text-slate-900 text-lg mb-1">Probetraining buchen</h2>
            <p className="text-slate-500 text-sm mb-5">
              Hinterlasse deine Kontaktdaten — wir melden uns schnellstmöglich.
            </p>
            <button
              onClick={() => setStep('form')}
              className="w-full bg-slate-950 text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
              Jetzt anmelden <ChevronRight size={15} />
            </button>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-900 text-lg">Deine Kontaktdaten</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Vorname *</label>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  required placeholder="Max"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-900 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nachname *</label>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  required placeholder="Mustermann"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-900 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">E-Mail *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required placeholder="max@beispiel.de"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-900 transition-colors" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Telefon</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+49 123 456789"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-900 transition-colors" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nachricht</label>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={3} placeholder="Ich interessiere mich für..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-slate-900 transition-colors resize-none" />
            </div>

            {formError && <p className="text-red-600 text-sm">{formError}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep('landing')}
                className="flex-1 border border-slate-200 text-slate-600 font-medium rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors">
                Zurück
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 bg-slate-950 text-white font-semibold rounded-xl py-2.5 text-sm hover:bg-slate-800 transition-colors disabled:opacity-50">
                {submitting ? 'Senden…' : 'Anfrage senden'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={22} className="text-green-600" />
            </div>
            <h2 className="font-bold text-slate-900 text-lg mb-2">Anfrage erhalten</h2>
            <p className="text-slate-500 text-sm">
              Wir haben deine Anfrage erhalten und melden uns in Kürze.
            </p>
          </div>
        )}

        {/* Plans */}
        {plans.length > 0 && (
          <div>
            <h2 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
              <Users size={15} className="text-slate-400" /> Mitgliedschaftspläne
            </h2>
            <div className="space-y-3">
              {plans.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">{p.name}</p>
                      {p.description && <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{p.description}</p>}
                      {p.contract_months > 0 && (
                        <p className="text-slate-400 text-xs mt-1">{p.contract_months} Monate Vertragslaufzeit</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-slate-900 text-base">
                        {(p.price_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </p>
                      <p className="text-slate-400 text-xs">{formatInterval(p.billing_interval)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule preview */}
        {days.length > 0 && (
          <div>
            <h2 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
              <Clock size={15} className="text-slate-400" /> Kommende Kurse
            </h2>
            <div className="space-y-4">
              {days.slice(0, 5).map(([day, dayClasses]) => (
                <div key={day}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{day}</p>
                  <div className="space-y-2">
                    {dayClasses.map(cls => {
                      const start = new Date(cls.starts_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                      const end   = new Date(cls.ends_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                      return (
                        <div key={cls.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                          <div className="text-xs font-mono text-slate-400 shrink-0 w-20">
                            {start} – {end}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 leading-tight">{cls.title}</p>
                            {cls.instructor && <p className="text-xs text-slate-400">{cls.instructor}</p>}
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${CLASS_COLORS[cls.class_type] ?? 'bg-slate-100 text-slate-600'}`}>
                            {CLASS_LABELS[cls.class_type] ?? cls.class_type}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="text-center py-8 text-slate-300 text-xs">
        Betrieben mit <span className="font-semibold text-slate-400">Osss</span>
      </div>
    </div>
  )
}
