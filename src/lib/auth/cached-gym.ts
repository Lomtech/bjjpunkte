/**
 * Cached Owner→Gym-Lookup.
 *
 * Praktisch jeder Dashboard-API-Endpoint führt
 *   gyms.select('*').eq('owner_id', user.id).maybeSingle()
 * aus. ~63 Stellen im Code, mehrere parallel pro Page-Load. Gym-Daten
 * ändern sich aber sehr selten — perfekter Cache-Kandidat.
 *
 * TTL 5 Min (300 s) — Trade-off zwischen Frische und Hit-Rate. Bei
 * Schreib-Operations (z.B. /api/gym/update) MUSS invalidateGym() gerufen
 * werden, sonst sehen Owner ihre eigenen Änderungen bis zu 5 min später.
 *
 * Sprint B (2026-05-30).
 */

import { cacheGet, cacheSet, cacheDel } from '@/lib/redis-cache'
import { createServiceClient } from '@/lib/supabase/service'

const TTL_SEC = 300

export interface CachedGym {
  id: string
  name: string | null
  // signup_enabled steuert ob Public-Pages aktiv sind — wird oft mit-gelesen
  signup_enabled: boolean | null
  // Stripe-Connect Account-ID für Subscription/Checkout-Endpoints
  stripe_account_id: string | null
}

function ownerKey(ownerId: string): string {
  return `g:owner:${ownerId}`
}

function gymKey(gymId: string): string {
  return `g:id:${gymId}`
}

/**
 * Resolve owner_id → primary gym. Cached 5 min.
 * Returns null wenn der User kein Gym besitzt.
 */
export async function getCachedGymForOwner(
  ownerId: string,
  opts: { force?: boolean } = {},
): Promise<CachedGym | null> {
  const key = ownerKey(ownerId)
  if (!opts.force) {
    const cached = await cacheGet<CachedGym>(key)
    if (cached) return cached
  }

  const svc = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('gyms') as any)
    .select('id, name, signup_enabled, stripe_account_id')
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!data) return null
  const gym: CachedGym = data as CachedGym
  await cacheSet(key, gym, TTL_SEC)
  // Reverse-Lookup auch cachen (manche Endpoints kennen nur gymId)
  await cacheSet(gymKey(gym.id), gym, TTL_SEC)
  return gym
}

/**
 * Invalidate cache nach Update am Gym. Beide Cache-Keys löschen
 * (owner→gym und gym-by-id).
 */
export async function invalidateGym(opts: { ownerId?: string; gymId?: string }): Promise<void> {
  const tasks: Promise<void>[] = []
  if (opts.ownerId) tasks.push(cacheDel(ownerKey(opts.ownerId)))
  if (opts.gymId) tasks.push(cacheDel(gymKey(opts.gymId)))
  await Promise.all(tasks)
}
