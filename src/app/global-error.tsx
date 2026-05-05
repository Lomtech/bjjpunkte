'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <p style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '0.5rem' }}>Kritischer Fehler</p>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem', maxWidth: '24rem' }}>
            Ein schwerwiegender Fehler ist aufgetreten. Das Team wurde automatisch benachrichtigt.
          </p>
          <button onClick={reset}
            style={{ padding: '0.625rem 1.25rem', background: '#0f172a', color: '#fff', fontSize: '0.875rem', fontWeight: 600, borderRadius: '0.75rem', border: 'none', cursor: 'pointer' }}>
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  )
}
