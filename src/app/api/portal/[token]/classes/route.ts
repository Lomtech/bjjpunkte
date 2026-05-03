import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const supabase = serviceClient()

  // Resolve member by portal_token
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase as any)
    .from('members')
    .select('id, gym_id')
    .eq('portal_token', token)
    .single()

  if (!member) return NextResponse.json({ error: 'Ungültiger Token' }, { status: 401 })

  // Support ?from=ISO for week navigation; default = start of current week
  const url      = new URL(req.url)
  const fromParam = url.searchParams.get('from')
  const fromDate  = fromParam ? new Date(fromParam) : (() => {
    const d = new Date(); const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); d.setHours(0,0,0,0); return d
  })()
  const toDate = new Date(fromDate.getTime() + 7 * 24 * 60 * 60 * 1000)

  const now    = fromDate.toISOString()
  const in14d  = toDate.toISOString()

  // Fetch upcoming classes for this gym (14 days)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: classes } = await (supabase as any)
    .from('classes')
    .select('id, title, class_type, instructor, starts_at, ends_at, max_capacity')
    .eq('gym_id', member.gym_id)
    .eq('is_cancelled', false)
    .gte('starts_at', now)
    .lte('starts_at', in14d)
    .order('starts_at')

  if (!classes?.length) return NextResponse.json([])

  const classIds = classes.map((c: { id: string }) => c.id)

  // All bookings with member names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookings } = await (supabase as any)
    .from('class_bookings')
    .select('class_id, status, member_id, members(first_name, last_name)')
    .in('class_id', classIds)
    .neq('status', 'cancelled')

  const confirmedCount: Record<string, number> = {}
  const waitlistCount:  Record<string, number> = {}
  const myStatus:       Record<string, string> = {}
  const participants:   Record<string, { name: string; status: string }[]> = {}

  type RawBooking = {
    class_id: string; status: string; member_id: string
    members: { first_name: string; last_name: string } | null
  }

  for (const b of (bookings ?? []) as RawBooking[]) {
    if (b.status === 'confirmed') confirmedCount[b.class_id] = (confirmedCount[b.class_id] ?? 0) + 1
    if (b.status === 'waitlist')  waitlistCount[b.class_id]  = (waitlistCount[b.class_id]  ?? 0) + 1
    if (b.member_id === member.id) myStatus[b.class_id] = b.status

    // Build participant list (first name + last initial)
    if (b.members && (b.status === 'confirmed' || b.status === 'checked_in')) {
      const name = `${b.members.first_name} ${b.members.last_name[0]}.`
      if (!participants[b.class_id]) participants[b.class_id] = []
      participants[b.class_id].push({ name, status: b.status })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = classes.map((c: any) => ({
    id:              c.id,
    title:           c.title,
    class_type:      c.class_type,
    instructor:      c.instructor,
    starts_at:       c.starts_at,
    ends_at:         c.ends_at,
    max_capacity:    c.max_capacity,
    confirmed_count: confirmedCount[c.id] ?? 0,
    waitlist_count:  waitlistCount[c.id]  ?? 0,
    my_status:       myStatus[c.id] ?? null,
    participants:    participants[c.id]   ?? [],
  }))

  return NextResponse.json(result)
}
