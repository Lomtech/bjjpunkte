import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startedAt = Date.now()
  const checks: Record<string, { ok: boolean; ms?: number; error?: string }> = {}

  // DB ping — small, fast, indexed query
  try {
    const t = Date.now()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('cron_runs')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    checks.db = error
      ? { ok: false, ms: Date.now() - t, error: error.message }
      : { ok: true, ms: Date.now() - t }
  } catch (e) {
    checks.db = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  // Required env vars
  const requiredEnv = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'CRON_SECRET',
  ]
  const missing = requiredEnv.filter(k => !process.env[k])
  checks.env = missing.length === 0
    ? { ok: true }
    : { ok: false, error: `missing: ${missing.join(',')}` }

  const ok = Object.values(checks).every(c => c.ok)
  return NextResponse.json(
    { ok, checks, ms: Date.now() - startedAt, time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  )
}
