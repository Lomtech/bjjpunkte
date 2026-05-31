import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint C 2026-05-30: auf resolveOwnerGym umgestellt
//   - getCachedUser (60s TTL) + getCachedGymForOwner (5min TTL)
//   - Spart ~100-200ms pro Call auf Cache-Hit

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: Request) {
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)
  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('gym_id', auth.gym.id)
    .order('created_at', { ascending: false })
    .limit(5000)
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)
  const body = await req.json()
  // Explicit allowlist — never spread untrusted body directly into insert
  const { first_name, last_name, email, phone, notes, source, status, trial_date, referred_by } = body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('leads') as any).insert({
    first_name: first_name ?? null,
    last_name:  last_name  ?? null,
    email:      email      ?? null,
    phone:      phone      ?? null,
    notes:      notes      ?? null,
    source:     source     ?? 'other',
    status:     status     ?? 'new',
    trial_date: trial_date ?? null,
    referred_by: referred_by ?? null,
    gym_id:     auth.gym.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
