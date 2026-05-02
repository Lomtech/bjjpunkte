import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = serviceClient()

  const { data: gym, error } = await supabase
    .from('gyms')
    .select('id, name, logo_url, address, phone, email, class_types, belt_system, belt_system_enabled, sport_type')
    .eq('slug', slug)
    .single()

  if (error || !gym) {
    return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })
  }

  // Upcoming classes — next 14 days
  const now  = new Date().toISOString()
  const end  = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: classes } = await supabase
    .from('classes')
    .select('id, title, class_type, instructor, starts_at, ends_at, max_capacity')
    .eq('gym_id', gym.id)
    .gte('starts_at', now)
    .lte('starts_at', end)
    .order('starts_at')
    .limit(30)

  // Membership plans (public)
  const { data: plans } = await supabase
    .from('membership_plans' as never)
    .select('id, name, description, price_cents, billing_interval, contract_months')
    .eq('gym_id', gym.id)
    .eq('is_active', true)
    .order('sort_order' as never)

  return NextResponse.json({
    gym: {
      id:                   gym.id,
      name:                 gym.name,
      logo_url:             gym.logo_url,
      address:              gym.address,
      phone:                gym.phone,
      email:                gym.email,
      class_types:          gym.class_types,
      sport_type:           (gym as never as { sport_type?: string }).sport_type ?? null,
      belt_system_enabled:  (gym as never as { belt_system_enabled?: boolean }).belt_system_enabled ?? true,
    },
    classes: classes ?? [],
    plans:   plans   ?? [],
  })
}
