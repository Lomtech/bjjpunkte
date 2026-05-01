import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const supabase = serviceClient()

  const { data: member, error: memberErr } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, belt, stripes, join_date, is_active, subscription_status, date_of_birth, contract_end_date, gym_id, plan_id, requested_plan_id, cancellation_requested_at')
    .eq('portal_token', token)
    .single()

  if (memberErr || !member) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  const memberId = member.id
  const gymId = member.gym_id

  const [
    { data: gym },
    { data: attendance },
    { count: totalSessions },
    { data: payments },
    { data: plans },
    { data: announcements },
  ] = await Promise.all([
    (supabase.from('gyms') as any).select('name, belt_system, belt_system_enabled, logo_url').eq('id', gymId).single(),
    supabase.from('attendance').select('id, checked_in_at, class_type').eq('member_id', memberId).order('checked_in_at', { ascending: false }).limit(50),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('member_id', memberId),
    supabase.from('payments').select('id, amount_cents, status, paid_at, created_at, checkout_url').eq('member_id', memberId).order('created_at', { ascending: false }).limit(24),
    (supabase.from('membership_plans') as any).select('id, name, description, price_cents, billing_interval, contract_months, sort_order').eq('gym_id', gymId).eq('is_active', true).order('sort_order'),
    (supabase.from('gym_announcements') as any).select('id, title, body, is_pinned, expires_at, created_at').eq('gym_id', gymId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(10),
  ])

  const totalPaidCents = (payments ?? [])
    .filter((p: any) => p.status === 'paid')
    .reduce((sum: number, p: any) => sum + (p.amount_cents ?? 0), 0)

  const { data: bookings } = await supabase
    .from('class_bookings')
    .select('status, classes(id, title, class_type, starts_at, ends_at, instructor)')
    .eq('member_id', memberId)
    .in('status', ['confirmed', 'waitlist'])
    .gte('classes.starts_at', new Date().toISOString())
    .lte('classes.starts_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())

  // Filter out expired announcements
  const now = new Date()
  const activeAnnouncements = (announcements ?? []).filter((a: any) =>
    !a.expires_at || new Date(a.expires_at) > now
  )

  return NextResponse.json({
    member: {
      id:                        member.id,
      first_name:                member.first_name,
      last_name:                 member.last_name,
      email:                     member.email,
      belt:                      member.belt,
      stripes:                   member.stripes,
      join_date:                 member.join_date,
      is_active:                 member.is_active,
      subscription_status:       member.subscription_status,
      date_of_birth:             member.date_of_birth,
      contract_end_date:         member.contract_end_date,
      plan_id:                   member.plan_id,
      requested_plan_id:         member.requested_plan_id,
      cancellation_requested_at: member.cancellation_requested_at,
    },
    gym:                gym ?? null,
    attendance:         attendance ?? [],
    totalSessions:      totalSessions ?? 0,
    payments:           payments ?? [],
    totalPaidCents,
    plans:              plans ?? [],
    announcements:      activeAnnouncements,
    upcoming_bookings: (bookings ?? []).map((b: any) => ({
      class_id:       b.classes?.id,
      title:          b.classes?.title,
      class_type:     b.classes?.class_type,
      starts_at:      b.classes?.starts_at,
      ends_at:        b.classes?.ends_at,
      instructor:     b.classes?.instructor,
      booking_status: b.status,
    })).filter((b: any) => b.class_id),
  })
}
