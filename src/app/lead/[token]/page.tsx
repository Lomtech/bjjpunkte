'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import { Clock, CheckCircle, MapPin, Calendar, Navigation } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadClass {
  id: string
  title: string
  class_type: string
  instructor: string | null
  starts_at: string
  ends_at: string
  max_capacity: number | null
}

interface LeadBooking {
  id: string
  class_id: string
  status: 'booked' | 'checked_in' | 'cancelled'
  booked_at: string
  checked_in_at: string | null
}

interface GymInfo {
  id: string
  name: string
  logo_url: string | null
  address: string | null
  slug: string
}

interface LeadInfo {
  id: string
  first_name: string
  last_name: string
  email: string | null
  status: string
}

interface PortalData {
  lead: LeadInfo
  gym: GymInfo | null
  classes: LeadClass[]
  bookings: LeadBooking[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CLASS_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat', kids: 'Kids', competition: 'Competition',
}

const TYPE_COLORS: Record<string, string> = {
  gi:          'bg-blue-50 text-blue-700',
  'no-gi':     'bg-zinc-100 text-zinc-700',
  'open mat':  'bg-amber-50 text-amber-700',
  kids:        'bg-green-50 text-green-700',
  competition: 'bg-red-50 text-red-700',
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  new:        'Neu',
  contacted:  'Kontaktiert',
  trial:      'Probetraining',
  converted:  'Mitglied',
  lost:       'Kein Interesse',
}

const LEAD_STATUS_COLORS: Record<string, string> = {
  new:        'bg-amber-50 text-amber-700 border-amber-200',
  contacted:  'bg-blue-50 text-blue-700 border-blue-200',
  trial:      'bg-purple-50 text-purple-700 border-purple-200',
  converted:  'bg-green-50 text-green-700 border-green-200',
  lost:       'bg-slate-100 text-slate-500 border-slate-200',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
    time: d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    dateShort: d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }),
  }
}

function isWithin2h(startsAt: string): boolean {
  const now = Date.now()
  const start = new Date(startsAt).getTime()
  return now >= start - 2 * 60 * 60 * 1000 && now <= start + 2 * 60 * 60 * 1000
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LeadPortalPage() {
  const params = useParams()
  const token  = params.token as string

  const [data, setData]       = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [gpsState, setGpsState] = useState<'idle' | 'locating' | 'success' | 'error'>('idle')
  const [gpsMessage, setGpsMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch(`/api/public/lead/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Verbindungsfehler'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => { load() }, [load])

  async function handleBook(classId: string) {
    setActionLoading(classId + ':book')
    await fetch(`/api/public/lead/${token}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId }),
    })
    setActionLoading(null)
    load()
  }

  async function handleCheckin(classId: string) {
    setActionLoading(classId + ':checkin')
    await fetch(`/api/public/lead/${token}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId }),
    })
    setActionLoading(null)
    load()
  }

  async function handleGpsCheckin() {
    if (!navigator.geolocation) {
      setGpsMessage('GPS nicht verfügbar'); setGpsState('error'); return
    }
    setGpsState('locating'); setGpsMessage(null)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const res = await fetch(`/api/public/lead/${token}/gps-checkin`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        })
        const d = await res.json()
        if (res.ok) {
          const clsName = d.class?.title ? ` · ${d.class.title}` : ''
          setGpsMessage(`Eingecheckt ✓${clsName}`)
          setGpsState('success')
          load()
        } else {
          setGpsMessage(d.error ?? 'Fehler beim GPS-Check-in')
          setGpsState('error')
        }
      },
      err => { setGpsMessage(err.message); setGpsState('error') },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }

  async function handleCancel(classId: string) {
    setActionLoading(classId + ':cancel')
    await fetch(`/api/public/lead/${token}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId }),
    })
    setActionLoading(null)
    load()
  }

  // ── Loading / Error ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Lädt…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-zinc-500 text-sm">{error || 'Nicht gefunden'}</p>
          <p className="text-zinc-400 text-xs mt-2">Bitte kontaktiere dein Gym.</p>
        </div>
      </div>
    )
  }

  const { lead, gym, classes, bookings } = data

  // Build a quick lookup: class_id -> booking
  const bookingMap = new Map<string, LeadBooking>()
  for (const b of bookings) {
    if (b.status !== 'cancelled') bookingMap.set(b.class_id, b)
  }

  const statusLabel = LEAD_STATUS_LABELS[lead.status] ?? lead.status
  const statusColor = LEAD_STATUS_COLORS[lead.status] ?? LEAD_STATUS_COLORS.new

  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <div className="bg-white border-b border-zinc-100 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center gap-3">
          {gym?.logo_url ? (
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-100">
              <Image
                src={gym.logo_url}
                alt={gym.name || 'Logo'}
                width={36}
                height={36}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-black text-white italic">oss</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-zinc-900 text-sm leading-tight truncate">
              {gym?.name ?? 'Gym'}
            </p>
            <p className="text-xs text-zinc-400">Interessenten-Portal</p>
          </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 py-6 space-y-6">

        {/* Welcome card */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-zinc-900 font-bold text-lg leading-tight">
                Hallo {lead.first_name}!
              </p>
              <p className="text-zinc-500 text-sm mt-1">
                Du bist als Interessent registriert.
              </p>
              {gym?.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(gym.address)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-amber-600 text-xs mt-2 flex items-center gap-1 transition-colors"
                >
                  <MapPin size={11} />
                  {gym.address}
                </a>
              )}
            </div>
            <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* GPS Check-in */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-slate-900 font-semibold text-sm mb-0.5 flex items-center gap-2">
            <Navigation size={14} className="text-amber-500" /> GPS Check-in
          </p>
          <p className="text-slate-400 text-xs mb-4">Im Gym? Tippe einmal — wir checken dich automatisch ein.</p>
          <button
            onClick={handleGpsCheckin}
            disabled={gpsState === 'locating'}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl py-3 transition-colors"
          >
            <Navigation size={14} />
            {gpsState === 'locating' ? 'Standort wird ermittelt…' : 'GPS Check-in starten'}
          </button>
          {gpsMessage && (
            <p className={`mt-3 text-xs text-center px-3 py-2 rounded-xl ${gpsState === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {gpsMessage}
            </p>
          )}
        </div>

        {/* Map */}
        {gym?.address && (
          <div className="rounded-2xl overflow-hidden border border-zinc-100 shadow-sm">
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent(gym.address)}&output=embed&z=15`}
              width="100%"
              height="220"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Standort"
            />
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(gym.address)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 bg-white hover:bg-zinc-50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <MapPin size={14} className="text-amber-500" />
                {gym.address}
              </span>
              <span className="text-xs text-amber-500 font-semibold">Route →</span>
            </a>
          </div>
        )}

        {/* Upcoming classes */}
        <div>
          <h2 className="font-bold text-zinc-900 text-base mb-3 flex items-center gap-2">
            <Calendar size={15} className="text-amber-500" />
            Kommende Trainings
          </h2>

          {classes.length === 0 ? (
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-5 py-8 text-center">
              <p className="text-zinc-400 text-sm">Keine Trainings in den nächsten 14 Tagen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {classes.map(cls => {
                const booking = bookingMap.get(cls.id)
                const isBooked    = booking?.status === 'booked'
                const isCheckedIn = booking?.status === 'checked_in'
                const showCheckin = isBooked && isWithin2h(cls.starts_at)
                const isBooking    = actionLoading === cls.id + ':book'
                const isCheckingIn = actionLoading === cls.id + ':checkin'
                const isCancelling = actionLoading === cls.id + ':cancel'
                const endTime = new Date(cls.ends_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                const { date, time } = formatDateTime(cls.starts_at)
                const typeColor = TYPE_COLORS[cls.class_type] ?? 'bg-zinc-100 text-zinc-700'
                const typeLabel = CLASS_LABELS[cls.class_type] ?? cls.class_type

                return (
                  <div key={cls.id} className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${typeColor}`}>
                            {typeLabel}
                          </span>
                        </div>
                        <p className="font-semibold text-zinc-900 text-sm">{cls.title}</p>
                        <p className="text-zinc-500 text-xs mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          {date} · {time}–{endTime}
                        </p>
                        {cls.instructor && (
                          <p className="text-zinc-400 text-xs mt-0.5">{cls.instructor}</p>
                        )}
                        {cls.max_capacity != null && (
                          <p className="text-zinc-400 text-xs mt-0.5">
                            max. {cls.max_capacity} Plätze
                          </p>
                        )}
                      </div>

                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        {isCheckedIn ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-3 py-2 rounded-xl border border-green-100">
                            <CheckCircle size={12} />
                            Eingecheckt ✓
                          </span>
                        ) : isBooked ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-3 py-2 rounded-xl border border-green-100">
                              <CheckCircle size={12} />
                              Zugesagt ✓
                            </span>
                            <button
                              onClick={() => handleCancel(cls.id)}
                              disabled={!!isCancelling}
                              className="text-[11px] text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-50"
                            >
                              {isCancelling ? '…' : 'Abmelden'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleBook(cls.id)}
                            disabled={!!isBooking}
                            className="text-xs font-semibold px-3 min-h-[36px] rounded-xl bg-amber-500 hover:bg-amber-400 text-white transition-colors disabled:opacity-50"
                          >
                            {isBooking ? '…' : 'Anmelden'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Checkin row */}
                    {showCheckin && (
                      <div className="mt-3 pt-3 border-t border-zinc-100">
                        <button
                          onClick={() => handleCheckin(cls.id)}
                          disabled={!!isCheckingIn}
                          className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={14} />
                          {isCheckingIn ? 'Einchecken…' : 'Einchecken'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* My bookings */}
        {bookings.filter(b => b.status !== 'cancelled').length > 0 && (
          <div>
            <h2 className="font-bold text-zinc-900 text-base mb-3 flex items-center gap-2">
              <CheckCircle size={15} className="text-amber-500" />
              Meine Anmeldungen
            </h2>

            <div className="space-y-2">
              {bookings
                .filter(b => b.status !== 'cancelled')
                .map(b => {
                  const cls = classes.find(c => c.id === b.class_id)
                  const isCheckedIn = b.status === 'checked_in'
                  const { dateShort, time } = cls
                    ? formatDateTime(cls.starts_at)
                    : { dateShort: '—', time: '—' }

                  return (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 truncate">
                          {cls?.title ?? 'Training'}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {dateShort} · {time}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${
                        isCheckedIn
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {isCheckedIn ? 'Eingecheckt' : 'Angemeldet'}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-zinc-300 text-xs pb-4">
          Betrieben mit <span className="font-bold italic">Osss</span>
        </p>
      </div>
    </div>
  )
}
