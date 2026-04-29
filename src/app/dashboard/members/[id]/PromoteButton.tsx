'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'

const BELTS: Belt[] = ['white', 'blue', 'purple', 'brown', 'black']
const BELT_LABELS: Record<Belt, string> = { white: 'Weiss', blue: 'Blau', purple: 'Lila', brown: 'Braun', black: 'Schwarz' }

export function PromoteButton({ memberId, gymId, currentBelt, currentStripes }: {
  memberId: string; gymId: string; currentBelt: Belt; currentStripes: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function nextPromotion(): { belt: Belt; stripes: number } {
    if (currentStripes < 4) return { belt: currentBelt, stripes: currentStripes + 1 }
    const nextIdx = BELTS.indexOf(currentBelt) + 1
    if (nextIdx >= BELTS.length) return { belt: currentBelt, stripes: currentStripes }
    return { belt: BELTS[nextIdx], stripes: 0 }
  }

  const next = nextPromotion()
  const isMax = currentBelt === 'black' && currentStripes === 4

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
    setTimeout(() => { setSuccess(false); router.refresh() }, 1500)
  }

  if (isMax) return <p className="text-slate-400 text-sm">Schwarz Belt 4 Stripes – maximales Level erreicht.</p>

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-sm">
        <BeltBadge belt={currentBelt} stripes={currentStripes} />
        <span className="text-slate-400">→</span>
        <BeltBadge belt={next.belt} stripes={next.stripes} />
      </div>
      <button
        onClick={promote}
        disabled={loading || success}
        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
          success
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-500 hover:bg-amber-400 text-white shadow-sm disabled:opacity-60'
        }`}
      >
        {success ? '✓ Promoted!' : loading ? 'Wird gespeichert...' : next.stripes === 0 ? `Zu ${BELT_LABELS[next.belt]} Belt` : 'Stripe hinzufügen'}
      </button>
    </div>
  )
}
