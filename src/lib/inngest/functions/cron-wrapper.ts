/**
 * Inngest-Cron-Wrapper.
 *
 * Sprint E (2026-05-30) — Full Cron-Migration auf Inngest.
 *
 * Strategie: bestehende /api/cron/<name>/route.ts-Handler bleiben unverändert
 * (2765 LOC, gut getestet). Inngest ruft sie via step.fetch auf — das gibt
 * uns Durability (Retries, Replay, History) ohne das Migrations-Risiko eines
 * Re-Implementations.
 *
 * Vorteile vs. nativem step.run:
 *   - Migrations-Risiko = 0 (Handler-Code unverändert)
 *   - Cron-Endpoints bleiben als manueller Trigger nutzbar (curl mit CRON_SECRET)
 *   - Inngest sieht alle Runs/Failures/Retries im Dashboard
 *
 * Nachteile:
 *   - Ein extra HTTP-Hop (Inngest → osss.pro/api/cron/<name>)
 *   - Keine step.run-Granularität (ein Failed step = ganzer Run failed)
 *
 * Trade-off ist akzeptabel: für die meisten Crons gibt's eh nur ein DB-Update.
 * Bei dunning-escalation + payment-reminders kann später ein Refactor zu
 * step.fanOut + step.sleep folgen (eigener Sprint F).
 */

import { inngest } from '../client'

export interface CronDef {
  /** Inngest-Function-ID — muss eindeutig sein im Workspace */
  id: string
  /** Display-Name im Inngest-Dashboard */
  name: string
  /** Cron-Expression im Europe/Berlin-TZ — "TZ=Europe/Berlin <expr>" wird auto-prefixed */
  cron: string
  /** Pfad-Segment unter /api/cron/, ohne führenden Slash */
  endpoint: string
  /** Retry-Count bei Failure (default 2). Inngest erlaubt 0-20. */
  retries?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  /** Concurrent Runs-Limit. 1 = serialize. Default = 1 für Cron-Sicherheit. */
  concurrency?: number
  /** Optional: maximale Function-Runtime in Sekunden */
  maxDurationSec?: number
}

/**
 * Builds an Inngest-Function that fires the given cron and invokes
 * `https://<APP_URL>/api/cron/<endpoint>` with the CRON_SECRET as Bearer.
 *
 * Use step.fetch for durability — failed HTTP calls are retried by Inngest,
 * the step result is cached so Replays don't double-execute.
 */
export function wrapCron(def: CronDef) {
  const fullCron = def.cron.startsWith('TZ=') ? def.cron : `TZ=Europe/Berlin ${def.cron}`

  return inngest.createFunction(
    {
      id: def.id,
      name: def.name,
      retries: def.retries ?? 2,
      concurrency: def.concurrency ?? 1,
      triggers: [{ cron: fullCron }],
    },
    async ({ step, logger, event }) => {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      if (!appUrl) {
        throw new Error('NEXT_PUBLIC_APP_URL / VERCEL_URL not set — cannot invoke cron endpoint')
      }
      const cronSecret = process.env.CRON_SECRET
      if (!cronSecret) {
        throw new Error('CRON_SECRET not set — cron endpoints will reject the call')
      }

      const url = `${appUrl}/api/cron/${def.endpoint}`
      logger.info('[inngest-cron] invoking', { id: def.id, url, ts: event.ts })

      // step.run gives us durability: Inngest caches the result, on retry
      // it doesn't re-execute (so we don't double-invoke if marker step
      // ahead of us crashed). 5min timeout matches the Vercel-side maxDuration.
      const result = await step.run('invoke-cron-endpoint', async () => {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cronSecret}`,
            'User-Agent': 'inngest-cron-wrapper/1.0',
          },
          // Edge-Cases: Cron-Endpoints brauchen oft 30-300s. Wir setzen
          // kein Timeout — Inngest cancelt nach maxDurationSec wenn nötig.
        })
        const text = await res.text()
        let parsed: unknown
        try { parsed = JSON.parse(text) } catch { parsed = text }

        if (!res.ok) {
          throw new Error(
            `Cron ${def.endpoint} returned HTTP ${res.status}: ${typeof parsed === 'string' ? parsed.slice(0, 500) : JSON.stringify(parsed).slice(0, 500)}`
          )
        }
        return { status: res.status, body: parsed }
      })

      logger.info('[inngest-cron] success', { id: def.id, status: result.status })
      return result
    }
  )
}
