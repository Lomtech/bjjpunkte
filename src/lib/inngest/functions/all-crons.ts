/**
 * Alle 12 Vercel-Crons als Inngest-Functions.
 *
 * Sprint E (2026-05-30). Bisher 1 Function (flip-first-term-flag), jetzt
 * komplette Migration aller 12 Crons.
 *
 * Cron-Expressions kommen 1:1 aus vercel.json. TZ=Europe/Berlin wird vom
 * wrapCron-Helper automatisch gesetzt — Vercel-Crons liefen vorher in UTC,
 * mit TZ-Switch shiften wir effektiv um 1-2h (Sommerzeit). Bewusst gewählt:
 * Owner sieht "08 Uhr morgens Mahnungen versendet" statt "06 UTC".
 */

import { wrapCron } from './cron-wrapper'

// Hinweis: flip-first-term-flag ist in flip-first-term.ts als native
// Inngest-Function (mit step.run für DB-Op) implementiert — nicht via wrapper.
// Die anderen 11 nutzen wrapCron als pragmatische 1:1-Migration.

export const paymentReminders = wrapCron({
  id: 'payment-reminders',
  name: 'Monatliche Beitragserinnerung an säumige Mitglieder',
  cron: '0 9 5 * *',
  endpoint: 'payment-reminders',
  retries: 3,
  maxDurationSec: 300,
})

export const birthdayGreetings = wrapCron({
  id: 'birthday',  // muss zum vercel.json-Cron-Pfad /api/cron/birthday matchen (Shadow-Mode-Mapping)
  name: 'Tägliche Geburtstags-Glückwünsche an Mitglieder',
  cron: '0 8 * * *',
  endpoint: 'birthday',
  retries: 2,
  maxDurationSec: 120,
})

export const salesFollowups = wrapCron({
  id: 'sales-followups',
  name: 'Tägliche Sales-Follow-up-Reminder (admin/sales/leads)',
  cron: '0 7 * * *',
  endpoint: 'sales-followups',
  retries: 2,
  maxDurationSec: 60,
})

export const leadFollowups = wrapCron({
  id: 'lead-followups',
  name: 'Tägliche Lead-Follow-up-Reminder pro Gym',
  cron: '30 7 * * *',
  endpoint: 'lead-followups',
  retries: 2,
  maxDurationSec: 60,
})

export const accountantDispatch = wrapCron({
  id: 'accountant-dispatch',
  name: 'Monatlicher Steuerberater-Versand (PDF-Anhänge)',
  cron: '0 6 * * *',
  endpoint: 'accountant-dispatch',
  retries: 3,
  maxDurationSec: 300,
})

export const dunningEscalation = wrapCron({
  id: 'dunning-escalation',
  name: 'Tägliche Mahnungs-Eskalation (Level 0→1→2→3→handoff)',
  cron: '0 8 * * *',
  endpoint: 'dunning-escalation',
  retries: 3,
  maxDurationSec: 60,
})

export const missingPlanReminder = wrapCron({
  id: 'missing-plan-reminder',
  name: 'Wöchentlicher Reminder an Members ohne Plan',
  cron: '0 8 * * 1',
  endpoint: 'missing-plan-reminder',
  retries: 2,
  maxDurationSec: 60,
})

export const aggregatePageViews = wrapCron({
  id: 'aggregate-page-views',
  name: 'Nächtliche Page-View-Aggregation für Dashboard',
  cron: '0 3 * * *',
  endpoint: 'aggregate-page-views',
  retries: 3,
  maxDurationSec: 300,
})

export const notificationWorker = wrapCron({
  id: 'notification-worker',
  name: 'Tägliche Notification-Queue-Abarbeitung',
  cron: '0 6 * * *',
  endpoint: 'notification-worker',
  retries: 3,
  maxDurationSec: 300,
})

export const newsletterCleanup = wrapCron({
  id: 'newsletter-cleanup',
  name: 'Nächtliche Bereinigung unconfirmed Newsletter-Subs (>30d)',
  cron: '30 4 * * *',
  endpoint: 'newsletter-cleanup',
  retries: 2,
  maxDurationSec: 60,
})

export const applyPriceChanges = wrapCron({
  id: 'apply-price-changes',
  name: 'Tägliche Anwendung von geplanten Beitragserhöhungen (Stripe)',
  cron: '0 4 * * *',
  endpoint: 'apply-price-changes',
  retries: 5, // Stripe-Calls — generös retry
  maxDurationSec: 300,
})
