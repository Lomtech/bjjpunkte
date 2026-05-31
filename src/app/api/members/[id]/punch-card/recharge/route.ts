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

// POST /api/members/[id]/punch-card/recharge
// Body: { units: number; amount_cents?: number; plan_id?: string | null; note?: string | null }
// Owner-only: nutzt RLS via Bearer-JWT. Trägt Aufladung in punch_card_purchases ein
// und addiert auf members.punch_units_remaining + total.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = authClient(auth.token)
  const gym = auth.gym

  const body = await req.json() as {
    units?: number
    amount_cents?: number
    plan_id?: string | null
    note?: string | null
  }

  const units = Number(body.units)
  if (!Number.isInteger(units) || units <= 0 || units > 1000) {
    return NextResponse.json({ error: 'units muss eine ganze Zahl zwischen 1 und 1000 sein' }, { status: 400 })
  }
  const amount = body.amount_cents == null ? 0 : Number(body.amount_cents)
  if (!Number.isInteger(amount) || amount < 0) {
    return NextResponse.json({ error: 'amount_cents muss >= 0 sein' }, { status: 400 })
  }

  const { data: member } = await supabase
    .from('members')
    .select('id, punch_units_remaining, punch_units_total')
    .eq('id', id)
    .eq('gym_id', gym.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })

  const memberRow = member as { punch_units_remaining: number | null; punch_units_total: number | null }
  const newRemaining = (memberRow.punch_units_remaining ?? 0) + units
  const newTotal = (memberRow.punch_units_total ?? 0) + units

  const { error: purchaseErr } = await supabase
    .from('punch_card_purchases')
    .insert({
      gym_id: gym.id,
      member_id: id,
      plan_id: body.plan_id ?? null,
      units_purchased: units,
      amount_cents: amount,
      note: body.note ?? null,
    })
  if (purchaseErr) return NextResponse.json({ error: purchaseErr.message }, { status: 500 })

  const { error: updateErr } = await supabase
    .from('members')
    .update({
      punch_units_remaining: newRemaining,
      punch_units_total: newTotal,
      punch_card_purchased_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('gym_id', gym.id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    punch_units_remaining: newRemaining,
    punch_units_total: newTotal,
  })
}
