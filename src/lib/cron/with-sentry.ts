import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

/**
 * Cron-Handler-Wrapper mit Sentry-Capture.
 *
 * Audit-Befund 2026-05-10: 8 Cron-Routes haben keinen einzigen
 * `Sentry.captureException`-Call. `withSentryConfig` in `next.config.ts` ist
 * disabled (Pass 17, Webpack-Konflikt) → API-Route-Errors werden NICHT
 * auto-captured. Cron-Failures sind komplett silent in Sentry.
 *
 * Dieser Wrapper:
 *   - fängt unhandled exceptions auf Top-Level
 *   - tagged das Sentry-Event mit `cron.name` für Filtering
 *   - logged zusätzlich nach Vercel-Console (für quick debug ohne Sentry-UI)
 *   - returnt 500 mit Error-Detail (statt Crash → Vercel-Retry-Loop)
 *
 * Nutzung:
 *
 *   export const GET = withCronSentry('payment-reminders', async (req) => {
 *     // ... bestehende Logik
 *     return NextResponse.json({ ok: true })
 *   })
 *
 * Existierende inner try/catch-Blocks bleiben — der Wrapper ist die
 * letzte Verteidigung für Errors die innen NICHT gefangen werden.
 */
export function withCronSentry(
  jobName: string,
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req)
    } catch (err) {
      // Sentry-Capture mit Tags für Cron-Specific-Filtering
      Sentry.captureException(err, {
        tags: {
          'cron.name': jobName,
          type: 'cron-failure',
        },
      })
      // Console-Log für Vercel-Logs-Tail (Quick-Debug ohne Sentry-Login)
      console.error(`[cron:${jobName}] uncaught error:`, err)
      // 500-Response → Vercel sieht es als Failure (für Retry-Logic + Cron-Monitoring)
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        { error: 'Cron handler failed', cron: jobName, detail: message },
        { status: 500 }
      )
    }
  }
}
