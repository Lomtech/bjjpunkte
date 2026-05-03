import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const svc = serviceClient()
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await anonClient.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Get gym for this owner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gym } = await (svc.from('gyms') as any)
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const { member_id, class_type, class_id } = await req.json()
  if (!member_id) return NextResponse.json({ error: 'member_id fehlt' }, { status: 400 })

  // Verify member belongs to this gym
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (svc.from('members') as any)
    .select('id')
    .eq('id', member_id)
    .eq('gym_id', gym.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error } = await (svc.from('attendance') as any)
    .insert({
      gym_id:       gym.id,
      member_id,
      class_type:   class_type ?? 'gi',
      class_id:     class_id ?? null,
      checked_in_at: new Date().toISOString(),
    })
    .select('id, checked_in_at, class_type')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, entry })
}
