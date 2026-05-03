import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function POST(req: Request) {
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await (supabase.from('gyms') as any).select('id').eq('owner_id', user.id).single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const body = await req.json()
  if (!body?.version || !body?.gym) {
    return NextResponse.json({ error: 'Ungültiges Import-Format' }, { status: 400 })
  }

  const { gym: gymData, membership_plans, announcements, posts } = body

  // Update gym settings (skip sensitive/account-specific fields)
  const gymUpdate: Record<string, unknown> = {}
  const allowed = [
    'name', 'address', 'phone', 'email', 'monthly_fee_cents', 'sport_type',
    'belt_system', 'belt_system_enabled', 'stripes_enabled', 'class_types',
    'contract_template', 'signup_enabled', 'whatsapp_number', 'instagram_url',
    'facebook_url', 'website_url', 'hero_title', 'hero_subtitle', 'accent_color',
    'is_kleinunternehmer', 'invoice_prefix',
  ]
  for (const key of allowed) {
    if (gymData[key] !== undefined) gymUpdate[key] = gymData[key]
  }
  await (supabase.from('gyms') as any).update(gymUpdate).eq('id', gym.id)

  // Import membership plans
  if (Array.isArray(membership_plans) && membership_plans.length > 0) {
    const plansToInsert = membership_plans.map((p: any) => ({
      gym_id:           gym.id,
      name:             p.name,
      description:      p.description ?? null,
      price_cents:      p.price_cents ?? 0,
      billing_interval: p.billing_interval ?? 'monthly',
      contract_months:  p.contract_months ?? 0,
      is_active:        p.is_active ?? true,
      sort_order:       p.sort_order ?? 0,
    }))
    await (supabase.from('membership_plans') as any).insert(plansToInsert)
  }

  // Import announcements
  if (Array.isArray(announcements) && announcements.length > 0) {
    const annosToInsert = announcements.map((a: any) => ({
      gym_id:     gym.id,
      title:      a.title,
      body:       a.body ?? null,
      is_pinned:  a.is_pinned ?? false,
      expires_at: a.expires_at ?? null,
    }))
    await (supabase.from('gym_announcements') as any).insert(annosToInsert)
  }

  // Import posts (only published ones)
  if (Array.isArray(posts) && posts.length > 0) {
    const postsToInsert = posts.map((p: any) => ({
      gym_id:       gym.id,
      title:        p.title,
      cover_url:    p.cover_url ?? null,
      blocks:       p.blocks ?? [],
      published_at: p.published_at ?? null,
    }))
    await (supabase.from('posts') as any).insert(postsToInsert)
  }

  return NextResponse.json({
    success: true,
    imported: {
      gym_settings: true,
      plans: membership_plans?.length ?? 0,
      announcements: announcements?.length ?? 0,
      posts: posts?.length ?? 0,
    }
  })
}
