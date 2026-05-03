import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: Request) {
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Verify identity via auth client
  const { data: { user }, error: userErr } = await authClient(accessToken).auth.getUser(accessToken)
  if (!user || userErr) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Use service client for data queries (bypasses RLS column issues)
  const service = serviceClient()

  const { data: gym, error: gymErr } = await (service.from('gyms') as any)
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (gymErr || !gym) {
    return NextResponse.json(
      { error: 'Gym nicht gefunden', detail: gymErr?.message ?? null },
      { status: 404 }
    )
  }

  const [{ data: plans }, { data: announcements }, { data: posts }] = await Promise.all([
    (service.from('membership_plans') as any)
      .select('name, description, price_cents, billing_interval, contract_months, is_active, sort_order')
      .eq('gym_id', gym.id).order('sort_order'),
    (service.from('gym_announcements') as any)
      .select('title, body, is_pinned, expires_at')
      .eq('gym_id', gym.id),
    (service.from('posts') as any)
      .select('title, cover_url, blocks, published_at')
      .eq('gym_id', gym.id)
      .not('published_at', 'is', null),
  ])

  return NextResponse.json({
    version: 2,
    exported_at: new Date().toISOString(),
    gym: {
      name:                gym.name,
      address:             gym.address,
      phone:               gym.phone,
      email:               gym.email,
      monthly_fee_cents:   gym.monthly_fee_cents,
      slug:                gym.slug,
      sport_type:          gym.sport_type,
      belt_system:         gym.belt_system,
      belt_system_enabled: gym.belt_system_enabled,
      stripes_enabled:     gym.stripes_enabled ?? null,
      class_types:         gym.class_types,
      contract_template:   gym.contract_template,
      signup_enabled:      gym.signup_enabled,
      whatsapp_number:     gym.whatsapp_number,
      instagram_url:       gym.instagram_url,
      facebook_url:        gym.facebook_url,
      website_url:         gym.website_url,
      hero_title:          gym.hero_title ?? null,
      hero_subtitle:       gym.hero_subtitle ?? null,
      accent_color:        gym.accent_color ?? null,
      is_kleinunternehmer: gym.is_kleinunternehmer ?? null,
      invoice_prefix:      gym.invoice_prefix ?? null,
      logo_url:            gym.logo_url,
      hero_image_url:      gym.hero_image_url,
      hero_image_position: gym.hero_image_position,
      video_url:           gym.video_url,
      video_urls:          gym.video_urls,
    },
    membership_plans: plans ?? [],
    announcements:    announcements ?? [],
    posts:            posts ?? [],
  })
}
