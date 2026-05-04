import { NextResponse } from 'next/server'

/**
 * Validates the CRON_SECRET from the Authorization header.
 * Returns a 401 NextResponse if the check fails, or null if the request is valid.
 *
 * Usage:
 *   const guard = cronGuard(req)
 *   if (guard) return guard
 */
export function cronGuard(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET

  // Reject immediately if secret is not configured or is too short
  if (!secret || secret.length < 16) {
    console.error('[cron-guard] CRON_SECRET is missing or too short — rejecting request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null // OK
}
