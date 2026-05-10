import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

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
  const expected = `Bearer ${secret}`
  // timingSafeEqual statt `!==` — verhindert Side-Channel-Angriff. Beide Buffers
  // müssen exakt gleich lang sein, sonst wirft die Funktion. Wir padden auf die
  // erwartete Länge, damit Länge-Mismatch nicht selber Timing-Info leakt.
  const a = Buffer.from(authHeader.padEnd(expected.length, '\0'))
  const b = Buffer.from(expected)
  let ok = false
  try {
    ok = a.length === b.length && timingSafeEqual(a, b) && authHeader.length === expected.length
  } catch {
    ok = false
  }
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null // OK
}
