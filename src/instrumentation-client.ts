// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// DSGVO/TTDSG: Session-Replay zeichnet User-Verhalten auf und braucht
// Einwilligung nach § 25 TTDSG. Ohne Cookie-Banner: Replay komplett aus.
// Error-Tracking (ohne Replay) läuft als berechtigtes Interesse weiter.
// Falls später Replay gewünscht → erst Cookie-Banner einbauen, dann replaysSessionSampleRate aktivieren.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "https://d913b462ad939dac84ad766db54e83d0@o4511339861049344.ingest.de.sentry.io/4511339862491216",

  // Performance-Tracing in Production niedriger samplen
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Logs an Sentry senden (errors only, keine PII)
  enableLogs: true,

  // Session-Replay aus — siehe Kommentar oben (DSGVO/TTDSG)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Keine PII (Email, IP, etc.) automatisch senden — DSGVO-konform für
  // anonyme Error-Reports
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
