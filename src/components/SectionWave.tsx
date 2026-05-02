'use client'

// Animated SVG wave divider between sections.
// fromBg / toBg: Tailwind bg-* class (e.g. 'bg-white', 'bg-zinc-50', 'bg-zinc-900')
// The wave fills `toBg` and sits on top of `fromBg`.

const BG_HEX: Record<string, string> = {
  'bg-white':    '#ffffff',
  'bg-zinc-50':  '#fafafa',
  'bg-zinc-100': '#f4f4f5',
  'bg-zinc-900': '#18181b',
  'bg-zinc-950': '#09090b',
  'bg-amber-500':'#f59e0b',
}

interface Props {
  fromBg: string   // tailwind class of the section above
  toBg:   string   // tailwind class of the section below
  flip?:  boolean  // mirror vertically for variety
  height?: number  // wave height px, default 72
}

export function SectionWave({ fromBg, toBg, flip = false, height = 72 }: Props) {
  const fill = BG_HEX[toBg] ?? '#ffffff'
  const bg   = fromBg

  return (
    <div className={`relative w-full overflow-hidden ${bg}`} style={{ height }}>
      {/* animated layer 1 (slower) */}
      <svg
        className="absolute top-0 left-0 w-[200%] h-full"
        viewBox="0 0 2880 72"
        preserveAspectRatio="none"
        style={{
          animation: 'waveSlide 18s linear infinite',
          opacity: 0.4,
        }}
      >
        <path
          d={flip
            ? 'M0,72 L0,36 C360,0 720,72 1080,36 C1440,0 1800,72 2160,36 C2520,0 2740,52 2880,36 L2880,72 Z'
            : 'M0,0 L0,36 C360,72 720,0 1080,36 C1440,72 1800,0 2160,36 C2520,72 2740,20 2880,36 L2880,0 Z'
          }
          fill={fill}
        />
      </svg>

      {/* animated layer 2 (faster, offset) */}
      <svg
        className="absolute top-0 left-0 w-[200%] h-full"
        viewBox="0 0 2880 72"
        preserveAspectRatio="none"
        style={{
          animation: 'waveSlide 12s linear infinite reverse',
          opacity: 0.6,
        }}
      >
        <path
          d={flip
            ? 'M0,72 L0,48 C480,12 960,72 1440,48 C1920,12 2400,64 2880,48 L2880,72 Z'
            : 'M0,0 L0,24 C480,60 960,0 1440,24 C1920,60 2400,8 2880,24 L2880,0 Z'
          }
          fill={fill}
        />
      </svg>

      {/* solid bottom strip to fill cleanly into next section */}
      <div className="absolute bottom-0 left-0 w-full h-4" style={{ background: fill }} />

      <style>{`
        @keyframes waveSlide {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
