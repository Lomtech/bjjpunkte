'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { BeltBadge } from '@/components/BeltBadge'
import { resolveBeltSystem } from '@/lib/belt-system'
import type { Belt } from '@/types/database'
import { Share2, Download, ArrowLeft } from 'lucide-react'

interface MemberData {
  member: {
    first_name: string
    last_name: string
    belt: string
    stripes: number
    join_date: string
  }
  gym: { name: string; logo_url?: string | null; belt_system?: unknown; belt_system_enabled?: boolean } | null
}

export default function QrCardPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData]       = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [shared, setShared]   = useState(false)

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [token])

  const qrUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/portal/${token}`
    : `https://bjjpunkte.vercel.app/portal/${token}`

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&color=0f172a&bgcolor=ffffff&margin=16`

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: 'Mein Mitglieds-QR', url: qrUrl })
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } else {
      await navigator.clipboard.writeText(qrUrl)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    }
  }

  async function handleDownload() {
    const res  = await fetch(qrSrc)
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `qr-${token.slice(0, 8)}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!data?.member) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white/50 text-sm">
        Mitglied nicht gefunden
      </div>
    )
  }

  const { member, gym } = data
  const beltSystem = resolveBeltSystem(gym?.belt_system)
  const fullName   = `${member.first_name} ${member.last_name}`
  const memberSince = new Date(member.join_date).getFullYear()

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-10"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2.5rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2.5rem)' }}>

      {/* Back link */}
      <div className="w-full max-w-xs mb-6">
        <Link href={`/portal/${token}`} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors">
          <ArrowLeft size={14} /> Portal
        </Link>
      </div>

      {/* Card */}
      <div className="w-full max-w-xs bg-white rounded-3xl overflow-hidden shadow-2xl">

        {/* Card header */}
        <div className="bg-slate-950 px-6 pt-6 pb-5 flex items-center gap-3">
          {gym?.logo_url ? (
            <Image src={gym.logo_url} alt={gym?.name ?? ''} width={36} height={36}
              className="rounded-full object-cover border border-white/10 shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/10 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{gym?.name ?? 'Gym'}</p>
            <p className="text-white/40 text-xs">Mitgliedskarte</p>
          </div>
          <div className="ml-auto">
            <div className="w-8 h-5 rounded bg-amber-400 opacity-90" />
          </div>
        </div>

        {/* QR code */}
        <div className="px-6 py-6 flex justify-center">
          <div className="bg-white border border-slate-100 rounded-2xl p-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="QR Code" width={200} height={200} className="block rounded-xl" />
          </div>
        </div>

        {/* Member info */}
        <div className="px-6 pb-6 border-t border-slate-100 pt-4">
          <p className="font-bold text-slate-900 text-lg leading-tight">{fullName}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {gym?.belt_system_enabled !== false && (
              <BeltBadge belt={member.belt as Belt} stripes={member.stripes} beltSystem={beltSystem} />
            )}
            <p className="text-slate-400 text-xs">seit {memberSince}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-xs mt-5 flex gap-3">
        <button onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-2xl py-3 transition-colors">
          <Share2 size={15} />
          {shared ? 'Kopiert' : 'Teilen'}
        </button>
        <button onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-2xl py-3 transition-colors">
          <Download size={15} /> QR speichern
        </button>
      </div>

      <p className="text-white/25 text-xs mt-6 text-center max-w-xs">
        Lesezeichen setzen oder zum Home-Screen hinzufügen — dieser Link gehört dir.
      </p>
    </div>
  )
}
