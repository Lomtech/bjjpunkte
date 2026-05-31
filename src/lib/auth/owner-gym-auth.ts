/**
 * Drop-in Auth+Gym-Resolution für Owner-Endpoints.
 *
 * 90% der /api/* Routes brauchen: Bearer-Token verifizieren → Owner-Gym
 * auflösen. Vorher 8-15 Zeilen Boilerplate × 60 Endpoints. Mit diesem
 * Wrapper: 3 Zeilen + voller Cache-Support (Auth-User 60s + Gym 5min).
 *
 * Beispiel:
 *
 *   import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'
 *
 *   export async function POST(req: Request) {
 *     const auth = await resolveOwnerGym(req)
 *     if ('error' in auth) return auth.error
 *     const { user, gym, token } = auth
 *     // ... weiterer Handler-Code
 *   }
 *
 * Sprint C (2026-05-30).
 */

import { NextResponse } from 'next/server'
import type { CachedUser } from '@/lib/auth/cached-user'
import type { CachedGym } from '@/lib/auth/cached-gym'
import { getCachedUser } from '@/lib/auth/cached-user'
import { getCachedGymForOwner } from '@/lib/auth/cached-gym'

export type OwnerGymResult =
  | { user: CachedUser; gym: CachedGym; token: string }
  | { error: NextResponse }

export async function resolveOwnerGym(req: Request): Promise<OwnerGymResult> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return {
      error: NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 }),
    }
  }

  const user = await getCachedUser(token)
  if (!user) {
    return {
      error: NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 }),
    }
  }

  const gym = await getCachedGymForOwner(user.id)
  if (!gym) {
    return {
      error: NextResponse.json({ error: 'Kein Gym für diesen User gefunden' }, { status: 404 }),
    }
  }

  return { user, gym, token }
}
