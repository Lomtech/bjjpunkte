import { createClient } from '@supabase/supabase-js'
import { inngest } from '../client'
import type { Database } from '@/types/database'

/**
 * SHADOW MODE — noch nicht source of truth.
 *
 * Die produktive Cron läuft weiterhin über Vercel:
 *   src/app/api/cron/flip-first-term-flag/route.ts  (Schedule in vercel.json)
 *
 * Diese Inngest-Function dupliziert dieselbe Logik. Solange Inngest-Cloud
 * NICHT mit https://www.osss.pro/api/inngest verbunden ist, wird sie nie
 * ausgelöst — der Vercel-Cron-Job bleibt unverändert aktiv.
 *
 * Cutover-Schritte: siehe src/lib/inngest/CUTOVER.md
 *
 * Idempotent: nur Verträge mit is_first_term=true UND original_end_date < CURRENT_DATE.
 */
export const flipFirstTermFlag = inngest.createFunction(
  {
    id: 'flip-first-term-flag',
    name: 'Flip is_first_term flag when original_end_date passed',
    retries: 3,
    triggers: [{ cron: 'TZ=Europe/Berlin 30 3 * * *' }],
  },
  async ({ step, logger }) => {
    const flipped = await step.run('flip-expired-first-terms', async () => {
      const supabase = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('member_contracts')
        .update({ is_first_term: false })
        .eq('is_first_term', true)
        .not('original_end_date', 'is', null)
        .lt('original_end_date', today)
        .select('id')

      if (error) throw new Error(`supabase update failed: ${error.message}`)
      return data?.map((r) => r.id) ?? []
    })

    logger.info('flipped first-term contracts', { count: flipped.length })
    return { flipped: flipped.length, ids: flipped }
  }
)
