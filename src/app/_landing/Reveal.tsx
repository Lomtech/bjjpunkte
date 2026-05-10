'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Tiny IntersectionObserver-based reveal-on-scroll wrapper. Mirrors the original
 * framer-motion `<Section>` + `fadeUp` variant pattern (opacity + translateY +
 * subtle blur, ~480 ms ease-out, fires once with -80px margin) without dragging
 * framer-motion into the bundle. Children are passed through, so they remain
 * RSC-rendered when the parent is a Server Component.
 *
 * `as` is constrained to a small set of block-level tags used on the landing
 * page; avoids the union-type explosion from a generic `keyof IntrinsicElements`.
 */

type Tag = 'div' | 'section' | 'header' | 'footer' | 'article' | 'aside'

interface RevealProps {
  as?: Tag
  className?: string
  children: React.ReactNode
  /** Margin at which IO fires; matches framer's `margin: '-80px'`. */
  rootMargin?: string
  /** Optional delay (ms) before reveal animation starts. */
  delay?: number
  /** Optional DOM id — used for anchor-targets like `#book-demo`. */
  id?: string
}

export function Reveal({
  as = 'div',
  className = '',
  children,
  rootMargin = '-80px',
  delay = 0,
  id,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (shown) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true)
            io.disconnect()
            break
          }
        }
      },
      { rootMargin, threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin, shown])

  const style: React.CSSProperties = {
    transitionDelay: delay ? `${delay}ms` : undefined,
  }
  const finalClassName = `landing-reveal ${className}`
  const dataReveal = shown ? 'on' : 'off'

  switch (as) {
    case 'section':
      return (
        <section ref={ref as React.RefObject<HTMLElement | null>} id={id} data-reveal={dataReveal} className={finalClassName} style={style}>
          {children}
        </section>
      )
    case 'header':
      return (
        <header ref={ref as React.RefObject<HTMLElement | null>} id={id} data-reveal={dataReveal} className={finalClassName} style={style}>
          {children}
        </header>
      )
    case 'footer':
      return (
        <footer ref={ref as React.RefObject<HTMLElement | null>} id={id} data-reveal={dataReveal} className={finalClassName} style={style}>
          {children}
        </footer>
      )
    case 'article':
      return (
        <article ref={ref as React.RefObject<HTMLElement | null>} id={id} data-reveal={dataReveal} className={finalClassName} style={style}>
          {children}
        </article>
      )
    case 'aside':
      return (
        <aside ref={ref as React.RefObject<HTMLElement | null>} id={id} data-reveal={dataReveal} className={finalClassName} style={style}>
          {children}
        </aside>
      )
    case 'div':
    default:
      return (
        <div ref={ref as React.RefObject<HTMLDivElement | null>} id={id} data-reveal={dataReveal} className={finalClassName} style={style}>
          {children}
        </div>
      )
  }
}
