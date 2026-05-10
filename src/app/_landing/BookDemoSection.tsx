'use client'

/**
 * Book-a-Demo Section — alternative conversion path for studio owners who don't
 * want to self-serve. Copied conceptually from maatapp.com's demo flow but with:
 *   - Founder voice ("Buch 20 Min mit mir") instead of corporate "Book a Demo"
 *   - Fewer required fields (4 vs MAAT's 8) to reduce friction
 *   - Direct delivery to oss@osss.pro via existing /api/public/contact endpoint
 *     (no separate API route — just sets a [DEMO] subject prefix)
 *   - Honeypot field carried over from ContactModal pattern
 *
 * Lives on the landing page as a full-width section (not a modal) — visible
 * commitment to the offer increases trust.
 */

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Calendar, ArrowRight } from 'lucide-react'

interface Props {
  lang: 'de' | 'en'
}

export function BookDemoSection({ lang }: Props) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [gymName, setGymName]   = useState('')
  const [gymSize, setGymSize]   = useState('')
  const [sport, setSport]       = useState('')
  const [message, setMessage]   = useState('')
  const [hp, setHp]             = useState('')  // Honeypot
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [done, setDone]         = useState(false)

  const isEn = lang === 'en'
  const valid = name.trim().length >= 2 && email.includes('@') && phone.trim().length >= 4 && gymName.trim().length >= 2

  async function send() {
    if (!valid) {
      setError(isEn
        ? 'Please fill name, email, phone and gym name.'
        : 'Bitte Name, E-Mail, Telefon und Gym-Name ausfüllen.')
      return
    }
    setBusy(true); setError(null)
    try {
      // Compose a structured message body. We reuse /api/public/contact rather
      // than spinning up a dedicated /api/public/demo route — same audit chain,
      // same Resend pipeline, just a different subject so Lom can filter.
      const body =
        `Demo-Anfrage von Landing-Page\n\n` +
        `Gym-Name:   ${gymName}\n` +
        (gymSize ? `Gym-Größe:  ${gymSize}\n` : '') +
        (sport ? `Sportart:   ${sport}\n` : '') +
        (message ? `\nNachricht:\n${message}\n` : '')
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    name.trim(),
          email:   email.trim(),
          phone:   phone.trim(),
          subject: '[DEMO] Demo-Anfrage von ' + (gymName.trim() || name.trim()),
          message: body,
          hp,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || (isEn ? 'Could not send. Please try again.' : 'Konnte nicht senden. Bitte erneut versuchen.'))
        setBusy(false)
        return
      }
      setDone(true); setBusy(false)
    } catch {
      setError(isEn ? 'Network error. Please try again.' : 'Netzwerkfehler. Bitte erneut versuchen.')
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto text-center py-10">
        <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto mb-5 flex items-center justify-center">
          <CheckCircle size={28} className="text-emerald-600" />
        </div>
        <h3 className="text-2xl font-black text-zinc-950 tracking-tight mb-3">
          {isEn ? 'Got it — talk soon!' : 'Hab\'s — bis gleich!'}
        </h3>
        <p className="text-zinc-500 text-base leading-relaxed">
          {isEn
            ? 'I\'ll reach out within 24 hours (usually same day) to set up a 20-minute call.'
            : 'Ich melde mich innerhalb von 24 Stunden (meist am selben Tag) für einen 20-Min-Call.'}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <p className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-3 inline-flex items-center gap-2">
          <Calendar size={11} />
          {isEn ? '20 minutes · free · no sales pitch' : '20 Minuten · gratis · ohne Verkaufs-Pitch'}
        </p>
        <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-3">
          {isEn ? 'Prefer a personal walk-through?' : 'Lieber persönlich durchgehen?'}
        </h2>
        <p className="text-zinc-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
          {isEn
            ? 'Book 20 min with me — Lom, the founder. I\'ll show you the dashboard live, answer your questions, and (if it fits) help you migrate from your old tool.'
            : 'Buch dir 20 Min mit mir — Lom, dem Founder. Ich zeige dir das Dashboard live, beantworte deine Fragen und helfe (wenn es passt) bei der Migration aus deinem alten Tool.'}
        </p>
      </div>

      <form
        onSubmit={e => { e.preventDefault(); send() }}
        className="bg-white border border-zinc-200 rounded-3xl p-6 sm:p-10 shadow-xl shadow-zinc-200/50 space-y-5"
      >
        {/* Honeypot — visually hidden, bots fill it, humans don't */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={e => setHp(e.target.value)}
          className="absolute -left-[9999px] -top-[9999px]"
          aria-hidden="true"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-1.5">
              {isEn ? 'Your name' : 'Dein Name'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={isEn ? 'Lucas Andrade' : 'Max Mustermann'}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-1.5">
              {isEn ? 'Email' : 'E-Mail'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={isEn ? 'lucas@your-gym.com' : 'max@dein-gym.de'}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-1.5">
              {isEn ? 'Phone' : 'Telefon'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+49 612 345 6789"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-1.5">
              {isEn ? 'Gym / academy name' : 'Gym-/Vereinsname'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={gymName}
              onChange={e => setGymName(e.target.value)}
              placeholder={isEn ? 'Arte Suave Academy' : 'Mein BJJ-Gym München'}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-1.5">
              {isEn ? 'Gym size' : 'Gym-Größe'}
            </label>
            <select
              value={gymSize}
              onChange={e => setGymSize(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm bg-white"
            >
              <option value="">{isEn ? 'Pick a range' : 'Bitte wählen'}</option>
              <option value="1-30">1–30 {isEn ? 'members' : 'Mitglieder'}</option>
              <option value="31-99">31–99 {isEn ? 'members' : 'Mitglieder'}</option>
              <option value="100-249">100–249 {isEn ? 'members' : 'Mitglieder'}</option>
              <option value="250+">250+ {isEn ? 'members' : 'Mitglieder'}</option>
              <option value="opening">{isEn ? 'Opening soon' : 'Eröffne demnächst'}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-zinc-900 mb-1.5">
              {isEn ? 'Primary sport' : 'Hauptsportart'}
            </label>
            <select
              value={sport}
              onChange={e => setSport(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm bg-white"
            >
              <option value="">{isEn ? 'Pick one' : 'Bitte wählen'}</option>
              <option value="bjj">Brazilian Jiu-Jitsu</option>
              <option value="mma">MMA</option>
              <option value="muay-thai">Muay Thai</option>
              <option value="boxing">{isEn ? 'Boxing' : 'Boxen'}</option>
              <option value="karate">Karate</option>
              <option value="judo">Judo</option>
              <option value="taekwondo">Taekwondo</option>
              <option value="kickboxing">Kickboxen</option>
              <option value="wrestling">{isEn ? 'Wrestling' : 'Ringen'}</option>
              <option value="other">{isEn ? 'Other' : 'Andere'}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-zinc-900 mb-1.5">
            {isEn ? 'Anything specific you\'d like to discuss?' : 'Was möchtest du konkret besprechen?'}
            <span className="text-zinc-400 font-normal ml-2">{isEn ? '(optional)' : '(optional)'}</span>
          </label>
          <textarea
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={isEn
              ? 'e.g. "Migrating from Eversports", "DATEV setup", "Multi-location gym"'
              : 'z.B. „Wechsel von Eversports", „DATEV-Setup", „Mehrere Standorte"'}
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm resize-none"
          />
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={busy || !valid}
            data-track="cta_demo_submit"
            className="w-full bg-zinc-950 hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-bold px-6 py-4 rounded-xl text-base transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {busy
              ? (isEn ? 'Sending…' : 'Sende…')
              : (
                <>
                  <Calendar size={16} className="text-amber-400" />
                  {isEn ? 'Book 20-min demo with founder' : '20-Min-Demo mit Founder buchen'}
                  <ArrowRight size={15} />
                </>
              )}
          </button>
          <p className="text-zinc-400 text-xs mt-3 text-center">
            {isEn ? (
              <>By submitting you agree to our <Link href="/datenschutz" className="underline hover:text-zinc-700">privacy policy</Link>. No spam, no sales calls without consent.</>
            ) : (
              <>Mit Absenden stimmst du unserer <Link href="/datenschutz" className="underline hover:text-zinc-700">Datenschutzerklärung</Link> zu. Kein Spam, keine ungewollten Verkaufs-Anrufe.</>
            )}
          </p>
        </div>
      </form>

      <div className="text-center mt-6">
        <p className="text-zinc-400 text-xs">
          {isEn ? 'Or skip the call — ' : 'Oder direkt loslegen — '}
          <Link href="/register" className="text-amber-600 hover:text-amber-700 font-semibold underline-offset-2 hover:underline">
            {isEn ? 'create a free account in 60 seconds' : 'Gratis-Account in 60 Sekunden anlegen'}
          </Link>
        </p>
      </div>
    </div>
  )
}
