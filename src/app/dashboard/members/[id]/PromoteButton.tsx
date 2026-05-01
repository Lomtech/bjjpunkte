'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BeltBadge } from '@/components/BeltBadge'
import { ArrowRight, Award } from 'lucide-react'
import type { Belt } from '@/types/database'
import type { BeltSystem } from '@/lib/belt-system'
import { DEFAULT_BELT_SYSTEM, getBeltSlot } from '@/lib/belt-system'

const BELT_KEYS: Belt[] = ['white', 'blue', 'purple', 'brown', 'black']

export function PromoteButton({
  memberId, gymId, currentBelt, currentStripes, onPromoted, beltSystem,
}: {
  memberId: string; gymId: string; currentBelt: Belt; currentStripes: number
  onPromoted?: (belt: Belt, stripes: number) => void
  beltSystem?: BeltSystem
}) {
  const system = beltSystem ?? DEFAULT_BELT_SYSTEM
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function nextPromotion(): { belt: Belt; stripes: number } {
    if (currentStripes < 4) return { belt: currentBelt, stripes: currentStripes + 1 }
    const nextIdx = BELT_KEYS.indexOf(currentBelt) + 1
    if (nextIdx >= BELT_KEYS.length) return { belt: currentBelt, stripes: currentStripes }
    return { belt: BELT_KEYS[nextIdx], stripes: 0 }
  }

  const next = nextPromotion()
  const isMax = currentBelt === 'black' && currentStripes === 4
  const isBeltChange = next.belt !== currentBelt

  async function promote() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('belt_promotions').insert({
      member_id: memberId, gym_id: gymId,
      previous_belt: currentBelt, previous_stripes: currentStripes,
      new_belt: next.belt, new_stripes: next.stripes,
    })
    await supabase.from('members').update({ belt: next.belt, stripes: next.stripes }).eq('id', memberId)
    setSuccess(true)
    setLoading(false)
    setTimeout(() => {
      setSuccess(false)
      onPromoted?.(next.belt, next.stripes)
    }, 1200)
  }

  if (isMax) {
    return <p className="text-slate-400 text-sm">{getBeltSlot(system, 'black').label} Belt, 4 Stripes – maximales Level erreicht.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Aktuell</p>
          <BeltBadge belt={currentBelt} stripes={currentStripes} beltSystem={system} />
        </div>
        <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {isBeltChange ? 'Aufsteigen zu' : 'Nächste Stufe'}
          </p>
          <BeltBadge belt={next.belt} stripes={next.stripes} beltSystem={system} />
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
