'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook für „Kopiert!"-Buttons mit Auto-Reset nach N ms.
 *
 * Problem das wir lösen:
 *   `setTimeout(() => setCopied(false), 2000)` ohne Cleanup → wenn die
 *   Komponente vor Ablauf unmounted, wird setState auf einer unmounted
 *   Komponente aufgerufen. React loggt "Cannot update state on unmounted
 *   component" — kein hard crash, aber Memory-Leak + Console-Spam.
 *
 *   Außerdem: wenn der User schnell zweimal klickt, läuft der erste Timer
 *   weiter und resettet zu früh.
 *
 * Lösung:
 *   - timerRef speichert die aktive Timer-ID
 *   - Beim erneuten Klick wird der alte Timer gecleart
 *   - Auf Unmount wird der Timer gecleart
 *
 * Usage:
 *
 *   const [copiedSignup, copySignup] = useCopyFeedback()
 *   ...
 *   <button onClick={() => {
 *     navigator.clipboard.writeText(url)
 *     copySignup()
 *   }}>
 *     {copiedSignup ? 'Kopiert ✓' : 'Link kopieren'}
 *   </button>
 *
 *   Optional: useCopyFeedback({ resetMs: 3000 }) für custom Dauer.
 */
export function useCopyFeedback(opts: { resetMs?: number } = {}): [boolean, () => void] {
  const { resetMs = 2000 } = opts
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setActive(true)
    timerRef.current = setTimeout(() => {
      setActive(false)
      timerRef.current = null
    }, resetMs)
  }, [resetMs])

  return [active, trigger]
}
