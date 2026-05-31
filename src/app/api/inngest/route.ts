import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { flipFirstTermFlag } from '@/lib/inngest/functions/flip-first-term'
import {
  paymentReminders,
  birthdayGreetings,
  salesFollowups,
  leadFollowups,
  accountantDispatch,
  dunningEscalation,
  missingPlanReminder,
  aggregatePageViews,
  notificationWorker,
  newsletterCleanup,
  applyPriceChanges,
} from '@/lib/inngest/functions/all-crons'

export const runtime = 'nodejs'
export const maxDuration = 300

// Sprint E (2026-05-30): alle 12 Crons via Inngest.
//   flipFirstTermFlag ist die einzige native Function (step.run DB-Op).
//   Die anderen 11 sind via wrapCron HTTP-Wrapper um die bestehenden
//   /api/cron/<name>-Endpoints — durable + retry-safe + replayable.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // Native (refactored)
    flipFirstTermFlag,
    // Wrapped (1:1 Migration)
    paymentReminders,
    birthdayGreetings,
    salesFollowups,
    leadFollowups,
    accountantDispatch,
    dunningEscalation,
    missingPlanReminder,
    aggregatePageViews,
    notificationWorker,
    newsletterCleanup,
    applyPriceChanges,
  ],
})
