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
  const isDark = variant === 'dark'
  return (
    <Link href={href} className="flex items-center gap-2.5 group">
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
          isDark
            ? 'bg-amber-400 group-hover:bg-amber-300'
            : 'bg-zinc-900 group-hover:bg-zinc-700'
        }`}
      >
        <LogoMark className={`w-4 h-3 ${isDark ? 'text-zinc-950' : 'text-amber-400'}`} />
      </div>
      <span
        className={`font-black text-lg tracking-tight ${
          isDark ? 'text-white' : 'text-zinc-900'
        }`}
      >
        Osss
      </span>
    </Link>
  )
}
