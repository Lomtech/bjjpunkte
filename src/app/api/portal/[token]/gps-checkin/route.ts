import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Haversine distance in metres */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const { lat, lng } = body as { lat?: number; lng?: number }
  if (lat === undefined || lng === undefined) {
    return NextResponse.json({ error: 'GPS-Koordinaten fehlen' }, { status: 400 })
  }

  const supabase = serviceClient()

  // Resolve member
  const { data: member, error: memberErr } = await supabase
    .from('members')
    .select('id, gym_id, first_name, last_name')
    .eq('portal_token', token)
    .single()

  if (memberErr || !member) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  // Fetch gym GPS settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gym } = await (supabase.from('gyms') as any)
    .select('latitude, longitude, gps_radius_meters')
    .eq('id', member.gym_id)
    .single()

  if (!gym?.latitude || !gym?.longitude) {
    return NextResponse.json({ error: 'GPS-Standort des Gyms nicht konfiguriert' }, { status: 422 })
  }

  const radius = gym.gps_radius_meters ?? 300
  const dist = haversineMeters(lat, lng, gym.latitude, gym.longitude)

  if (dist > radius) {
    return NextResponse.json(
      { error: `Du bist ${Math.round(dist)} m vom Gym entfernt (Radius: ${radius} m)` },
      { status: 403 }
    )
  }

  // Find current or upcoming class (starts within ±60 min)
  const now = new Date()
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

  const { data: classes } = await supabase
    .from('classes')
    .select('id, title, starts_at, ends_at, class_type')
    .eq('gym_id', member.gym_id)
    .eq('is_cancelled', false)
    .gte('starts_at', windowStart)
    .lte('starts_at', windowEnd)
    .order('starts_at', { ascending: true })
    .limit(1)

  const cls = classes?.[0] ?? null

  const checkedInAt = now.toISOString()

  // Dedup: if already checked in for this class (or today without a class), return early
  if (cls) {
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('member_id', member.id)
      .eq('class_id', cls.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ success: true, attendance: existing, class: cls, distance_m: Math.round(dist), already_checked_in: true })
    }
  } else {
    // No class — dedup by same calendar day
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
    const dayEnd   = new Date(now); dayEnd.setHours(23, 59, 59, 999)
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('member_id', member.id)
      .is('class_id', null)
      .gte('checked_in_at', dayStart.toISOString())
      .lte('checked_in_at', dayEnd.toISOString())
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ success: true, attendance: existing, class: null, distance_m: Math.round(dist), already_checked_in: true })
    }
  }

  // Insert attendance record
  const { data: att, error: attErr } = await supabase
    .from('attendance')
    .insert({
      gym_id:        member.gym_id,
      member_id:     member.id,
      class_id:      cls?.id ?? null,
      class_type:    cls?.class_type ?? null,
      checked_in_at: checkedInAt,
    })
    .select()
    .single()

  if (attErr) {
    return NextResponse.json({ error: attErr.message }, { status: 500 })
  }

  // If there's a class, also upsert a booking as checked_in
  if (cls) {
    await supabase
      .from('class_bookings')
      .upsert(
        {
          gym_id:    member.gym_id,
          member_id: member.id,
          class_id:  cls.id,
          status:    'checked_in',
        },
        { onConflict: 'member_id,class_id' }
      )
  }

  return NextResponse.json({
    success:      true,
    attendance:   att,
    class:        cls ?? null,
    distance_m:   Math.round(dist),
  })
}
