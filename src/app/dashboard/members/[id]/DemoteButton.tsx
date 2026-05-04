'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BeltBadge } from '@/components/BeltBadge'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import type { BeltSystem } from '@/lib/belt-system'
import { DEFAULT_BELT_SYSTEM, getBeltSlot } from '@/lib/belt-system'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export function DemoteButton({
  memberId, gymId, currentBelt, currentStripes, onDemoted, beltSystem, stripesEnabled = true,
}: {
  memberId: string; gymId: string; currentBelt: string; currentStripes: number
  onDemoted?: (belt: string, stripes: number) => void
  beltSystem?: BeltSystem
  stripesEnabled?: boolean
}) {
  const system = beltSystem ?? DEFAULT_BELT_SYSTEM
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const currentIdx = system.findIndex(s => s.key === currentBelt)

  function prevPromotion(): { belt: string; stripes: number } | null {
    if (stripesEnabled) {
      if (currentIdx === 0 && currentStripes === 0) return null
      if (currentStripes > 0) return { belt: currentBelt, stripes: currentStripes - 1 }
      const prevIdx = currentIdx - 1
      if (prevIdx < 0) return null
      return { belt: system[prevIdx].key, stripes: 4 }
    } else {
      if (currentIdx === 0) return null
      const prevIdx = currentIdx - 1
      return { belt: system[prevIdx].key, stripes: 0 }
    }
  }

  const prev = prevPromotion()
  const isMin = prev === null
  const isBeltChange = prev !== null && prev.belt !== currentBelt

  async function demote() {
    if (!prev) return
    setLoading(true)
    const supabase = createClient()
    await (supabase.from('belt_promotions') as any).insert({
      member_id: memberId, gym_id: gymId,
      previous_belt: currentBelt, previous_stripes: currentStripes,
      new_belt: prev.belt, new_stripes: prev.stripes,
    })
    await (supabase.from('members') as any).update({ belt: prev.belt, stripes: prev.stripes }).eq('id', memberId)
    setSuccess(true)
    setLoading(false)
    setOpen(false)
    setTimeout(() => {
      setSuccess(false)
      onDemoted?.(prev.belt, prev.stripes)
    }, 1200)
  }

  if (isMin) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200"
      >
        <ChevronDown size={14} />
        {t('promotion', 'demoteBtn')}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-white rounded-xl border border-slate-200 shadow-lg p-4 w-72">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{t('promotion', 'confirmDemote')}</p>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">{t('promotion', 'current')}</p>
              <BeltBadge belt={currentBelt} stripes={stripesEnabled ? currentStripes : 0} beltSystem={system} />
            </div>
            <ArrowLeft size={16} className="text-slate-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {isBeltChange ? t('promotion', 'backTo') : t('promotion', 'newLevel')}
              </p>
              <BeltBadge belt={prev.belt} stripes={stripesEnabled ? prev.stripes : 0} beltSystem={system} />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              {t('promotion', 'cancel')}
            </button>
            <button
              onClick={demote}
              disabled={loading || success}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                success
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
              }`}
            >
              <ChevronDown size={14} />
              {success ? t('promotion', 'demoteSaved') : loading ? t('promotion', 'demoteSaving') :
                isBeltChange ? t('promotion', 'demoteTo', { belt: getBeltSlot(system, prev.belt).label }) : t('promotion', 'removeStripe')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
