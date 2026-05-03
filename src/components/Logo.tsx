import Link from 'next/link'

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 14" fill="currentColor" className={className} aria-hidden="true">
      <rect x="0" y="0"    width="18" height="2.8" rx="1.4" />
      <rect x="0" y="5.6"  width="12" height="2.8" rx="1.4" />
      <rect x="0" y="11.2" width="6"  height="2.8" rx="1.4" />
    </svg>
  )
}

export function OsssLogo({
  variant = 'dark',
  href = '/',
}: {
  variant?: 'dark' | 'light'
  href?: string
}) {
  // amber square everywhere — text adapts to background
  const textClass = variant === 'light' ? 'text-white' : 'text-zinc-900'
  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      <div className="w-8 h-8 rounded-xl bg-amber-400 group-hover:bg-amber-300 flex items-center justify-center transition-colors flex-shrink-0">
        <LogoMark className="w-4 h-3 text-zinc-950" />
      </div>
      <span className={`font-black text-lg tracking-tight ${textClass}`}>
        Osss
      </span>
    </Link>
  )
}
