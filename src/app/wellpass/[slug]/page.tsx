'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { LogoMark } from '@/components/Logo'

interface GymInfo {
  id: string
  name: string
  logo_url: string | null
}

const INPUT = 'w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors'

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'wellpass',     label: 'Wellpass' },
  { value: 'hansefit',     label: 'Hansefit' },
  { value: 'egym',         label: 'EGYM Wellpass' },
  { value: 'urban_sports', label: 'Urban Sports Club' },
]

/**
 * Wellpass-Onboarding-Page für Anbieter-Mitglieder.
 *
 * URL-Schema: /wellpass/[slug]?source=wellpass
 *
 * Flow:
 *  1. Stammdaten + Geburtsdatum + Anbieter-Auswahl
 *  2. Wellpass-Vereinbarung lesen (4 Punkte) + Akzeptieren
 *  3. Bestätigung
 *
 * Hard-Checks (Client + Server):
 *  - Volljährig (Anbieter-Vertrag = nur Erwachsene)
 *  - Vereinbarung muss explizit akzeptiert werden
 */
export default function WellpassPage() {
  const { slug } = useParams() as { slug: string }

  const [gymInfo, setGymInfo]   = useState<GymInfo | null>(null)
  const [loading, setLoading]   = useState(true)
  const [loadErr, setLoadErr]   = useState('')
  const [contract, setContract] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  // Read source from URL — fall back to 'wellpass'
  const initialSource = (() => {
    if (typeof window === 'undefined') return 'wellpass'
    const sp = new URLSearchParams(window.location.search)
    const v = sp.get('source')
    return SOURCE_OPTIONS.some(o => o.value === v) ? v! : 'wellpass'
  })()

  const [source,    setSource]    = useState(initialSource)
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [dob,       setDob]       = useState('')
  const [accepted,  setAccepted]  = useState(false)

  useEffect(() => {
    fetch(`/api/public/gym/${encodeURIComponent(slug)}`)
      .then(async r => {
        const data = await r.json()
        if (data.error) { setLoadErr(data.error); return }
        setGymInfo({ id: data.gym.id, name: data.gym.name, logo_url: data.gym.logo_url })
        setContract(typeof data.wellpassContract === 'string' ? data.wellpassContract : '')
      })
      .catch(() => setLoadErr('Verbindungsfehler – bitte Internetverbindung prüfen.'))
      .finally(() => setLoading(false))
  }, [slug])

  // Volljährigkeits-Check
  function calcAge(dobStr: string): number | null {
    if (!dobStr) return null
    const d = new Date(dobStr)
    if (Number.isNaN(d.getTime())) return null
    const t = new Date()
    let a = t.getFullYear() - d.getFullYear()
    const md = t.getMonth() - d.getMonth()
    if (md < 0 || (md === 0 && t.getDate() < d.getDate())) a--
    return a
  }

  const age          = calcAge(dob)
  const ageBlocked   = age !== null && age < 18
  const formValid    = firstName.trim() && lastName.trim() && email.includes('@') && dob && !ageBlocked && accepted

  async function submit() {
    if (!formValid) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/public/gym/${encodeURIComponent(slug)}/wellpass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          first_name: firstName.trim(),
          last_name:  lastName.trim(),
          email:      email.trim(),
          phone:      phone.trim() || null,
          date_of_birth: dob,
          contract_text: contract,
          contract_accepted: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unbekannter Fehler')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <Loader2 className="animate-spin text-zinc-400" size={28} />
    </div>
  )

  if (loadErr) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="text-center max-w-sm">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
        <h2 className="font-bold text-zinc-900 text-lg mb-2">Studio nicht gefunden</h2>
        <p className="text-zinc-500 text-sm">{loadErr}</p>
      </div>
    </div>
  )

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <h2 className="font-bold text-zinc-900 text-2xl mb-2">Anmeldung bestätigt!</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Deine Anmeldung bei <strong>{gymInfo?.name}</strong> über{' '}
          {SOURCE_OPTIONS.find(o => o.value === source)?.label} wurde erfolgreich registriert.
          Du erhältst eine Bestätigungs-E-Mail.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="bg-zinc-950 px-4 py-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center">
            <LogoMark className="w-3.5 h-3 text-zinc-950" />
          </div>
          <p className="text-amber-400 font-black text-xl italic tracking-tight">Osss</p>
        </div>
        <p className="text-white font-semibold text-sm">{gymInfo?.name}</p>
        <p className="text-zinc-500 text-xs mt-0.5">Anbieter-Mitgliedschaft anmelden</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* Anbieter-Auswahl */}
        <div>
          <label className="block text-sm font-semibold text-zinc-700 mb-2">Über welchen Anbieter trainierst du?</label>
          <div className="grid grid-cols-2 gap-2">
            {SOURCE_OPTIONS.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSource(o.value)}
                className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  source === o.value
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stammdaten */}
        <div className="space-y-3">
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
            <input className={INPUT} type="email" placeholder="max@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Telefon</label>
              <input className={INPUT} type="tel" placeholder="+49 …" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Geburtsdatum *</label>
              <input className={INPUT} type="date" value={dob} onChange={e => setDob(e.target.value)} />
            </div>
          </div>
          {ageBlocked && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-sm text-rose-800">
              <p className="font-bold">{SOURCE_OPTIONS.find(o => o.value === source)?.label} ist nur für Erwachsene möglich.</p>
              <p className="text-xs mt-0.5 opacity-80">
                Anbieter-Verträge erfordern Volljährigkeit (Arbeitgeber-Tarif). Bitte kontaktiere das Studio direkt.
              </p>
            </div>
          )}
        </div>

        {/* Vereinbarung — Pflicht-Akzeptanz */}
        {contract && (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Vereinbarung für Anbieter-Mitglieder
              </p>
            </div>
            <pre className="px-4 py-3 max-h-64 overflow-y-auto text-xs text-zinc-600 font-sans whitespace-pre-wrap leading-relaxed">{contract}</pre>
            <label className="flex items-start gap-3 px-4 py-3 border-t border-zinc-100 cursor-pointer hover:bg-amber-50 transition-colors">
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-sm text-zinc-700 leading-relaxed">
                Ich habe die Vereinbarung <strong>gelesen und akzeptiert</strong> (Verhalten, §823 BGB, Haftungsausschluss, Hausordnung).
              </span>
            </label>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            <AlertCircle size={15} className="flex-shrink-0" /> {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || !formValid}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold text-sm transition-colors"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Wird übertragen…</>
            : 'Anmeldung absenden'}
        </button>

        <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
          Mit Klick auf „Anmeldung absenden&ldquo; wird die Vereinbarung elektronisch nach eIDAS Art. 25 Abs. 1
          unterschrieben. IP-Adresse + Browser werden für die Nachvollziehbarkeit gespeichert.
        </p>
      </div>
    </div>
  )
}
