import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const authHeader  = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Verify member belongs to this user's gym and is inactive
  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const { data: member } = await supabase.from('members')
    .select('id, is_active').eq('id', id).eq('gym_id', gym.id).single()

  if (!member) return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  if (member.is_active) return NextResponse.json({ error: 'Aktive Mitglieder können nicht gelöscht werden.' }, { status: 400 })

  // Delete related data first
  await supabase.from('attendance').delete().eq('member_id', id)
  await supabase.from('payments').delete().eq('member_id', id)
  await supabase.from('belt_promotions').delete().eq('member_id', id)
  await supabase.from('members').delete().eq('id', id)

  return NextResponse.json({ success: true })
}
