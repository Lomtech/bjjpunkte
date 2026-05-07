'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Cookielose, DSGVO-anonyme Page-View-Tracker.
 *
 * Sendet bei jedem Page-Load + Route-Change einen Beacon an /api/track.
 * Nutzt navigator.sendBeacon für reliable tracking auch bei page-unload.
 *
 * Was NICHT passiert:
 *  - Keine Cookies werden gesetzt
 *  - KEINE LocalStorage-Werte
 *  - KEIN Browser-Fingerprint
 *  - KEINE IP-Speicherung server-side
 *
 * Komponente einfach in src/app/layout.tsx einbinden.
 */
export function TrackPageView() {
  const pathname = usePathname()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return

    // Innerhalb der gleichen Pfad-URL nicht doppelt tracken (z.B. bei
    // Re-Renders durch State-Änderungen oder ?lang=… Toggle)
    const trackedPath = pathname
    if (lastPath.current === trackedPath) return
    lastPath.current = trackedPath

    // Pfade ausschließen, die der Server eh nicht trackt
    if (
      trackedPath.startsWith('/api/') ||
      trackedPath.startsWith('/dashboard/') ||
      trackedPath.startsWith('/admin/') ||
      trackedPath.startsWith('/auth/') ||
      trackedPath.startsWith('/portal/') ||
      trackedPath.startsWith('/signup/') ||
      trackedPath.startsWith('/staff/') ||
      trackedPath === '/dashboard'
    ) {
      return
    }

    // Owner/Admin-Filter: wer je auf /admin/analytics war, hat ein
    // Opt-Out-Flag in localStorage — eigene Test-Visits verfälschen
    // sonst die Statistik. Wird in /admin/analytics automatisch gesetzt.
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('osss-no-track') === '1') {
        return
      }
    } catch { /* localStorage könnte blockiert sein */ }

    const payload = JSON.stringify({
      path: trackedPath,
      referrer: typeof document !== 'undefined' ? document.referrer : null,
    })

    // sendBeacon ist optimal für Tracking — wird auch bei Tab-Close geschickt
    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon('/api/track', blob)
      } else {
        // Fallback für ältere Browser
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => { /* silent — tracking-fail darf den user-flow nie blockieren */ })
      }
    } catch {
      // niemals throwen
    }
  }, [pathname])

  return null
}
