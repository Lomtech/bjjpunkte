// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// DSGVO: Server-side errors. PII (email, IP, request headers, cookies) NICHT
// automatisch an Sentry senden — sonst wäre Cookie-Banner nötig (Art. 6 DSGVO).
// Stack-Traces, Error-Messages und Performance-Metriken laufen weiter
// als berechtigtes Interesse (Art. 6(1)(f)).
//
// Audit 2026-05-11: zusätzlicher beforeSend-Filter scrubbt PII aus
// Error-Messages (Emails, IBANs, Telefonnummern), falls jemand versehentlich
// `captureException(new Error('Bad ' + user.email))` schreibt.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scrubPII(value: any): any {
  if (typeof value !== 'string') return value
  return value
    // Email
    .replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '<redacted-email>')
    // IBAN (grob: 2 Buchstaben + 2 Ziffern + 11+ alphanumerisch)
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, '<redacted-iban>')
    // E.164 Telefonnummer
    .replace(/\+\d{8,15}\b/g, '<redacted-phone>')
    // Stripe customer/sub IDs sind keine PII, aber Customer-Emails als URL-Param mal sehen
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // 10% in production, 100% in dev — avoid excessive billing
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // KEIN PII — DSGVO-konform für anonymes Error-Tracking
  sendDefaultPii: false,

  beforeSend(event) {
    if (event.message) event.message = scrubPII(event.message)
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) ex.value = scrubPII(ex.value)
      }
    }
    return event
  },
});
