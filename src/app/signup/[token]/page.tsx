'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, ChevronRight, ChevronLeft, Pen, RotateCcw, AlertCircle } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

interface Plan {
  id: string
  name: string
  description: string | null
  price_cents: number
  billing_interval: string
  contract_months: number
}

interface GymInfo {
  gymId: string
  gymName: string
  contractTemplate: string
  plans: Plan[]
}

const BELTS = [
  { value: 'white',  labelDe: 'Weiß',    labelEn: 'White',  color: '#f1f5f9' },
  { value: 'blue',   labelDe: 'Blau',    labelEn: 'Blue',   color: '#3b82f6' },
  { value: 'purple', labelDe: 'Lila',    labelEn: 'Purple', color: '#a855f7' },
  { value: 'brown',  labelDe: 'Braun',   labelEn: 'Brown',  color: '#92400e' },
  { value: 'black',  labelDe: 'Schwarz', labelEn: 'Black',  color: '#0f172a' },
]

const INPUT = 'w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors'

/* ── Canvas signature pad ──────────────────────────────────────────── */
function SignaturePad({ onChange, lang = 'de' }: { onChange: (data: string | null) => void; lang?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing   = useRef(false)
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
    const ctx  = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const pos  = getPos(e, rect)
    const scaleX = canvas.width / rect.width
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
    const scaleX = canvas.width / rect.width
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
      <div className="relative rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 overflow-hidden">
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
            <Pen size={20} className="text-zinc-300 mb-1" />
            <p className="text-zinc-400 text-sm">{lang === 'en' ? 'Sign here' : 'Hier unterschreiben'}</p>
          </div>
        )}
      </div>
      {hasData && (
        <button type="button" onClick={clear}
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors">
          <RotateCcw size={12} /> {lang === 'en' ? 'Clear signature' : 'Unterschrift löschen'}
        </button>
      )}
    </div>
  )
}

/* ── Main signup page ──────────────────────────────────────────────── */
export default function SignupPage() {
  const params = useParams()
  const token  = params.token as string
  const { lang } = useLanguage()

  const [step, setStep]       = useState<1 | 2 | 3 | 4>(1)
  const [gymInfo, setGymInfo] = useState<GymInfo | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]       = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError]     = useState('')

  const [firstName,      setFirstName]      = useState('')
  const [lastName,       setLastName]       = useState('')
  const [email,          setEmail]          = useState('')
  const [phone,          setPhone]          = useState('')
  const [dob,            setDob]            = useState('')
  const [street,         setStreet]         = useState('')
  const [zip,            setZip]            = useState('')
  const [city,           setCity]           = useState('')
  const [ecName,         setEcName]         = useState('')
  const [ecPhone,        setEcPhone]        = useState('')
  const [belt,           setBelt]           = useState('white')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [agbAccepted,      setAgbAccepted]      = useState(false)
  const [contractRead,     setContractRead]     = useState(false)
  const [gdprAccepted,     setGdprAccepted]     = useState(false)
  const [contractAccepted, setContractAccepted] = useState(false)
  const [signatureData,    setSignatureData]    = useState<string | null>(null)

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

  const plans     = gymInfo?.plans ?? []
  const step1Valid = firstName.trim() && lastName.trim() && email.trim().includes('@') && dob
    && (plans.length === 0 || selectedPlanId !== null)
  const step3Valid = signatureData !== null
  const step4Valid = gdprAccepted && contractAccepted && contractRead

  const contractRef = useRef<HTMLDivElement>(null)
  const handleScroll = useCallback(() => {
    const el = contractRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setContractRead(true)
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
          plan_id: selectedPlanId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unbekannter Fehler')

      // If there's a Stripe checkout URL, redirect directly — no email/WhatsApp link needed
      if (data.checkoutUrl) {
        setRedirecting(true)
        window.location.href = data.checkoutUrl
        return
      }

      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
      setSubmitting(false)
    }
  }

  /* ── Loading / error states ─────────────────────────────────────── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-7 h-7 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
    </div>
  )

  if (loadErr) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="text-center max-w-sm">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
        <h2 className="font-bold text-zinc-900 text-lg mb-2">
          {loadErr.includes('deaktiviert') ? (lang === 'en' ? 'Sign-up disabled' : 'Anmeldung deaktiviert') : (lang === 'en' ? 'Invalid link' : 'Link ungültig')}
        </h2>
        <p className="text-zinc-500 text-sm">{loadErr}</p>
      </div>
    </div>
  )

  if (redirecting) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="font-bold text-zinc-900 text-xl mb-2">
          {lang === 'en' ? 'Almost done…' : 'Fast fertig…'}
        </h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          {lang === 'en'
            ? 'You are being redirected to our secure payment provider to complete your membership.'
            : 'Du wirst zur sicheren Zahlungsabwicklung weitergeleitet, um deine Mitgliedschaft abzuschließen.'}
        </p>
      </div>
    </div>
  )

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={40} className="text-amber-500" />
        </div>
        <h2 className="font-bold text-zinc-900 text-2xl mb-2">{lang === 'en' ? 'Registration successful!' : 'Anmeldung erfolgreich!'}</h2>
        <p className="text-zinc-500 text-sm leading-relaxed mb-4">
          {lang === 'en'
            ? <><strong>{gymInfo?.gymName}</strong>{' '}has received your registration. Your membership is active — check your email for your member portal link.</>
            : <>Deine Mitgliedschaft bei <strong>{gymInfo?.gymName}</strong> ist aktiv! Schau in deine E-Mails für den Link zu deinem Mitglieder-Portal.</>
          }
        </p>
        <p className="text-xs text-zinc-400">
          {lang === 'en'
            ? `Contract and privacy policy digitally signed on ${new Date().toLocaleDateString('en-GB')}.`
            : `Vertrag und Datenschutz digital unterzeichnet am ${new Date().toLocaleDateString('de-DE')}.`
          }
        </p>
      </div>
    </div>
  )

  const steps = [
    { n: 1 as const, label: lang === 'en' ? 'Details' : 'Daten' },
    { n: 2 as const, label: lang === 'en' ? 'Contract' : 'Vertrag' },
    { n: 3 as const, label: lang === 'en' ? 'Signature' : 'Unterschrift' },
    { n: 4 as const, label: lang === 'en' ? 'Confirm' : 'Bestätigung' },
  ]

  return (
    <div className="min-h-screen bg-zinc-50 safe-area-top">

      {/* Header */}
      <div className="bg-zinc-950 px-4 py-5 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center">
            <LogoMark className="w-3.5 h-3 text-zinc-950" />
          </div>
          <p className="text-amber-400 font-black text-xl italic tracking-tight">Osss</p>
        </div>
        <p className="text-white font-semibold text-sm">{gymInfo?.gymName}</p>
        <p className="text-zinc-500 text-xs mt-0.5">{lang === 'en' ? 'Member registration' : 'Mitglieder-Anmeldung'}</p>
        <div className="mt-2 flex justify-center"><LanguageSwitcher variant="minimal" className="text-zinc-400" /></div>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
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
                <div className={`flex-1 h-0.5 w-6 rounded-full transition-colors ${step > s.n ? 'bg-zinc-900' : 'bg-zinc-200'}`} />
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
              <h2 className="text-lg font-bold text-zinc-900 mb-1">{lang === 'en' ? 'Personal details' : 'Persönliche Daten'}</h2>
              <p className="text-zinc-500 text-sm">{lang === 'en' ? 'Please fill in all required fields.' : 'Bitte fülle alle Pflichtfelder aus.'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={lang === 'en' ? 'First name *' : 'Vorname *'} value={firstName} onChange={setFirstName} placeholder="Max" />
              <Field label={lang === 'en' ? 'Last name *' : 'Nachname *'} value={lastName} onChange={setLastName} placeholder="Mustermann" />
            </div>
            <Field label={lang === 'en' ? 'Email *' : 'E-Mail *'} type="email" value={email} onChange={setEmail} placeholder="max@example.com" />
            <Field label={lang === 'en' ? 'Phone' : 'Telefon'} type="tel" value={phone} onChange={setPhone} placeholder="+49 176 …" />
            <Field label={lang === 'en' ? 'Date of birth *' : 'Geburtsdatum *'} type="date" value={dob} onChange={setDob} />

            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Address' : 'Adresse'}</p>
              <div className="space-y-3">
                <Field label={lang === 'en' ? 'Street & number' : 'Straße & Hausnummer'} value={street} onChange={setStreet} placeholder={lang === 'en' ? '1 Example St' : 'Musterstraße 1'} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label={lang === 'en' ? 'Postcode' : 'PLZ'} value={zip} onChange={setZip} placeholder="12345" />
                  <Field label={lang === 'en' ? 'City' : 'Stadt'} value={city} onChange={setCity} placeholder={lang === 'en' ? 'Berlin' : 'München'} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Emergency contact' : 'Notfallkontakt'}</p>
              <div className="space-y-3">
                <Field label="Name" value={ecName} onChange={setEcName} placeholder="Maria Mustermann" />
                <Field label={lang === 'en' ? 'Phone' : 'Telefon'} type="tel" value={ecPhone} onChange={setEcPhone} placeholder="+49 …" />
              </div>
            </div>

            {plans.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Choose membership *' : 'Mitgliedschaft wählen *'}</p>
                <div className="space-y-2">
                  {plans.map(plan => {
                    const intervalLabel = lang === 'en'
                      ? (plan.billing_interval === 'monthly' ? 'mo.' : plan.billing_interval === 'biannual' ? '6 mo.' : 'yr.')
                      : (plan.billing_interval === 'monthly' ? 'mtl.' : plan.billing_interval === 'biannual' ? 'halbjährl.' : 'jährl.')
                    const price = (plan.price_cents / 100).toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE', { style: 'currency', currency: 'EUR' })
                    const contractLabel = lang === 'en'
                      ? (plan.contract_months === 0 ? 'Cancel monthly' : `${plan.contract_months} month term`)
                      : (plan.contract_months === 0 ? 'Monatlich kündbar' : `${plan.contract_months} Monate Laufzeit`)
                    const isSelected = selectedPlanId === plan.id
                    return (
                      <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)}
                        className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                          isSelected ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 bg-white hover:border-zinc-300'
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-900 text-sm">{plan.name}</p>
                            {plan.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{plan.description}</p>}
                            <p className="text-xs text-zinc-400 mt-1">{contractLabel}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-zinc-900 text-sm">{price}</p>
                            <p className="text-xs text-zinc-400">{intervalLabel}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{lang === 'en' ? 'Current belt rank' : 'Aktueller Gürtelgrad'}</p>
              <div className="flex flex-wrap gap-2">
                {BELTS.map(b => (
                  <button key={b.value} type="button" onClick={() => setBelt(b.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                      belt === b.value ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}>
                    <span className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0"
                      style={{ background: b.color }} />
                    {lang === 'en' ? b.labelEn : b.labelDe}
                  </button>
                ))}
              </div>
            </div>

            <button disabled={!step1Valid} onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-colors flex items-center justify-center gap-2">
              {lang === 'en' ? 'Next' : 'Weiter'} <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* ── STEP 2: Vertrag ─────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 mb-1">{lang === 'en' ? 'Membership contract' : 'Mitgliedsvertrag'}</h2>
              <p className="text-zinc-500 text-sm">{lang === 'en' ? 'Please read the contract fully (scroll to the end).' : 'Bitte lies den Vertrag vollständig durch (bis zum Ende scrollen).'}</p>
            </div>

            <div
              ref={contractRef}
              onScroll={handleScroll}
              className="bg-white rounded-2xl border border-zinc-200 p-5 max-h-[55vh] overflow-y-auto shadow-sm text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap"
            >
              {gymInfo?.contractTemplate || (lang === 'en' ? 'No contract on file.' : 'Kein Vertrag hinterlegt.')}
            </div>

            {!contractRead && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle size={13} /> {lang === 'en' ? 'Please scroll to the end to continue.' : 'Bitte scrolle bis zum Ende, um fortzufahren.'}
              </p>
            )}
            {contractRead && (
              <p className="text-xs text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 size={13} /> {lang === 'en' ? 'You have read the contract in full.' : 'Du hast den Vertrag vollständig gelesen.'}
              </p>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors">
                <ChevronLeft size={16} /> {lang === 'en' ? 'Back' : 'Zurück'}
              </button>
              <button disabled={!contractRead} onClick={() => setStep(3)}
                className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center justify-center gap-2">
                {lang === 'en' ? 'Next' : 'Weiter'} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Unterschrift ────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 mb-1">{lang === 'en' ? 'Digital signature' : 'Digitale Unterschrift'}</h2>
              <p className="text-zinc-500 text-sm">
                {lang === 'en' ? 'Sign with your finger (mobile) or mouse (PC) in the field below.' : 'Unterschreibe mit dem Finger (Handy) oder der Maus (PC) im Feld unten.'}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm">
              <p className="text-xs text-zinc-400 mb-3">
                {firstName} {lastName} — {new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE')}
              </p>
              <SignaturePad onChange={setSignatureData} lang={lang} />
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {lang === 'en'
                ? <>By signing you confirm that you have read and agreed to the membership contract of <strong>{gymInfo?.gymName}</strong>. Your digital signature is legally binding under the eIDAS Regulation.</>
                : <>Mit deiner Unterschrift bestätigst du, dass du den Mitgliedsvertrag von <strong>{gymInfo?.gymName}</strong> gelesen hast und damit einverstanden bist. Die digitale Unterschrift ist rechtlich bindend gemäß eIDAS-Verordnung.</>
              }
            </p>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors">
                <ChevronLeft size={16} /> {lang === 'en' ? 'Back' : 'Zurück'}
              </button>
              <button disabled={!step3Valid} onClick={() => setStep(4)}
                className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center justify-center gap-2">
                {lang === 'en' ? 'Next' : 'Weiter'} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Einwilligung & Absenden ─────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 mb-1">{lang === 'en' ? 'Consent & registration' : 'Einwilligung & Anmeldung'}</h2>
              <p className="text-zinc-500 text-sm">{lang === 'en' ? 'Please confirm the following points.' : 'Bitte bestätige die folgenden Punkte.'}</p>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm space-y-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">{lang === 'en' ? 'Summary' : 'Zusammenfassung'}</p>
              <SummaryRow label="Name"         value={`${firstName} ${lastName}`} />
              <SummaryRow label="E-Mail"        value={email} />
              {phone && <SummaryRow label={lang === 'en' ? 'Phone' : 'Telefon'}       value={phone} />}
              {dob   && <SummaryRow label={lang === 'en' ? 'Date of birth' : 'Geburtsdatum'}  value={new Date(dob).toLocaleDateString(lang === 'en' ? 'en-GB' : 'de-DE')} />}
              {(street || city) && <SummaryRow label={lang === 'en' ? 'Address' : 'Adresse'} value={[street, `${zip} ${city}`.trim()].filter(Boolean).join(', ')} />}
              {ecName && <SummaryRow label={lang === 'en' ? 'Emergency contact' : 'Notfallkontakt'} value={`${ecName}${ecPhone ? ` · ${ecPhone}` : ''}`} />}
              <SummaryRow label={lang === 'en' ? 'Belt rank' : 'Gürtelgrad'} value={BELTS.find(b => b.value === belt)?.[lang === 'en' ? 'labelEn' : 'labelDe'] ?? (lang === 'en' ? 'White' : 'Weiß')} />
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={contractAccepted} onChange={e => setContractAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-zinc-300 text-amber-500 focus:ring-amber-400 flex-shrink-0 cursor-pointer" />
                <span className="text-sm text-zinc-700 leading-relaxed">
                  {lang === 'en'
                    ? <>I have read and fully understood the membership contract of <strong>{gymInfo?.gymName}</strong> and agree to it. My digital signature is legally binding.</>
                    : <>Ich habe den Mitgliedsvertrag von <strong>{gymInfo?.gymName}</strong> vollständig gelesen, verstanden und erkläre mich damit einverstanden. Meine digitale Unterschrift ist rechtsverbindlich.</>
                  }
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={gdprAccepted} onChange={e => setGdprAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-zinc-300 text-amber-500 focus:ring-amber-400 flex-shrink-0 cursor-pointer" />
                <span className="text-sm text-zinc-700 leading-relaxed">
                  {lang === 'en'
                    ? <>I consent to the processing of my personal data for membership management in accordance with the{' '}<a href="/datenschutz" target="_blank" className="text-amber-600 hover:underline font-medium">Privacy Policy</a>.</>
                    : <>Ich stimme der Verarbeitung meiner personenbezogenen Daten zur Mitgliedschaftsverwaltung gemäß der{' '}<a href="/datenschutz" target="_blank" className="text-amber-600 hover:underline font-medium">Datenschutzerklärung</a>{' '}zu.</>
                  }
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agbAccepted} onChange={e => setAgbAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-zinc-300 text-amber-500 focus:ring-amber-400 flex-shrink-0 cursor-pointer" />
                <span className="text-sm text-zinc-700 leading-relaxed">
                  {lang === 'en'
                    ? <>I have read and agree to the{' '}<a href="/datenschutz" target="_blank" className="text-amber-600 hover:underline font-medium">Privacy Policy</a>{' '}and the{' '}<a href="/agb" target="_blank" className="text-amber-600 hover:underline font-medium">Terms & Conditions</a>.</>
                    : <>Ich habe die{' '}<a href="/datenschutz" target="_blank" className="text-amber-600 hover:underline font-medium">Datenschutzerklärung</a>{' '}und die{' '}<a href="/agb" target="_blank" className="text-amber-600 hover:underline font-medium">AGB</a>{' '}gelesen und stimme zu.</>
                  }
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
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium transition-colors">
                <ChevronLeft size={16} /> {lang === 'en' ? 'Back' : 'Zurück'}
              </button>
              <button disabled={!step4Valid || !agbAccepted || submitting} onClick={submit}
                className="flex-1 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base transition-colors flex items-center justify-center gap-2">
                {submitting
                  ? (lang === 'en' ? 'Submitting…' : 'Wird gesendet…')
                  : selectedPlanId
                    ? (lang === 'en' ? '🥋 Sign up & pay now' : '🥋 Anmelden & jetzt bezahlen')
                    : (lang === 'en' ? '🥋 Sign up now' : '🥋 Jetzt anmelden')
                }
              </button>
            </div>

            <p className="text-xs text-zinc-400 text-center">
              {lang === 'en' ? 'Date & time:' : 'Datum & Uhrzeit:'} {new Date().toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Helper components ──────────────────────────────────────────────── */
function Field({
  label, value, onChange, placeholder = '', type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 mb-1.5">{label}</label>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors"
      />
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 border-b border-zinc-50 last:border-0">
      <span className="text-xs text-zinc-400 flex-shrink-0">{label}</span>
      <span className="text-xs font-medium text-zinc-800 text-right truncate">{value}</span>
    </div>
  )
}
