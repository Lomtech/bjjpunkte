import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

// Audit 2026-05-11: Health-Check darf keine Env-Var-Inventory nach außen leaken.
// Public-Version liefert nur `{ ok, ms, time }`. Detail-Diagnose (welcher Check,
// welches Env-Var fehlt) wird nur ausgeliefert, wenn der Aufrufer den
// HEALTH_DEBUG_TOKEN-Header mit dem korrekten Secret mitschickt.
//
// Vercel pingt unter dem normalen Pfad ohne Header → bekommt nur den Status,
// das reicht für Uptime-Monitoring.
const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'CRON_SECRET',
] as const

export async function GET(req: Request) {
  const startedAt = Date.now()
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {}

  try {
    const t = Date.now()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('cron_runs')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    checks.db = error
      ? { ok: false, ms: Date.now() - t, error: 'db-ping-failed' }
      : { ok: true, ms: Date.now() - t }
  } catch {
    checks.db = { ok: false, error: 'db-ping-exception' }
  }

  const missing = requiredEnv.filter(k => !process.env[k])
  checks.env = missing.length === 0 ? { ok: true } : { ok: false, error: 'env-incomplete' }

  const ok = Object.values(checks).every(c => c.ok)

  // Debug-Modus: nur mit korrektem Token wird die Diagnose detailliert ausgeliefert.
  const debugToken = req.headers.get('x-health-debug-token')
  const debugSecret = process.env.HEALTH_DEBUG_TOKEN
  const isDebug = !!debugSecret && debugToken === debugSecret

  if (isDebug) {
    return NextResponse.json(
      {
        ok,
        checks,
        missing,
        ms: Date.now() - startedAt,
        time: new Date().toISOString(),
      },
      { status: ok ? 200 : 503 },
    )
  }

  return NextResponse.json(
    { ok, ms: Date.now() - startedAt, time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  )
}
