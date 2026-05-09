import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Worker-Queue-Pattern für E-Mail/WhatsApp-Versand.
 *
 * Cron-Producer (z.B. payment-reminders) schreiben Tasks per `enqueueNotification`
 * in die `notification_queue`. Der Worker (/api/cron/notification-worker) pollt
 * regelmäßig pending Tasks und versendet sie.
 *
 * Trennung Producer/Consumer löst das Problem, dass O(Gyms × Members)
 * Resend-Calls inline den Vercel-300s-Timeout sprengen würden.
 *
 * Feature-Flag: `NOTIFICATION_QUEUE_ENABLED=true` aktiviert die Queue.
 * Solange ungesetzt, fällt der Caller auf den direkten Versand zurück
 * (Backwards-compat-Pfad während des Rollouts).
 */

export type NotificationKind = 'payment_reminder' | 'birthday' | 'dunning'
export type NotificationChannel = 'email' | 'whatsapp'

export interface EmailPayload {
  gym_id: string
  member_id?: string | null
  to: string
  subject: string
  html: string
  list_unsubscribe?: string
  // Optional Meta-Felder, die der Worker (oder Logging) brauchen kann.
  gym_name?: string
}

export interface WhatsappPayload {
  gym_id: string
  member_id?: string | null
  to: string // Telefonnummer
  body: string
  gym_name?: string
}

export interface EnqueueEmailInput {
  kind: NotificationKind
  channel?: 'email'
  payload: EmailPayload
  scheduled_for?: string
  max_attempts?: number
}

export interface EnqueueWhatsappInput {
  kind: NotificationKind
  channel: 'whatsapp'
  payload: WhatsappPayload
  scheduled_for?: string
  max_attempts?: number
}

export type EnqueueInput = EnqueueEmailInput | EnqueueWhatsappInput

/**
 * Liest den Feature-Flag ENV. Default: false (Queue aus, direct-mail aktiv).
 */
export function notificationQueueEnabled(): boolean {
  return process.env.NOTIFICATION_QUEUE_ENABLED === 'true'
}

/**
 * Schreibt einen einzelnen Task in die Queue.
 * Producer (Cron-Endpoints) sollten `enqueueNotificationsBatch` für Bulk
 * verwenden — dieser Helper ist primär für Tests und Single-Use-Cases.
 */
export async function enqueueNotification(
  supabase: SupabaseClient<Database>,
  input: EnqueueInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data, error } = await supabase
    .from('notification_queue')
    .insert({
      kind: input.kind,
      channel: input.channel ?? 'email',
      payload: input.payload as unknown as Record<string, unknown>,
      scheduled_for: input.scheduled_for,
      max_attempts: input.max_attempts ?? 3,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data.id }
}

/**
 * Bulk-Insert für viele Tasks gleichzeitig — der typische Producer-Pfad.
 * Schreibt in Chunks von 500 (Postgres-Insert-Sweet-Spot).
 */
export async function enqueueNotificationsBatch(
  supabase: SupabaseClient<Database>,
  inputs: EnqueueInput[]
): Promise<{ inserted: number; failed: number; errors: string[] }> {
  if (inputs.length === 0) return { inserted: 0, failed: 0, errors: [] }

  const CHUNK = 500
  let inserted = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < inputs.length; i += CHUNK) {
    const slice = inputs.slice(i, i + CHUNK)
    const rows = slice.map(input => ({
      kind: input.kind,
      channel: input.channel ?? 'email',
      payload: input.payload as unknown as Record<string, unknown>,
      scheduled_for: input.scheduled_for,
      max_attempts: input.max_attempts ?? 3,
    }))

    const { error } = await supabase.from('notification_queue').insert(rows)
    if (error) {
      failed += slice.length
      errors.push(`chunk ${i}-${i + slice.length}: ${error.message}`)
    } else {
      inserted += slice.length
    }
  }

  return { inserted, failed, errors }
}
