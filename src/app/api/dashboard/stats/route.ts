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

  // Single query to get gym with ALL fields needed (was previously 2 round trips)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gym } = await (supabase.from('gyms') as any)
    .select('id, signup_token, slug')
    .single()

  if (!gym) return NextResponse.json({ error: 'Gym not found' }, { status: 404 })

  const gymId = gym.id
  const today          = new Date().toISOString().split('T')[0]
  const in30           = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const startOfMonth   = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const ninetyDaysAgo  = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // All 12 queries fire in parallel — runs server-side (5 ms to Supabase) not client-side (~80 ms)
  const [
    { count: total },
    { count: active },
    { data: todayAttendance },
    { data: recentPromotions },
    { data: beltStats },
    { data: membersList },
    { data: birthdayList },
    { data: contractList },
    { data: monthPayments },
    { data: allPayments },
    { data: monthAttendance },
    { data: allAttendance },
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId),
    supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('is_active', true),
    supabase.from('attendance').select('id, checked_in_at, class_type, member_id').eq('gym_id', gymId).gte('checked_in_at', today).order('checked_in_at', { ascending: false }),
    supabase.from('belt_promotions').select('id, new_belt, new_stripes, promoted_at, member_id').eq('gym_id', gymId).order('promoted_at', { ascending: false }).limit(5),
    supabase.from('members').select('belt').eq('gym_id', gymId).eq('is_active', true),
    supabase.from('members').select('id, first_name, last_name').eq('gym_id', gymId).eq('is_active', true),
    supabase.from('members').select('id, first_name, last_name, date_of_birth').eq('gym_id', gymId).eq('is_active', true).not('date_of_birth', 'is', null),
    supabase.from('members').select('id, contract_end_date').eq('gym_id', gymId).eq('is_active', true).not('contract_end_date', 'is', null).lte('contract_end_date', in30),
    supabase.from('payments').select('amount_cents').eq('gym_id', gymId).eq('status', 'paid').gte('paid_at', startOfMonth),
    supabase.from('payments').select('id, member_id, amount_cents, paid_at, status').eq('gym_id', gymId).order('paid_at', { ascending: false }).limit(20),
    supabase.from('attendance').select('member_id').eq('gym_id', gymId).gte('checked_in_at', startOfMonth),
    supabase.from('attendance').select('member_id, checked_in_at').eq('gym_id', gymId).gte('checked_in_at', ninetyDaysAgo).order('checked_in_at', { ascending: false }),
  ])

  return NextResponse.json({
    gym:              { id: gymId, signup_token: gym.signup_token, slug: gym.slug },
    totalMembers:     total ?? 0,
    activeMembers:    active ?? 0,
    todayAttendance:  todayAttendance ?? [],
    recentPromotions: recentPromotions ?? [],
    beltStats:        beltStats ?? [],
    membersList:      membersList ?? [],
    birthdayList:     birthdayList ?? [],
    contractList:     contractList ?? [],
    monthPayments:    monthPayments ?? [],
    allPayments:      allPayments ?? [],
    monthAttendance:  monthAttendance ?? [],
    allAttendance:    allAttendance ?? [],
  })
}
