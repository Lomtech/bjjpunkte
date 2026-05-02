'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'
import Link from 'next/link'
import { ArrowLeft, Search, CheckCircle2, X, QrCode } from 'lucide-react'

interface Member { id: string; first_name: string; last_name: string; belt: string; stripes: number }

interface ClassEvent {
  id: string
  title: string
  class_type: string
  starts_at: string
  ends_at: string
  is_cancelled: boolean
}

interface CheckedInEntry {
  member_id: string
  name: string
  belt: string
  stripes: number
  time: string
}

const DEFAULT_CLASS_TYPES = [
  { value: 'gi',          label: 'Gi' },
  { value: 'no-gi',       label: 'No-Gi' },
  { value: 'open mat',    label: 'Open Mat' },
  { value: 'kids',        label: 'Kids' },
  { value: 'competition', label: 'Competition' },
]

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function toWaPhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('0'))  p = '+49' + p.slice(1)
  return p.replace(/^\+/, '')
}

export default function KioskPage() {
  const [loading, setLoading]         = useState(true)
  const [gymId, setGymId]             = useState('')
  const [members, setMembers]         = useState<Member[]>([])
  const [search, setSearch]           = useState('')
  const [todayClasses, setTodayClasses] = useState<ClassEvent[]>([])
  const [selectedClass, setSelectedClass] = useState<ClassEvent | null>(null)
  const [classTypes, setClassTypes]   = useState(DEFAULT_CLASS_TYPES)
  const [manualClassType, setManualClassType] = useState('gi')
  const [checkedIn, setCheckedIn]     = useState<Map<string, CheckedInEntry>>(new Map())
  const [totalToday, setTotalToday]   = useState(0)
  const [flash, setFlash]             = useState<{ name: string; belt: string; stripes: number } | null>(null)
  const [checkingId, setCheckingId]   = useState<string | null>(null)
  const [scanMode, setScanMode]       = useState(false)
  const [scanError, setScanError]     = useState('')
  const [alreadyName, setAlreadyName] = useState<string | null>(null)
  const inputRef  = useRef<HTMLInputElement>(null)
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const gymIdRef  = useRef('')

  // Load check-ins for a specific event (or all today if no event)
  const loadCheckedIn = useCallback(async (classId: string | null, memberMap: Map<string, Member>) => {
    const supabase = createClient()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let q = supabase.from('attendance')
      .select('member_id, checked_in_at, class_type')
      .eq('gym_id', gymIdRef.current)
      .gte('checked_in_at', today.toISOString())
    if (classId) q = (q as any).eq('class_id', classId)
    const { data } = await q
    const map = new Map<string, CheckedInEntry>()
    for (const a of (data ?? []) as { member_id: string; checked_in_at: string }[]) {
      const m = memberMap.get(a.member_id)
      if (m) map.set(a.member_id, {
        member_id: a.member_id,
        name: `${m.first_name} ${m.last_name}`,
        belt: m.belt, stripes: m.stripes,
        time: new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      })
    }
    setCheckedIn(map)
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await (supabase.from('gyms') as any).select('id, class_types').single()
      if (!gym) { setLoading(false); return }
      gymIdRef.current = gym.id
      setGymId(gym.id)

      const rawTypes = (gym as any)?.class_types
      if (Array.isArray(rawTypes) && rawTypes.length > 0) {
        setClassTypes(rawTypes.map((v: string) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })))
        setManualClassType(rawTypes[0])
      }

      const today = new Date(); today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

      const [membersRes, classesRes, totalRes] = await Promise.all([
        supabase.from('members').select('id, first_name, last_name, belt, stripes')
          .eq('gym_id', gym.id).eq('is_active', true).order('last_name'),
        (supabase as any).rpc('get_classes_for_gym', { p_gym_id: gym.id, p_from: today.toISOString() }),
        supabase.from('attendance').select('id', { count: 'exact', head: true })
          .eq('gym_id', gym.id).gte('checked_in_at', today.toISOString()),
      ])

      const memberList = (membersRes.data as Member[]) ?? []
      setMembers(memberList)
      setTotalToday(totalRes.count ?? 0)

      // Filter to today's non-cancelled classes, sorted by time
      const todayCls = ((classesRes.data ?? []) as ClassEvent[])
        .filter(c => {
          const s = new Date(c.starts_at)
          return s >= today && s < tomorrow && !c.is_cancelled
        })
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      setTodayClasses(todayCls)

      // Auto-select: active class now, else next upcoming, else first
      const now = new Date()
      const active = todayCls.find(c => new Date(c.starts_at) <= now && new Date(c.ends_at) >= now)
      const next   = todayCls.find(c => new Date(c.starts_at) > now)
      const auto   = active ?? next ?? todayCls[0] ?? null

      const memberMap = new Map(memberList.map(m => [m.id, m]))
      if (auto) {
        setSelectedClass(auto)
        await loadCheckedIn(auto.id, memberMap)
      } else {
        await loadCheckedIn(null, memberMap)
      }

      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 200)
    }
    load()
  }, [loadCheckedIn])

  // Reload check-ins when selected class changes
  async function selectClass(cls: ClassEvent) {
    setSelectedClass(cls)
    const memberMap = new Map(members.map(m => [m.id, m]))
    await loadCheckedIn(cls.id, memberMap)
  }

  const activeClassType = selectedClass?.class_type ?? manualClassType
  const activeClassId   = selectedClass?.id ?? null

  const filtered = search
    ? members.filter(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase()))
    : members

  async function checkIn(member: Member) {
    if (checkedIn.has(member.id) || checkingId === member.id) return
    setCheckingId(member.id)
    const supabase = createClient()
    await (supabase as any).from('attendance').insert({
      member_id: member.id,
      gym_id: gymId,
      class_type: activeClassType,
      ...(activeClassId ? { class_id: activeClassId } : {}),
    })
    const entry: CheckedInEntry = {
      member_id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      belt: member.belt, stripes: member.stripes,
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    }
    setCheckedIn(prev => new Map(prev).set(member.id, entry))
    setTotalToday(n => n + 1)
    setFlash({ name: `${member.first_name} ${member.last_name}`, belt: member.belt, stripes: member.stripes })
    setTimeout(() => setFlash(null), 2500)
    setSearch('')
    setCheckingId(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function startScanner() {
    setScanMode(true); setScanError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        const scan = async () => {
          if (!videoRef.current || !streamRef.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) { await handleQRResult(barcodes[0].rawValue); return }
          } catch {}
          if (streamRef.current) requestAnimationFrame(scan)
        }
        requestAnimationFrame(scan)
      }
    } catch {
      setScanError('Kamera konnte nicht geöffnet werden.')
      setScanMode(false)
    }
  }

  function stopScanner() {
    setScanMode(false)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function handleQRResult(url: string) {
    const match = url.match(/\/portal\/([a-zA-Z0-9_-]+)/)
    if (!match) { setScanError('Ungültiger QR-Code.'); return }
    stopScanner()
    const supabase = createClient()
    const { data: member } = await (supabase.from('members') as any)
      .select('id, first_name, last_name, belt, stripes')
      .eq('portal_token', match[1]).single()
    if (!member) { setScanError('Mitglied nicht gefunden.'); return }
    if (checkedIn.has(member.id)) {
      setAlreadyName(`${member.first_name} ${member.last_name}`)
      setTimeout(() => setAlreadyName(null), 3000)
      return
    }
    await checkIn(member as Member)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-zinc-50 text-zinc-400 text-sm">Lädt…</div>
  )

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">

      {/* ── Header ── */}
      <div className="bg-white border-b border-zinc-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] flex-shrink-0">
        <div className="flex items-center justify-between px-5 py-3.5">
          <Link href="/dashboard/attendance"
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors">
            <ArrowLeft size={14} /> Zurück
          </Link>
          <div className="text-center">
            <p className="text-zinc-950 font-black tracking-tight text-lg leading-none">Check-in</p>
            <p className="text-zinc-400 text-xs mt-0.5">
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={scanMode ? stopScanner : startScanner}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm ${
                scanMode
                  ? 'bg-amber-500 text-white'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              <QrCode size={14} />
              <span className="hidden sm:inline">{scanMode ? 'Scan aktiv' : 'QR-Scan'}</span>
            </button>
            <div className="text-right min-w-[40px]">
              <p className="text-zinc-950 font-black text-2xl tracking-tight leading-none">{checkedIn.size}</p>
              <p className="text-zinc-400 text-[10px]">
                {activeClassId ? 'diese Klasse' : 'heute'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Event / class selector ── */}
        <div className="px-5 pb-4 pt-0.5">
          {todayClasses.length > 0 ? (
            <>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
                Klasse wählen
              </p>
              <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                {todayClasses.map(cls => {
                  const active = selectedClass?.id === cls.id
                  const now = new Date()
                  const isNow = new Date(cls.starts_at) <= now && new Date(cls.ends_at) >= now
                  return (
                    <button
                      key={cls.id}
                      onClick={() => selectClass(cls)}
                      className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-left transition-all border ${
                        active
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-md'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-black leading-tight ${active ? 'text-white' : 'text-zinc-900'}`}>
                          {cls.title}
                        </span>
                        {isNow && (
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                      </div>
                      <div className={`text-[11px] font-medium mt-0.5 tabular-nums ${active ? 'text-zinc-400' : 'text-zinc-400'}`}>
                        {formatTime(cls.starts_at)} – {formatTime(cls.ends_at)}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">Klasse</p>
              <div className="flex gap-2 flex-wrap">
                {classTypes.map(t => (
                  <button key={t.value} onClick={() => setManualClassType(t.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                      manualClassType === t.value
                        ? 'bg-zinc-950 text-white border-zinc-950'
                        : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Flash: success ── */}
      {flash && (
        <div className="fixed inset-x-0 top-28 flex justify-center z-50 pointer-events-none px-4">
          <div className="bg-emerald-500 text-white rounded-2xl px-8 py-5 shadow-2xl flex flex-col items-center gap-2">
            <CheckCircle2 size={36} />
            <p className="font-black text-2xl tracking-tight">{flash.name}</p>
            <BeltBadge belt={flash.belt as Belt} stripes={flash.stripes} />
            <p className="text-emerald-100 text-sm font-medium mt-0.5">Eingecheckt 🥋</p>
          </div>
        </div>
      )}

      {/* ── Flash: already ── */}
      {alreadyName && (
        <div className="fixed inset-x-0 top-28 flex justify-center z-50 pointer-events-none px-4">
          <div className="bg-amber-500 text-white rounded-2xl px-8 py-5 shadow-2xl flex flex-col items-center gap-2">
            <CheckCircle2 size={36} />
            <p className="font-black text-2xl tracking-tight">{alreadyName}</p>
            <p className="text-amber-100 text-sm font-medium">Bereits eingecheckt ✓</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* ── Left: check-in panel ── */}
        <div className="flex-1 flex flex-col p-5 overflow-auto">

          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name suchen…"
              className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-white border border-zinc-200 text-zinc-900 placeholder-zinc-400 text-base focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 shadow-sm"
            />
            {search && (
              <button onClick={() => { setSearch(''); inputRef.current?.focus() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                <X size={16} />
              </button>
            )}
          </div>

          {/* QR scanner */}
          {scanMode && (
            <div className="relative mb-4">
              <video ref={videoRef}
                className="w-full rounded-2xl border border-zinc-200 shadow-sm"
                style={{ maxHeight: '260px', objectFit: 'cover' }}
                playsInline muted
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-44 h-44 border-4 border-amber-500 rounded-2xl opacity-80" />
              </div>
              {scanError && (
                <div className="mt-2 p-3 bg-red-50 rounded-xl text-red-700 text-sm text-center border border-red-100">{scanError}</div>
              )}
              <button onClick={stopScanner}
                className="mt-3 w-full py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 transition-colors shadow-sm">
                Abbrechen
              </button>
              <div className="mt-3">
                <p className="text-xs text-zinc-400 text-center mb-2">QR-Scan nicht verfügbar?</p>
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  const input = (e.target as HTMLFormElement).querySelector('input') as HTMLInputElement
                  await handleQRResult(`/portal/${input.value}`)
                  input.value = ''
                }} className="flex gap-2">
                  <input
                    placeholder="Portal-Token"
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 text-sm focus:outline-none focus:border-amber-400"
                  />
                  <button type="submit"
                    className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-400 transition-colors">
                    OK
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Member grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(m => {
              const done = checkedIn.has(m.id)
              const checking = checkingId === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => checkIn(m)}
                  disabled={done || checking}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                    done
                      ? 'bg-emerald-50 border-emerald-200 cursor-default'
                      : checking
                      ? 'bg-amber-50 border-amber-300 scale-95'
                      : 'bg-white border-zinc-100 hover:border-amber-400 hover:shadow-md active:scale-95 shadow-sm'
                  }`}
                >
                  {done && (
                    <CheckCircle2 size={14} className="absolute top-2.5 right-2.5 text-emerald-500" />
                  )}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    done ? 'bg-emerald-100' : 'bg-amber-50'
                  }`}>
                    <span className={`font-black text-base ${done ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {m.first_name[0]}{m.last_name[0]}
                    </span>
                  </div>
                  <div className="min-w-0 w-full">
                    <p className={`text-sm font-bold tracking-tight truncate leading-tight ${done ? 'text-emerald-700' : 'text-zinc-900'}`}>
                      {m.first_name}
                    </p>
                    <p className="text-zinc-400 text-xs truncate">{m.last_name}</p>
                  </div>
                  <BeltBadge belt={m.belt as Belt} stripes={m.stripes} />
                  {done && (
                    <p className="text-emerald-600 text-[10px] font-semibold">{checkedIn.get(m.id)?.time}</p>
                  )}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-16 text-zinc-400 text-sm">
                Kein Mitglied gefunden.
              </div>
            )}
          </div>
        </div>

        {/* ── Right: roster ── */}
        <div className="lg:w-72 bg-white border-t lg:border-t-0 lg:border-l border-zinc-100 flex flex-col max-h-64 lg:max-h-full flex-shrink-0">
          <div className="px-4 py-3 border-b border-zinc-100 flex-shrink-0">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
              {activeClassId
                ? `${selectedClass?.title ?? 'Klasse'} · ${checkedIn.size}`
                : `Heute eingecheckt · ${checkedIn.size}`
              }
            </p>
          </div>
          <div className="flex-1 overflow-auto">
            {Array.from(checkedIn.values()).reverse().map(entry => (
              <div key={entry.member_id} className="flex items-center gap-3 px-4 py-3 border-b border-zinc-50 last:border-0">
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-600 text-xs font-black">
                    {entry.name.split(' ').map((n: string) => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-900 text-sm font-semibold truncate">{entry.name}</p>
                  <BeltBadge belt={entry.belt as Belt} stripes={entry.stripes} />
                </div>
                <span className="text-zinc-400 text-xs flex-shrink-0 tabular-nums">{entry.time}</span>
              </div>
            ))}
            {checkedIn.size === 0 && (
              <p className="text-zinc-400 text-sm text-center py-10">Noch niemand eingecheckt.</p>
            )}
          </div>
          {activeClassId && totalToday > checkedIn.size && (
            <div className="px-4 py-2.5 border-t border-zinc-100 flex-shrink-0">
              <p className="text-[10px] text-zinc-400 text-center">
                {totalToday} insgesamt heute im Gym
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
