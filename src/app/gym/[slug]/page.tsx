'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  MapPin, Phone, Mail, Clock, Users, ChevronRight, Check,
  Share2, Globe, MessageCircle, Play, Menu, X,
  CalendarDays, Award,
} from 'lucide-react'
import { LogoMark } from '@/components/Logo'

// ── Types ─────────────────────────────────────────────────────────────────────

interface GymClass {
  id: string; title: string; class_type: string
  instructor: string | null; starts_at: string; ends_at: string
  max_capacity: number | null
}

interface Plan {
  id: string; name: string; description: string | null
  price_cents: number; billing_interval: string; contract_months: number
}

type DayKey = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so'
interface DayHours { closed: boolean; open: string; close: string }

interface GymInfo {
  id: string; name: string; logo_url: string | null
  address: string | null; phone: string | null; email: string | null
  sport_type: string | null; belt_system_enabled: boolean
  tagline: string | null; about: string | null
  hero_image_url: string | null; gallery_urls: string[]
  video_url: string | null; whatsapp_number: string | null
  instagram_url: string | null; facebook_url: string | null
  website_url: string | null; founded_year: number | null
  opening_hours: Record<DayKey, DayHours> | null
  impressum_text: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CLASS_TYPE_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat',
  kids: 'Kids', competition: 'Competition',
}
const CLASS_TYPE_COLORS: Record<string, string> = {
  gi:          'bg-zinc-100 text-zinc-700',
  'no-gi':     'bg-zinc-800 text-zinc-200',
  'open mat':  'bg-amber-50 text-amber-700',
  kids:        'bg-zinc-100 text-zinc-600',
  competition: 'bg-zinc-900 text-white',
}

const DAY_LABELS: Record<DayKey, string> = {
  mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag',
  fr: 'Freitag', sa: 'Samstag', so: 'Sonntag',
}
const DAY_ORDER: DayKey[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatInterval(interval: string) {
  if (interval === 'biannual') return '/ 6 Monate'
  if (interval === 'annual')   return '/ Jahr'
  return '/ Monat'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function groupByDay(classes: GymClass[]) {
  const groups: Record<string, GymClass[]> = {}
  for (const c of classes) {
    const d = new Date(c.starts_at)
    const key = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups[key]) groups[key] = []
    groups[key].push(c)
  }
  return Object.entries(groups)
}

function toWaPhone(raw: string) {
  let p = raw.replace(/[\s\-().]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('0'))  p = '+49' + p.slice(1)
  return p.replace(/^\+/, '')
}

function parseYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  return m ? m[1] : null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StickyNav({ gym, slug }: { gym: GymInfo; slug: string }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const navLinks = [
    { href: '#about',    label: 'Über uns' },
    { href: '#schedule', label: 'Stundenplan' },
    { href: '#plans',    label: 'Preise' },
    { href: '#contact',  label: 'Kontakt' },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-zinc-950/95 backdrop-blur-md shadow-lg shadow-black/20' : 'bg-transparent'
    }`}>
      <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        {/* Logo + name */}
        <div className="flex items-center gap-2.5 min-w-0">
          {gym.logo_url ? (
            <Image src={gym.logo_url} alt={gym.name} width={32} height={32}
              className="rounded-lg object-cover border border-white/10 flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0">
              <LogoMark className="w-3.5 h-3 text-zinc-950" />
            </div>
          )}
          <span className="font-black text-white text-sm tracking-tight truncate">{gym.name}</span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(l => (
            <a key={l.href} href={l.href}
              className="px-3 py-1.5 text-sm text-white/70 hover:text-white transition-colors rounded-lg hover:bg-white/5">
              {l.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2">
          <a href="#contact"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold transition-colors">
            Probetraining <ChevronRight size={14} />
          </a>
          <button onClick={() => setMenuOpen(m => !m)}
            className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-zinc-950 border-t border-white/10 px-5 py-4 space-y-1">
          {navLinks.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              className="block px-3 py-2.5 text-sm text-white/70 hover:text-white rounded-xl hover:bg-white/5 transition-colors">
              {l.label}
            </a>
          ))}
          <a href="#contact" onClick={() => setMenuOpen(false)}
            className="block mt-2 px-3 py-2.5 text-sm font-bold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-xl text-center transition-colors">
            Probetraining anfragen
          </a>
        </div>
      )}
    </nav>
  )
}

// ── ContactForm ───────────────────────────────────────────────────────────────

function ContactForm({ slug }: { slug: string }) {
  const [step, setStep]         = useState<'idle' | 'form' | 'done'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError]   = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', message: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')
    const res = await fetch(`/api/public/gym/${slug}/lead`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) {
      setStep('done')
    } else {
      const d = await res.json()
      setFormError(d.error ?? 'Fehler beim Senden')
    }
    setSubmitting(false)
  }

  const INPUT_CLS = 'w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-colors'

  if (step === 'done') return (
    <div className="text-center py-8">
      <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check size={24} className="text-amber-400" strokeWidth={2.5} />
      </div>
      <h3 className="font-bold text-white text-lg mb-2">Anfrage erhalten!</h3>
      <p className="text-zinc-400 text-sm">Wir melden uns schnellstmöglich bei dir.</p>
    </div>
  )

  if (step === 'idle') return (
    <button onClick={() => setStep('form')}
      className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
      Probetraining anfragen <ChevronRight size={15} />
    </button>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Vorname *</label>
          <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
            required placeholder="Max" className={INPUT_CLS} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Nachname *</label>
          <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
            required placeholder="Mustermann" className={INPUT_CLS} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">E-Mail *</label>
        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          required placeholder="max@beispiel.de" className={INPUT_CLS} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Telefon</label>
        <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="+49 151 …" className={INPUT_CLS} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">Nachricht</label>
        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          rows={2} placeholder="Ich interessiere mich für…"
          className={INPUT_CLS + ' resize-none'} />
      </div>
      {formError && <p className="text-red-400 text-sm">{formError}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => setStep('idle')}
          className="flex-1 border border-zinc-700 text-zinc-400 font-medium rounded-xl py-2.5 text-sm hover:bg-zinc-800 transition-colors">
          Zurück
        </button>
        <button type="submit" disabled={submitting}
          className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50">
          {submitting ? 'Senden…' : 'Absenden'}
        </button>
      </div>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PublicGymPage() {
  const { slug }              = useParams<{ slug: string }>()
  const [gym, setGym]         = useState<GymInfo | null>(null)
  const [classes, setClasses] = useState<GymClass[]>([])
  const [plans, setPlans]     = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showImpressum, setShowImpressum] = useState(false)
  const videoId = gym?.video_url ? parseYouTubeId(gym.video_url) : null

  useEffect(() => {
    fetch(`/api/public/gym/${slug}`)
      .then(r => r.json())
      .then(d => { setGym(d.gym); setClasses(d.classes ?? []); setPlans(d.plans ?? []) })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
    </div>
  )

  if (!gym) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">Gym nicht gefunden.</p>
    </div>
  )

  const days     = groupByDay(classes)
  const hasHours = !!gym.opening_hours

  return (
    <div className="min-h-screen bg-zinc-50 font-sans antialiased">
      <StickyNav gym={gym} slug={slug} />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex flex-col justify-end bg-zinc-950 overflow-hidden">
        {gym.hero_image_url ? (
          <>
            <Image src={gym.hero_image_url} alt={gym.name} fill
              className="object-cover object-center opacity-40" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/20" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#78350f_0%,_transparent_60%)] opacity-40" />
        )}

        <div className="relative max-w-5xl mx-auto px-5 pb-16 pt-32 w-full">
          {/* Sport badge */}
          {gym.sport_type && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-[0.15em] mb-4">
              <span className="w-4 h-px bg-amber-400" />{gym.sport_type}
            </span>
          )}

          {/* Gym name */}
          <h1 className="text-5xl sm:text-7xl font-black text-white leading-none tracking-tight mb-4">
            {gym.name}
          </h1>

          {/* Tagline */}
          {gym.tagline && (
            <p className="text-xl text-zinc-300 font-light leading-relaxed max-w-xl mb-8">
              {gym.tagline}
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <a href="#contact"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-colors active:scale-[0.98]">
              Probetraining anfragen <ChevronRight size={15} />
            </a>
            {gym.whatsapp_number && (
              <a href={`https://wa.me/${toWaPhone(gym.whatsapp_number)}?text=${encodeURIComponent(`Hallo! Ich interessiere mich für ein Probetraining bei ${gym.name}.`)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors backdrop-blur-sm border border-white/10">
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
          </div>

          {/* Location bar */}
          {(gym.address || gym.founded_year) && (
            <div className="flex items-center gap-4 mt-10 text-zinc-500 text-xs">
              {gym.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} /> {gym.address}
                </span>
              )}
              {gym.founded_year && (
                <span className="flex items-center gap-1.5">
                  <Award size={12} /> Seit {gym.founded_year}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── ABOUT ─────────────────────────────────────────────────── */}
      {gym.about && (
        <section id="about" className="bg-white">
          <div className="max-w-5xl mx-auto px-5 py-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-[0.15em] mb-4">Über uns</p>
                <h2 className="text-3xl font-black text-zinc-900 leading-tight mb-6">
                  Was uns ausmacht
                </h2>
                <p className="text-zinc-600 leading-relaxed whitespace-pre-wrap text-[15px]">{gym.about}</p>

                {/* Key facts */}
                <div className="grid grid-cols-2 gap-4 mt-8">
                  {gym.founded_year && (
                    <div className="bg-zinc-50 rounded-2xl p-4">
                      <p className="text-2xl font-black text-zinc-900">{gym.founded_year}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Gegründet</p>
                    </div>
                  )}
                  {gym.sport_type && (
                    <div className="bg-amber-50 rounded-2xl p-4">
                      <p className="text-2xl font-black text-amber-700">{gym.sport_type}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">Sportart</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Hero or first gallery image */}
              {(gym.hero_image_url || gym.gallery_urls[0]) && (
                <div className="relative h-80 md:h-full min-h-[320px] rounded-3xl overflow-hidden">
                  <Image
                    src={gym.gallery_urls[0] ?? gym.hero_image_url!}
                    alt={gym.name} fill className="object-cover" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── GALLERY ──────────────────────────────────────────────── */}
      {gym.gallery_urls.length > 1 && (
        <section className="bg-zinc-950 py-4 px-4">
          <div className="max-w-5xl mx-auto">
            <div className={`grid gap-2 ${
              gym.gallery_urls.length === 2 ? 'grid-cols-2' :
              gym.gallery_urls.length === 3 ? 'grid-cols-3' :
              'grid-cols-2 md:grid-cols-3'
            }`}>
              {gym.gallery_urls.slice(0, 9).map((url, i) => (
                <div key={i} className={`relative overflow-hidden rounded-xl ${
                  i === 0 && gym.gallery_urls.length >= 5 ? 'md:col-span-2 md:row-span-2' : ''
                }`} style={{ aspectRatio: i === 0 && gym.gallery_urls.length >= 5 ? 'auto' : '1' }}>
                  <div style={{ paddingBottom: i === 0 && gym.gallery_urls.length >= 5 ? '50%' : '100%' }} />
                  <Image src={url} alt={`Foto ${i + 1}`} fill
                    className="object-cover hover:scale-105 transition-transform duration-700" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── VIDEO ────────────────────────────────────────────────── */}
      {videoId && (
        <section className="bg-zinc-950 py-16">
          <div className="max-w-5xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center">
                <Play size={14} className="text-amber-400" />
              </div>
              <h2 className="text-2xl font-black text-white">Sieh selbst</h2>
            </div>
            <div className="relative rounded-2xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Gym Video"
              />
            </div>
          </div>
        </section>
      )}

      {/* ── SCHEDULE ─────────────────────────────────────────────── */}
      {days.length > 0 && (
        <section id="schedule" className="bg-zinc-50 py-20">
          <div className="max-w-5xl mx-auto px-5">
            <div className="flex items-center gap-3 mb-2">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-[0.15em]">Stundenplan</p>
            </div>
            <h2 className="text-3xl font-black text-zinc-900 mb-10">Kommende Trainings</h2>

            <div className="space-y-6">
              {days.map(([day, dayClasses]) => (
                <div key={day}>
                  <div className="flex items-center gap-3 mb-3">
                    <CalendarDays size={14} className="text-amber-600" />
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{day}</p>
                    <div className="flex-1 h-px bg-zinc-200" />
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {dayClasses.map(cls => {
                      const start = formatTime(cls.starts_at)
                      const end   = formatTime(cls.ends_at)
                      return (
                        <div key={cls.id}
                          className="bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm flex items-start gap-3">
                          <div className="flex-shrink-0 text-center pt-0.5">
                            <p className="text-xs font-bold text-zinc-900 tabular-nums">{start}</p>
                            <p className="text-[10px] text-zinc-400 tabular-nums">{end}</p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-zinc-900 text-sm leading-tight">{cls.title}</p>
                            {cls.instructor && <p className="text-xs text-zinc-400 mt-0.5">{cls.instructor}</p>}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${CLASS_TYPE_COLORS[cls.class_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                                {CLASS_TYPE_LABELS[cls.class_type] ?? cls.class_type}
                              </span>
                              {cls.max_capacity && (
                                <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                                  <Users size={9} /> max. {cls.max_capacity}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PLANS ────────────────────────────────────────────────── */}
      {plans.length > 0 && (
        <section id="plans" className="bg-zinc-950 py-20">
          <div className="max-w-5xl mx-auto px-5">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-[0.15em] mb-2">Mitgliedschaft</p>
            <h2 className="text-3xl font-black text-white mb-10">Unsere Preise</h2>

            <div className={`grid gap-4 ${
              plans.length === 1 ? 'max-w-sm' :
              plans.length === 2 ? 'sm:grid-cols-2 max-w-2xl' :
              'sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {plans.map((p, i) => {
                const featured = plans.length > 1 && i === Math.floor(plans.length / 2)
                return (
                  <div key={p.id}
                    className={`rounded-2xl p-6 border ${
                      featured
                        ? 'bg-amber-500 border-amber-400'
                        : 'bg-zinc-900 border-zinc-800'
                    }`}>
                    {featured && (
                      <span className="inline-block text-[10px] font-bold text-zinc-950 bg-zinc-950/20 uppercase tracking-wider px-2 py-0.5 rounded-full mb-3">
                        Beliebt
                      </span>
                    )}
                    <h3 className={`font-black text-lg mb-1 ${featured ? 'text-zinc-950' : 'text-white'}`}>
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className={`text-sm mb-4 leading-relaxed ${featured ? 'text-zinc-800' : 'text-zinc-400'}`}>
                        {p.description}
                      </p>
                    )}
                    <div className="mb-4">
                      <span className={`text-4xl font-black ${featured ? 'text-zinc-950' : 'text-white'}`}>
                        {(p.price_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
                      </span>
                      <span className={`text-sm ml-1 ${featured ? 'text-zinc-800' : 'text-zinc-500'}`}>
                        {formatInterval(p.billing_interval)}
                      </span>
                    </div>
                    {p.contract_months > 0 && (
                      <p className={`text-xs ${featured ? 'text-zinc-800' : 'text-zinc-500'}`}>
                        {p.contract_months} Monate Mindestlaufzeit
                      </p>
                    )}
                    <a href="#contact"
                      className={`mt-5 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        featured
                          ? 'bg-zinc-950 text-white hover:bg-zinc-800'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}>
                      Anfragen <ChevronRight size={14} />
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT ──────────────────────────────────────────────── */}
      <section id="contact" className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-5">
          <div className="grid md:grid-cols-2 gap-12">

            {/* Left: contact info */}
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-[0.15em] mb-2">Kontakt</p>
              <h2 className="text-3xl font-black text-zinc-900 mb-8">Komm vorbei</h2>

              <div className="space-y-4">
                {gym.whatsapp_number && (
                  <a href={`https://wa.me/${toWaPhone(gym.whatsapp_number)}?text=${encodeURIComponent(`Hallo! Ich interessiere mich für ein Probetraining bei ${gym.name}.`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-2xl bg-[#25D366] hover:opacity-90 transition-opacity text-white">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <MessageCircle size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">WhatsApp schreiben</p>
                      <p className="text-xs text-white/80">{gym.whatsapp_number}</p>
                    </div>
                    <ChevronRight size={16} className="ml-auto" />
                  </a>
                )}

                {gym.email && (
                  <a href={`mailto:${gym.email}`}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-zinc-200 flex items-center justify-center flex-shrink-0">
                      <Mail size={16} className="text-zinc-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 text-sm">E-Mail schreiben</p>
                      <p className="text-xs text-zinc-500 truncate">{gym.email}</p>
                    </div>
                    <ChevronRight size={16} className="ml-auto text-zinc-400" />
                  </a>
                )}

                {gym.phone && (
                  <a href={`tel:${gym.phone}`}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-zinc-200 flex items-center justify-center flex-shrink-0">
                      <Phone size={16} className="text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 text-sm">Anrufen</p>
                      <p className="text-xs text-zinc-500">{gym.phone}</p>
                    </div>
                    <ChevronRight size={16} className="ml-auto text-zinc-400" />
                  </a>
                )}

                {gym.address && (
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(gym.address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-zinc-200 flex items-center justify-center flex-shrink-0">
                      <MapPin size={16} className="text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 text-sm">Route anzeigen</p>
                      <p className="text-xs text-zinc-500">{gym.address}</p>
                    </div>
                    <ChevronRight size={16} className="ml-auto text-zinc-400" />
                  </a>
                )}

                {/* Social links */}
                {(gym.instagram_url || gym.facebook_url || gym.website_url) && (
                  <div className="flex gap-2 pt-2">
                    {gym.instagram_url && (
                      <a href={gym.instagram_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-medium transition-colors">
                        <Share2 size={15} /> Instagram
                      </a>
                    )}
                    {gym.facebook_url && (
                      <a href={gym.facebook_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-medium transition-colors">
                        <Share2 size={15} /> Facebook
                      </a>
                    )}
                    {gym.website_url && (
                      <a href={gym.website_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-medium transition-colors">
                        <Globe size={15} /> Website
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Opening hours */}
              {hasHours && gym.opening_hours && (
                <div className="mt-8">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Clock size={12} /> Öffnungszeiten
                  </p>
                  <div className="space-y-1.5">
                    {DAY_ORDER.map(key => {
                      const h = gym.opening_hours![key]
                      if (!h) return null
                      return (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-zinc-600 w-24">{DAY_LABELS[key]}</span>
                          {h.closed
                            ? <span className="text-zinc-400 text-xs">Geschlossen</span>
                            : <span className="text-zinc-900 font-medium tabular-nums">{h.open} – {h.close}</span>
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: contact form */}
            <div className="bg-zinc-950 rounded-3xl p-6 md:p-8">
              <h3 className="font-black text-white text-xl mb-1">Probetraining anfragen</h3>
              <p className="text-zinc-400 text-sm mb-6">
                Hinterlasse deine Daten — wir melden uns innerhalb von 24 Stunden.
              </p>
              <ContactForm slug={slug} />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="bg-zinc-950 border-t border-zinc-800">
        <div className="max-w-5xl mx-auto px-5 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {gym.logo_url ? (
                  <Image src={gym.logo_url} alt={gym.name} width={24} height={24}
                    className="rounded-md object-cover border border-white/10" />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-amber-400 flex items-center justify-center">
                    <LogoMark className="w-3 h-2.5 text-zinc-950" />
                  </div>
                )}
                <span className="font-black text-white text-sm">{gym.name}</span>
              </div>
              <p className="text-zinc-600 text-xs">{gym.sport_type ?? 'Kampfsport'} · {gym.address ?? ''}</p>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
              {gym.impressum_text && (
                <button onClick={() => setShowImpressum(true)}
                  className="hover:text-zinc-300 transition-colors">Impressum</button>
              )}
              <Link href="/datenschutz" target="_blank" className="hover:text-zinc-300 transition-colors">
                Datenschutz
              </Link>
              <Link href="/agb" target="_blank" className="hover:text-zinc-300 transition-colors">
                AGB
              </Link>
              <span className="text-zinc-700">
                Betrieben mit <span className="font-black text-amber-400">Osss</span>
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Impressum modal */}
      {showImpressum && gym.impressum_text && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          onClick={() => setShowImpressum(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-bold text-zinc-900">Impressum</h3>
              <button onClick={() => setShowImpressum(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
              {gym.impressum_text}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
