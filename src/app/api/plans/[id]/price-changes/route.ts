import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

// GET /api/plans/[id]/price-changes — History
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = authClient(auth.token)
  const gym = auth.gym

  const { data, error } = await supabase
    .from('plan_price_changes')
    .select('*')
    .eq('plan_id', planId)
    .eq('gym_id', gym.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ price_changes: data ?? [] })
}

// POST /api/plans/[id]/price-changes — Erhöhung anmelden
// Body: { new_price_cents: number, effective_date: 'YYYY-MM-DD', objection_deadline_days_before?: number }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = authClient(auth.token)
  const gym = auth.gym

  const { data: plan } = await supabase
    .from('membership_plans')
    .select('id, gym_id, price_cents, kind')
    .eq('id', planId)
    .eq('gym_id', gym.id)
    .maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Plan nicht gefunden' }, { status: 404 })
  if ((plan as { kind: string }).kind !== 'subscription') {
    return NextResponse.json({ error: 'Beitragserhöhung nur für subscription-Plans' }, { status: 400 })
  }

  const body = await req.json() as {
    new_price_cents?: number
    effective_date?: string
    objection_deadline_days_before?: number
  }

  const newPrice = Number(body.new_price_cents)
  if (!Number.isInteger(newPrice) || newPrice <= 0) {
    return NextResponse.json({ error: 'new_price_cents muss positive Ganzzahl sein' }, { status: 400 })
  }
  if (!body.effective_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.effective_date)) {
    return NextResponse.json({ error: 'effective_date muss YYYY-MM-DD sein' }, { status: 400 })
  }
  const effective = new Date(body.effective_date + 'T00:00:00Z')
  if (effective.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'effective_date muss in der Zukunft liegen' }, { status: 400 })
  }
  const daysBefore = body.objection_deadline_days_before ?? 14
  if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 90) {
    return NextResponse.json({ error: 'objection_deadline_days_before muss 0-90 sein' }, { status: 400 })
  }
  const objection = new Date(effective.getTime() - daysBefore * 24 * 60 * 60 * 1000)
  const objectionIso = objection.toISOString().slice(0, 10)

  const oldPrice = (plan as { price_cents: number }).price_cents

  const { data: inserted, error } = await supabase
    .from('plan_price_changes')
    .insert({
      gym_id: gym.id,
      plan_id: planId,
      old_price_cents: oldPrice,
      new_price_cents: newPrice,
      effective_date: body.effective_date,
      objection_deadline: objectionIso,
    })
    .select('id, pct_change')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    id: (inserted as { id: string }).id,
    pct_change: (inserted as { pct_change: number | null }).pct_change,
    objection_deadline: objectionIso,
  })
}
