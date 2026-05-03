'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BeltBadge } from '@/components/BeltBadge'
import { ArrowRight, Award } from 'lucide-react'
import type { BeltSystem } from '@/lib/belt-system'
import { DEFAULT_BELT_SYSTEM, getBeltSlot } from '@/lib/belt-system'

export function PromoteButton({
  memberId, gymId, currentBelt, currentStripes, onPromoted, beltSystem, stripesEnabled = true,
}: {
  memberId: string; gymId: string; currentBelt: string; currentStripes: number
  onPromoted?: (belt: string, stripes: number) => void
  beltSystem?: BeltSystem
  stripesEnabled?: boolean
}) {
  const system = beltSystem ?? DEFAULT_BELT_SYSTEM
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const currentIdx = system.findIndex(s => s.key === currentBelt)
  // When stripes disabled: max = last belt (no stripe concept)
  const isMax = stripesEnabled
    ? currentIdx === system.length - 1 && currentStripes === 4
    : currentIdx === system.length - 1

  function nextPromotion(): { belt: string; stripes: number } {
    if (stripesEnabled) {
      if (currentStripes < 4) return { belt: currentBelt, stripes: currentStripes + 1 }
      const nextIdx = currentIdx + 1
      if (nextIdx >= system.length) return { belt: currentBelt, stripes: currentStripes }
      return { belt: system[nextIdx].key, stripes: 0 }
    } else {
      // Without stripes: only belt changes
      const nextIdx = currentIdx + 1
      if (nextIdx >= system.length) return { belt: currentBelt, stripes: 0 }
      return { belt: system[nextIdx].key, stripes: 0 }
    }
  }

  const next = nextPromotion()
  const isBeltChange = next.belt !== currentBelt

  async function promote() {
    setLoading(true)
    const supabase = createClient()
    await (supabase.from('belt_promotions') as any).insert({
      member_id: memberId, gym_id: gymId,
      previous_belt: currentBelt, previous_stripes: currentStripes,
      new_belt: next.belt, new_stripes: next.stripes,
    })
    await (supabase.from('members') as any).update({ belt: next.belt, stripes: next.stripes }).eq('id', memberId)
    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      setSuccess(false)
      onPromoted?.(next.belt, next.stripes)
    }, 1200)
  }

  if (isMax) {
    const maxLabel = stripesEnabled
      ? `${getBeltSlot(system, currentBelt).label} Belt, 4 Stripes – maximales Level erreicht.`
      : `${getBeltSlot(system, currentBelt).label} Belt – maximales Level erreicht.`
    return <p className="text-slate-400 text-sm">{maxLabel}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Aktuell</p>
          <BeltBadge belt={currentBelt} stripes={stripesEnabled ? currentStripes : 0} beltSystem={system} />
        </div>
        <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {isBeltChange ? 'Aufsteigen zu' : 'Nächste Stufe'}
          </p>
          <BeltBadge belt={next.belt} stripes={stripesEnabled ? next.stripes : 0} beltSystem={system} />
        </div>
      </div>

      <button
        onClick={promote}
        disabled={loading || success}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 ${
          success
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-600 hover:bg-amber-500 text-white'
        }`}
      >
        <Award size={15} />
        {success
          ? 'Graduierung gespeichert'
          : loading
            ? 'Wird gespeichert…'
            : isBeltChange
              ? `Aufsteigen zu ${getBeltSlot(system, next.belt).label} Belt`
              : 'Streifen vergeben'}
      </button>
    </div>
  )
}
