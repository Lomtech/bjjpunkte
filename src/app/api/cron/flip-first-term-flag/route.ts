import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cronGuard } from '@/lib/cron-guard'
import type { Database } from '@/types/database'

/**
 * Sub 0014d: Setzt is_first_term=false für Verträge, deren original_end_date
 * überschritten ist. Damit greift ab dem nächsten Tag die
 * notice_period_days_after_first_term Frist statt notice_period_days.
 *
 * Idempotent: läuft nur auf Verträge mit is_first_term=true UND
 * original_end_date IS NOT NULL AND original_end_date < CURRENT_DATE.
 *
 * Schedule: täglich 03:30 (siehe vercel.json).
 */
export async function GET(req: Request) {
  const guard = cronGuard(req)
  if (guard) return guard

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('member_contracts')
    .update({ is_first_term: false })
    .eq('is_first_term', true)
    .not('original_end_date', 'is', null)
    .lt('original_end_date', new Date().toISOString().slice(0, 10))
    .select('id')

  if (error) {
    console.error('[cron flip-first-term-flag] update error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const flipped = data?.length ?? 0
  return NextResponse.json({ ok: true, flipped })
}
