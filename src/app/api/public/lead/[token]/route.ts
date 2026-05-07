import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token || token.length < 20 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const supabase = serviceClient()

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, first_name, last_name, email, status, gym_id')
    .eq('lead_token', token)
    .single()

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Interessent nicht gefunden' }, { status: 404 })
  }

  const leadId = lead.id
  const gymId  = lead.gym_id

  // Optional ?from=ISO for week-based navigation; default = start of current week
  const url     = new URL(req.url)
  const fromRaw = url.searchParams.get('from')
  const from    = fromRaw ? new Date(fromRaw) : (() => {
    const d = new Date(); const day = d.getDay()
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); d.setHours(0, 0, 0, 0); return d
  })()
  const to = new Date(from); to.setDate(from.getDate() + 7)

  // If this is a classes-only refresh (has ?from), skip gym/bookings fetch
  const classesOnly = !!fromRaw

  const classesQuery = supabase
    .from('classes')
    .select('id, title, class_type, instructor, starts_at, ends_at, max_capacity')
    .eq('gym_id', gymId)
    .eq('is_cancelled', false)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at', { ascending: true })

  if (classesOnly) {
    const { data: classes } = await classesQuery
    return NextResponse.json({ classes: classes ?? [] })
  }

  const [
    { data: gym },
    { data: classes },
    { data: bookings },
  ] = await Promise.all([
    supabase
      .from('gyms')
      .select('id, name, logo_url, address, slug, latitude, longitude')
      .eq('id', gymId)
      .single(),

    classesQuery,

    supabase
      .from('lead_bookings')
      .select('id, class_id, status, booked_at, checked_in_at')
      .eq('lead_id', leadId),
  ])

  return NextResponse.json({
    lead: {
      id:         lead.id,
      first_name: lead.first_name,
      last_name:  lead.last_name,
      email:      lead.email,
      status:     lead.status,
    },
    gym:      gym ?? null,
    classes:  classes ?? [],
    bookings: bookings ?? [],
  })
}
