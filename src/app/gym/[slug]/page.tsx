'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  MapPin, Phone, Mail, Clock, Users, ChevronRight, Check,
  Share2, Globe, MessageCircle, Menu, X, CalendarDays, Award,
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

const CLASS_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat',
  kids: 'Kids', competition: 'Competition',
}
const CLASS_COLORS: Record<string, string> = {
  gi: 'bg-zinc-100 text-zinc-700', 'no-gi': 'bg-zinc-800 text-zinc-200',
  'open mat': 'bg-amber-50 text-amber-700', kids: 'bg-zinc-100 text-zinc-600',
  competition: 'bg-zinc-900 text-white',
}
const DAY_LABELS: Record<DayKey, string> = {
  mo: 'Montag', di: 'Dienstag', mi: 'Mittwoch', do: 'Donnerstag',
  fr: 'Freitag', sa: 'Samstag', so: 'Sonntag',
}
const DAY_ORDER: DayKey[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(interval: string) {
  return interval === 'biannual' ? '/ 6 Mo.' : interval === 'annual' ? '/ Jahr' : '/ Monat'
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}
function groupByDay(cls: GymClass[]) {
  const g: Record<string, GymClass[]> = {}
  for (const c of cls) {
    const k = new Date(c.starts_at).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    ;(g[k] = g[k] ?? []).push(c)
  }
  return Object.entries(g)
}
function toWa(raw: string) {
  let p = raw.replace(/[\s\-().]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('0'))  p = '+49' + p.slice(1)
  return p.replace(/^\+/, '')
}
function ytId(url: string) {
  return url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)?.[1] ?? null
}

// ── Sticky nav ────────────────────────────────────────────────────────────────

function Nav({ gym }: { gym: GymInfo }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  const links = [
    { href: '#about', label: 'Über uns' },
    { href: '#schedule', label: 'Stundenplan' },
    { href: '#plans', label: 'Preise' },
    { href: '#contact', label: 'Kontakt' },
  ]
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-zinc-950/95 backdrop-blur-md shadow-xl shadow-black/30' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {gym.logo_url
            ? <Image src={gym.logo_url} alt={gym.name} width={30} height={30} className="rounded-lg object-cover border border-white/10 flex-shrink-0" />
            : <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0"><LogoMark className="w-3 h-2.5 text-zinc-950" /></div>
          }
          <span className="font-black text-white text-sm tracking-tight truncate max-w-[180px]">{gym.name}</span>
        </div>
        <div className="hidden md:flex items-center gap-0.5">
          {links.map(l => (
            <a key={l.href} href={l.href} className="px-3 py-1.5 text-[13px] text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-colors">{l.label}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href="#contact" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold transition-colors">
            Probetraining <ChevronRight size={14} />
          </a>
          <button onClick={() => setOpen(o => !o)} className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-zinc-950 border-t border-white/10 px-4 py-3 space-y-0.5">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block px-3 py-2.5 text-sm text-white/70 hover:text-white rounded-xl hover:bg-white/5 transition-colors">{l.label}</a>
          ))}
          <a href="#contact" onClick={() => setOpen(false)} className="block mt-2 px-3 py-3 text-sm font-bold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-xl text-center">Probetraining anfragen</a>
        </div>
      )}
    </nav>
  )
}

// ── Contact form ──────────────────────────────────────────────────────────────

function ContactForm({ slug }: { slug: string }) {
  const [step, setStep]     = useState<'idle' | 'form' | 'done'>('idle')
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState('')
  const [form, setForm]     = useState({ first_name: '', last_name: '', email: '', phone: '', message: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const res = await fetch(`/api/public/gym/${slug}/lead`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) setStep('done')
    else { const d = await res.json(); setErr(d.error ?? 'Fehler') }
    setBusy(false)
  }

  const ic = 'w-full px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-colors'

  if (step === 'done') return (
    <div className="text-center py-8">
      <div className="w-14 h-14 bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check size={24} className="text-amber-400" strokeWidth={2.5} />
      </div>
      <p className="font-bold text-white text-lg mb-1">Anfrage erhalten!</p>
      <p className="text-zinc-400 text-sm">Wir melden uns schnellstmöglich.</p>
    </div>
  )

  if (step === 'idle') return (
    <button onClick={() => setStep('form')} className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition-colors">
      Probetraining anfragen <ChevronRight size={15} />
    </button>
  )

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-zinc-400 mb-1">Vorname *</label><input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required placeholder="Max" className={ic} /></div>
        <div><label className="block text-xs font-medium text-zinc-400 mb-1">Nachname *</label><input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required placeholder="Mustermann" className={ic} /></div>
      </div>
      <div><label className="block text-xs font-medium text-zinc-400 mb-1">E-Mail *</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="max@beispiel.de" className={ic} /></div>
      <div><label className="block text-xs font-medium text-zinc-400 mb-1">Telefon</label><input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+49 151 …" className={ic} /></div>
      <div><label className="block text-xs font-medium text-zinc-400 mb-1">Nachricht</label><textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={2} placeholder="Ich interessiere mich für…" className={ic + ' resize-none'} /></div>
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => setStep('idle')} className="flex-1 border border-zinc-700 text-zinc-400 rounded-xl py-2.5 text-sm hover:bg-zinc-800 transition-colors">Zurück</button>
        <button type="submit" disabled={busy} className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50">{busy ? 'Senden…' : 'Absenden'}</button>
      </div>
    </form>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PublicGymPage() {
  const { slug }               = useParams<{ slug: string }>()
  const [gym, setGym]          = useState<GymInfo | null>(null)
  const [classes, setClasses]  = useState<GymClass[]>([])
  const [plans, setPlans]      = useState<Plan[]>([])
  const [loading, setLoading]  = useState(true)
  const [showImpressum, setShowImpressum] = useState(false)

  useEffect(() => {
    fetch(`/api/public/gym/${slug}`)
      .then(r => r.json())
      .then(d => { setGym(d.gym); setClasses(d.classes ?? []); setPlans(d.plans ?? []) })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-800 border-t-amber-400 rounded-full animate-spin" />
    </div>
  )
  if (!gym) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">Gym nicht gefunden.</p>
    </div>
  )

  const days    = groupByDay(classes)
  const videoId = gym.video_url ? ytId(gym.video_url) : null

  return (
    <div className="min-h-screen bg-zinc-950 font-sans antialiased">
      <Nav gym={gym} />

      {/* ── HERO ── photo left + text right on desktop, stacked on mobile ── */}
      <section className="relative min-h-screen bg-zinc-950 overflow-hidden">
        {/* Background grain */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,rgba(245,158,11,0.08),transparent)]" />

        <div className="max-w-6xl mx-auto px-5 min-h-screen grid md:grid-cols-2 gap-0 items-center pt-24 pb-16 md:pt-0 md:pb-0">

          {/* Left – main photo */}
          <div className="order-1 md:order-1 relative flex items-center justify-center md:h-screen">
            {gym.hero_image_url ? (
              <div className="relative w-full md:h-[80vh] h-64 md:absolute md:inset-0 md:rounded-none rounded-2xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gym.hero_image_url}
                  alt={gym.name}
                  className="w-full h-full object-cover object-top"
                />
                {/* Right-side fade for desktop */}
                <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-zinc-950" />
                {/* Bottom fade for mobile */}
                <div className="md:hidden absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-zinc-950" />
              </div>
            ) : (
              <div className="w-full md:h-screen h-40 md:absolute md:inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950 flex items-center justify-center">
                <div className="w-24 h-24 rounded-2xl bg-amber-400/10 flex items-center justify-center">
                  <LogoMark className="w-10 h-8 text-amber-400/40" />
                </div>
              </div>
            )}
          </div>

          {/* Right – text content */}
          <div className="order-2 md:order-2 relative z-10 md:pl-10">
            {/* Sport tag */}
            {gym.sport_type && (
              <div className="flex items-center gap-2 mb-5">
                <span className="w-6 h-px bg-amber-400" />
                <span className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">{gym.sport_type}</span>
              </div>
            )}

            {/* Name */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[0.95] tracking-tight mb-4">
              {gym.name}
            </h1>

            {/* Tagline */}
            {gym.tagline && (
              <p className="text-zinc-400 text-lg leading-relaxed mb-8 max-w-sm">
                {gym.tagline}
              </p>
            )}

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-10">
              <a href="#contact" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-colors active:scale-[0.98]">
                Probetraining <ChevronRight size={15} />
              </a>
              {gym.whatsapp_number && (
                <a href={`https://wa.me/${toWa(gym.whatsapp_number)}?text=${encodeURIComponent(`Hallo! Ich interessiere mich für ${gym.name}.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/8 hover:bg-white/12 text-white font-bold text-sm border border-white/10 backdrop-blur-sm transition-colors">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
            </div>

            {/* Quick info chips */}
            <div className="flex flex-wrap gap-3">
              {gym.address && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <MapPin size={12} className="text-zinc-600" /> {gym.address}
                </span>
              )}
              {gym.founded_year && (
                <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Award size={12} className="text-zinc-600" /> Seit {gym.founded_year}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 opacity-40">
          <div className="w-px h-8 bg-white/30 animate-pulse" />
        </div>
      </section>

      {/* ── VIDEO ── prominent, right after hero ── */}
      {videoId && (
        <section className="bg-zinc-900 py-0">
          <div className="max-w-6xl mx-auto">
            <div className="relative" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen title="Gym Video"
              />
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
            <p className="text-xs text-zinc-600 font-medium uppercase tracking-widest">{gym.name} — Sieh uns in Aktion</p>
          </div>
        </section>
      )}

      {/* ── ABOUT ── */}
      {gym.about && (
        <section id="about" className="bg-zinc-950 py-24">
          <div className="max-w-6xl mx-auto px-5">
            <div className="grid md:grid-cols-[1fr_2fr] gap-16 items-start">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-px bg-amber-400" />
                  <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">Über uns</p>
                </div>
                <h2 className="text-3xl font-black text-white leading-tight">Was uns ausmacht</h2>
                {(gym.founded_year || gym.sport_type) && (
                  <div className="mt-8 space-y-3">
                    {gym.founded_year && (
                      <div className="border-l-2 border-amber-400 pl-4">
                        <p className="text-2xl font-black text-amber-400">{gym.founded_year}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Gegründet</p>
                      </div>
                    )}
                    {gym.sport_type && (
                      <div className="border-l-2 border-zinc-700 pl-4">
                        <p className="text-lg font-black text-white">{gym.sport_type}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Schwerpunkt</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <p className="text-zinc-300 leading-[1.9] text-[15px] whitespace-pre-wrap">{gym.about}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── GALLERY ── */}
      {gym.gallery_urls.length > 0 && (
        <section className="bg-zinc-900">
          <div className="max-w-6xl mx-auto">
            <div className={`grid gap-1 ${
              gym.gallery_urls.length === 1 ? 'grid-cols-1' :
              gym.gallery_urls.length === 2 ? 'grid-cols-2' :
              'grid-cols-2 md:grid-cols-3'
            }`}>
              {gym.gallery_urls.slice(0, 6).map((url, i) => (
                <div key={i}
                  className={`relative overflow-hidden group ${i === 0 && gym.gallery_urls.length >= 4 ? 'md:col-span-2 md:row-span-2' : ''}`}
                  style={{ paddingBottom: i === 0 && gym.gallery_urls.length >= 4 ? undefined : '75%', aspectRatio: i === 0 && gym.gallery_urls.length >= 4 ? '16/9' : undefined }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full absolute inset-0 object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-zinc-950/0 group-hover:bg-zinc-950/20 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SCHEDULE ── */}
      {days.length > 0 && (
        <section id="schedule" className="bg-zinc-950 py-24">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-px bg-amber-400" />
              <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">Stundenplan</p>
            </div>
            <h2 className="text-3xl font-black text-white mb-12">Kommende Trainings</h2>
            <div className="space-y-8">
              {days.map(([day, dc]) => (
                <div key={day}>
                  <div className="flex items-center gap-3 mb-4">
                    <CalendarDays size={13} className="text-amber-400" />
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{day}</p>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dc.map(cls => (
                      <div key={cls.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex items-start gap-3 hover:border-zinc-700 transition-colors">
                        <div className="flex-shrink-0">
                          <p className="text-sm font-bold text-white tabular-nums">{fmtTime(cls.starts_at)}</p>
                          <p className="text-[11px] text-zinc-600 tabular-nums">{fmtTime(cls.ends_at)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white text-sm leading-tight">{cls.title}</p>
                          {cls.instructor && <p className="text-xs text-zinc-500 mt-0.5">{cls.instructor}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${CLASS_COLORS[cls.class_type] ?? 'bg-zinc-800 text-zinc-400'}`}>
                              {CLASS_LABELS[cls.class_type] ?? cls.class_type}
                            </span>
                            {cls.max_capacity && (
                              <span className="text-[10px] text-zinc-600 flex items-center gap-0.5">
                                <Users size={9} /> {cls.max_capacity}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── PLANS ── */}
      {plans.length > 0 && (
        <section id="plans" className="bg-zinc-900 py-24">
          <div className="max-w-6xl mx-auto px-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-px bg-amber-400" />
              <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">Mitgliedschaft</p>
            </div>
            <h2 className="text-3xl font-black text-white mb-12">Unsere Preise</h2>
            <div className={`grid gap-4 ${plans.length === 1 ? 'max-w-xs' : plans.length === 2 ? 'sm:grid-cols-2 max-w-xl' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              {plans.map((p, i) => {
                const featured = plans.length > 1 && i === Math.floor(plans.length / 2)
                return (
                  <div key={p.id} className={`rounded-2xl p-6 ${featured ? 'bg-amber-500 ring-0' : 'bg-zinc-800 border border-zinc-700'}`}>
                    {featured && <span className="text-[10px] font-black text-zinc-950/60 uppercase tracking-widest mb-3 block">Beliebt</span>}
                    <h3 className={`font-black text-xl mb-2 ${featured ? 'text-zinc-950' : 'text-white'}`}>{p.name}</h3>
                    {p.description && <p className={`text-sm mb-4 leading-relaxed ${featured ? 'text-zinc-800' : 'text-zinc-400'}`}>{p.description}</p>}
                    <p className={`text-4xl font-black mb-1 ${featured ? 'text-zinc-950' : 'text-white'}`}>
                      {(p.price_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
                      <span className={`text-base font-medium ml-1 ${featured ? 'text-zinc-700' : 'text-zinc-500'}`}>{fmt(p.billing_interval)}</span>
                    </p>
                    {p.contract_months > 0 && <p className={`text-xs mb-5 ${featured ? 'text-zinc-700' : 'text-zinc-600'}`}>{p.contract_months} Monate Mindestlaufzeit</p>}
                    <a href="#contact" className={`flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-bold mt-4 transition-colors ${featured ? 'bg-zinc-950 text-white hover:bg-zinc-800' : 'bg-zinc-700 text-white hover:bg-zinc-600'}`}>
                      Anfragen <ChevronRight size={14} />
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT ── */}
      <section id="contact" className="bg-zinc-950 py-24">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-px bg-amber-400" />
            <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">Kontakt</p>
          </div>
          <h2 className="text-3xl font-black text-white mb-12">Komm vorbei</h2>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Left: channels */}
            <div className="space-y-3">
              {gym.whatsapp_number && (
                <a href={`https://wa.me/${toWa(gym.whatsapp_number)}?text=${encodeURIComponent(`Hallo! Ich interessiere mich für ${gym.name}.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-[#25D366] hover:opacity-90 transition-opacity text-white">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <MessageCircle size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">WhatsApp schreiben</p>
                    <p className="text-xs text-white/80">{gym.whatsapp_number}</p>
                  </div>
                  <ChevronRight size={16} />
                </a>
              )}
              {gym.email && (
                <a href={`mailto:${gym.email}`} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0"><Mail size={16} className="text-zinc-400" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm">E-Mail schreiben</p>
                    <p className="text-xs text-zinc-500 truncate">{gym.email}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-600 flex-shrink-0" />
                </a>
              )}
              {gym.phone && (
                <a href={`tel:${gym.phone}`} className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0"><Phone size={16} className="text-zinc-400" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">Anrufen</p>
                    <p className="text-xs text-zinc-500">{gym.phone}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-600 flex-shrink-0" />
                </a>
              )}
              {gym.address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(gym.address)}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0"><MapPin size={16} className="text-zinc-400" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">Route anzeigen</p>
                    <p className="text-xs text-zinc-500">{gym.address}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-600 flex-shrink-0" />
                </a>
              )}
              {(gym.instagram_url || gym.facebook_url || gym.website_url) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {gym.instagram_url && (
                    <a href={gym.instagram_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                      <Share2 size={13} /> Instagram
                    </a>
                  )}
                  {gym.facebook_url && (
                    <a href={gym.facebook_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                      <Share2 size={13} /> Facebook
                    </a>
                  )}
                  {gym.website_url && (
                    <a href={gym.website_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-sm font-medium transition-colors">
                      <Globe size={13} /> Website
                    </a>
                  )}
                </div>
              )}

              {/* Opening hours */}
              {gym.opening_hours && (
                <div className="pt-4">
                  <p className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock size={11} /> Öffnungszeiten
                  </p>
                  <div className="space-y-2">
                    {DAY_ORDER.map(key => {
                      const h = gym.opening_hours![key]
                      if (!h) return null
                      return (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-zinc-500 w-24">{DAY_LABELS[key]}</span>
                          {h.closed
                            ? <span className="text-zinc-700 text-xs">Geschlossen</span>
                            : <span className="text-zinc-300 font-medium tabular-nums">{h.open} – {h.close}</span>
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: form */}
            <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 md:p-8">
              <h3 className="font-black text-white text-xl mb-1">Probetraining anfragen</h3>
              <p className="text-zinc-500 text-sm mb-6">Wir melden uns innerhalb von 24 Stunden.</p>
              <ContactForm slug={slug} />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-zinc-900 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {gym.logo_url
                ? <Image src={gym.logo_url} alt={gym.name} width={20} height={20} className="rounded-md object-cover border border-white/10" />
                : <div className="w-5 h-5 rounded-md bg-amber-400 flex items-center justify-center"><LogoMark className="w-2.5 h-2 text-zinc-950" /></div>
              }
              <span className="font-black text-white text-sm">{gym.name}</span>
            </div>
            <p className="text-zinc-700 text-xs">{gym.sport_type ?? 'Kampfsport'}{gym.address ? ` · ${gym.address}` : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-600">
            {gym.impressum_text && (
              <button onClick={() => setShowImpressum(true)} className="hover:text-zinc-300 transition-colors">Impressum</button>
            )}
            <Link href="/datenschutz" target="_blank" className="hover:text-zinc-300 transition-colors">Datenschutz</Link>
            <Link href="/agb" target="_blank" className="hover:text-zinc-300 transition-colors">AGB</Link>
            <span className="text-zinc-800">Betrieben mit <span className="font-black text-amber-400">Osss</span></span>
          </div>
        </div>
      </footer>

      {/* Impressum modal */}
      {showImpressum && gym.impressum_text && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowImpressum(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[80dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-white">Impressum</h3>
              <button onClick={() => setShowImpressum(false)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"><X size={15} /></button>
            </div>
            <div className="px-6 py-5 text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{gym.impressum_text}</div>
          </div>
        </div>
      )}
    </div>
  )
}
