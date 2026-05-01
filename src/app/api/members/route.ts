import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await (supabase.from('gyms') as any).select('id, plan_member_limit').eq('owner_id', user.id).single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const gymData = gym as { id: string; plan_member_limit: number | null }
  const limit = gymData.plan_member_limit ?? 30

  const { count: activeCount } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('gym_id', gymData.id)
    .eq('is_active', true)

  if ((activeCount ?? 0) >= limit) {
    return NextResponse.json({ error: 'PLAN_LIMIT_REACHED', limit }, { status: 403 })
  }

  const body = await req.json()
  const {
    first_name, last_name, email, phone, date_of_birth, join_date,
    belt, stripes, notes, contract_end_date, parent_member_id,
  } = body

  // Eingabevalidierung
  if (!first_name?.trim()) return NextResponse.json({ error: 'Vorname fehlt' }, { status: 400 })
  if (!last_name?.trim()) return NextResponse.json({ error: 'Nachname fehlt' }, { status: 400 })
  if (!join_date) return NextResponse.json({ error: 'Eintrittsdatum fehlt' }, { status: 400 })
  const VALID_BELTS = ['white', 'blue', 'purple', 'brown', 'black']
  if (belt && !VALID_BELTS.includes(belt)) return NextResponse.json({ error: 'Ungültiger Gürtel' }, { status: 400 })

  const { data: member, error } = await (supabase.from('members') as any).insert({
    gym_id: gymData.id,
    first_name,
    last_name,
    email: email || null,
    phone: phone || null,
    date_of_birth: date_of_birth || null,
    join_date,
    belt,
    stripes,
    notes: notes || null,
    contract_end_date: contract_end_date || null,
    is_active: true,
    parent_member_id: parent_member_id || null,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: (member as { id: string }).id }, { status: 201 })
}
