/**
 * Osss-Brand-Marks — re-exports + erweiterte Variationen.
 *
 * Source-of-Truth bleibt @/components/Logo.tsx (alte Imports laufen weiter).
 * Diese Datei aggregiert + ergänzt um spezialisierte Variationen für
 * verschiedene UI-Kontexte (Avatar, Favicon, Marketing-Tile).
 *
 * Brand-Konstanten:
 *   - Background: amber-400 (#FBBF24, Tailwind class amber-400)
 *   - Stripes:    zinc-950 (#09090B)
 *   - Stripe-Aspect: 18:14 (Belt-Stripes-Inspiration aus BJJ)
 *   - Border-Radius: rounded-xl auf Containers, rounded-1.4u auf Stripes
 */

import Link from 'next/link'

// Re-exports — backwards-compat für alle bestehenden Imports
export { LogoMark, OsssLogo } from '@/components/Logo'

/**
 * Amber-Square mit Stripes (ohne Wordmark + ohne Link).
 * Use-Cases: Avatar in Cards, Empty-State-Hero, Email-Header-Brand.
 */
export function OsssMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-xl bg-amber-400 flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <svg viewBox="0 0 18 14" fill="currentColor" className="text-zinc-950" style={{ width: size * 0.5, height: size * 0.375 }} aria-hidden="true">
        <rect x="0" y="0"    width="18" height="2.8" rx="1.4" />
        <rect x="0" y="5.6"  width="12" height="2.8" rx="1.4" />
        <rect x="0" y="11.2" width="6"  height="2.8" rx="1.4" />
      </svg>
    </div>
  )
}

/**
 * Inverse Variante — zinc-Square mit amber-Stripes.
 * Use-Case: dunkle Sektionen wo amber zu grell wäre.
 */
export function OsssMarkInverse({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-xl bg-zinc-950 flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <svg viewBox="0 0 18 14" fill="currentColor" className="text-amber-400" style={{ width: size * 0.5, height: size * 0.375 }} aria-hidden="true">
        <rect x="0" y="0"    width="18" height="2.8" rx="1.4" />
        <rect x="0" y="5.6"  width="12" height="2.8" rx="1.4" />
        <rect x="0" y="11.2" width="6"  height="2.8" rx="1.4" />
      </svg>
    </div>
  )
}

/**
 * Wordmark-only — kein Mark, nur Text. Use für Footer-/Compliance-Stellen
 * wo das Mark zu visuell laut wäre.
 */
export function OsssWordmark({
  variant = 'dark',
  size = 'md',
  className = '',
  href,
}: {
  variant?: 'dark' | 'light'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  href?: string
}) {
  const sizeClass = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg'
  const colorClass = variant === 'light' ? 'text-white' : 'text-zinc-900'
  const inner = (
    <span className={`font-black tracking-tight ${sizeClass} ${colorClass} ${className}`}>
      Osss
    </span>
  )
  return href ? <Link href={href} className="inline-block">{inner}</Link> : inner
}

/**
 * Avatar-Sized Mark mit User-Initialen — Fallback für fehlende Profile-Photos.
 * Beispiel: <OsssAvatarFallback initials="LI" size={48} />
 */
export function OsssAvatarFallback({
  initials,
  size = 40,
  className = '',
}: {
  initials: string
  size?: number
  className?: string
}) {
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`rounded-full bg-amber-400 text-zinc-950 font-black flex items-center justify-center flex-shrink-0 ${className}`}
    >
      {initials.slice(0, 2).toUpperCase()}
    </div>
  )
}

/**
 * Brand-Constants — wenn du SVGs/PDFs/E-Mails-Templates exportierst, nutze
 * diese Werte statt hardcoded Hex.
 *
 * Hinweis: bei Tailwind-Class-Generation reicht meist amber-400 / zinc-950 —
 * diese Konstanten sind für Server-side rendering von SVG/PDF/Email-HTML wo
 * Tailwind nicht verfügbar ist.
 */
export const BRAND = {
  amber:  '#FBBF24', // Tailwind amber-400
  zinc:   '#09090B', // Tailwind zinc-950
  white:  '#FFFFFF',
  // Stripes-Geometrie (für SVG-Generierung außerhalb React)
  stripeAspect: { wTop: 18, wMid: 12, wBottom: 6, height: 2.8, gap: 2.8, radius: 1.4 },
} as const
