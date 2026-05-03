import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function GET(req: Request) {
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await (supabase.from('gyms') as any)
    .select('id, name, address, phone, email, monthly_fee_cents, slug, sport_type, belt_system, belt_system_enabled, stripes_enabled, class_types, contract_template, signup_enabled, whatsapp_number, instagram_url, facebook_url, website_url, hero_title, hero_subtitle, accent_color, is_kleinunternehmer, invoice_prefix')
    .eq('owner_id', user.id)
    .single()

  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const [{ data: plans }, { data: announcements }, { data: posts }] = await Promise.all([
    (supabase.from('membership_plans') as any).select('name, description, price_cents, billing_interval, contract_months, is_active, sort_order').eq('gym_id', gym.id).order('sort_order'),
    (supabase.from('gym_announcements') as any).select('title, body, is_pinned, expires_at').eq('gym_id', gym.id),
    (supabase.from('posts') as any).select('title, cover_url, blocks, published_at').eq('gym_id', gym.id).not('published_at', 'is', null),
  ])

  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    gym: {
      name:               gym.name,
      address:            gym.address,
      phone:              gym.phone,
      email:              gym.email,
      monthly_fee_cents:  gym.monthly_fee_cents,
      slug:               gym.slug,
      sport_type:         gym.sport_type,
      belt_system:        gym.belt_system,
      belt_system_enabled: gym.belt_system_enabled,
      stripes_enabled:    gym.stripes_enabled,
      class_types:        gym.class_types,
      contract_template:  gym.contract_template,
      signup_enabled:     gym.signup_enabled,
      whatsapp_number:    gym.whatsapp_number,
      instagram_url:      gym.instagram_url,
      facebook_url:       gym.facebook_url,
      website_url:        gym.website_url,
      hero_title:         gym.hero_title,
      hero_subtitle:      gym.hero_subtitle,
      accent_color:       gym.accent_color,
      is_kleinunternehmer: gym.is_kleinunternehmer,
      invoice_prefix:     gym.invoice_prefix,
    },
    membership_plans: plans ?? [],
    announcements:    announcements ?? [],
    posts:            posts ?? [],
  }

  return NextResponse.json(exportData)
}
