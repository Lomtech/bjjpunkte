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

// GET /api/members/[id]/contract — aktiver Vertrag + offene Pause + Pausen-History
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = authClient(auth.token)
  const gym = auth.gym

  const { data: contracts, error } = await supabase
    .from('member_contracts')
    .select('*')
    .eq('member_id', memberId)
    .eq('gym_id', gym.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const active = contracts?.find(c => c.status === 'active' || c.status === 'paused' || c.status === 'cancelled_pending') ?? null

  let pauses: unknown[] = []
  let terminations: unknown[] = []
  if (active) {
    const [{ data: ps }, { data: ts }] = await Promise.all([
      supabase.from('contract_pauses').select('*').eq('contract_id', active.id).order('paused_from', { ascending: false }),
      supabase.from('contract_terminations').select('*').eq('contract_id', active.id).order('created_at', { ascending: false }),
    ])
    pauses = ps ?? []
    terminations = ts ?? []
  }

  return NextResponse.json({ contracts: contracts ?? [], active, pauses, terminations })
}
