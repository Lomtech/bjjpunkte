'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'
import Link from 'next/link'
import { ArrowLeft, Search, CheckCircle2, X, QrCode } from 'lucide-react'

interface Member { id: string; first_name: string; last_name: string; belt: string; stripes: number }

interface CheckedInEntry {
  member_id: string
  name: string
  belt: string
  stripes: number
  time: string
}

const DEFAULT_CLASS_TYPES = [
  { value: 'gi', label: 'Gi' },
  { value: 'no-gi', label: 'No-Gi' },
  { value: 'open mat', label: 'Open Mat' },
  { value: 'kids', label: 'Kids' },
  { value: 'competition', label: 'Competition' },
]

export default function KioskPage() {
  const [loading, setLoading]     = useState(true)
  const [gymId, setGymId]         = useState('')
  const [members, setMembers]     = useState<Member[]>([])
  const [search, setSearch]       = useState('')
  const [classTypes, setClassTypes] = useState(DEFAULT_CLASS_TYPES)
  const [classType, setClassType] = useState('gi')
  const [checkedIn, setCheckedIn] = useState<Map<string, CheckedInEntry>>(new Map())
  const [flash, setFlash]         = useState<{ name: string; belt: string; stripes: number } | null>(null)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [scanMode, setScanMode]   = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanResult, setScanResult] = useState<{ type: 'already'; name: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: gym } = await (supabase.from('gyms') as any).select('id, class_types').single()
      if (!gym) { setLoading(false); return }
      setGymId(gym.id)
      const rawTypes = (gym as any)?.class_types
      if (Array.isArray(rawTypes) && rawTypes.length > 0) {
        setClassTypes(rawTypes.map((v: string) => ({
          value: v,
          label: v.charAt(0).toUpperCase() + v.slice(1),
        })))
        setClassType(rawTypes[0])
      }
      const today = new Date().toISOString().split('T')[0]
      // Load members and already-checked-in for today
      const [membersRes, todayRes] = await Promise.all([
        supabase.from('members').select('id, first_name, last_name, belt, stripes')
          .eq('gym_id', gym.id).eq('is_active', true).order('last_name'),
        supabase.from('attendance').select('member_id, checked_in_at, class_type')
          .eq('gym_id', gym.id).gte('checked_in_at', today),
      ])
      setMembers((membersRes.data as Member[]) ?? [])
      // Pre-populate checkedIn
      const todayMap = new Map<string, CheckedInEntry>()
      const memberMap = new Map((membersRes.data ?? []).map((m: Member) => [m.id, m]))
      for (const a of (todayRes.data ?? []) as { member_id: string; checked_in_at: string; class_type: string }[]) {
        const m = memberMap.get(a.member_id)
        if (m) todayMap.set(a.member_id, {
          member_id: a.member_id,
          name: `${m.first_name} ${m.last_name}`,
          belt: m.belt, stripes: m.stripes,
          time: new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        })
      }
      setCheckedIn(todayMap)
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 200)
    }
    load()
  }, [])

  const filtered = members.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${m.first_name} ${m.last_name}`.toLowerCase().includes(q)
  })

  async function startScanner() {
    setScanMode(true)
    setScanError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        const scan = async () => {
          if (!videoRef.current || !streamRef.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              const url = barcodes[0].rawValue
              await handleQRResult(url)
              return
            }
          } catch {}
          if (streamRef.current) requestAnimationFrame(scan)
        }
        requestAnimationFrame(scan)
      }
    } catch {
      setScanError('Kamera konnte nicht geöffnet werden. Bitte Kamerazugriff erlauben.')
      setScanMode(false)
    }
  }

  function stopScanner() {
    setScanMode(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  async function handleQRResult(url: string) {
    const match = url.match(/\/portal\/([a-zA-Z0-9_-]+)/)
    if (!match) {
      setScanError('Ungültiger QR-Code. Bitte Osss-QR-Code verwenden.')
      return
    }
    const portalToken = match[1]
    stopScanner()

    const supabase = createClient()
    const { data: member } = await (supabase.from('members') as any)
      .select('id, first_name, last_name, belt, stripes')
      .eq('portal_token', portalToken)
      .single()

    if (!member) {
      setScanError('Mitglied nicht gefunden.')
      return
    }

    // Duplikat-Check: bereits heute eingecheckt?
    const today = new Date().toISOString().split('T')[0]
    const { data: existingToday } = await supabase
      .from('attendance')
      .select('id')
      .eq('member_id', member.id)
      .eq('gym_id', gymId)
      .gte('checked_in_at', today)
      .limit(1)

    if (existingToday && existingToday.length > 0) {
      setScanResult({ type: 'already', name: `${member.first_name} ${member.last_name}` })
      setTimeout(() => setScanResult(null), 3000)
      return
    }

    await (supabase.from('attendance') as any).insert({
      member_id: member.id,
      gym_id: gymId,
      class_type: classType,
    })

    setFlash({ name: `${member.first_name} ${member.last_name}`, belt: member.belt, stripes: member.stripes })
    setTimeout(() => setFlash(null), 3000)

    const { data: todayData } = await supabase.from('attendance')
      .select('member_id, checked_in_at, class_type')
      .eq('gym_id', gymId)
      .gte('checked_in_at', today)
    const memberMap = new Map(members.map(m => [m.id, m]))
    const newMap = new Map(checkedIn)
    for (const a of (todayData ?? []) as any[]) {
      const m = memberMap.get(a.member_id)
      if (m && !newMap.has(a.member_id)) {
        newMap.set(a.member_id, {
          member_id: a.member_id,
          name: `${m.first_name} ${m.last_name}`,
          belt: m.belt,
          stripes: m.stripes,
          time: new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        })
      }
    }
    setCheckedIn(newMap)
  }

  async function checkIn(member: Member) {
    if (checkedIn.has(member.id) || checkingId === member.id) return
    setCheckingId(member.id)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('attendance').insert({
      member_id: member.id, gym_id: gymId,
      class_type: classType,
    })
    const entry: CheckedInEntry = {
      member_id: member.id,
      name: `${member.first_name} ${member.last_name}`,
      belt: member.belt, stripes: member.stripes,
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    }
    setCheckedIn(prev => new Map(prev).set(member.id, entry))
    setFlash({ name: `${member.first_name} ${member.last_name}`, belt: member.belt, stripes: member.stripes })
    setTimeout(() => setFlash(null), 2500)
    setSearch('')
    setCheckingId(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0f172a] text-slate-400 text-sm">Lädt…</div>
  )

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <Link href="/dashboard/attendance" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <div className="text-center">
          <p className="text-white font-bold text-lg italic">Osss</p>
          <p className="text-slate-400 text-xs">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={scanMode ? stopScanner : startScanner}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              scanMode ? 'bg-amber-500 text-white' : 'bg-white/10 border border-white/20 text-slate-300 hover:bg-white/20'
            }`}
          >
            <QrCode size={15} />
            {scanMode ? 'Scan läuft…' : 'QR-Scan'}
          </button>
          <div className="text-right">
            <p className="text-amber-400 font-bold text-2xl">{checkedIn.size}</p>
            <p className="text-slate-400 text-xs">Heute</p>
          </div>
        </div>
      </div>

      {/* Flash success */}
      {flash && (
        <div className="absolute inset-x-0 top-20 flex justify-center z-50 pointer-events-none px-4">
          <div className="bg-green-500 text-white rounded-2xl px-8 py-5 shadow-2xl flex flex-col items-center gap-2 animate-bounce-once">
            <CheckCircle2 size={32} />
            <p className="font-bold text-xl">{flash.name}</p>
            <BeltBadge belt={flash.belt as Belt} stripes={flash.stripes} />
            <p className="text-green-100 text-sm">Eingecheckt! 🥋</p>
          </div>
        </div>
      )}

      {/* Flash already checked in */}
      {scanResult?.type === 'already' && (
        <div className="absolute inset-x-0 top-20 flex justify-center z-50 pointer-events-none px-4">
          <div className="bg-amber-500 text-white rounded-2xl px-8 py-5 shadow-2xl flex flex-col items-center gap-2">
            <CheckCircle2 size={32} />
            <p className="font-bold text-xl">{scanResult.name}</p>
            <p className="text-amber-100 text-sm">Bereits heute eingecheckt ✓</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* Left: check-in panel */}
        <div className="flex-1 flex flex-col p-5">
          {/* Class type selector */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {classTypes.map(t => (
              <button key={t.value} onClick={() => setClassType(t.value)}
                className={`px-4 py-2 min-h-[44px] rounded-full text-sm font-semibold transition-colors ${
                  classType === t.value
                    ? 'bg-amber-500 text-white'
                    : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name eingeben oder tippen…"
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-slate-400 text-lg focus:outline-none focus:border-amber-500 focus:bg-white/15"
            />
            {search && (
              <button onClick={() => { setSearch(''); inputRef.current?.focus() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            )}
          </div>

          {/* QR-Scan Mode */}
          {scanMode && (
            <div className="relative mb-4">
              <video
                ref={videoRef}
                className="w-full rounded-2xl"
                style={{ maxHeight: '300px', objectFit: 'cover' }}
                playsInline
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-4 border-amber-400 rounded-2xl opacity-80" />
              </div>
              {scanError && (
                <div className="mt-2 p-3 bg-red-50 rounded-xl text-red-700 text-sm text-center">{scanError}</div>
              )}
              <button
                onClick={stopScanner}
                className="mt-3 w-full py-2 rounded-xl bg-white/10 text-slate-300 text-sm font-medium hover:bg-white/20 transition-colors"
              >
                Abbrechen
              </button>
              <div className="mt-3">
                <p className="text-xs text-slate-400 text-center mb-2">QR-Scan nicht verfügbar?</p>
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  const input = (e.target as HTMLFormElement).querySelector('input') as HTMLInputElement
                  await handleQRResult(`/portal/${input.value}`)
                  input.value = ''
                }} className="flex gap-2">
                  <input
                    placeholder="Portal-Token eingeben"
                    className="flex-1 px-3 py-2 rounded-xl border border-white/20 bg-white/10 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-400 transition-colors">OK</button>
                </form>
              </div>
            </div>
          )}

          {/* Member grid */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(m => {
                const done = checkedIn.has(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => checkIn(m)}
                    disabled={done || checkingId === m.id}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center ${
                      done
                        ? 'bg-green-500/20 border-green-500/50 opacity-70'
                        : checkingId === m.id
                        ? 'bg-amber-500/20 border-amber-500 scale-95'
                        : 'bg-white/5 border-white/10 hover:bg-white/15 hover:border-amber-500/50 active:scale-95'
                    }`}
                  >
                    {done && (
                      <CheckCircle2 size={16} className="absolute top-2 right-2 text-green-400" />
                    )}
                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <span className="text-amber-400 font-bold text-lg">{m.first_name[0]}{m.last_name[0]}</span>
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-white text-sm font-semibold truncate">{m.first_name}</p>
                      <p className="text-slate-300 text-xs truncate">{m.last_name}</p>
                    </div>
                    <BeltBadge belt={m.belt as Belt} stripes={m.stripes} />
                    {done && (
                      <p className="text-green-400 text-[10px] font-semibold">{checkedIn.get(m.id)?.time}</p>
                    )}
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 text-sm">
                  Kein Mitglied gefunden.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: today's roster */}
        <div className="lg:w-72 bg-white/5 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col max-h-72 lg:max-h-full">
          <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Heute eingecheckt · {checkedIn.size}
            </p>
          </div>
          <div className="flex-1 overflow-auto">
            {Array.from(checkedIn.values()).reverse().map(entry => (
              <div key={entry.member_id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-400 text-xs font-bold">
                    {entry.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{entry.name}</p>
                  <BeltBadge belt={entry.belt as Belt} stripes={entry.stripes} />
                </div>
                <span className="text-slate-400 text-xs flex-shrink-0">{entry.time}</span>
              </div>
            ))}
            {checkedIn.size === 0 && (
              <p className="text-slate-500 text-sm text-center py-8">Noch niemand da.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
