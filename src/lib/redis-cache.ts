/**
 * Generic Redis-Cache-Wrapper auf Upstash REST.
 *
 * Pattern wie rate-limit-handler.ts: Lazy-init, Fallback auf In-Memory wenn
 * UPSTASH_REDIS_REST_URL / TOKEN nicht gesetzt (Dev-Env), silent-fail bei
 * jedem Redis-Fehler — Cache-Probleme dürfen NIEMALS den User-Flow blockieren.
 *
 * Sprint A (2026-05-30): Auth-User-Cache (TTL 60s) → spart 50–150ms pro
 * API-Call der auth.getUser(token) gegen Sup-Auth-API macht. ~89 Stellen
 * im Code, ~30ms × 5–8 pro Dashboard-Page-Load.
 *
 * DSGVO: Keys sind SHA-256-Hashes (Tokens) oder Owner-IDs (UUIDs) — keine
 * PII roh im Cache. Werte können Email enthalten (user.email), aber das ist
 * im Sup-DPA gedeckt (Upstash ist Sub-Prozessor in compliance/avv-status.md).
 */

import { createHash } from 'crypto'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisLike = {
  get: <T>(key: string) => Promise<T | null>
  set: (key: string, value: unknown, opts?: { ex?: number }) => Promise<unknown>
  del: (key: string) => Promise<unknown>
}

let redis: RedisLike | null = null
let redisInit: Promise<RedisLike | null> | null = null

async function getRedis(): Promise<RedisLike | null> {
  if (redis) return redis
  if (redisInit) return redisInit

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    // In-memory fallback — nicht über Function-Instances geteilt, aber besser als nichts
    redis = createInMemoryRedis()
    return redis
  }

  redisInit = (async () => {
    try {
      const { Redis } = await import('@upstash/redis')
      redis = new Redis({ url, token }) as unknown as RedisLike
      return redis
    } catch (err) {
      console.error('[redis-cache] Upstash init failed, falling back to memory:', err)
      redis = createInMemoryRedis()
      return redis
    }
  })()
  return redisInit
}

function createInMemoryRedis(): RedisLike {
  type Entry = { value: unknown; expires: number }
  const store = new Map<string, Entry>()
  let lastCleanup = Date.now()
  const CLEANUP_MS = 5 * 60_000

  function maybeCleanup() {
    const now = Date.now()
    if (now - lastCleanup < CLEANUP_MS) return
    lastCleanup = now
    for (const [k, e] of store) { if (e.expires < now) store.delete(k) }
  }

  return {
    async get<T>(key: string): Promise<T | null> {
      maybeCleanup()
      const e = store.get(key)
      if (!e) return null
      if (e.expires < Date.now()) { store.delete(key); return null }
      return e.value as T
    },
    async set(key: string, value: unknown, opts?: { ex?: number }) {
      maybeCleanup()
      const ttl = opts?.ex ?? 60
      store.set(key, { value, expires: Date.now() + ttl * 1000 })
      return 'OK'
    },
    async del(key: string) {
      store.delete(key)
      return 1
    },
  }
}

/**
 * Get a cached value. Returns null on miss, fallback, or any error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const r = await getRedis()
    if (!r) return null
    return (await r.get<T>(key)) ?? null
  } catch (err) {
    console.error('[redis-cache] get failed for', key, err)
    return null
  }
}

/**
 * Set a cached value with TTL in seconds.
 * Silent-fail — never throws to caller.
 */
export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  try {
    const r = await getRedis()
    if (!r) return
    await r.set(key, value, { ex: ttlSec })
  } catch (err) {
    console.error('[redis-cache] set failed for', key, err)
  }
}

/**
 * Delete a cached value (invalidation). Silent-fail.
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    const r = await getRedis()
    if (!r) return
    await r.del(key)
  } catch (err) {
    console.error('[redis-cache] del failed for', key, err)
  }
}

/**
 * SHA-256-Hash eines Tokens, slice 16 — sodass der rohe JWT nie als Cache-Key
 * persistiert wird. 16 Hex-Zeichen = 64 bits = ausreichende Kollisions-
 * Resistenz für unsere Cache-Size.
 */
export function tokenKey(token: string): string {
  return 'u:' + createHash('sha256').update(token).digest('hex').slice(0, 16)
}
