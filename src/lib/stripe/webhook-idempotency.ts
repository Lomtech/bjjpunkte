/**
 * Redis-L1-Idempotency für Stripe-Webhooks.
 *
 * Stripe retried Webhooks bis zu 3 Tage lang exponentiell. Wir müssen jedes
 * event.id genau einmal verarbeiten — sonst Doppel-Buchungen, doppelt
 * angelegte Subscriptions, doppelt versandte Bestätigungs-Mails.
 *
 * Bestehend (vor Sprint B): DB-Tabelle `stripe_event_dedup` mit PK on
 * event_id. Korrekt aber jeder Webhook macht 2 DB-Roundtrips (insert +
 * lookup).
 *
 * Sprint B (2026-05-30): Redis vor der DB als L1-Cache.
 *  - Cache-Hit ('processed') → 200 schnell zurück, kein DB-Hit
 *  - Cache-Miss → normaler DB-Pfad, danach SET in Redis (24h TTL)
 *  - DB bleibt source of truth (Redis kann ausfallen, dann fallback)
 *
 * Wichtig: TTL nur 24h. Stripe retried max 3 Tage — danach gibt's keinen
 * Replay mehr, kein Risiko. Falls Redis hochkommt: DB-Tabelle hat alle.
 */

import { cacheGet, cacheSet } from '@/lib/redis-cache'

const TTL_SEC = 24 * 60 * 60 // 24h

function key(eventId: string): string {
  return `stripe:evt:${eventId}`
}

/**
 * Prüfe ob ein Stripe-Event bereits verarbeitet wurde (Redis-Cache only).
 * Returns true wenn definitiv schon verarbeitet, false wenn unbekannt
 * (Caller muss DB-Pfad nehmen).
 */
export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  const cached = await cacheGet<string>(key(eventId))
  return cached === 'done'
}

/**
 * Markiere ein Stripe-Event als verarbeitet im Cache. Idempotent —
 * mehrfache Aufrufe sind unschädlich.
 */
export async function markStripeEventProcessed(eventId: string): Promise<void> {
  await cacheSet(key(eventId), 'done', TTL_SEC)
}
