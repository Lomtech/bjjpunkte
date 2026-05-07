'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import {
  Clock, CheckCircle, MapPin, Calendar, Navigation,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { startOfWeek, addDays, CLASS_LABELS } from '@/lib/constants'

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
  latitude: number | null
  longitude: number | null
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

const LEAD_STATUS_LABELS_DE: Record<string, string> = {
  new:        'Neu',
  contacted:  'Kontaktiert',
  trial:      'Probetraining',
  converted:  'Mitglied',
  lost:       'Kein Interesse',
}
const LEAD_STATUS_LABELS_EN: Record<string, string> = {
  new:        'New',
  contacted:  'Contacted',
  trial:      'Trial',
  converted:  'Member',
  lost:       'Not interested',
}

const LEAD_STATUS_COLORS: Record<string, string> = {
  new:        'bg-amber-50 text-amber-700 border-amber-200',
  contacted:  'bg-blue-50 text-blue-700 border-blue-200',
  trial:      'bg-purple-50 text-purple-700 border-purple-200',
  converted:  'bg-green-50 text-green-700 border-green-200',
  lost:       'bg-slate-100 text-slate-500 border-slate-200',
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function formatTime(iso: string, locale = 'de-DE') {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
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
  const { lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'

  const [data, setData]             = useState<PortalData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [gpsState, setGpsState]     = useState<'idle' | 'locating' | 'success' | 'error'>('idle')
  const [gpsMessage, setGpsMessage] = useState<string | null>(null)

  // Calendar state
  const todayDate  = (() => { const d = new Date(); d.setHours(0,0,0,0); return d })()
  const [weekStart, setWeekStart]   = useState<Date>(() => startOfWeek(new Date()))
  const weekStartRef = useRef<Date>(weekStart)
  weekStartRef.current = weekStart
  const [selectedDay, setSelectedDay] = useState<Date>(todayDate)
  const [classes, setClasses]         = useState<LeadClass[]>([])
  const [classesLoading, setClassesLoading] = useState(false)

  const loadClasses = useCallback((from?: Date) => {
    setClassesLoading(true)
    const fromParam = (from ?? weekStartRef.current).toISOString()
    fetch(`/api/public/lead/${token}?from=${encodeURIComponent(fromParam)}`)
      .then(r => r.json())
      .then(d => { if (d.classes) setClasses(d.classes) })
      .catch(() => {})
      .finally(() => setClassesLoading(false))
  }, [token])

  const loadAll = useCallback(() => {
    fetch(`/api/public/lead/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else {
          setData(d)
          setClasses(d.classes ?? [])
        }
      })
      .catch(() => setError(lang === 'en' ? 'Connection error' : 'Verbindungsfehler'))
      .finally(() => setLoading(false))
  }, [token, lang])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { if (!loading) loadClasses(weekStart) }, [weekStart]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBook(classId: string) {
    setActionLoading(classId + ':book')
    await fetch(`/api/public/lead/${token}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId }),
    })
    setActionLoading(null)
    loadAll()
  }

  async function handleCheckin(classId: string) {
    setActionLoading(classId + ':checkin')
    await fetch(`/api/public/lead/${token}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId }),
    })
    setActionLoading(null)
    loadAll()
  }

  async function handleGpsCheckin() {
    if (!navigator.geolocation) {
      setGpsMessage(lang === 'en' ? 'GPS not available' : 'GPS nicht verfügbar'); setGpsState('error'); return
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
          setGpsMessage(`${lang === 'en' ? 'Checked in' : 'Eingecheckt'} ✓${clsName}`)
          setGpsState('success')
          loadAll()
        } else {
          setGpsMessage(d.error ?? (lang === 'en' ? 'GPS check-in failed' : 'Fehler beim GPS-Check-in'))
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
    loadAll()
  }

  // ── Loading / Error ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">{lang === 'en' ? 'Loading…' : 'Lädt…'}</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-500 text-sm">{error || (lang === 'en' ? 'Not found' : 'Nicht gefunden')}</p>
          <p className="text-slate-400 text-xs mt-2">{lang === 'en' ? 'Please contact your gym.' : 'Bitte kontaktiere dein Gym.'}</p>
        </div>
      </div>
    )
  }

  const { lead, gym, bookings } = data

  // Build a quick lookup: class_id -> booking
  const bookingMap = new Map<string, LeadBooking>()
  for (const b of bookings) {
    if (b.status !== 'cancelled') bookingMap.set(b.class_id, b)
  }

  const statusLabels = lang === 'en' ? LEAD_STATUS_LABELS_EN : LEAD_STATUS_LABELS_DE
  const statusLabel  = statusLabels[lead.status] ?? lead.status
  const statusColor  = LEAD_STATUS_COLORS[lead.status] ?? LEAD_STATUS_COLORS.new

  const dayClasses = classes.filter(c => isSameDay(new Date(c.starts_at), selectedDay))

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          {gym?.logo_url ? (
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
              <Image src={gym.logo_url} alt={gym.name || 'Logo'} width={36} height={36} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-black text-white italic">oss</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-sm leading-tight truncate">{gym?.name ?? 'Gym'}</p>
            <p className="text-xs text-slate-400">{lang === 'en' ? 'Prospect Portal' : 'Interessenten-Portal'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-3">

        {/* Welcome card */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-slate-900 font-bold text-lg leading-tight">
                {lang === 'en' ? 'Hello' : 'Hallo'} {lead.first_name}!
              </p>
              <p className="text-slate-600 text-sm mt-1">
                {lang === 'en' ? 'You are registered as a prospect.' : 'Du bist als Interessent registriert.'}
              </p>
              {gym?.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(gym.address)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-slate-400 hover:text-amber-600 text-xs mt-2 flex items-center gap-1 transition-colors"
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
          <p className="text-slate-400 text-xs mb-4">
            {lang === 'en' ? 'At the gym? One tap — checked in automatically.' : 'Im Gym? Tippe einmal — wir checken dich automatisch ein.'}
          </p>
          <button
            onClick={handleGpsCheckin}
            disabled={gpsState === 'locating'}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl py-3 transition-colors"
          >
            <Navigation size={14} />
            {gpsState === 'locating'
              ? (lang === 'en' ? 'Locating…' : 'Standort wird ermittelt…')
              : (lang === 'en' ? 'Start GPS Check-in' : 'GPS Check-in starten')}
          </button>
          {gpsMessage && (
            <p className={`mt-3 text-xs text-center px-3 py-2 rounded-xl ${gpsState === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {gpsMessage}
            </p>
          )}
        </div>

        {/* Map — OpenStreetMap embed (zuverlässiger als Google Maps ohne API-Key).
            Bei vorhandenen lat/lng: Marker + Bounding-Box exakt um den Studio-Punkt.
            Sonst: Fallback auf Address-Link ohne iframe. */}
        {gym?.address && (
          <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
            {gym.latitude != null && gym.longitude != null ? (
              <iframe
                src={(() => {
                  const lat = gym.latitude
                  const lon = gym.longitude
                  const d = 0.005 // ~500 m bbox
                  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d},${lat - d / 2},${lon + d},${lat + d / 2}&layer=mapnik&marker=${lat},${lon}`
                })()}
                width="100%" height="220"
                style={{ border: 0, display: 'block' }}
                loading="lazy"
                title={lang === 'en' ? 'Location' : 'Standort'}
              />
            ) : (
              // Kein lat/lng — zeige Karten-Platzhalter mit „auf Karte öffnen"-Link
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(gym.address)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 h-[220px] bg-gradient-to-br from-amber-50 to-zinc-50 hover:from-amber-100 hover:to-zinc-100 transition-colors"
              >
                <MapPin size={28} className="text-amber-500" />
                <span className="text-sm font-bold text-zinc-700">
                  {lang === 'en' ? 'Open on map' : 'Auf Karte öffnen'}
                </span>
                <span className="text-xs text-zinc-500">{gym.address}</span>
              </a>
            )}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(gym.address)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <MapPin size={14} className="text-amber-500" />
                {gym.address}
              </span>
              <span className="text-xs text-amber-500 font-semibold">Route →</span>
            </a>
          </div>
        )}

        {/* ── Schedule calendar ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-amber-500" />
              {lang === 'en' ? 'Schedule' : 'Stundenplan'}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  const prev = addDays(weekStart, -7)
                  setWeekStart(prev); setSelectedDay(addDays(selectedDay, -7)); loadClasses(prev)
                }}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => {
                  const w = startOfWeek(new Date())
                  setWeekStart(w); setSelectedDay(todayDate); loadClasses(w)
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                {lang === 'en' ? 'Today' : 'Heute'}
              </button>
              <button
                onClick={() => {
                  const next = addDays(weekStart, 7)
                  setWeekStart(next); setSelectedDay(addDays(selectedDay, 7)); loadClasses(next)
                }}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Day strip */}
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

          {/* Classes for selected day */}
          <div className="p-4">
            {classesLoading ? (
              <p className="text-slate-400 text-sm text-center py-8">{lang === 'en' ? 'Loading…' : 'Lädt…'}</p>
            ) : dayClasses.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">
                {lang === 'en' ? 'No training on this day.' : 'Kein Training an diesem Tag.'}
              </p>
            ) : (
              <div className="space-y-3">
                {dayClasses.map(cls => {
                  const booking     = bookingMap.get(cls.id)
                  const isBooked    = booking?.status === 'booked'
                  const isCheckedIn = booking?.status === 'checked_in'
                  const showCheckin = isBooked && isWithin2h(cls.starts_at)
                  const isBooking    = actionLoading === cls.id + ':book'
                  const isCheckingIn = actionLoading === cls.id + ':checkin'
                  const isCancelling = actionLoading === cls.id + ':cancel'
                  const typeColor    = TYPE_COLORS[cls.class_type] ?? 'bg-zinc-100 text-zinc-700'
                  const typeDot      = TYPE_DOT[cls.class_type] ?? 'bg-zinc-300'
                  const typeLabel    = CLASS_LABELS[cls.class_type] ?? cls.class_type
                  const isLive       = new Date(cls.starts_at) <= new Date() && new Date(cls.ends_at) >= new Date()

                  return (
                    <div key={cls.id} className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Type dot */}
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
                              {isBooked && !isCheckedIn && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-green-50 text-green-700 border border-green-200">
                                  {lang === 'en' ? 'Booked ✓' : 'Angemeldet ✓'}
                                </span>
                              )}
                              {isCheckedIn && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {lang === 'en' ? 'Checked in ✓' : 'Eingecheckt ✓'}
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">{cls.title}</p>
                            <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                              <Clock size={10} />
                              {formatTime(cls.starts_at, locale)} – {formatTime(cls.ends_at, locale)}
                            </p>
                            {cls.instructor && (
                              <p className="text-slate-400 text-xs mt-0.5">{cls.instructor}</p>
                            )}
                            {cls.max_capacity != null && (
                              <p className="text-slate-400 text-xs mt-0.5">
                                {lang === 'en' ? `max. ${cls.max_capacity} spots` : `max. ${cls.max_capacity} Plätze`}
                              </p>
                            )}
                          </div>

                          {/* Action button */}
                          <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                            {isCheckedIn ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                                <CheckCircle size={12} /> ✓
                              </span>
                            ) : isBooked ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-3 py-2 rounded-xl border border-green-100">
                                  <CheckCircle size={12} />
                                  {lang === 'en' ? 'Booked' : 'Zugesagt'}
                                </span>
                                <button
                                  onClick={() => handleCancel(cls.id)}
                                  disabled={!!isCancelling}
                                  className="text-[11px] text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                >
                                  {isCancelling ? '…' : (lang === 'en' ? 'Cancel' : 'Abmelden')}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleBook(cls.id)}
                                disabled={!!isBooking}
                                className="text-xs font-semibold px-3 min-h-[36px] rounded-xl bg-amber-500 hover:bg-amber-400 text-white transition-colors disabled:opacity-50"
                              >
                                {isBooking ? '…' : (lang === 'en' ? 'Book' : 'Anmelden')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Checkin row */}
                      {showCheckin && (
                        <div className="px-4 pb-4 pt-0">
                          <button
                            onClick={() => handleCheckin(cls.id)}
                            disabled={!!isCheckingIn}
                            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <CheckCircle size={14} />
                            {isCheckingIn ? (lang === 'en' ? 'Checking in…' : 'Einchecken…') : (lang === 'en' ? 'Check in' : 'Einchecken')}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* My bookings */}
        {bookings.filter(b => b.status !== 'cancelled').length > 0 && (
          <div>
            <h2 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
              <CheckCircle size={15} className="text-amber-500" />
              {lang === 'en' ? 'My bookings' : 'Meine Anmeldungen'}
            </h2>
            <div className="space-y-2">
              {bookings
                .filter(b => b.status !== 'cancelled')
                .map(b => {
                  const cls = data.classes.find(c => c.id === b.class_id)
                  const isCheckedIn = b.status === 'checked_in'
                  const dateStr = cls
                    ? new Date(cls.starts_at).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
                    : '—'
                  const timeStr = cls ? formatTime(cls.starts_at, locale) : '—'

                  return (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-slate-100 bg-white px-4 py-3 flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{cls?.title ?? 'Training'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{dateStr} · {timeStr}</p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${
                        isCheckedIn
                          ? 'bg-green-50 text-green-700 border-green-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {isCheckedIn ? (lang === 'en' ? 'Checked in' : 'Eingecheckt') : (lang === 'en' ? 'Booked' : 'Angemeldet')}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-slate-300 text-xs pb-4">
          {lang === 'en' ? 'Powered by' : 'Betrieben mit'} <span className="font-bold italic">Osss</span>
        </p>
      </div>
    </div>
  )
}
