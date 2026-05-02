'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Globe, Save, ExternalLink, CheckCircle2, Camera, Trash2,
  ImagePlus, Play, Share2, Phone, Mail, MapPin,
  Clock, FileText, Info, ChevronDown, ChevronUp, Loader2, Plus, X,
} from 'lucide-react'
import { BlockEditor, uid, type Block } from '@/components/BlockEditor'
import Image from 'next/image'

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GymWebsite {
  slug: string | null
  name: string
  logo_url: string | null
  sport_type: string | null
  tagline: string | null
  about: string | null
  about_blocks: Block[]
  hero_image_url: string | null
  gallery_urls: string[]
  video_url: string | null
  video_urls: string[]
  whatsapp_number: string | null
  instagram_url: string | null
  facebook_url: string | null
  website_url: string | null
  founded_year: number | null
  opening_hours: OpeningHours | null
  impressum_text: string | null
}

type DayKey = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so'
interface DayHours { closed: boolean; open: string; close: string }
type OpeningHours = Record<DayKey, DayHours>

const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mo', label: 'Montag' },
  { key: 'di', label: 'Dienstag' },
  { key: 'mi', label: 'Mittwoch' },
  { key: 'do', label: 'Donnerstag' },
  { key: 'fr', label: 'Freitag' },
  { key: 'sa', label: 'Samstag' },
  { key: 'so', label: 'Sonntag' },
]

const DEFAULT_HOURS: OpeningHours = {
  mo: { closed: false, open: '09:00', close: '21:00' },
  di: { closed: false, open: '09:00', close: '21:00' },
  mi: { closed: false, open: '09:00', close: '21:00' },
  do: { closed: false, open: '09:00', close: '21:00' },
  fr: { closed: false, open: '09:00', close: '21:00' },
  sa: { closed: false, open: '10:00', close: '14:00' },
  so: { closed: true,  open: '10:00', close: '14:00' },
}

// ── Helper ────────────────────────────────────────────────────────────────────

const INPUT = 'w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-colors'
const TEXTAREA = INPUT + ' resize-none leading-relaxed'

function completionScore(g: GymWebsite): number {
  const checks = [
    !!g.tagline, !!(g.about || g.about_blocks?.length), !!g.hero_image_url,
    g.gallery_urls.length > 0, g.video_urls?.length > 0 || !!g.video_url,
    !!g.whatsapp_number || !!g.instagram_url,
    !!g.opening_hours, !!g.impressum_text,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  num, title, subtitle, icon, done, children,
}: {
  num: string; title: string; subtitle: string; icon: React.ReactNode
  done: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-zinc-50/60 transition-colors">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
        }`}>
          {done ? <CheckCircle2 size={16} className="text-emerald-600" /> : num}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-zinc-900 text-sm">{title}</p>
          <p className="text-zinc-400 text-xs mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">{icon}</span>
          {open ? <ChevronUp size={15} className="text-zinc-400" /> : <ChevronDown size={15} className="text-zinc-400" />}
        </div>
      </button>
      {open && <div className="px-5 pb-5 border-t border-zinc-50">{children}</div>}
    </div>
  )
}

// ── Save button ───────────────────────────────────────────────────────────────

function SaveBtn({ onClick, saving, saved }: { onClick: () => void; saving: boolean; saved: boolean }) {
  return (
    <button onClick={onClick} disabled={saving}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
        saved
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-zinc-950 hover:bg-zinc-800 text-white'
      }`}>
      {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
      {saving ? 'Speichern…' : saved ? 'Gespeichert' : 'Speichern'}
    </button>
  )
}

// ── Image uploader ────────────────────────────────────────────────────────────

function ImageUpload({
  label, url, onUploaded, hint, positionY, onPositionChange,
}: {
  label: string; url: string | null; onUploaded: (url: string) => void
  hint?: string; positionY?: number; onPositionChange?: (y: number) => void
}) {
  const ref        = useRef<HTMLInputElement>(null)
  const imgRef     = useRef<HTMLDivElement>(null)
  const [uploading, setUploading]   = useState(false)
  const [preview, setPreview]       = useState(url ?? '')
  const [uploadError, setUploadError] = useState('')
  const dragging   = useRef(false)
  const dragStartY = useRef(0)
  const dragStartPos = useRef(positionY ?? 50)

  useEffect(() => { setPreview(url ?? '') }, [url])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setPreview(URL.createObjectURL(file))
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/gym/media', { method: 'POST', headers: await getAuthHeaders(), body: fd })
    if (res.ok) {
      const { url: uploaded } = await res.json()
      setPreview(uploaded)
      onUploaded(uploaded)
    } else {
      const data = await res.json().catch(() => ({}))
      setUploadError(data.error ?? 'Upload fehlgeschlagen — bitte erneut versuchen.')
      setPreview(url ?? '')
    }
    setUploading(false)
    if (ref.current) ref.current.value = ''
  }

  function startDrag(clientY: number) {
    if (!onPositionChange) return
    dragging.current = true
    dragStartY.current = clientY
    dragStartPos.current = positionY ?? 50
  }
  function moveDrag(clientY: number) {
    if (!dragging.current || !onPositionChange || !imgRef.current) return
    const h = imgRef.current.getBoundingClientRect().height
    const delta = clientY - dragStartY.current
    // drag down → show top of image (lower %) ; drag up → show bottom (higher %)
    const newPos = Math.round(Math.max(0, Math.min(100, dragStartPos.current - (delta / h) * 100)))
    onPositionChange(newPos)
  }
  function stopDrag() { dragging.current = false }

  const canAdjustPos = !!onPositionChange && !!preview

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-zinc-600">{label}</p>
      {preview && (
        <div
          ref={imgRef}
          className={`relative w-full h-48 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 ${canAdjustPos ? 'cursor-ns-resize select-none' : ''}`}
          onMouseDown={canAdjustPos ? e => startDrag(e.clientY) : undefined}
          onMouseMove={canAdjustPos ? e => moveDrag(e.clientY) : undefined}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onTouchStart={canAdjustPos ? e => startDrag(e.touches[0].clientY) : undefined}
          onTouchMove={canAdjustPos ? e => { e.preventDefault(); moveDrag(e.touches[0].clientY) } : undefined}
          onTouchEnd={stopDrag}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview} alt={label}
            className="w-full h-full object-cover pointer-events-none"
            style={positionY !== undefined ? { objectPosition: `center ${positionY}%` } : undefined}
            draggable={false}
          />
          {canAdjustPos && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1.5 flex flex-col items-center gap-0.5">
                <span className="text-white text-[9px] font-medium leading-none">↑</span>
                <span className="text-white/70 text-[8px] leading-none">Ziehen</span>
                <span className="text-white text-[9px] font-medium leading-none">↓</span>
              </div>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 size={20} className="text-white animate-spin" />
            </div>
          )}
        </div>
      )}
      {canAdjustPos && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">Bildausschnitt</span>
            <span className="text-[11px] text-zinc-400 tabular-nums">
              {(positionY ?? 50) <= 15 ? 'Oben' : (positionY ?? 50) >= 85 ? 'Unten' : `${positionY}%`}
            </span>
          </div>
          <input
            type="range" min={0} max={100} value={positionY ?? 50}
            onChange={e => onPositionChange(parseInt(e.target.value))}
            className="w-full accent-amber-500 h-1.5 rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-zinc-300">
            <span>Oben</span><span>Mitte</span><span>Unten</span>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={preview}
          onChange={e => { setPreview(e.target.value); onUploaded(e.target.value) }}
          placeholder="https://… oder Datei hochladen →"
          className={INPUT + ' flex-1'}
        />
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold transition-colors flex-shrink-0 disabled:opacity-50">
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
          {uploading ? 'Lädt…' : 'Hochladen'}
        </button>
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WebsitePage() {
  const [gym,     setGym]     = useState<GymWebsite | null>(null)
  const [gymId,   setGymId]   = useState('')
  const [loading, setLoading] = useState(true)

  // Section states
  const [tagline,     setTagline]     = useState('')
  const [about,       setAbout]       = useState('')
  const [aboutBlocks, setAboutBlocks] = useState<Block[]>([])
  const [foundedYear, setFoundedYear] = useState('')
  const [gymSlug,     setGymSlug]     = useState('')
  const [slugError,   setSlugError]   = useState('')

  const [heroImageUrl, setHeroImageUrl] = useState('')
  const [heroPos,      setHeroPos]      = useState(50)
  const [galleryUrls,  setGalleryUrls]  = useState<string[]>([])
  const [videoUrls,    setVideoUrls]    = useState<string[]>([''])

  const [whatsapp,   setWhatsapp]   = useState('')
  const [instagram,  setInstagram]  = useState('')
  const [facebook,   setFacebook]   = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const [hours, setHours] = useState<OpeningHours>(DEFAULT_HOURS)

  const [impressum, setImpressum] = useState('')

  // Saving states per section
  const [saving,  setSaving]  = useState<Record<string, boolean>>({})
  const [saved,   setSaved]   = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('gyms')
        .select(`id, slug, name, logo_url, sport_type,
          tagline, about, about_blocks, hero_image_url, hero_image_position, gallery_urls, video_url, video_urls,
          whatsapp_number, instagram_url, facebook_url, website_url,
          founded_year, opening_hours, impressum_text`)
        .single()
      if (data) {
        setGym(data)
        setGymSlug(data.slug ?? '')
        setTagline(data.tagline ?? '')
        setAbout(data.about ?? '')
        setAboutBlocks(Array.isArray(data.about_blocks) ? data.about_blocks : [])
        setFoundedYear(data.founded_year?.toString() ?? '')
        setHeroImageUrl(data.hero_image_url ?? '')
        setHeroPos(data.hero_image_position ?? 50)
        setGalleryUrls(data.gallery_urls ?? [])
        const existingUrls: string[] = Array.isArray(data.video_urls) && data.video_urls.length > 0
          ? data.video_urls
          : data.video_url ? [data.video_url] : ['']
        setVideoUrls(existingUrls.length ? existingUrls : [''])
        setWhatsapp(data.whatsapp_number ?? '')
        setInstagram(data.instagram_url ?? '')
        setFacebook(data.facebook_url ?? '')
        setWebsiteUrl(data.website_url ?? '')
        setHours(data.opening_hours ?? DEFAULT_HOURS)
        setImpressum(data.impressum_text ?? '')
      }
      if (data?.id) setGymId(data.id)
      setLoading(false)
    }
    load()
  }, [])

  async function saveSlug() {
    setSlugError('')
    const clean = gymSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!clean) { setSlugError('URL-Kürzel darf nicht leer sein.'); return }
    setGymSlug(clean)
    setSaving(s => ({ ...s, slug: true }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    // Check uniqueness (exclude own gym)
    const { data: existing } = await supabase.from('gyms').select('id').eq('slug', clean).neq('id', gymId).maybeSingle()
    if (existing) {
      setSlugError('Dieses URL-Kürzel ist bereits vergeben. Bitte wähle ein anderes.')
      setSaving(s => ({ ...s, slug: false }))
      return
    }
    await supabase.from('gyms').update({ slug: clean }).eq('id', gymId)
    setGym((g: typeof gym) => g ? { ...g, slug: clean } : g)
    setSaving(s => ({ ...s, slug: false }))
    setSaved(s => ({ ...s, slug: true }))
    setTimeout(() => setSaved(s => ({ ...s, slug: false })), 2500)
  }

  async function saveSection(key: string, fields: Record<string, unknown>) {
    setSaving(s => ({ ...s, [key]: true }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any
    await supabase.from('gyms').update(fields).eq('id', gymId)
    setSaving(s => ({ ...s, [key]: false }))
    setSaved(s => ({ ...s, [key]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2500)
  }

  if (loading) return <div className="flex items-center justify-center h-full text-zinc-400 text-sm">Lädt…</div>

  const score = gym ? completionScore({
    ...gym,
    tagline, about, about_blocks: aboutBlocks, hero_image_url: heroImageUrl,
    gallery_urls: galleryUrls, video_url: videoUrls[0] ?? null, video_urls: videoUrls,
    whatsapp_number: whatsapp, instagram_url: instagram,
    opening_hours: hours, impressum_text: impressum,
  }) : 0

  const publicUrl = gym?.slug
    ? (typeof window !== 'undefined' ? window.location.origin : 'https://osss.pro') + `/gym/${gym.slug}`
    : null

  return (
    <div className="p-4 md:p-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Globe size={18} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Gym-Webseite</h1>
            <p className="text-zinc-400 text-xs mt-0.5">Konfiguriere deine öffentliche Gym-Seite</p>
          </div>
        </div>
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-xs font-medium transition-colors flex-shrink-0">
            <ExternalLink size={13} /> Vorschau
          </a>
        )}
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-zinc-900">Profil-Vollständigkeit</p>
          <span className={`text-sm font-bold ${score >= 75 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-zinc-400'}`}>
            {score}%
          </span>
        </div>
        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${score >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${score}%` }}
          />
        </div>
        {score < 100 && (
          <p className="text-xs text-zinc-400 mt-2">
            {score < 40
              ? 'Fange mit Tagline, Beschreibung und Kontaktdaten an — das sind die wichtigsten Felder.'
              : score < 75
              ? 'Gute Basis! Füge Fotos und Öffnungszeiten hinzu für einen professionellen Auftritt.'
              : 'Fast fertig! Nur noch das Impressum fehlt, um die Seite rechtssicher zu machen.'}
          </p>
        )}
      </div>

      <div className="space-y-4">

        {/* 1 — Grundlagen */}
        <Section num="1" title="Grundlagen" icon={<Info size={14} />}
          subtitle="Name, URL-Kürzel, Tagline und Gründungsjahr"
          done={!!tagline}>
          <div className="space-y-4 pt-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Gym-Name</label>
              <input value={gym?.name ?? ''} disabled
                className={INPUT + ' opacity-60 cursor-not-allowed'} />
              <p className="text-xs text-zinc-400 mt-1">Ändere den Namen unter Einstellungen → Allgemein.</p>
            </div>

            {/* Slug */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">URL-Kürzel (Slug)</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 whitespace-nowrap flex-shrink-0">osss.pro/gym/</span>
                <input
                  value={gymSlug}
                  onChange={e => { setGymSlug(e.target.value); setSlugError('') }}
                  placeholder="mein-gym"
                  className={INPUT + ' flex-1'}
                />
              </div>
              {gymSlug && (
                <p className="text-[11px] text-zinc-400 mt-1 font-mono">
                  → osss.pro/gym/{gymSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}
                </p>
              )}
              {slugError && <p className="text-xs text-red-500 mt-1">{slugError}</p>}
              <p className="text-xs text-zinc-400 mt-1">Nur Kleinbuchstaben, Zahlen und Bindestriche. Ändere den Slug nur bewusst — bestehende Links werden ungültig.</p>
              <div className="flex justify-end mt-3">
                <SaveBtn onClick={saveSlug} saving={!!saving.slug} saved={!!saved.slug} />
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-4">
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Tagline *</label>
              <input value={tagline} onChange={e => setTagline(e.target.value)}
                placeholder="z.B. Kampfsport für alle Levels im Herzen von München"
                className={INPUT} maxLength={100} />
              <p className="text-xs text-zinc-400 mt-1">Kurz und prägnant — erscheint groß im Hero-Bereich.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Gegründet</label>
              <input value={foundedYear} onChange={e => setFoundedYear(e.target.value)}
                type="number" placeholder="z.B. 2018" min="1900" max="2099"
                className={INPUT} />
            </div>
            <div className="flex justify-end">
              <SaveBtn
                onClick={() => saveSection('grundlagen', {
                  tagline: tagline || null,
                  founded_year: foundedYear ? parseInt(foundedYear) : null,
                })}
                saving={saving.grundlagen} saved={saved.grundlagen}
              />
            </div>
          </div>
        </Section>

        {/* 2 — Über uns */}
        <Section num="2" title="Über uns" icon={<FileText size={14} />}
          subtitle="Geschichte, Philosophie, Team — mit Texten und Bildern"
          done={aboutBlocks.length > 0 || !!about}>
          <div className="space-y-4 pt-4">
            <BlockEditor blocks={aboutBlocks} onChange={setAboutBlocks} />
            <div className="flex justify-end">
              <SaveBtn
                onClick={() => saveSection('about', {
                  about_blocks: aboutBlocks,
                  about: aboutBlocks.find(b => b.type === 'paragraph')?.text ?? about ?? null,
                })}
                saving={saving.about} saved={saved.about}
              />
            </div>
          </div>
        </Section>

        {/* 3 — Medien */}
        <Section num="3" title="Fotos & Video" icon={<Camera size={14} />}
          subtitle="Hero-Bild, Galerie und YouTube-Video"
          done={!!heroImageUrl || galleryUrls.length > 0}>
          <div className="space-y-5 pt-4">

            {/* Hero image */}
            <ImageUpload
              label="Hero-Bild (Hauptfoto)"
              url={heroImageUrl || null}
              onUploaded={setHeroImageUrl}
              positionY={heroPos}
              onPositionChange={setHeroPos}
              hint="Empfehlung: Hochformat oder Querformat. Bild im Vorschaufenster nach oben/unten ziehen um den Ausschnitt einzustellen."
            />

            {/* Gallery */}
            <div>
              <p className="text-xs font-semibold text-zinc-600 mb-2">Galerie (bis zu 9 Fotos)</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {galleryUrls.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 group">
                    <Image src={url} alt={`Galerie ${i + 1}`} fill className="object-cover" />
                    <button
                      onClick={() => setGalleryUrls(prev => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
                {galleryUrls.length < 9 && (
                  <GalleryUploader onUploaded={url => setGalleryUrls(prev => [...prev, url])} />
                )}
              </div>
              <p className="text-xs text-zinc-400">Klicke auf + um Fotos hochzuladen. Empfehlung: quadratische oder querformatige Aufnahmen.</p>
            </div>

            {/* Videos */}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-2">
                <span className="flex items-center gap-1.5"><Play size={12} /> YouTube-Videos & Shorts</span>
              </label>
              <div className="space-y-2">
                {videoUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={url}
                      onChange={e => setVideoUrls(vs => vs.map((v, j) => j === i ? e.target.value : v))}
                      placeholder={i === 0 ? 'https://www.youtube.com/watch?v=… oder /shorts/…' : 'Weitere URL…'}
                      className={INPUT + ' flex-1'}
                    />
                    {videoUrls.length > 1 && (
                      <button type="button"
                        onClick={() => setVideoUrls(vs => vs.filter((_, j) => j !== i))}
                        className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button"
                  onClick={() => setVideoUrls(vs => [...vs, ''])}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-600 transition-colors py-1">
                  <Plus size={13} /> Video hinzufügen
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-1">Regular Videos (16:9) und Shorts (9:16) werden automatisch erkannt.</p>
            </div>

            <div className="flex justify-end">
              <SaveBtn
                onClick={() => saveSection('medien', {
                  hero_image_url:      heroImageUrl || null,
                  hero_image_position: heroPos,
                  gallery_urls:        galleryUrls,
                  video_urls:          videoUrls.filter(u => u.trim()),
                  video_url:           videoUrls.find(u => u.trim()) || null,
                })}
                saving={saving.medien} saved={saved.medien}
              />
            </div>
          </div>
        </Section>

        {/* 4 — Kontakt & Social */}
        <Section num="4" title="Kontakt & Social Media" icon={<Phone size={14} />}
          subtitle="WhatsApp, Instagram, Facebook und mehr"
          done={!!(whatsapp || instagram)}>
          <div className="space-y-4 pt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
              <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                E-Mail, Telefon und Adresse werden automatisch aus den Gym-Einstellungen übernommen.
                Hier konfigurierst du zusätzliche Kanäle.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
                <span className="flex items-center gap-1.5"><Phone size={12} /> WhatsApp-Nummer</span>
              </label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                placeholder="+49 151 12345678"
                className={INPUT} />
              <p className="text-xs text-zinc-400 mt-1">Erscheint als grüner WhatsApp-Button auf deiner Seite — direkte Kontaktaufnahme für Interessenten.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
                <span className="flex items-center gap-1.5"><Share2 size={12} /> Instagram-URL</span>
              </label>
              <input value={instagram} onChange={e => setInstagram(e.target.value)}
                placeholder="https://www.instagram.com/deingym"
                className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
                <span className="flex items-center gap-1.5"><Share2 size={12} /> Facebook-URL</span>
              </label>
              <input value={facebook} onChange={e => setFacebook(e.target.value)}
                placeholder="https://www.facebook.com/deingym"
                className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
                <span className="flex items-center gap-1.5"><Globe size={12} /> Eigene Website</span>
              </label>
              <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://www.deingym.de"
                className={INPUT} />
            </div>
            <div className="flex justify-end">
              <SaveBtn
                onClick={() => saveSection('kontakt', {
                  whatsapp_number: whatsapp || null,
                  instagram_url:   instagram || null,
                  facebook_url:    facebook || null,
                  website_url:     websiteUrl || null,
                })}
                saving={saving.kontakt} saved={saved.kontakt}
              />
            </div>
          </div>
        </Section>

        {/* 5 — Öffnungszeiten */}
        <Section num="5" title="Öffnungszeiten" icon={<Clock size={14} />}
          subtitle="Wann ist dein Gym geöffnet?"
          done={!!gym?.opening_hours}>
          <div className="space-y-2 pt-4">
            {DAYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-700 w-20 flex-shrink-0">{label}</span>
                <label className="flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={!hours[key].closed}
                    onChange={e => setHours(h => ({ ...h, [key]: { ...h[key], closed: !e.target.checked } }))}
                    className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-xs text-zinc-500">Offen</span>
                </label>
                {!hours[key].closed && (
                  <>
                    <input type="time" value={hours[key].open}
                      onChange={e => setHours(h => ({ ...h, [key]: { ...h[key], open: e.target.value } }))}
                      className="px-2 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:border-amber-400 bg-zinc-50" />
                    <span className="text-xs text-zinc-400">–</span>
                    <input type="time" value={hours[key].close}
                      onChange={e => setHours(h => ({ ...h, [key]: { ...h[key], close: e.target.value } }))}
                      className="px-2 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-900 focus:outline-none focus:border-amber-400 bg-zinc-50" />
                  </>
                )}
                {hours[key].closed && (
                  <span className="text-xs text-zinc-400 italic">Geschlossen</span>
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <SaveBtn
                onClick={() => saveSection('stunden', { opening_hours: hours })}
                saving={saving.stunden} saved={saved.stunden}
              />
            </div>
          </div>
        </Section>

        {/* 6 — Impressum */}
        <Section num="6" title="Impressum" icon={<FileText size={14} />}
          subtitle="Gesetzlich vorgeschrieben für gewerbliche Websites"
          done={!!impressum}>
          <div className="space-y-4 pt-4">
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex gap-2">
              <Info size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-600 space-y-1">
                <p className="font-semibold">Pflichtangaben im Impressum:</p>
                <p>Name & Anschrift · Telefon · E-Mail · ggf. Handelsregisternummer · ggf. Steuernummer</p>
                <p className="text-zinc-400">Tipp: Nutze einen kostenlosen Impressum-Generator (z.B. e-recht24.de) und füge den Text hier ein.</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Impressum-Text *</label>
              <textarea value={impressum} onChange={e => setImpressum(e.target.value)}
                rows={8}
                placeholder={`Angaben gemäß § 5 TMG:\n\nDein Name / Firmenname\nStraße Hausnummer\nPLZ Stadt\n\nTelefon: +49 …\nE-Mail: info@…`}
                className={TEXTAREA} />
            </div>
            <div className="flex justify-end">
              <SaveBtn
                onClick={() => saveSection('impressum', { impressum_text: impressum || null })}
                saving={saving.impressum} saved={saved.impressum}
              />
            </div>
          </div>
        </Section>

      </div>

      {/* Footer note */}
      {publicUrl && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <Globe size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Deine Gym-Seite ist live</p>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-amber-700 hover:underline break-all">{publicUrl}</a>
            <p className="text-xs text-amber-700 mt-1">Teile diesen Link auf Instagram, in WhatsApp-Gruppen oder drucke ihn als QR-Code aus.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Gallery uploader ──────────────────────────────────────────────────────────

function GalleryUploader({ onUploaded }: { onUploaded: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/gym/media', { method: 'POST', headers: await getAuthHeaders(), body: fd })
    if (res.ok) {
      const { url } = await res.json()
      onUploaded(url)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Upload fehlgeschlagen')
    }
    setUploading(false)
    if (ref.current) ref.current.value = ''
  }

  return (
    <div className="aspect-square flex flex-col">
      <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
        className="flex-1 rounded-xl border-2 border-dashed border-zinc-200 hover:border-amber-400 hover:bg-amber-50 flex flex-col items-center justify-center gap-1.5 transition-colors disabled:opacity-50">
        {uploading
          ? <Loader2 size={18} className="text-amber-500 animate-spin" />
          : <ImagePlus size={18} className="text-zinc-400" />}
        <span className="text-[10px] text-zinc-400">{uploading ? 'Lädt…' : 'Foto hinzufügen'}</span>
      </button>
      {error && <p className="text-[10px] text-red-500 mt-1 text-center">{error}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
