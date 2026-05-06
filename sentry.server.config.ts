// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// DSGVO: Server-side errors. PII (email, IP, request headers, cookies) NICHT
// automatisch an Sentry senden — sonst wäre Cookie-Banner nötig (Art. 6 DSGVO).
// Stack-Traces, Error-Messages und Performance-Metriken laufen weiter
// als berechtigtes Interesse (Art. 6(1)(f)).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% in production, 100% in dev — avoid excessive billing
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // KEIN PII — DSGVO-konform für anonymes Error-Tracking
  sendDefaultPii: false,
});
