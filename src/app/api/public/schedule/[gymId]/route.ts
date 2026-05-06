import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request, { params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params
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
    bookingCounts[(b as any).class_id] = (bookingCounts[(b as any).class_id] ?? 0) + 1
  }

  const enriched = (classes ?? []).map((c: any) => ({
    ...c,
    confirmed_count: bookingCounts[c.id] ?? 0,
    spots_left: c.max_capacity != null ? c.max_capacity - (bookingCounts[c.id] ?? 0) : null,
  }))

  return NextResponse.json({
    gym: { name: gym.name, address: gym.address, signup_enabled: gym.signup_enabled },
    classes: enriched,
  })
}
