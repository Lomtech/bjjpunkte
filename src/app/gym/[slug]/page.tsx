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
interface PostBlock { id: string; type: 'heading' | 'paragraph' | 'image'; text?: string; url?: string; caption?: string }
interface GymPost {
  id: string; title: string; cover_url: string | null
  blocks: PostBlock[]; published_at: string; created_at: string
}
type DayKey = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so'
interface DayHours { closed: boolean; open: string; close: string }
interface GymInfo {
  id: string; name: string; logo_url: string | null
  address: string | null; phone: string | null; email: string | null
  sport_type: string | null; belt_system_enabled: boolean
  tagline: string | null; about: string | null
  hero_image_url: string | null; hero_image_position: number
  gallery_urls: string[]
  video_url: string | null; video_urls: string[]; whatsapp_number: string | null
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
  gi: 'bg-zinc-100 text-zinc-700', 'no-gi': 'bg-zinc-800 text-zinc-100',
  'open mat': 'bg-amber-100 text-amber-800', kids: 'bg-zinc-100 text-zinc-600',
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
function ytParse(url: string): { id: string; isShort: boolean } | null {
  const short = url.match(/youtube\.com\/shorts\/([^?&/\s]+)/)
  if (short) return { id: short[1], isShort: true }
  const regular = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/\s]+)/)
  if (regular) return { id: regular[1], isShort: false }
  return null
}

// ── Sticky nav ────────────────────────────────────────────────────────────────

function Nav({ gym }: { gym: GymInfo }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  const links = [
    { href: '#about', label: 'Über uns' },
    { href: '#news', label: 'News' },
    { href: '#schedule', label: 'Stundenplan' },
    { href: '#plans', label: 'Preise' },
    { href: '#contact', label: 'Kontakt' },
  ]
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-zinc-100' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <a href="#" className="flex items-center gap-2.5">
          {gym.logo_url
            ? <Image src={gym.logo_url} alt={gym.name} width={30} height={30} className="rounded-lg object-cover border border-zinc-200 flex-shrink-0" />
            : <div className="w-7 h-7 rounded-lg bg-amber-400 flex items-center justify-center flex-shrink-0"><LogoMark className="w-3 h-2.5 text-zinc-950" /></div>
          }
          <span className={`font-black text-sm tracking-tight truncate max-w-[180px] transition-colors ${scrolled ? 'text-zinc-900' : 'text-white'}`}>{gym.name}</span>
        </a>
        <div className="hidden md:flex items-center gap-0.5">
          {links.map(l => (
            <a key={l.href} href={l.href} className={`px-3 py-1.5 text-[13px] rounded-lg transition-colors ${scrolled ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>{l.label}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href="#contact" className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-sm font-bold transition-colors">
            Probetraining <ChevronRight size={14} />
          </a>
          <button onClick={() => setOpen(o => !o)} className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden bg-white border-t border-zinc-100 px-4 py-3 space-y-0.5 shadow-lg">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block px-3 py-2.5 text-sm text-zinc-600 hover:text-zinc-900 rounded-xl hover:bg-zinc-50 transition-colors">{l.label}</a>
          ))}
          <a href="#contact" onClick={() => setOpen(false)} className="block mt-2 px-3 py-3 text-sm font-bold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-xl text-center">Probetraining anfragen</a>
        </div>
      )}
    </nav>
  )
}

// ── Contact form ──────────────────────────────────────────────────────────────

function ContactForm({ slug }: { slug: string }) {
  const [step, setStep] = useState<'idle' | 'form' | 'done'>('idle')
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', message: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const res = await fetch(`/api/public/gym/${slug}/lead`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) setStep('done')
    else { const d = await res.json(); setErr(d.error ?? 'Fehler') }
    setBusy(false)
  }

  const ic = 'w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors'

  if (step === 'done') return (
    <div className="text-center py-8">
      <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check size={24} className="text-amber-500" strokeWidth={2.5} />
      </div>
      <p className="font-bold text-zinc-900 text-lg mb-1">Anfrage erhalten!</p>
      <p className="text-zinc-500 text-sm">Wir melden uns schnellstmöglich.</p>
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
        <div><label className="block text-xs font-medium text-zinc-500 mb-1">Vorname *</label><input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required placeholder="Max" className={ic} /></div>
        <div><label className="block text-xs font-medium text-zinc-500 mb-1">Nachname *</label><input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required placeholder="Mustermann" className={ic} /></div>
      </div>
      <div><label className="block text-xs font-medium text-zinc-500 mb-1">E-Mail *</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="max@beispiel.de" className={ic} /></div>
      <div><label className="block text-xs font-medium text-zinc-500 mb-1">Telefon</label><input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+49 151 …" className={ic} /></div>
      <div><label className="block text-xs font-medium text-zinc-500 mb-1">Nachricht</label><textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={2} placeholder="Ich interessiere mich für…" className={ic + ' resize-none'} /></div>
      {err && <p className="text-red-500 text-xs">{err}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => setStep('idle')} className="flex-1 border border-zinc-200 text-zinc-600 rounded-xl py-2.5 text-sm hover:bg-zinc-50 transition-colors">Zurück</button>
        <button type="submit" disabled={busy} className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl py-2.5 text-sm transition-colors disabled:opacity-50">{busy ? 'Senden…' : 'Absenden'}</button>
      </div>
    </form>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

// ── Scroll-reveal hook ────────────────────────────────────────────────────────

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          (e.target as HTMLElement).style.opacity = '1';
          (e.target as HTMLElement).style.transform = 'translateY(0)';
          io.unobserve(e.target)
        }
      })
    }, { threshold: 0.1 })
    els.forEach(el => {
      (el as HTMLElement).style.opacity = '0';
      (el as HTMLElement).style.transform = 'translateY(32px)';
      (el as HTMLElement).style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      io.observe(el)
    })
    return () => io.disconnect()
  }, [])
}

export default function PublicGymPage() {
  const { slug }               = useParams<{ slug: string }>()
  const [gym, setGym]          = useState<GymInfo | null>(null)
  const [classes, setClasses]  = useState<GymClass[]>([])
  const [plans, setPlans]      = useState<Plan[]>([])
  const [posts, setPosts]      = useState<GymPost[]>([])
  const [loading, setLoading]  = useState(true)
  const [showImpressum, setShowImpressum] = useState(false)

  useScrollReveal()

  useEffect(() => {
    fetch(`/api/public/gym/${slug}`)
      .then(r => r.json())
      .then(d => { setGym(d.gym); setClasses(d.classes ?? []); setPlans(d.plans ?? []); setPosts(d.posts ?? []) })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-200 border-t-amber-400 rounded-full animate-spin" />
    </div>
  )
  if (!gym) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-zinc-400 text-sm">Gym nicht gefunden.</p>
    </div>
  )

  const days   = groupByDay(classes)
  // Merge video_urls array (new) with legacy video_url fallback, dedupe, parse
  const allVideoUrls = Array.isArray(gym.video_urls) && gym.video_urls.length > 0
    ? gym.video_urls
    : gym.video_url ? [gym.video_url] : []
  const videos = allVideoUrls.map(u => ytParse(u)).filter(Boolean) as { id: string; isShort: boolean }[]

  function PostsSection() {
    if (posts.length === 0) return null
    return (
      <section id="news" className="bg-white py-24">
        <div className="max-w-6xl mx-auto px-5">
          <div data-reveal className="flex items-center gap-2 mb-3">
            <span className="w-6 h-px bg-amber-400" />
            <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em]">News & Ankündigungen</p>
          </div>
          <h2 data-reveal className="text-3xl font-black text-zinc-900 mb-12">Aktuelles</h2>
          <div className="space-y-12">
            {posts.map((post, idx) => (
              <article key={post.id} data-reveal
                style={{ transitionDelay: `${idx * 80}ms` }}
                className="group">
                <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">
                  {/* Cover or date column */}
                  <div>
                    {post.cover_url ? (
                      <div className="rounded-2xl overflow-hidden aspect-[4/3]">
                        <img src={post.cover_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-zinc-50 border border-zinc-100 aspect-[4/3] flex items-center justify-center">
                        <span className="text-zinc-200 font-black text-6xl select-none">
                          {new Date(post.published_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-zinc-400 mt-3 font-medium">
                      {new Date(post.published_at).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  {/* Content */}
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black text-zinc-900 leading-tight">{post.title}</h3>
                    {post.blocks.map((block) => {
                      if (block.type === 'heading') return (
                        <h4 key={block.id} className="text-lg font-bold text-zinc-800 mt-6 first:mt-0">{block.text}</h4>
                      )
                      if (block.type === 'paragraph') return (
                        <p key={block.id} className="text-zinc-600 leading-[1.85] text-[15px] whitespace-pre-wrap">{block.text}</p>
                      )
                      if (block.type === 'image' && block.url) return (
                        <figure key={block.id} className="my-4">
                          <div className="rounded-2xl overflow-hidden">
                            <img src={block.url} alt={block.caption ?? ''} className="w-full object-cover max-h-96 group-hover:scale-102 transition-transform duration-500" />
                          </div>
                          {block.caption && <figcaption className="text-xs text-zinc-400 text-center mt-2">{block.caption}</figcaption>}
                        </figure>
                      )
                      return null
                    })}
                  </div>
                </div>
                {idx < posts.length - 1 && <div className="mt-12 h-px bg-zinc-100" />}
              </article>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      <Nav gym={gym} />

      {/* ── HERO ── photo left, text right, dark overlay for readability ── */}
      <section className="relative min-h-screen overflow-hidden bg-zinc-900">
        {/* Full-bleed hero image */}
        {gym.hero_image_url && (
          <div className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gym.hero_image_url} alt={gym.name} className="w-full h-full object-cover"
              style={{ objectPosition: `center ${gym.hero_image_position ?? 50}%` }} />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/60 to-zinc-950/30" />
          </div>
        )}
        {!gym.hero_image_url && (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-800" />
        )}

        <div className="relative z-10 max-w-6xl mx-auto px-5 min-h-screen flex items-center pt-20 pb-16">
          <div className="max-w-xl">
            {gym.sport_type && (
              <div className="flex items-center gap-2 mb-6">
                <span className="w-6 h-px bg-amber-400" />
                <span className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">{gym.sport_type}</span>
              </div>
            )}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[0.95] tracking-tight mb-5">
              {gym.name}
            </h1>
            {gym.tagline && (
              <p className="text-zinc-300 text-lg leading-relaxed mb-8 max-w-md">{gym.tagline}</p>
            )}
            <div className="flex flex-wrap gap-3 mb-10">
              <a href="#contact" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-colors">
                Probetraining <ChevronRight size={15} />
              </a>
              {gym.whatsapp_number && (
                <a href={`https://wa.me/${toWa(gym.whatsapp_number)}?text=${encodeURIComponent(`Hallo! Ich interessiere mich für ${gym.name}.`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 backdrop-blur-sm transition-colors">
                  <MessageCircle size={15} /> WhatsApp
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-4">
              {gym.address && (
                <span className="flex items-center gap-1.5 text-sm text-zinc-400">
                  <MapPin size={13} className="text-zinc-500" /> {gym.address}
                </span>
              )}
              {gym.founded_year && (
                <span className="flex items-center gap-1.5 text-sm text-zinc-400">
                  <Award size={13} className="text-zinc-500" /> Seit {gym.founded_year}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── VIDEOS ── */}
      {videos.length > 0 && (
        <section className="bg-zinc-950 py-8">
          <div className="max-w-6xl mx-auto px-5">
            {/* Single regular video → full width */}
            {videos.length === 1 && !videos[0].isShort && (
              <div className="relative rounded-2xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${videos[0].id}?rel=0&modestbranding=1`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen title="Gym Video"
                />
              </div>
            )}
            {/* Single short → centred portrait */}
            {videos.length === 1 && videos[0].isShort && (
              <div className="flex justify-center">
                <div className="relative rounded-2xl overflow-hidden w-full max-w-xs" style={{ paddingBottom: 'min(177.78%, 80dvh)', maxHeight: '80dvh' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${videos[0].id}?rel=0&modestbranding=1`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen title="Short"
                  />
                </div>
              </div>
            )}
            {/* Multiple videos → adaptive grid */}
            {videos.length > 1 && (() => {
              const regulars = videos.filter(v => !v.isShort)
              const shorts   = videos.filter(v => v.isShort)
              return (
                <div className="space-y-4">
                  {regulars.length > 0 && (
                    <div className={`grid gap-4 ${regulars.length === 1 ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
                      {regulars.map(v => (
                        <div key={v.id} className="relative rounded-2xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${v.id}?rel=0&modestbranding=1`}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen title="Video"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {shorts.length > 0 && (
                    <div className={`grid gap-4 ${
                      shorts.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' :
                      shorts.length === 2 ? 'grid-cols-2 max-w-sm mx-auto' :
                      'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                    }`}>
                      {shorts.map(v => (
                        <div key={v.id} className="relative rounded-2xl overflow-hidden" style={{ paddingBottom: '177.78%' }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${v.id}?rel=0&modestbranding=1`}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen title="Short"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </section>
      )}

      {/* ── ABOUT ── */}
      {gym.about && (
        <section id="about" className="bg-white py-24">
          <div className="max-w-6xl mx-auto px-5">
            <div className="grid md:grid-cols-[1fr_2fr] gap-16 items-start">
              <div data-reveal>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-px bg-amber-400" />
                  <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em]">Über uns</p>
                </div>
                <h2 className="text-3xl font-black text-zinc-900 leading-tight">Was uns ausmacht</h2>
                {(gym.founded_year || gym.sport_type) && (
                  <div className="mt-8 space-y-3">
                    {gym.founded_year && (
                      <div className="border-l-2 border-amber-400 pl-4">
                        <p className="text-2xl font-black text-amber-500">{gym.founded_year}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Gegründet</p>
                      </div>
                    )}
                    {gym.sport_type && (
                      <div className="border-l-2 border-zinc-200 pl-4">
                        <p className="text-lg font-black text-zinc-900">{gym.sport_type}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">Schwerpunkt</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div data-reveal style={{ transitionDelay: '120ms' }}>
                <p className="text-zinc-600 leading-[1.9] text-[15px] whitespace-pre-wrap">{gym.about}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── GALLERY ── */}
      {gym.gallery_urls.length > 0 && (
        <section className="bg-zinc-50">
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
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── NEWS / POSTS ── */}
      <PostsSection />

      {/* ── SCHEDULE ── */}
      {days.length > 0 && (
        <section id="schedule" className="bg-white py-24">
          <div className="max-w-6xl mx-auto px-5">
            <div data-reveal className="flex items-center gap-2 mb-3">
              <span className="w-6 h-px bg-amber-400" />
              <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em]">Stundenplan</p>
            </div>
            <h2 data-reveal className="text-3xl font-black text-zinc-900 mb-12" style={{ transitionDelay: '60ms' }}>Kommende Trainings</h2>
            <div className="space-y-8">
              {days.map(([day, dc]) => (
                <div key={day}>
                  <div className="flex items-center gap-3 mb-4">
                    <CalendarDays size={13} className="text-amber-500" />
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{day}</p>
                    <div className="flex-1 h-px bg-zinc-100" />
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {dc.map(cls => (
                      <div key={cls.id} className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-start gap-3 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all">
                        <div className="flex-shrink-0">
                          <p className="text-sm font-bold text-zinc-900 tabular-nums">{fmtTime(cls.starts_at)}</p>
                          <p className="text-[11px] text-zinc-400 tabular-nums">{fmtTime(cls.ends_at)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-zinc-900 text-sm leading-tight">{cls.title}</p>
                          {cls.instructor && <p className="text-xs text-zinc-500 mt-0.5">{cls.instructor}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${CLASS_COLORS[cls.class_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                              {CLASS_LABELS[cls.class_type] ?? cls.class_type}
                            </span>
                            {cls.max_capacity && (
                              <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
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
        <section id="plans" className="bg-zinc-50 py-24">
          <div className="max-w-6xl mx-auto px-5">
            <div data-reveal className="flex items-center gap-2 mb-3">
              <span className="w-6 h-px bg-amber-400" />
              <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em]">Mitgliedschaft</p>
            </div>
            <h2 data-reveal className="text-3xl font-black text-zinc-900 mb-12" style={{ transitionDelay: '60ms' }}>Unsere Preise</h2>
            <div className={`grid gap-4 ${plans.length === 1 ? 'max-w-xs' : plans.length === 2 ? 'sm:grid-cols-2 max-w-xl' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              {plans.map((p, i) => {
                const featured = plans.length > 1 && i === Math.floor(plans.length / 2)
                return (
                  <div key={p.id} className={`rounded-2xl p-6 ${featured ? 'bg-amber-500 shadow-lg shadow-amber-200' : 'bg-white border border-zinc-200 shadow-sm'}`}>
                    {featured && <span className="text-[10px] font-black text-zinc-950/60 uppercase tracking-widest mb-3 block">Beliebt</span>}
                    <h3 className={`font-black text-xl mb-2 ${featured ? 'text-zinc-950' : 'text-zinc-900'}`}>{p.name}</h3>
                    {p.description && <p className={`text-sm mb-4 leading-relaxed ${featured ? 'text-zinc-800' : 'text-zinc-500'}`}>{p.description}</p>}
                    <p className={`text-4xl font-black mb-1 ${featured ? 'text-zinc-950' : 'text-zinc-900'}`}>
                      {(p.price_cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
                      <span className={`text-base font-medium ml-1 ${featured ? 'text-zinc-700' : 'text-zinc-400'}`}>{fmt(p.billing_interval)}</span>
                    </p>
                    {p.contract_months > 0 && <p className={`text-xs mb-5 ${featured ? 'text-zinc-700' : 'text-zinc-400'}`}>{p.contract_months} Monate Mindestlaufzeit</p>}
                    <a href="#contact" className={`flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-bold mt-4 transition-colors ${featured ? 'bg-zinc-950 text-white hover:bg-zinc-800' : 'bg-zinc-900 text-white hover:bg-zinc-700'}`}>
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
      <section id="contact" className="bg-white py-24">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-px bg-amber-400" />
            <p className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em]">Kontakt</p>
          </div>
          <h2 className="text-3xl font-black text-zinc-900 mb-12">Komm vorbei</h2>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Left: channels + hours */}
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
              {gym.instagram_url && (
                <a href={gym.instagram_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 transition-opacity text-white">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Share2 size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">Instagram folgen</p>
                    <p className="text-xs text-white/80 truncate">{gym.instagram_url.replace(/^https?:\/\/(www\.)?instagram\.com\/?/, '@').replace(/\/$/, '')}</p>
                  </div>
                  <ChevronRight size={16} />
                </a>
              )}
              {gym.facebook_url && (
                <a href={gym.facebook_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-[#1877F2] hover:opacity-90 transition-opacity text-white">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Share2 size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">Facebook besuchen</p>
                  </div>
                  <ChevronRight size={16} />
                </a>
              )}
              {gym.email && (
                <a href={`mailto:${gym.email}`} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0"><Mail size={16} className="text-zinc-500" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 text-sm">E-Mail schreiben</p>
                    <p className="text-xs text-zinc-400 truncate">{gym.email}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />
                </a>
              )}
              {gym.phone && (
                <a href={`tel:${gym.phone}`} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0"><Phone size={16} className="text-zinc-500" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-zinc-900 text-sm">Anrufen</p>
                    <p className="text-xs text-zinc-400">{gym.phone}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />
                </a>
              )}
              {gym.address && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(gym.address)}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0"><MapPin size={16} className="text-zinc-500" /></div>
                  <div className="flex-1">
                    <p className="font-semibold text-zinc-900 text-sm">Route anzeigen</p>
                    <p className="text-xs text-zinc-400">{gym.address}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />
                </a>
              )}
              {gym.website_url && (
                <a href={gym.website_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center flex-shrink-0"><Globe size={16} className="text-zinc-500" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-900 text-sm">Website besuchen</p>
                    <p className="text-xs text-zinc-400 truncate">{gym.website_url.replace(/^https?:\/\//, '')}</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />
                </a>
              )}

              {gym.opening_hours && (
                <div className="pt-4">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock size={11} /> Öffnungszeiten
                  </p>
                  <div className="space-y-2">
                    {DAY_ORDER.map(key => {
                      const h = gym.opening_hours![key]
                      if (!h) return null
                      return (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-zinc-400 w-24">{DAY_LABELS[key]}</span>
                          {h.closed
                            ? <span className="text-zinc-300 text-xs">Geschlossen</span>
                            : <span className="text-zinc-700 font-medium tabular-nums">{h.open} – {h.close}</span>
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: form */}
            <div className="bg-zinc-50 rounded-3xl border border-zinc-200 p-6 md:p-8 shadow-sm">
              <h3 className="font-black text-zinc-900 text-xl mb-1">Probetraining anfragen</h3>
              <p className="text-zinc-500 text-sm mb-6">Wir melden uns innerhalb von 24 Stunden.</p>
              <ContactForm slug={slug} />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-zinc-50 border-t border-zinc-200">
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {gym.logo_url
                ? <Image src={gym.logo_url} alt={gym.name} width={20} height={20} className="rounded-md object-cover border border-zinc-200" />
                : <div className="w-5 h-5 rounded-md bg-amber-400 flex items-center justify-center"><LogoMark className="w-2.5 h-2 text-zinc-950" /></div>
              }
              <span className="font-black text-zinc-900 text-sm">{gym.name}</span>
            </div>
            <p className="text-zinc-400 text-xs">{gym.sport_type ?? 'Kampfsport'}{gym.address ? ` · ${gym.address}` : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-400">
            {gym.impressum_text && (
              <button onClick={() => setShowImpressum(true)} className="hover:text-zinc-700 transition-colors">Impressum</button>
            )}
            <Link href="/datenschutz" target="_blank" className="hover:text-zinc-700 transition-colors">Datenschutz</Link>
            <Link href="/agb" target="_blank" className="hover:text-zinc-700 transition-colors">AGB</Link>
            <span className="text-zinc-300">Betrieben mit <span className="font-black text-amber-500">Osss</span></span>
          </div>
        </div>
      </footer>

      {/* Impressum modal */}
      {showImpressum && gym.impressum_text && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowImpressum(false)}>
          <div className="bg-white border border-zinc-200 rounded-3xl shadow-2xl w-full max-w-lg max-h-[80dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-zinc-900">Impressum</h3>
              <button onClick={() => setShowImpressum(false)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"><X size={15} /></button>
            </div>
            <div className="px-6 py-5 text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">{gym.impressum_text}</div>
          </div>
        </div>
      )}
    </div>
  )
}
