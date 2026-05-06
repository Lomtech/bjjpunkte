import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: 'https://d913b462ad939dac84ad766db54e83d0@o4511339861049344.ingest.de.sentry.io/4511339862491216',
  environment: process.env.NODE_ENV,

  // 10% traces in prod — enough for performance monitoring without billing explosion
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Replay 1% of sessions, 100% on error
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,  // DSGVO: mask all text in replays
      blockAllMedia: true,
    }),
  ],

  // Don't send errors from browser extensions or localhost noise
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
  ],
})
