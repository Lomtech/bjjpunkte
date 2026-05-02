'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ChevronRight, Scan } from 'lucide-react'

interface Member {
  id: string; first_name: string; last_name: string; belt: string; stripes: number
}
interface ClassEvent {
  id: string; title: string; class_type: string; starts_at: string; ends_at: string; is_cancelled: boolean
}
interface CheckedInEntry {
  member_id: string; name: string; belt: string; stripes: number; time: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

// ── Event Picker (shown when no class_id in URL) ──────────────────────────────

function EventPicker({ gymId, onSelect }: { gymId: string; onSelect: (cls: ClassEvent) => void }) {
  const [classes, setClasses] = useState<ClassEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
      const { data } = await (supabase as any).rpc('get_classes_for_gym', {
        p_gym_id: gymId, p_from: today.toISOString(),
      })
      const todayCls = ((data ?? []) as ClassEvent[])
        .filter(c => {
          const s = new Date(c.starts_at)
          return s >= today && s < tomorrow && !c.is_cancelled
        })
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      setClasses(todayCls)
      setLoading(false)
      // Auto-select currently active class
      const now = new Date()
      const active = todayCls.find(c => new Date(c.starts_at) <= now && new Date(c.ends_at) >= now)
      if (active) onSelect(active)
    }
    load()
  }, [gymId, onSelect])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-zinc-400 text-sm">Lädt Klassen…</p>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest text-center mb-2">
          Welche Klasse?
        </p>
        <p className="text-zinc-950 text-2xl font-black tracking-tight text-center mb-8">
          {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {classes.length === 0 ? (
          <div className="text-center py-12">
            <Scan size={40} className="text-zinc-200 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm font-medium">Kein Training heute geplant.</p>
            <p className="text-zinc-400 text-xs mt-1">Trage zuerst Klassen im Stundenplan ein.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {classes.map(cls => {
              const now = new Date()
              const isActive = new Date(cls.starts_at) <= now && new Date(cls.ends_at) >= now
              return (
                <button
                  key={cls.id}
                  onClick={() => onSelect(cls)}
                  className="w-full flex items-center justify-between bg-white rounded-2xl px-5 py-4 border border-zinc-100 shadow-sm hover:border-amber-300 hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-zinc-950 font-bold text-base">{cls.title}</p>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm tabular-nums mt-0.5">
                      {formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-zinc-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── QR Scanner ────────────────────────────────────────────────────────────────

function QRScanner({ cls, gymId }: { cls: ClassEvent; gymId: string }) {
  const [checkedIn, setCheckedIn]   = useState<CheckedInEntry[]>([])
  const [flash, setFlash]           = useState<{ name: string; belt: string; stripes: number } | null>(null)
  const [alreadyFlash, setAlreadyFlash] = useState<string | null>(null)
  const [error, setScanError]       = useState('')
  const [scanning, setScanning]     = useState(false)
  const [members, setMembers]       = useState<Member[]>([])
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(false)

  // Load existing check-ins for this class
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const [membersRes, attendanceRes] = await Promise.all([
        supabase.from('members').select('id, first_name, last_name, belt, stripes')
          .eq('gym_id', gymId).eq('is_active', true),
        supabase.from('attendance').select('member_id, checked_in_at')
          .eq('gym_id', gymId)
          .eq('class_id', cls.id)
          .gte('checked_in_at', today.toISOString())
          .order('checked_in_at', { ascending: false }),
      ])
      const memberList = (membersRes.data as Member[]) ?? []
      setMembers(memberList)
      const memberMap = new Map(memberList.map(m => [m.id, m]))
      const entries: CheckedInEntry[] = []
      for (const a of (attendanceRes.data ?? []) as { member_id: string; checked_in_at: string }[]) {
        const m = memberMap.get(a.member_id)
        if (m) entries.push({
          member_id: a.member_id,
          name: `${m.first_name} ${m.last_name}`,
          belt: m.belt, stripes: m.stripes,
          time: new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        })
      }
      setCheckedIn(entries)
    }
    load()
  }, [cls.id, gymId])

  const startCamera = useCallback(async () => {
    setScanError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
      scanningRef.current = true
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        const scan = async () => {
          if (!scanningRef.current || !videoRef.current || !streamRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              await handleQR(codes[0].rawValue)
              // Pause scanning briefly, then resume
              await new Promise(r => setTimeout(r, 2800))
            }
          } catch {}
          if (scanningRef.current) requestAnimationFrame(scan)
        }
        requestAnimationFrame(scan)
      }
    } catch {
      setScanError('Kamera konnte nicht geöffnet werden. Bitte Kamerazugriff erlauben.')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    startCamera()
    return () => {
      scanningRef.current = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [startCamera])

  async function handleQR(url: string) {
    const match = url.match(/\/portal\/([a-zA-Z0-9_-]+)/)
    if (!match) return
    const supabase = createClient()
    const { data: member } = await (supabase.from('members') as any)
      .select('id, first_name, last_name, belt, stripes')
      .eq('portal_token', match[1]).single()
    if (!member) { setScanError('Mitglied nicht gefunden.'); return }

    // Already in THIS class?
    if (checkedIn.some(e => e.member_id === member.id)) {
      setAlreadyFlash(`${member.first_name} ${member.last_name}`)
      setTimeout(() => setAlreadyFlash(null), 2500)
      return
    }

    await (supabase as any).from('attendance').insert({
      member_id: member.id, gym_id: gymId,
      class_type: cls.class_type, class_id: cls.id,
    })

    // Sync to class_bookings so check-in appears as confirmed in Stundenplan
    await (supabase as any).from('class_bookings').upsert({
      gym_id: gymId, class_id: cls.id, member_id: member.id, status: 'confirmed',
    }, { onConflict: 'class_id,member_id' })

    // Haptic feedback (iOS PWA)
    try { navigator.vibrate?.(60) } catch {}

    const entry: CheckedInEntry = {
      member_id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      belt: member.belt, stripes: member.stripes,
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    }
    setCheckedIn(prev => [entry, ...prev])
    setFlash({ name: `${member.first_name} ${member.last_name}`, belt: member.belt, stripes: member.stripes })
    setTimeout(() => setFlash(null), 2500)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Camera — fills available space */}
      <div className="relative flex-1 bg-zinc-950 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline muted
        />

        {/* Dimmed overlay with clear center window */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top dim */}
          <div className="absolute top-0 left-0 right-0 h-[22%] bg-zinc-950/60" />
          {/* Bottom dim */}
          <div className="absolute bottom-0 left-0 right-0 h-[22%] bg-zinc-950/60" />
          {/* Left dim */}
          <div className="absolute top-[22%] bottom-[22%] left-0 w-[12%] bg-zinc-950/60" />
          {/* Right dim */}
          <div className="absolute top-[22%] bottom-[22%] right-0 w-[12%] bg-zinc-950/60" />

          {/* Scanner frame */}
          <div className="absolute top-[22%] bottom-[22%] left-[12%] right-[12%] flex items-center justify-center">
            <div className="w-full h-full relative">
              {/* Corner brackets */}
              {[
                'top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl',
                'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl',
                'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl',
                'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-8 h-8 border-white/90 ${cls}`} />
              ))}
              {/* Scan line */}
              <div className="absolute left-2 right-2 top-1/2 h-px bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            </div>
          </div>
        </div>

        {/* Hint label */}
        <div className="absolute bottom-5 inset-x-0 flex justify-center pointer-events-none">
          <div className="bg-zinc-950/70 backdrop-blur-sm rounded-full px-4 py-1.5">
            <p className="text-white/80 text-xs font-medium">QR-Code in den Rahmen halten</p>
          </div>
        </div>

        {error && (
          <div className="absolute bottom-16 inset-x-4 bg-red-500 text-white text-sm font-medium text-center rounded-2xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Success flash */}
        {flash && (
          <div className="absolute inset-0 bg-emerald-500 flex flex-col items-center justify-center z-20 animate-in fade-in duration-150">
            <CheckCircle2 size={64} className="text-white mb-4" strokeWidth={1.5} />
            <p className="text-white font-black text-3xl tracking-tight mb-2">{flash.name}</p>
            <BeltBadge belt={flash.belt as Belt} stripes={flash.stripes} />
            <p className="text-emerald-100 text-sm font-medium mt-3">Eingecheckt ✓</p>
          </div>
        )}

        {/* Already flash */}
        {alreadyFlash && (
          <div className="absolute inset-0 bg-amber-500 flex flex-col items-center justify-center z-20 animate-in fade-in duration-150">
            <CheckCircle2 size={64} className="text-white mb-4" strokeWidth={1.5} />
            <p className="text-white font-black text-3xl tracking-tight mb-2">{alreadyFlash}</p>
            <p className="text-amber-100 text-sm font-medium mt-2">Bereits eingecheckt ✓</p>
          </div>
        )}
      </div>

      {/* Checked-in strip */}
      <div className="bg-white border-t border-zinc-100 flex-shrink-0" style={{ maxHeight: '36vh' }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-50">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
            {cls.title}
          </p>
          <span className="text-sm font-black text-zinc-950 tabular-nums">{checkedIn.length}</span>
        </div>
        <div className="overflow-auto" style={{ maxHeight: 'calc(36vh - 44px)' }}>
          {checkedIn.length === 0 ? (
            <p className="text-zinc-400 text-sm text-center py-6">Noch niemand eingecheckt.</p>
          ) : (
            checkedIn.map(entry => (
              <div key={entry.member_id} className="flex items-center gap-3 px-5 py-2.5 border-b border-zinc-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-600 text-[11px] font-black">
                    {entry.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-900 text-sm font-semibold truncate leading-tight">{entry.name}</p>
                  <BeltBadge belt={entry.belt as Belt} stripes={entry.stripes} />
                </div>
                <span className="text-zinc-400 text-xs tabular-nums flex-shrink-0">{entry.time}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function KioskContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [gymId, setGymId]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [selectedClass, setSelectedClass] = useState<ClassEvent | null>(null)

  const classIdParam    = searchParams.get('class_id')
  const classTitleParam = searchParams.get('title')
  const classTypeParam  = searchParams.get('class_type')
  const startsAtParam   = searchParams.get('starts_at')
  const endsAtParam     = searchParams.get('ends_at')

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: gym } = await (supabase.from('gyms') as any).select('id').single()
      if (!gym) { setLoading(false); return }
      setGymId(gym.id)

      // If class info is in URL params, use it directly (came from schedule)
      if (classIdParam && classTitleParam && classTypeParam) {
        setSelectedClass({
          id: classIdParam,
          title: decodeURIComponent(classTitleParam),
          class_type: decodeURIComponent(classTypeParam),
          starts_at: startsAtParam ? decodeURIComponent(startsAtParam) : new Date().toISOString(),
          ends_at: endsAtParam ? decodeURIComponent(endsAtParam) : new Date().toISOString(),
          is_cancelled: false,
        })
      }
      setLoading(false)
    }
    init()
  }, [classIdParam, classTitleParam, classTypeParam, startsAtParam, endsAtParam])

  if (loading) return (
    <div className="flex items-center justify-center flex-1">
      <p className="text-zinc-400 text-sm">Lädt…</p>
    </div>
  )

  return (
    <>
      {/* ── Header ── */}
      <div className="bg-white/96 backdrop-blur-md border-b border-zinc-100 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => selectedClass && !classIdParam ? setSelectedClass(null) : router.back()}
            className="flex items-center gap-1.5 text-amber-500 text-sm font-semibold"
          >
            <ArrowLeft size={16} /> {selectedClass && !classIdParam ? 'Klassen' : 'Zurück'}
          </button>

          {selectedClass ? (
            <div className="text-center">
              <p className="text-zinc-950 font-black text-base tracking-tight leading-tight">{selectedClass.title}</p>
              <p className="text-zinc-400 text-xs tabular-nums">
                {formatTime(selectedClass.starts_at)} – {formatTime(selectedClass.ends_at)}
              </p>
            </div>
          ) : (
            <p className="text-zinc-950 font-black text-base tracking-tight">Check-in</p>
          )}

          {/* Live indicator or empty spacer */}
          {selectedClass ? (
            (() => {
              const now = new Date()
              const isLive = new Date(selectedClass.starts_at) <= now && new Date(selectedClass.ends_at) >= now
              return isLive ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              ) : <div className="w-14" />
            })()
          ) : (
            <div className="w-14" />
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {gymId && (
        selectedClass
          ? <QRScanner cls={selectedClass} gymId={gymId} />
          : <EventPicker gymId={gymId} onSelect={setSelectedClass} />
      )}
    </>
  )
}

export default function KioskPage() {
  return (
    <div className="flex flex-col bg-zinc-50"
      style={{ height: '100dvh' }}
    >
      <Suspense fallback={
        <div className="flex items-center justify-center flex-1">
          <p className="text-zinc-400 text-sm">Lädt…</p>
        </div>
      }>
        <KioskContent />
      </Suspense>
    </div>
  )
}
