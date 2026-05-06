'use client'
import * as Sentry from '@sentry/nextjs'
import { useState } from 'react'

export default function SentryExamplePage() {
  const [triggered, setTriggered] = useState(false)

  function triggerError() {
    Sentry.captureException(new Error('Sentry Test-Error von osss.pro — alles funktioniert!'))
    setTriggered(true)
  }

  async function triggerApiError() {
    await fetch('/api/sentry-example-api')
    setTriggered(true)
  }

  return (
    <main style={{ padding: 40, fontFamily: 'system-ui', maxWidth: 500 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Sentry Test</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Klicke einen Button — danach sollte innerhalb von ~30 Sekunden ein Issue in Sentry erscheinen.
      </p>
      <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
        <button
          onClick={triggerError}
          style={{ padding: '12px 20px', background: '#f59e0b', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          Client-Error senden
        </button>
        <button
          onClick={triggerApiError}
          style={{ padding: '12px 20px', background: '#1e293b', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
        >
          Server-Error senden (API)
        </button>
      </div>
      {triggered && (
        <p style={{ marginTop: 24, color: '#16a34a', fontWeight: 600 }}>
          ✓ Gesendet — jetzt Sentry Dashboard refreshen.
        </p>
      )}
      <p style={{ marginTop: 32, fontSize: 12, color: '#999' }}>
        Diese Seite ist nur für den Sentry-Test — kann danach gelöscht werden.
      </p>
    </main>
  )
}
