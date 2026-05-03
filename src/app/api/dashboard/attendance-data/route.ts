import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function authedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = authedClient(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gym } = await (supabase.from('gyms') as any)
    .select('id, class_types, belt_system')
    .single()

  if (!gym) return NextResponse.json({ error: 'Gym not found' }, { status: 404 })

  const today    = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

  const [membersRes, attendanceRes, classesRes] = await Promise.all([
    supabase.from('members')
      .select('id, first_name, last_name, belt, stripes')
      .eq('gym_id', gym.id).eq('is_active', true).order('last_name'),
    supabase.from('attendance')
      .select('id, checked_in_at, class_type, member_id, class_id')
      .eq('gym_id', gym.id)
      .gte('checked_in_at', today.toISOString())
      .order('checked_in_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('get_classes_for_gym', { p_gym_id: gym.id, p_from: today.toISOString() }),
  ])

  return NextResponse.json({
    gym:        { id: gym.id, class_types: gym.class_types, belt_system: gym.belt_system },
    members:    membersRes.data ?? [],
    attendance: attendanceRes.data ?? [],
    classes:    (classesRes.data ?? []).filter((c: { starts_at: string; is_cancelled: boolean }) => {
      const s = new Date(c.starts_at)
      return s >= today && s < tomorrow && !c.is_cancelled
    }),
  })
}
