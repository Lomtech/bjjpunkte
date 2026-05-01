'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BeltBadge } from '@/components/BeltBadge'
import { ArrowRight, Award } from 'lucide-react'
import type { Belt } from '@/types/database'

const BELTS: Belt[] = ['white', 'blue', 'purple', 'brown', 'black']
const BELT_LABELS: Record<Belt, string> = {
  white: 'Weiss', blue: 'Blau', purple: 'Lila', brown: 'Braun', black: 'Schwarz',
}

export function PromoteButton({
  memberId, gymId, currentBelt, currentStripes, onPromoted,
}: {
  memberId: string; gymId: string; currentBelt: Belt; currentStripes: number
  onPromoted?: (belt: Belt, stripes: number) => void
}) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function nextPromotion(): { belt: Belt; stripes: number } {
    if (currentStripes < 4) return { belt: currentBelt, stripes: currentStripes + 1 }
    const nextIdx = BELTS.indexOf(currentBelt) + 1
    if (nextIdx >= BELTS.length) return { belt: currentBelt, stripes: currentStripes }
    return { belt: BELTS[nextIdx], stripes: 0 }
  }

  const next    = nextPromotion()
  const isMax   = currentBelt === 'black' && currentStripes === 4
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
    return (
      <p className="text-slate-400 text-sm">Schwarz Belt, 4 Stripes – maximales Level erreicht.</p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Visual preview */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Aktuell</p>
          <BeltBadge belt={currentBelt} stripes={currentStripes} />
        </div>
        <ArrowRight size={16} className="text-slate-300 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            {isBeltChange ? 'Aufsteigen zu' : 'Nächste Stufe'}
          </p>
          <BeltBadge belt={next.belt} stripes={next.stripes} />
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
              ? `Aufsteigen zu ${BELT_LABELS[next.belt]} Belt`
              : 'Streifen vergeben'}
      </button>
    </div>
  )
}
