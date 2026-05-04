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
  const { lat, lng } = body as { lat?: unknown; lng?: unknown }
  // Strict coordinate validation — NaN/Infinity would silently bypass the distance check
  if (
    typeof lat !== 'number' || typeof lng !== 'number' ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return NextResponse.json({ error: 'Ungültige GPS-Koordinaten' }, { status: 400 })
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

  // Find class: started at most 3 h ago OR starts within the next 30 min
  const now = new Date()
  const retroStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString() // now − 3 h
  const aheadEnd   = new Date(now.getTime() + 30 * 60 * 1000).toISOString()     // now + 30 min

  const { data: classes } = await supabase
    .from('classes')
    .select('id, title, starts_at, ends_at, class_type')
    .eq('gym_id', member.gym_id)
    .eq('is_cancelled', false)
    .lte('starts_at', aheadEnd)  // started before now+30min
    .gte('ends_at', retroStart)  // ended at most 3 h ago
    .order('starts_at', { ascending: false }) // prefer most recent class
    .limit(1)

  const cls = classes?.[0] ?? null

  // Require a class — no check-in without a schedule entry
  if (!cls) {
    return NextResponse.json(
      { error: 'Kein aktiver Kurs. Check-in ist nur während oder bis zu 3 Std. nach einem Training möglich.' },
      { status: 422 }
    )
  }

  // Dedup: already checked in for this class → return silently
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('member_id', member.id)
    .eq('class_id', cls.id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ success: true, attendance: existing, class: cls, distance_m: Math.round(dist), already_checked_in: true })
  }

  const checkedInAt = now.toISOString()

  // Insert attendance record
  const { data: att, error: attErr } = await supabase
    .from('attendance')
    .insert({
      gym_id:        member.gym_id,
      member_id:     member.id,
      class_id:      cls.id,
      class_type:    cls.class_type ?? null,
      checked_in_at: checkedInAt,
    })
    .select()
    .single()

  if (attErr) {
    return NextResponse.json({ error: attErr.message }, { status: 500 })
  }

  // Upsert booking so member appears in schedule roster
  await supabase
    .from('class_bookings')
    .upsert(
      { gym_id: member.gym_id, member_id: member.id, class_id: cls.id, status: 'checked_in' },
      { onConflict: 'member_id,class_id' }
    )

  return NextResponse.json({
    success:    true,
    attendance: att,
    class:      cls,
    distance_m: Math.round(dist),
  })
}
