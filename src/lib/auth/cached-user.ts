/**
 * Cached Bearer-Auth-Lookup.
 *
 * Sup `auth.getUser(token)` macht einen HTTP-Roundtrip zur Sup-Auth-API
 * (50–150 ms je nach Region/Load). Bei 89 Aufruf-Stellen im Code + 5–8
 * pro Dashboard-Page-Load = signifikant.
 *
 * Cache-TTL 60s: Token-Rotation/Logout sind selten und der Cache fällt nach
 * spätestens einer Minute heraus. Kritische Operations (z.B. Sub-Cancel)
 * können `force=true` setzen um den Cache zu umgehen.
 *
 * Returns null wenn Token ungültig oder nicht vorhanden.
 */

import { createClient } from '@supabase/supabase-js'
import { cacheGet, cacheSet, cacheDel, tokenKey } from '@/lib/redis-cache'

export interface CachedUser {
  id: string
  email?: string
}

const TTL_SEC = 60

/**
 * Resolve a Bearer token to a user. Cached for 60s.
 *
 * @param token Bearer token (raw JWT, ohne "Bearer "-Prefix)
 * @param opts.force true = bypass cache, fetch fresh from Sup
 */
export async function getCachedUser(
  token: string | null | undefined,
  opts: { force?: boolean } = {},
): Promise<CachedUser | null> {
  if (!token) return null

  const key = tokenKey(token)

  if (!opts.force) {
    const cached = await cacheGet<CachedUser>(key)
    if (cached) return cached
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data } = await sb.auth.getUser(token)
  if (!data.user) return null

  const user: CachedUser = {
    id: data.user.id,
    email: data.user.email ?? undefined,
  }
  await cacheSet(key, user, TTL_SEC)
  return user
}

/**
 * Auth-Helper: holt Token aus dem Authorization-Header und cached-resolved
 * den User. Drop-in für das Standard-Pattern.
 *
 * Returns either { user, token } oder null wenn nicht autorisiert.
 */
export async function getCachedUserFromRequest(
  req: Request,
): Promise<{ user: CachedUser; token: string } | null> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const user = await getCachedUser(token)
  if (!user) return null
  return { user, token }
}

/**
 * Invalidate cache (z.B. nach Logout oder Password-Change).
 */
export async function invalidateCachedUser(token: string): Promise<void> {
  await cacheDel(tokenKey(token))
}
