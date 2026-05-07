'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, ChevronLeft, AlertCircle, Calendar, Clock, User, Sparkles } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { startOfWeek, addDays, CLASS_LABELS } from '@/lib/constants'

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

// Konsistent mit Lead-Portal + Member-Portal
const TYPE_COLORS: Record<string, string> = {
  gi:          'bg-blue-50 text-blue-700',
  'no-gi':     'bg-zinc-100 text-zinc-700',
  'open mat':  'bg-amber-50 text-amber-700',
  kids:        'bg-green-50 text-green-700',
  competition: 'bg-red-50 text-red-700',
}
const TYPE_DOT: Record<string, string> = {
  gi:          'bg-blue-400',
  'no-gi':     'bg-zinc-400',
  'open mat':  'bg-amber-400',
  kids:        'bg-green-400',
  competition: 'bg-red-400',
}

const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WEEKDAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatTime(iso: string, locale = 'de-DE') {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

export default function TrialPage() {
  const { slug } = useParams() as { slug: string }
  const { lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'

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
  const [trialContract, setTrialContract] = useState<string>('')
  const [rulesAccepted, setRulesAccepted] = useState(false)

  // Schedule-Navigation (analog Member/Lead-Portal)
  const todayDate  = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const [weekStart, setWeekStart]     = useState<Date>(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date>(todayDate)

  useEffect(() => {
    fetch(`/api/public/gym/${encodeURIComponent(slug)}`)
      .then(async r => {
        const data = await r.json()
        if (data.error) { setLoadErr(data.error); return }
        setGymInfo({ id: data.gym.id, name: data.gym.name, logo_url: data.gym.logo_url })
        setClasses(data.classes ?? [])
        setTrialContract(typeof data.trialContract === 'string' ? data.trialContract : '')
      })
      .catch(() => setLoadErr(lang === 'en' ? 'Connection error – please check your internet connection.' : 'Verbindungsfehler – bitte Internetverbindung prüfen.'))
      .finally(() => setLoading(false))
  }, [slug, lang])

  const step1Valid = firstName.trim() && lastName.trim() && email.trim().includes('@')

  async function submit() {
    if (!rulesAccepted) {
      setError(lang === 'en'
        ? 'You must accept the trial rules to book a session.'
        : 'Bitte akzeptiere die Probetraining-Regelungen, um eine Stunde zu buchen.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/public/gym/${encodeURIComponent(slug)}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name:  lastName.trim(),
          email:      email.trim(),
          phone:      phone.trim() || null,
          message:    message.trim() || null,
          class_id:   classId,
          trial_consent_accepted: true,
          trial_consent_text:     trialContract,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (lang === 'en' ? 'Unknown error' : 'Unbekannter Fehler'))
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : (lang === 'en' ? 'Error' : 'Fehler'))
    }
    setSubmitting(false)
  }

  // Klassen für gewählten Tag
  const dayClasses = useMemo(
    () => classes.filter(c => isSameDay(new Date(c.starts_at), selectedDay))
                 .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [classes, selectedDay],
  )

  const steps = [
    { n: 1 as const, label: lang === 'en' ? 'Details' : 'Daten' },
    { n: 2 as const, label: lang === 'en' ? 'Class' : 'Klasse' },
    { n: 3 as const, label: lang === 'en' ? 'Done' : 'Fertig' },
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
        <h2 className="font-bold text-zinc-900 text-lg mb-2">{lang === 'en' ? 'Gym not found' : 'Gym nicht gefunden'}</h2>
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
        <h2 className="font-bold text-zinc-900 text-2xl mb-2">{lang === 'en' ? 'Request sent!' : 'Anfrage gesendet!'}</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          {lang === 'en'
            ? <>Your trial class request at <strong>{gymInfo?.name}</strong> has been received. You will get a confirmation email with your personal portal link.</>
            : <>Deine Probetraining-Anfrage bei <strong>{gymInfo?.name}</strong> ist eingegangen. Du erhältst eine Bestätigungs-E-Mail mit deinem persönlichen Portal-Link.</>
          }
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
        <p className="text-zinc-500 text-xs mt-0.5">{lang === 'en' ? 'Request a trial class' : 'Probetraining anfragen'}</p>
        <div className="mt-2 flex justify-center"><LanguageSwitcher variant="minimal" className="text-zinc-400" /></div>
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

      {/* Wellpass-Hinweis-Banner — nur Step 1 (oberste Stufe), damit Wellpass-
          Kunden nicht den Probetraining-Pfad gehen, sondern direkt anmelden. */}
      {step === 1 && (
        <div className="max-w-lg mx-auto px-4 pt-5">
          <Link
            href={`/wellpass/${encodeURIComponent(slug)}`}
            className="block bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 hover:bg-emerald-100 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-emerald-900 text-sm">
                  {lang === 'en' ? 'Wellpass / Hansefit / EGYM customer?' : 'Wellpass / Hansefit / EGYM-Kunde?'}
                </p>
                <p className="text-xs text-emerald-700 leading-snug mt-0.5">
                  {lang === 'en'
                    ? <>Skip the trial — sign up directly. Adults only (18+).</>
                    : <>Direkt anmelden statt Probetraining — über die Anbieter-Vereinbarung. Nur für Erwachsene (ab 18 Jahren).</>}
                </p>
              </div>
              <ChevronRight size={16} className="text-emerald-500 flex-shrink-0 mt-1" />
            </div>
          </Link>
        </div>
      )}

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Step 1: Personal data */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-black text-zinc-900 mb-1">{lang === 'en' ? 'Personal details' : 'Persönliche Daten'}</h2>
            <p className="text-zinc-400 text-sm mb-6">{lang === 'en' ? 'Please fill in all required fields.' : 'Bitte fülle alle Pflichtfelder aus.'}</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{lang === 'en' ? 'First name *' : 'Vorname *'}</label>
                  <input className={INPUT} placeholder="Max" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{lang === 'en' ? 'Last name *' : 'Nachname *'}</label>
                  <input className={INPUT} placeholder="Mustermann" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{lang === 'en' ? 'Email *' : 'E-Mail *'}</label>
                <input className={INPUT} type="email" placeholder="max@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{lang === 'en' ? 'Phone' : 'Telefon'}</label>
                <input className={INPUT} type="tel" placeholder="+49 176 …" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{lang === 'en' ? 'Message' : 'Nachricht'} <span className="text-zinc-400 font-normal">({lang === 'en' ? 'optional' : 'optional'})</span></label>
                <textarea className={`${INPUT} resize-none`} rows={3} placeholder={lang === 'en' ? 'Experience, questions, …' : 'Erfahrung, Fragen, …'} value={message} onChange={e => setMessage(e.target.value)} />
              </div>
            </div>

            <button
              onClick={() => { if (step1Valid) setStep(2) }}
              disabled={!step1Valid}
              className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold text-sm transition-colors"
            >
              {lang === 'en' ? 'Next' : 'Weiter'} <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Class selection — Schedule-Style wie Member/Lead-Portal */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-black text-zinc-900 mb-1">{lang === 'en' ? 'Choose a class' : 'Klasse wählen'}</h2>
            <p className="text-zinc-400 text-sm mb-4">{lang === 'en' ? 'Optional — you can also enquire without a slot.' : 'Optional — du kannst auch ohne Slot anfragen.'}</p>

            {/* Stundenplan-Card (analog Lead-/Member-Portal) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">

              {/* Stundenplan-Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-amber-500" />
                  {lang === 'en' ? 'Schedule' : 'Stundenplan'}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const prev = addDays(weekStart, -7)
                      setWeekStart(prev)
                      setSelectedDay(addDays(selectedDay, -7))
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setWeekStart(startOfWeek(new Date()))
                      setSelectedDay(todayDate)
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
                  >
                    {lang === 'en' ? 'Today' : 'Heute'}
                  </button>
                  <button
                    onClick={() => {
                      const next = addDays(weekStart, 7)
                      setWeekStart(next)
                      setSelectedDay(addDays(selectedDay, 7))
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Day-Strip */}
              <div className="border-b border-slate-100 bg-white overflow-x-auto">
                <div className="flex min-w-max px-2 gap-1 py-2">
                  {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day, idx) => {
                    const isToday = isSameDay(day, todayDate)
                    const isSel   = isSameDay(day, selectedDay)
                    const hasCls  = classes.some(c => isSameDay(new Date(c.starts_at), day))
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDay(day)}
                        className={`flex flex-col items-center px-4 py-2 rounded-xl transition-colors min-w-[52px] ${
                          isSel ? 'bg-amber-500 text-white' : isToday ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-wide">
                          {(lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_DE)[idx]}
                        </span>
                        <span className="text-sm font-bold mt-0.5">{day.getDate()}</span>
                        {hasCls && !isSel && <span className="w-1 h-1 rounded-full bg-amber-400 mt-1" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Klassen für gewählten Tag */}
              <div className="p-4">
                {classes.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar size={28} className="text-zinc-200 mx-auto mb-2" />
                    <p className="text-zinc-400 text-sm">
                      {lang === 'en' ? 'No upcoming classes listed.' : 'Keine bevorstehenden Klassen eingetragen.'}
                    </p>
                  </div>
                ) : dayClasses.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">
                    {lang === 'en' ? 'No training on this day.' : 'Kein Training an diesem Tag.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {dayClasses.map(cls => {
                      const full       = cls.spots_left !== null && cls.spots_left <= 0
                      const selected   = classId === cls.id
                      const typeColor  = TYPE_COLORS[cls.class_type] ?? 'bg-zinc-100 text-zinc-700'
                      const typeDot    = TYPE_DOT[cls.class_type] ?? 'bg-zinc-300'
                      const typeLabel  = CLASS_LABELS[cls.class_type] ?? cls.class_type
                      const isLive     = new Date(cls.starts_at) <= new Date() && new Date(cls.ends_at) >= new Date()

                      return (
                        <button
                          key={cls.id}
                          type="button"
                          disabled={full}
                          onClick={() => setClassId(selected ? null : cls.id)}
                          className={`w-full text-left rounded-xl border-2 transition-all overflow-hidden ${
                            full      ? 'opacity-40 cursor-not-allowed border-zinc-100 bg-white' :
                            selected  ? 'border-amber-400 bg-amber-50 shadow-sm' :
                                        'border-slate-100 bg-white hover:border-zinc-200'
                          }`}
                        >
                          <div className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${typeDot}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${typeColor}`}>
                                    {typeLabel}
                                  </span>
                                  {isLive && (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      Live
                                    </span>
                                  )}
                                  {full && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-red-50 text-red-700 border border-red-200">
                                      {lang === 'en' ? 'Full' : 'Ausgebucht'}
                                    </span>
                                  )}
                                  {selected && !full && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                      ✓ {lang === 'en' ? 'Selected' : 'Ausgewählt'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-slate-900 text-sm font-bold leading-tight">{cls.title}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                  <span className="flex items-center gap-1 tabular-nums">
                                    <Clock size={10} /> {formatTime(cls.starts_at, locale)} – {formatTime(cls.ends_at, locale)}
                                  </span>
                                  {cls.instructor && (
                                    <span className="flex items-center gap-1 truncate">
                                      <User size={10} /> {cls.instructor}
                                    </span>
                                  )}
                                </div>
                                {cls.max_capacity != null && cls.spots_left != null && !full && (
                                  <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                                    {cls.spots_left} {lang === 'en' ? 'of' : 'von'} {cls.max_capacity} {lang === 'en' ? 'spots free' : 'Plätzen frei'}
                                  </p>
                                )}
                              </div>
                              {selected && (
                                <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-[10px] font-black">✓</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Probetraining-Regelungen — Pflicht-Acknowledgment vor Submit */}
            {trialContract && (
              <div className="mb-4 bg-white rounded-2xl border border-zinc-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    {lang === 'en' ? 'Trial rules' : 'Probetraining-Regelungen'}
                  </p>
                </div>
                <pre className="px-4 py-3 max-h-56 overflow-y-auto text-xs text-zinc-600 font-sans whitespace-pre-wrap leading-relaxed">{trialContract}</pre>
                <label className="flex items-start gap-3 px-4 py-3 border-t border-zinc-100 cursor-pointer hover:bg-amber-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={rulesAccepted}
                    onChange={e => setRulesAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-sm text-zinc-700 leading-relaxed">
                    {lang === 'en'
                      ? <>I have <strong>read and accepted</strong> the rules above (liability, conduct, house rules).</>
                      : <>Ich habe die Regelungen oben (Haftung, Verhalten, Hausordnung) <strong>gelesen und akzeptiere</strong> sie.</>}
                  </span>
                </label>
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
                <ChevronLeft size={15} /> {lang === 'en' ? 'Back' : 'Zurück'}
              </button>
              <button
                onClick={submit}
                disabled={submitting || (!!trialContract && !rulesAccepted)}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-950 font-bold text-sm transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" /> {lang === 'en' ? 'Sending…' : 'Wird gesendet…'}</span>
                ) : (
                  classId ? (lang === 'en' ? 'Book trial class' : 'Probetraining buchen') : (lang === 'en' ? 'Send request' : 'Anfrage senden')
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
