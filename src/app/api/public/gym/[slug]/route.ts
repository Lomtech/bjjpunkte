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
    .select(`
      id, name, logo_url, address, phone, email,
      class_types, belt_system, belt_system_enabled, sport_type,
      tagline, about, about_blocks, hero_image_url, hero_image_position, gallery_urls, video_url, video_urls,
      whatsapp_number, instagram_url, facebook_url, website_url,
      founded_year, opening_hours, impressum_text
    `)
    .eq('slug', slug)
    .single()

  if (error || !gym) {
    return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: classes }, { data: plans }, { data: posts }] = await Promise.all([
    supabase
      .from('classes')
      .select('id, title, class_type, instructor, starts_at, ends_at, max_capacity')
      .eq('gym_id', gym.id)
      .eq('is_cancelled', false)
      .gte('starts_at', now)
      .lte('starts_at', end)
      .order('starts_at')
      .limit(50),
    supabase
      .from('membership_plans' as never)
      .select('id, name, description, price_cents, billing_interval, contract_months')
      .eq('gym_id', gym.id)
      .eq('is_active', true)
      .order('sort_order' as never),
    supabase
      .from('posts' as never)
      .select('id, title, cover_url, blocks, published_at, created_at')
      .eq('gym_id', gym.id)
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false } as never)
      .limit(10),
  ])

  const g = gym as typeof gym & Record<string, unknown>

  return NextResponse.json({
    gym: {
      id:               gym.id,
      name:             gym.name,
      logo_url:         gym.logo_url,
      address:          gym.address,
      phone:            gym.phone,
      email:            gym.email,
      sport_type:       g.sport_type ?? null,
      belt_system_enabled: g.belt_system_enabled ?? true,
      tagline:          g.tagline ?? null,
      about:            g.about ?? null,
      about_blocks:     (g.about_blocks as unknown[]) ?? [],
      hero_image_url:      g.hero_image_url ?? null,
      hero_image_position: (g.hero_image_position as number) ?? 50,
      gallery_urls:        (g.gallery_urls as string[]) ?? [],
      video_url:        g.video_url ?? null,
      video_urls:       (g.video_urls as string[]) ?? [],
      whatsapp_number:  g.whatsapp_number ?? null,
      instagram_url:    g.instagram_url ?? null,
      facebook_url:     g.facebook_url ?? null,
      website_url:      g.website_url ?? null,
      founded_year:     g.founded_year ?? null,
      opening_hours:    g.opening_hours ?? null,
      impressum_text:   g.impressum_text ?? null,
    },
    classes: classes ?? [],
    plans:   plans   ?? [],
    posts:   posts   ?? [],
  })
}
