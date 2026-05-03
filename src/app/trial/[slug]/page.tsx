'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, ChevronRight, ChevronLeft, AlertCircle, Calendar, Clock, User } from 'lucide-react'
import { LogoMark } from '@/components/Logo'

interface GymInfo {
  id: string
  name: string
  logo_url: string | null
}

interface ClassSlot {
  id: string
  title: string
  class_type: string
  instructor: string | null
  starts_at: string
  ends_at: string
  max_capacity: number | null
  spots_left: number | null
}

const INPUT = 'w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors'

const TYPE_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat', kids: 'Kids', competition: 'Competition',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })
}

export default function TrialPage() {
  const { slug } = useParams() as { slug: string }

  const [step, setStep]           = useState<1 | 2 | 3>(1)
  const [gymInfo, setGymInfo]     = useState<GymInfo | null>(null)
  const [classes, setClasses]     = useState<ClassSlot[]>([])
  const [loadErr, setLoadErr]     = useState('')
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [message,   setMessage]   = useState('')
  const [classId,   setClassId]   = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/public/gym/${encodeURIComponent(slug)}`)
      .then(async r => {
        const data = await r.json()
        if (data.error) { setLoadErr(data.error); return }
        setGymInfo({ id: data.gym.id, name: data.gym.name, logo_url: data.gym.logo_url })
        setClasses(data.classes ?? [])
      })
      .catch(() => setLoadErr('Verbindungsfehler – bitte Internetverbindung prüfen.'))
      .finally(() => setLoading(false))
  }, [slug])

  const step1Valid = firstName.trim() && lastName.trim() && email.trim().includes('@')

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/public/gym/${encodeURIComponent(slug)}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim(), phone: phone.trim() || null, message: message.trim() || null, class_id: classId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unbekannter Fehler')
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    }
    setSubmitting(false)
  }

  // Group classes by day
  const byDay = classes.reduce<Record<string, ClassSlot[]>>((acc, cls) => {
    const day = new Date(cls.starts_at).toDateString()
    if (!acc[day]) acc[day] = []
    acc[day].push(cls)
    return acc
  }, {})

  const steps = [
    { n: 1 as const, label: 'Daten' },
    { n: 2 as const, label: 'Klasse' },
    { n: 3 as const, label: 'Fertig' },
  ]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-7 h-7 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  )

  if (loadErr) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="text-center max-w-sm">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
        <h2 className="font-bold text-zinc-900 text-lg mb-2">Gym nicht gefunden</h2>
        <p className="text-zinc-500 text-sm">{loadErr}</p>
      </div>
    </div>
  )

  if (step === 3) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={40} className="text-amber-500" />
        </div>
        <h2 className="font-bold text-zinc-900 text-2xl mb-2">Anfrage gesendet!</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Deine Probetraining-Anfrage bei <strong>{gymInfo?.name}</strong> ist eingegangen.
          Du erhältst eine Bestätigungs-E-Mail mit deinem persönlichen Portal-Link.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-50">

      {/* Header */}
      <div className="bg-zinc-950 px-4 py-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center">
            <LogoMark className="w-3.5 h-3 text-zinc-950" />
          </div>
          <p className="text-amber-400 font-black text-xl italic tracking-tight">Osss</p>
        </div>
        <p className="text-white font-semibold text-sm">{gymInfo?.name}</p>
        <p className="text-zinc-500 text-xs mt-0.5">Probetraining anfragen</p>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`flex flex-col items-center ${step >= s.n ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  step > s.n   ? 'bg-zinc-900 border-zinc-900 text-white' :
                  step === s.n ? 'bg-amber-500 border-amber-500 text-white' :
                                 'bg-white border-zinc-300 text-zinc-400'
                }`}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className="text-[10px] text-zinc-400 mt-0.5 hidden sm:block">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-px w-8 bg-zinc-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Step 1: Personal data */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-black text-zinc-900 mb-1">Persönliche Daten</h2>
            <p className="text-zinc-400 text-sm mb-6">Bitte fülle alle Pflichtfelder aus.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Vorname *</label>
                  <input className={INPUT} placeholder="Max" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Nachname *</label>
                  <input className={INPUT} placeholder="Mustermann" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">E-Mail *</label>
                <input className={INPUT} type="email" placeholder="max@beispiel.de" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Telefon</label>
                <input className={INPUT} type="tel" placeholder="+49 176 …" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Nachricht <span className="text-zinc-400 font-normal">(optional)</span></label>
                <textarea className={`${INPUT} resize-none`} rows={3} placeholder="Erfahrung, Fragen, …" value={message} onChange={e => setMessage(e.target.value)} />
              </div>
            </div>

            <button
              onClick={() => { if (step1Valid) setStep(2) }}
              disabled={!step1Valid}
              className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold text-sm transition-colors"
            >
              Weiter <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Class selection */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-black text-zinc-900 mb-1">Klasse wählen</h2>
            <p className="text-zinc-400 text-sm mb-6">Optional — du kannst auch ohne Slot anfragen.</p>

            {classes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center mb-6">
                <Calendar size={28} className="text-zinc-200 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Keine bevorstehenden Klassen eingetragen.</p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {Object.entries(byDay).map(([day, dayClasses]) => (
                  <div key={day}>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{formatDay(dayClasses[0].starts_at)}</p>
                    <div className="space-y-2">
                      {dayClasses.map(cls => {
                        const full = cls.spots_left !== null && cls.spots_left <= 0
                        const selected = classId === cls.id
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            disabled={full}
                            onClick={() => setClassId(selected ? null : cls.id)}
                            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                              full ? 'opacity-40 cursor-not-allowed border-zinc-100 bg-white' :
                              selected ? 'border-amber-400 bg-amber-50' :
                              'border-zinc-100 bg-white hover:border-zinc-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">
                                    {TYPE_LABELS[cls.class_type] ?? cls.class_type}
                                  </span>
                                  {full && <span className="text-xs text-red-400 font-medium">Ausgebucht</span>}
                                </div>
                                <p className="font-semibold text-zinc-900 text-sm truncate">{cls.title}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                                  <span className="flex items-center gap-1"><Clock size={10} /> {formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}</span>
                                  {cls.instructor && <span className="flex items-center gap-1"><User size={10} /> {cls.instructor}</span>}
                                </div>
                              </div>
                              {selected && (
                                <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-[10px] font-black">✓</span>
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
                <AlertCircle size={15} className="flex-shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-5 py-4 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-semibold transition-colors">
                <ChevronLeft size={15} /> Zurück
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-zinc-950 font-bold text-sm transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" /> Wird gesendet…</span>
                ) : (
                  classId ? 'Probetraining buchen' : 'Anfrage senden'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
