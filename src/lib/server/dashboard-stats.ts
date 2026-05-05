import 'server-only'
import { createClient } from '@/lib/supabase/server'

export interface AttendanceRow  { id: string; checked_in_at: string; class_type: string; member_id: string }
export interface PromotionRow   { id: string; new_belt: string; new_stripes: number; promoted_at: string; member_id: string }
export interface MemberRow      { id: string; first_name: string; last_name: string }
export interface BirthdayRow    { id: string; first_name: string; last_name: string; date_of_birth: string }
export interface PaymentRow     { id: string; member_id: string; amount_cents: number; paid_at: string | null; status: string }

export interface DashboardStats {
  gym:              { id: string; signup_token: string | null; slug: string | null }
  totalMembers:     number
  activeMembers:    number
  todayAttendance:  AttendanceRow[]
  recentPromotions: PromotionRow[]
  beltStats:        { belt: string }[]
  membersList:      MemberRow[]
  birthdayList:     BirthdayRow[]
  contractList:     { id: string }[]
  monthPayments:    { amount_cents: number }[]
  allPayments:      PaymentRow[]
  monthAttendance:  { member_id: string }[]
  allAttendance:    { member_id: string; checked_in_at: string }[]
}

export async function fetchDashboardStats(): Promise<DashboardStats | null> {
  const supabase = await createClient()

  // RLS returns only the gym owned by the authenticated user
  const { data: gym } = await supabase
    .from('gyms').select('id, signup_token, slug').single()
  if (!gym) return null

  const gymId         = gym.id
  const today         = new Date().toISOString().split('T')[0]
  const in30          = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const startOfMonth  = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

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
    supabase.from('members').select('id, first_name, last_name').eq('gym_id', gymId).eq('is_active', true).limit(500),
    supabase.from('members').select('id, first_name, last_name, date_of_birth').eq('gym_id', gymId).eq('is_active', true).not('date_of_birth', 'is', null),
    supabase.from('members').select('id, contract_end_date').eq('gym_id', gymId).eq('is_active', true).not('contract_end_date', 'is', null).lte('contract_end_date', in30),
    supabase.from('payments').select('amount_cents').eq('gym_id', gymId).eq('status', 'paid').gte('paid_at', startOfMonth),
    supabase.from('payments').select('id, member_id, amount_cents, paid_at, status').eq('gym_id', gymId).order('paid_at', { ascending: false }).limit(20),
    supabase.from('attendance').select('member_id').eq('gym_id', gymId).gte('checked_in_at', startOfMonth),
    supabase.from('attendance').select('member_id, checked_in_at').eq('gym_id', gymId).gte('checked_in_at', ninetyDaysAgo).order('checked_in_at', { ascending: false }).limit(3000),
  ])

  return {
    gym:              { id: gymId, signup_token: gym.signup_token, slug: gym.slug },
    totalMembers:     total ?? 0,
    activeMembers:    active ?? 0,
    todayAttendance:  (todayAttendance  ?? []) as AttendanceRow[],
    recentPromotions: (recentPromotions ?? []) as PromotionRow[],
    beltStats:        (beltStats        ?? []) as { belt: string }[],
    membersList:      (membersList      ?? []) as MemberRow[],
    birthdayList:     (birthdayList     ?? []) as BirthdayRow[],
    contractList:     (contractList     ?? []) as { id: string }[],
    monthPayments:    (monthPayments    ?? []) as { amount_cents: number }[],
    allPayments:      (allPayments      ?? []) as PaymentRow[],
    monthAttendance:  (monthAttendance  ?? []) as { member_id: string }[],
    allAttendance:    (allAttendance    ?? []) as { member_id: string; checked_in_at: string }[],
  }
}
