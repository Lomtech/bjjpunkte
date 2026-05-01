'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, ChevronRight, ChevronLeft, Pen, RotateCcw, AlertCircle } from 'lucide-react'

interface GymInfo {
  gymId: string
  gymName: string
  contractTemplate: string
}

const BELTS = [
  { value: 'white',  label: 'Weiß',   color: '#f1f5f9' },
  { value: 'blue',   label: 'Blau',   color: '#3b82f6' },
  { value: 'purple', label: 'Lila',   color: '#a855f7' },
  { value: 'brown',  label: 'Braun',  color: '#92400e' },
  { value: 'black',  label: 'Schwarz', color: '#0f172a' },
]

/* ── Canvas signature pad ─────────────────────────────────────── */
function SignaturePad({ onChange }: { onChange: (data: string | null) => void }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const drawing    = useRef(false)
  const [hasData, setHasData] = useState(false)

  function getPos(e: React.MouseEvent | React.TouchEvent, rect: DOMRect) {
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const pos  = getPos(e, rect)
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    ctx.beginPath()
    ctx.moveTo(pos.x * scaleX, pos.y * scaleY)
    drawing.current = true
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    const ctx  = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const pos  = getPos(e, rect)
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    ctx.lineWidth   = 2.5
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.lineTo(pos.x * scaleX, pos.y * scaleY)
    ctx.stroke()
    setHasData(true)
    onChange(canvas.toDataURL('image/png'))
  }

  function stop() { drawing.current = false }

  function clear() {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasData(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full touch-none cursor-crosshair block"
          style={{ height: '160px' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
        />
        {!hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <Pen size={20} className="text-gray-300 mb-1" />
            <p className="text-gray-400 text-sm">Hier unterschreiben</p>
          </div>
        )}
      </div>
      {hasData && (
        <button type="button" onClick={clear}
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors">
          <RotateCcw size={12} /> Unterschrift löschen
        </button>
      )}
    </div>
  )
}

/* ── Main signup page ─────────────────────────────────────────── */
export default function SignupPage() {
  const params = useParams()
  const token  = params.token as string

  const [step, setStep]       = useState<1 | 2 | 3 | 4>(1)
  const [gymInfo, setGymInfo] = useState<GymInfo | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  // Form fields
  const [firstName,    setFirstName]    = useState('')
  const [lastName,     setLastName]     = useState('')
  const [email,        setEmail]        = useState('')
  const [phone,        setPhone]        = useState('')
  const [dob,          setDob]          = useState('')
  const [street,       setStreet]       = useState('')
  const [zip,          setZip]          = useState('')
  const [city,         setCity]         = useState('')
  const [ecName,       setEcName]       = useState('')
  const [ecPhone,      setEcPhone]      = useState('')
  const [belt,         setBelt]         = useState('white')
  const [agbAccepted, setAgbAccepted] = useState(false)
  const [contractRead, setContractRead] = useState(false)
  const [gdprAccepted, setGdprAccepted] = useState(false)
  const [contractAccepted, setContractAccepted] = useState(false)
  const [signatureData, setSignatureData] = useState<string | null>(null)

  // Load gym info
  useEffect(() => {
    fetch(`/api/signup?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const text = await r.text()
        try {
          const data = JSON.parse(text)
          if (data.error) setLoadErr(data.error)
          else setGymInfo(data)
        } catch {
          setLoadErr(`Serverfehler (${r.status}) – bitte kontaktiere das Gym direkt.`)
        }
      })
      .catch(() => setLoadErr('Verbindungsfehler – bitte Internetverbindung prüfen.'))
      .finally(() => setLoading(false))
  }, [token])

  // Step 1 validation
  const step1Valid = firstName.trim() && lastName.trim() && email.trim().includes('@') && dob

  // Step 3 validation (signature)
  const step3Valid = signatureData !== null

  // Step 4 validation
  const step4Valid = gdprAccepted && contractAccepted && contractRead

  const contractRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    const el = contractRef.current
    if (!el) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20
    if (atBottom) setContractRead(true)
  }, [])

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token, gymId: gymInfo!.gymId,
          firstName, lastName, email, phone,
          dateOfBirth: dob || null,
          address: [street, zip, city].filter(Boolean).join(', ') || null,
          emergencyContactName:  ecName  || null,
          emergencyContactPhone: ecPhone || null,
          signatureData,
          belt,
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

  /* ── Loading / error states ─────────────────────────────────── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-400 text-sm">Lädt…</p>
    </div>
  )

  if (loadErr) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-sm">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
        <h2 className="font-bold text-slate-900 text-lg mb-2">
          {loadErr.includes('deaktiviert') ? 'Anmeldung deaktiviert' : 'Link ungültig'}
        </h2>
        <p className="text-slate-500 text-sm">{loadErr}</p>
      </div>
    </div>
  )

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h2 className="font-bold text-slate-900 text-2xl mb-2">Anmeldung erfolgreich! 🥋</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-4">
          Deine Anmeldung bei <strong>{gymInfo?.gymName}</strong> wurde übermittelt.
          Das Gym wird dich in Kürze kontaktieren und freischalten.
        </p>
        <p className="text-xs text-slate-400">
          Vertrag und Datenschutz digital unterzeichnet am {new Date().toLocaleDateString('de-DE')}.
        </p>
      </div>
    </div>
  )

  const steps = [
    { n: 1 as const, label: 'Daten' },
    { n: 2 as const, label: 'Vertrag' },
    { n: 3 as const, label: 'Unterschrift' },
    { n: 4 as const, label: 'Bestätigung' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-[#0f172a] px-4 py-5 text-center">
        <p className="text-amber-400 font-black text-2xl italic tracking-tight">Osss</p>
        <p className="text-white font-semibold text-sm mt-1">{gymInfo?.gymName}</p>
        <p className="text-slate-400 text-xs mt-0.5">Mitglieder-Anmeldung</p>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`flex flex-col items-center ${step >= s.n ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  step > s.n  ? 'bg-green-500 border-green-500 text-white' :
                  step === s.n ? 'bg-amber-500 border-amber-500 text-white' :
                                 'bg-white border-gray-300 text-gray-400'
                }`}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 hidden sm:block">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 w-6 rounded-full transition-colors ${step > s.n ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ── STEP 1: Persönliche Daten ─────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Persönliche Daten</h2>
              <p className="text-slate-500 text-sm">Bitte fülle alle Pflichtfelder aus.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Vorname *" value={firstName} onChange={setFirstName} placeholder="Max" />
              <Field label="Nachname *" value={lastName} onChange={setLastName} placeholder="Mustermann" />
            </div>
            <Field label="E-Mail *" type="email" value={email} onChange={setEmail} placeholder="max@beispiel.de" />
            <Field label="Telefon" type="tel" value={phone} onChange={setPhone} placeholder="+49 176 …" />
            <Field label="Geburtsdatum *" type="date" value={dob} onChange={setDob} />

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Adresse</p>
              <div className="space-y-3">
                <Field label="Straße & Hausnummer" value={street} onChange={setStreet} placeholder="Musterstraße 1" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="PLZ" value={zip} onChange={setZip} placeholder="12345" />
                  <Field label="Stadt" value={city} onChange={setCity} placeholder="München" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notfallkontakt</p>
              <div className="space-y-3">
                <Field label="Name" value={ecName} onChange={setEcName} placeholder="Maria Mustermann" />
                <Field label="Telefon" type="tel" value={ecPhone} onChange={setEcPhone} placeholder="+49 …" />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Aktueller Gürtelgrad</p>
              <div className="flex flex-wrap gap-2">
                {BELTS.map(b => (
                  <button key={b.value} type="button" onClick={() => setBelt(b.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                      belt === b.value ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <span className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0"
                      style={{ background: b.color }} />
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <button disabled={!step1Valid} onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-colors flex items-center justify-center gap-2">
              Weiter <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── STEP 2: Vertrag ────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Mitgliedsvertrag</h2>
              <p className="text-slate-500 text-sm">Bitte lies den Vertrag vollständig durch (bis zum Ende scrollen).</p>
            </div>

            <div
              ref={contractRef}
              onScroll={handleScroll}
              className="bg-white rounded-2xl border border-gray-200 p-5 max-h-[55vh] overflow-y-auto shadow-sm text-sm text-slate-700 leading-relaxed whitespace-pre-wrap"
            >
              {gymInfo?.contractTemplate || 'Kein Vertrag hinterlegt.'}
            </div>

            {!contractRead && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle size={13} /> Bitte scrolle bis zum Ende, um fortzufahren.
              </p>
            )}
            {contractRead && (
              <p className="text-xs text-green-600 flex items-center gap-1.5">
                <CheckCircle2 size={13} /> Du hast den Vertrag vollständig gelesen.
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-slate-700 font-medium transition-colors">
                <ChevronLeft size={16} /> Zurück
              </button>
              <button disabled={!contractRead} onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center justify-center gap-2">
                Weiter <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Unterschrift ───────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Digitale Unterschrift</h2>
              <p className="text-slate-500 text-sm">
                Unterschreibe mit dem Finger (Handy) oder der Maus (PC) im Feld unten.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-slate-400 mb-3">
                {firstName} {lastName} — {new Date().toLocaleDateString('de-DE')}
              </p>
              <SignaturePad onChange={setSignatureData} />
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Mit deiner Unterschrift bestätigst du, dass du den Mitgliedsvertrag von{' '}
              <strong>{gymInfo?.gymName}</strong> gelesen hast und damit einverstanden bist.
              Die digitale Unterschrift ist rechtlich bindend gemäß eIDAS-Verordnung.
            </p>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-slate-700 font-medium transition-colors">
                <ChevronLeft size={16} /> Zurück
              </button>
              <button disabled={!step3Valid} onClick={() => setStep(4)}
                className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center justify-center gap-2">
                Weiter <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Einwilligung & Absenden ────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Einwilligung & Anmeldung</h2>
              <p className="text-slate-500 text-sm">Bitte bestätige die folgenden Punkte.</p>
            </div>

            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Zusammenfassung</p>
              <SummaryRow label="Name"         value={`${firstName} ${lastName}`} />
              <SummaryRow label="E-Mail"        value={email} />
              {phone && <SummaryRow label="Telefon"      value={phone} />}
              {dob   && <SummaryRow label="Geburtsdatum" value={new Date(dob).toLocaleDateString('de-DE')} />}
              {(street || city) && <SummaryRow label="Adresse" value={[street, `${zip} ${city}`.trim()].filter(Boolean).join(', ')} />}
              {ecName && <SummaryRow label="Notfallkontakt" value={`${ecName}${ecPhone ? ` · ${ecPhone}` : ''}`} />}
              <SummaryRow label="Gürtelgrad" value={BELTS.find(b => b.value === belt)?.label ?? 'Weiß'} />
            </div>

            {/* Consent checkboxes */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={contractAccepted} onChange={e => setContractAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-400 flex-shrink-0 cursor-pointer" />
                <span className="text-sm text-slate-700 leading-relaxed">
                  Ich habe den Mitgliedsvertrag von <strong>{gymInfo?.gymName}</strong> vollständig gelesen,
                  verstanden und erkläre mich damit einverstanden. Meine digitale Unterschrift ist rechtsverbindlich.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={gdprAccepted} onChange={e => setGdprAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-400 flex-shrink-0 cursor-pointer" />
                <span className="text-sm text-slate-700 leading-relaxed">
                  Ich stimme der Verarbeitung meiner personenbezogenen Daten zur Mitgliedschaftsverwaltung gemäß
                  der{' '}
                  <a href="/datenschutz" target="_blank" className="text-amber-600 hover:underline font-medium">
                    Datenschutzerklärung
                  </a>
                  {' '}zu. Die Daten werden nicht ohne meine Einwilligung an Dritte weitergegeben.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agbAccepted}
                  onChange={e => setAgbAccepted(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-amber-500 flex-shrink-0"
                  required
                />
                <span className="text-sm text-slate-600">
                  Ich habe die{' '}
                  <a href="/datenschutz" target="_blank" className="text-amber-600 hover:underline">Datenschutzerklärung</a>
                  {' '}und die AGB gelesen und stimme zu. Ich bin mir bewusst, dass meine digitale Unterschrift rechtlich bindend ist.
                </span>
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-slate-700 font-medium transition-colors">
                <ChevronLeft size={16} /> Zurück
              </button>
              <button disabled={!step4Valid || !agbAccepted || submitting} onClick={submit}
                className="flex-1 py-3.5 rounded-2xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-colors flex items-center justify-center gap-2">
                {submitting ? 'Wird gesendet…' : '🥋 Jetzt anmelden'}
              </button>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Datum & Uhrzeit: {new Date().toLocaleString('de-DE')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Helper components ──────────────────────────────────────────── */
function Field({
  label, value, onChange, placeholder = '', type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors"
      />
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 border-b border-gray-50 last:border-0">
      <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-xs font-medium text-slate-800 text-right truncate">{value}</span>
    </div>
  )
}
