import * as Sentry from '@sentry/nextjs'

// DSGVO/TTDSG: Session-Replay deaktiviert — braucht Cookie-Banner-Consent.
// Falls später wieder aktivieren → erst Cookie-Banner einbauen.
//
// Audit 2026-05-11: beforeSend scrubbt PII aus Error-Messages, falls Code
// versehentlich `captureException(new Error('Bad ' + user.email))` schreibt.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scrubPII(value: any): any {
  if (typeof value !== 'string') return value
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '<redacted-email>')
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, '<redacted-iban>')
    .replace(/\+\d{8,15}\b/g, '<redacted-phone>')
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
  ],
  beforeSend(event) {
    if (event.message) event.message = scrubPII(event.message)
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) ex.value = scrubPII(ex.value)
      }
    }
    return event
  },
})
