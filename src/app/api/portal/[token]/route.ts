import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public endpoint — uses service role to bypass RLS, token is the auth mechanism
function adminClient() {
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

  const supabase = adminClient()

  // Look up member by portal_token
  const { data: member } = await supabase
    .from('members')
    .select('id, gym_id, first_name, last_name, email, belt, stripes, join_date, is_active, subscription_status, date_of_birth, notes')
    .eq('portal_token', token)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  const memberId = (member as { id: string }).id
  const gymId = (member as { gym_id: string }).gym_id

  const [
    { data: gym },
    { data: attendance, count: totalSessions },
    { data: payments },
  ] = await Promise.all([
    supabase.from('gyms').select('name').eq('id', gymId).single(),
    supabase.from('attendance')
      .select('id, checked_in_at, class_type', { count: 'exact' })
      .eq('member_id', memberId)
      .order('checked_in_at', { ascending: false })
      .limit(50),
    supabase.from('payments')
      .select('id, amount_cents, status, paid_at, created_at')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(24),
  ])

  const totalPaidCents = (payments ?? [])
    .filter((p: { status: string }) => p.status === 'paid')
    .reduce((sum: number, p: { amount_cents: number }) => sum + p.amount_cents, 0)

  return NextResponse.json({
    member,
    gym,
    attendance,
    totalSessions,
    payments,
    totalPaidCents,
  })
}
