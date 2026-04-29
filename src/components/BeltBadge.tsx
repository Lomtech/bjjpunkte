import type { Belt } from '@/types/database'

const BELT_COLORS: Record<Belt, string> = {
  white:  'bg-slate-100 text-slate-700 border border-slate-300',
  blue:   'bg-blue-600 text-white',
  purple: 'bg-purple-600 text-white',
  brown:  'bg-amber-900 text-white',
  black:  'bg-slate-900 text-amber-400',
}

const BELT_LABELS: Record<Belt, string> = {
  white: 'Weiss', blue: 'Blau', purple: 'Lila', brown: 'Braun', black: 'Schwarz',
}

export function BeltBadge({ belt, stripes }: { belt: Belt; stripes: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${BELT_COLORS[belt]}`}>
      {BELT_LABELS[belt]}
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
