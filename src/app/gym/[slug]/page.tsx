'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { MapPin, Phone, Mail, Clock, Users, ChevronRight, Check } from 'lucide-react'
import { LogoMark as OsssLogoMark } from '@/components/Logo'

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
  gi:          'bg-zinc-100 text-zinc-700',
  'no-gi':     'bg-zinc-200 text-zinc-700',
  'open mat':  'bg-amber-50 text-amber-700',
  kids:        'bg-zinc-100 text-zinc-600',
  competition: 'bg-zinc-900 text-white',
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

const INPUT = 'w-full border border-zinc-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white text-zinc-900 placeholder-zinc-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors'

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
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!gym) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-400 text-sm">
        Gym nicht gefunden
      </div>
    )
  }

  const days = groupByDay(classes)

  return (
    <div className="min-h-screen bg-zinc-50">

      {/* Hero */}
      <div className="bg-zinc-950 text-white">
        <div className="max-w-2xl mx-auto px-5 py-10">
          <div className="flex items-center gap-4 mb-6">
            {gym.logo_url ? (
              <Image src={gym.logo_url} alt={gym.name} width={56} height={56}
                className="rounded-2xl object-cover border border-white/10 shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center shrink-0">
                <OsssLogoMark className="w-6 h-5 text-zinc-950" />
              </div>
            )}
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-0.5">
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
          <div className="bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm">
            <h2 className="font-bold text-zinc-900 text-lg mb-1">Probetraining buchen</h2>
            <p className="text-zinc-500 text-sm mb-5">
              Hinterlasse deine Kontaktdaten — wir melden uns schnellstmöglich.
            </p>
            <button
              onClick={() => setStep('form')}
              className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
              Jetzt Probetraining anfragen <ChevronRight size={15} />
            </button>
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-100 p-6 shadow-sm space-y-4">
            <div className="mb-2">
              <h2 className="font-bold text-zinc-900 text-lg">Deine Kontaktdaten</h2>
              <p className="text-zinc-500 text-sm mt-0.5">Wir melden uns in der Regel innerhalb von 24 Stunden.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Vorname *</label>
                <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  required placeholder="Max" className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Nachname *</label>
                <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  required placeholder="Mustermann" className={INPUT} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">E-Mail *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required placeholder="max@beispiel.de" className={INPUT} />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Telefon</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+49 123 456789" className={INPUT} />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Nachricht</label>
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={3} placeholder="Ich interessiere mich für…"
                className={INPUT + ' resize-none'} />
            </div>

            {formError && (
              <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{formError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep('landing')}
                className="flex-1 border border-zinc-200 text-zinc-600 font-medium rounded-xl py-2.5 text-sm hover:bg-zinc-50 transition-colors">
                Zurück
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50">
                {submitting ? 'Senden…' : 'Anfrage senden'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 shadow-sm text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-amber-500" strokeWidth={2.5} />
            </div>
            <h2 className="font-bold text-zinc-900 text-lg mb-2">Anfrage erhalten!</h2>
            <p className="text-zinc-500 text-sm">
              {gym.name} wird sich in Kürze bei dir melden. Wir freuen uns auf dich!
            </p>
          </div>
        )}

        {/* Plans */}
        {plans.length > 0 && (
          <div>
            <h2 className="font-bold text-zinc-900 text-base mb-3 flex items-center gap-2">
              <Users size={15} className="text-zinc-400" /> Mitgliedschaftspläne
            </h2>
            <div className="space-y-3">
              {plans.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 text-sm">{p.name}</p>
                      {p.description && <p className="text-zinc-500 text-xs mt-0.5 line-clamp-2">{p.description}</p>}
                      {p.contract_months > 0 && (
                        <p className="text-zinc-400 text-xs mt-1">{p.contract_months} Monate Vertragslaufzeit</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-zinc-900 text-base">
                        {(p.price_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </p>
                      <p className="text-zinc-400 text-xs">{formatInterval(p.billing_interval)}</p>
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
            <h2 className="font-bold text-zinc-900 text-base mb-3 flex items-center gap-2">
              <Clock size={15} className="text-zinc-400" /> Kommende Kurse
            </h2>
            <div className="space-y-4">
              {days.slice(0, 5).map(([day, dayClasses]) => (
                <div key={day}>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{day}</p>
                  <div className="space-y-2">
                    {dayClasses.map(cls => {
                      const start = new Date(cls.starts_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                      const end   = new Date(cls.ends_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                      return (
                        <div key={cls.id} className="bg-white rounded-xl border border-zinc-100 px-4 py-3 flex items-center gap-3 shadow-sm">
                          <div className="text-xs font-mono text-zinc-400 shrink-0 w-20">
                            {start} – {end}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-zinc-900 leading-tight">{cls.title}</p>
                            {cls.instructor && <p className="text-xs text-zinc-400">{cls.instructor}</p>}
                          </div>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${CLASS_COLORS[cls.class_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
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
      <div className="text-center py-8 text-zinc-300 text-xs">
        Betrieben mit <span className="font-black text-amber-400">Osss</span>
      </div>
    </div>
  )
}
