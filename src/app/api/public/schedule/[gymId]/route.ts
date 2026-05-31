import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cacheGet, cacheSet } from '@/lib/redis-cache'

// Sprint C 2026-05-30: Public-Schedule-Cache.
// /schedule/[gymId] ist eine öffentliche Page (Embed in Gym-Websites).
// Klassen-Listen ändern sich pro Stunde, nicht pro Sekunde. 60s TTL = wenig
// Drift, aber massiver TTFB-Gewinn bei wiederholten Hits (z.B. Embed-iframe).
//
// Invalidation: nicht nötig — 60s TTL ist tolerabel.
const TTL_SEC = 60

function cacheKey(gymId: string): string {
  return `pub:schedule:${gymId}`
}

interface CachedPayload {
  gym: { name: string | null; address: string | null; signup_enabled: boolean | null }
  classes: Array<Record<string, unknown>>
}

export async function GET(_req: Request, { params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params

  // L1: Redis
  const cached = await cacheGet<CachedPayload>(cacheKey(gymId))
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'x-cache': 'HIT', 'cache-control': 'public, max-age=30' },
    })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify gym exists and is active
  const { data: gym } = await supabase
    .from('gyms')
    .select('id, name, address, phone, email, signup_token, signup_enabled')
    .eq('id', gymId)
    .single()

  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const now = new Date()
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  const { data: classes } = await supabase
    .from('classes')
    .select('id, title, class_type, instructor, starts_at, ends_at, max_capacity, is_cancelled')
    .eq('gym_id', gymId)
    .eq('is_cancelled', false)
    .gte('starts_at', now.toISOString())
    .lte('starts_at', in14Days.toISOString())
    .order('starts_at', { ascending: true })

  // Get confirmed booking counts per class
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classIds = (classes ?? []).map((c: any) => c.id)
  const { data: bookings } = classIds.length > 0
    ? await supabase
        .from('class_bookings')
        .select('class_id')
        .in('class_id', classIds)
        .eq('status', 'confirmed')
    : { data: [] }

  const bookingCounts: Record<string, number> = {}
  for (const b of bookings ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bookingCounts[(b as any).class_id] = (bookingCounts[(b as any).class_id] ?? 0) + 1
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = (classes ?? []).map((c: any) => ({
    ...c,
    confirmed_count: bookingCounts[c.id] ?? 0,
    spots_left: c.max_capacity != null ? c.max_capacity - (bookingCounts[c.id] ?? 0) : null,
  }))

  const payload: CachedPayload = {
    gym: { name: gym.name, address: gym.address, signup_enabled: gym.signup_enabled },
    classes: enriched,
  }

  // Best-effort cache write — silent-fail
  await cacheSet(cacheKey(gymId), payload, TTL_SEC)

  return NextResponse.json(payload, {
    headers: { 'x-cache': 'MISS', 'cache-control': 'public, max-age=30' },
  })
}
