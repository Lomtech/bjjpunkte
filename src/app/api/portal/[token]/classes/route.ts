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

  // Confirmed counts per class
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookings } = await (supabase as any)
    .from('class_bookings')
    .select('class_id, status')
    .in('class_id', classIds)
    .neq('status', 'cancelled')

  // This member's bookings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myBookings } = await (supabase as any)
    .from('class_bookings')
    .select('class_id, status')
    .in('class_id', classIds)
    .eq('member_id', member.id)
    .neq('status', 'cancelled')

  const confirmedCount: Record<string, number> = {}
  const waitlistCount: Record<string, number>  = {}
  const myStatus: Record<string, string>        = {}

  for (const b of (bookings ?? []) as { class_id: string; status: string }[]) {
    if (b.status === 'confirmed')  confirmedCount[b.class_id] = (confirmedCount[b.class_id] ?? 0) + 1
    if (b.status === 'waitlist')   waitlistCount[b.class_id]  = (waitlistCount[b.class_id]  ?? 0) + 1
  }
  for (const b of (myBookings ?? []) as { class_id: string; status: string }[]) {
    myStatus[b.class_id] = b.status
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
  }))

  return NextResponse.json(result)
}
