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
      trackedPath === '/dashboard' ||
      trackedPath === '/no-track'
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

    // UTM-Parameter aus aktueller URL extrahieren (?utm_source=…)
    let utmSource: string | null = null
    let utmMedium: string | null = null
    let utmCampaign: string | null = null
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        utmSource   = params.get('utm_source')
        utmMedium   = params.get('utm_medium')
        utmCampaign = params.get('utm_campaign')
      }
    } catch { /* URL-Parsing kann silent fail */ }

    const payload = JSON.stringify({
      path: trackedPath,
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      utm_source:   utmSource,
      utm_medium:   utmMedium,
      utm_campaign: utmCampaign,
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

/**
 * Globaler Click-Event-Tracker.
 *
 * Verwendet via `data-track="cta_signup"` Attribut auf Buttons/Links.
 * Beim Klick wird ein POST an /api/track mit event_type='click' geschickt.
 *
 * Beispiel:
 *   <button data-track="cta_signup">Kostenlos starten</button>
 *   <Link data-track="cta_pricing" href="/pricing">Preise</Link>
 *
 * Vorteile:
 *  - Kein State-Pollution in Components
 *  - Funktioniert auch auf Server-Components (data-* Attribute überleben)
 *  - DSGVO-konform: gleicher Anonymisierungs-Pfad wie page_view
 */
export function TrackClicks() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (e: MouseEvent) => {
      // Owner-Opt-Out respektieren
      try {
        if (localStorage.getItem('osss-no-track') === '1') return
      } catch { /* localStorage könnte blockiert sein */ }

      // Walk up DOM, bis wir ein data-track Element finden
      let el: HTMLElement | null = e.target as HTMLElement | null
      let target: string | null = null
      let i = 0
      while (el && i < 8) {
        if (el.dataset && el.dataset.track) {
          target = el.dataset.track
          break
        }
        el = el.parentElement
        i++
      }
      if (!target) return

      // Sanitize lokal — Server validiert nochmal
      target = target.toLowerCase().replace(/[^a-z0-9_\-.]/g, '').slice(0, 100)
      if (!target) return

      // UTM aus URL mitschicken
      let utmSource: string | null = null
      let utmMedium: string | null = null
      let utmCampaign: string | null = null
      try {
        const params = new URLSearchParams(window.location.search)
        utmSource   = params.get('utm_source')
        utmMedium   = params.get('utm_medium')
        utmCampaign = params.get('utm_campaign')
      } catch { /* silent */ }

      const payload = JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer || null,
        event_type: 'click',
        event_target: target,
        utm_source:   utmSource,
        utm_medium:   utmMedium,
        utm_campaign: utmCampaign,
      })

      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' })
          navigator.sendBeacon('/api/track', blob)
        } else {
          fetch('/api/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {})
        }
      } catch { /* silent */ }
    }

    document.addEventListener('click', handler, { capture: true })
    return () => document.removeEventListener('click', handler, { capture: true })
  }, [])

  return null
}
