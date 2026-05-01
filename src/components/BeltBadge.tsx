import type { Belt } from '@/types/database'
import type { BeltSystem } from '@/lib/belt-system'
import { DEFAULT_BELT_SYSTEM, getBeltSlot } from '@/lib/belt-system'

export function BeltBadge({
  belt, stripes, beltSystem,
}: {
  belt: Belt
  stripes: number
  beltSystem?: BeltSystem
}) {
  const slot = getBeltSlot(beltSystem ?? DEFAULT_BELT_SYSTEM, belt)
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: slot.bg, color: slot.text }}
    >
      {slot.label}
      {stripes > 0 && (
        <span className="flex gap-0.5">
          {Array.from({ length: stripes }).map((_, i) => (
            <span key={i} className="w-1 h-3 bg-current opacity-60 rounded-sm" />
          ))}
        </span>
      )}
    </span>
  )
}
