import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token || token.length < 10) {
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

  const now14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: gym },
    { data: classes },
    { data: bookings },
  ] = await Promise.all([
    supabase
      .from('gyms')
      .select('id, name, logo_url, address, slug')
      .eq('id', gymId)
      .single(),

    supabase
      .from('classes')
      .select('id, title, class_type, instructor, starts_at, ends_at, max_capacity')
      .eq('gym_id', gymId)
      .eq('is_cancelled', false)
      .gte('starts_at', new Date().toISOString())
      .lte('starts_at', now14)
      .order('starts_at', { ascending: true }),

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
