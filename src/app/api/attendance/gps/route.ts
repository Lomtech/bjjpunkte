import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, ClassType } from '@/types/database'
import { withApiHandler } from '@/lib/api/with-error-handler'

function serviceClient() {
  return createClient<Database>(
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

/**
 * GPS-verified operator check-in.
 * Verifies the operator's device is within the gym's GPS radius,
 * then creates attendance + upserts class_bookings so the member
 * appears in the schedule roster immediately.
 */
export const POST = withApiHandler('attendance.gps.post', async (req: Request) => {
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const svc = serviceClient()
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await anonClient.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Resolve gym — owner first, then staff fallback
   
  const gymRow = await svc.from('gyms')
    .select('id, latitude, longitude, gps_radius_meters')
    .eq('owner_id', user.id)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let gym: any = gymRow.data

  if (!gym) {
     
    const { data: staff } = await svc.from('gym_staff')
      .select('gym_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (staff?.gym_id) {
       
      const { data: g } = await svc.from('gyms')
        .select('id, latitude, longitude, gps_radius_meters')
        .eq('id', staff.gym_id)
        .maybeSingle()
      gym = g
    }
  }

  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  if (!gym.latitude || !gym.longitude) {
    return NextResponse.json(
      { error: 'GPS-Standort des Gyms nicht konfiguriert. Bitte in den Einstellungen eintragen.' },
      { status: 422 }
    )
  }

  const body = await req.json()
  const { member_id, class_type, class_id, lat, lng } = body as {
    member_id: string; class_type?: string; class_id?: string | null
    lat: number; lng: number
  }

  if (!member_id) return NextResponse.json({ error: 'member_id fehlt' }, { status: 400 })
  if (
    typeof lat !== 'number' || typeof lng !== 'number' ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return NextResponse.json({ error: 'Ungültige GPS-Koordinaten' }, { status: 400 })
  }

  // GPS radius check
  const radius = gym.gps_radius_meters ?? 300
  const dist   = haversineMeters(lat, lng, gym.latitude, gym.longitude)

  if (dist > radius) {
    return NextResponse.json(
      { error: `Du bist ${Math.round(dist)} m vom Gym entfernt (erlaubt: ${radius} m). Bitte im Gym einchecken.` },
      { status: 403 }
    )
  }

  // Verify member belongs to this gym + lade membership_source + Punch-Card-Stand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (svc.from('members') as any)
    .select('id, membership_source, punch_units_remaining')
    .eq('id', member_id)
    .eq('gym_id', gym.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })

  // Anbieter-Mitgliedschaften (Wellpass / Hansefit / EGYM / Urban Sports) →
  // Check-in wird automatisch als Anbieter-Checkin markiert. Ermöglicht
  // separate Statistik + späteres Reporting an Wellpass-Anbieter.
  const memberRow = member as { membership_source?: string | null; punch_units_remaining?: number | null }
  const memberSource = memberRow.membership_source ?? null
  const isProviderMember = memberSource != null
    && ['wellpass', 'hansefit', 'egym', 'urban_sports'].includes(memberSource)
  const isPunchCard = memberRow.punch_units_remaining !== null && memberRow.punch_units_remaining !== undefined

  // Dedup: don't create a second attendance record for the same class
  if (class_id) {
    const { data: existing } = await svc.from('attendance')
      .select('id, checked_in_at, class_type')
      .eq('member_id', member_id)
      .eq('class_id', class_id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, entry: existing, distance_m: Math.round(dist), already_checked_in: true, via_wellpass: isProviderMember, punch_units_remaining: memberRow.punch_units_remaining ?? null })
    }
  }

  // 10er-Karte: atomar 1 Einheit abziehen BEVOR attendance angelegt wird.
  // Bei 0 Einheiten raised die RPC 'insufficient_punch_units' (ERRCODE 23514).
  let punchUnitsRemaining: number | null = null
  if (isPunchCard) {
    const { data: rpcData, error: rpcErr } = await svc.rpc('consume_punch_unit', {
      p_member_id: member_id,
      p_gym_id: gym.id,
    })
    if (rpcErr) {
      if (rpcErr.message?.includes('insufficient_punch_units')) {
        return NextResponse.json(
          { error: 'Keine Einheiten mehr auf der 10er-Karte. Bitte beim Gym aufladen.', code: 'insufficient_punch_units' },
          { status: 422 }
        )
      }
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }
    punchUnitsRemaining = rpcData
  }

  // Insert attendance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error: attErr } = await (svc.from('attendance') as any)
    .insert({
      gym_id:        gym.id,
      member_id,
      class_type:    (class_type ?? 'gi') as ClassType,
      class_id:      class_id ?? null,
      checked_in_at: new Date().toISOString(),
      via_wellpass:                  isProviderMember,
      membership_source_at_checkin:  memberSource,
    })
    .select('id, checked_in_at, class_type')
    .single()

  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 })

  // Upsert class_bookings so member shows up in schedule roster
  if (class_id) {

    await svc.from('class_bookings').upsert(
      { gym_id: gym.id, member_id, class_id, status: 'confirmed' as const },
      { onConflict: 'member_id,class_id' }
    )
  }

  return NextResponse.json({ ok: true, entry, distance_m: Math.round(dist), punch_units_remaining: punchUnitsRemaining })
})
