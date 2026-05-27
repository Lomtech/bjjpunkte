import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

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
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

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
