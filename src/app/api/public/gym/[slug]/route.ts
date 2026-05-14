import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  // Service role key bypasses RLS; falls back to anon key + RLS policy for public reads
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    return await handleGet(params)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    const stack = err instanceof Error ? err.stack : null
    console.error('[public/gym] crash:', msg, stack)
    return NextResponse.json(
      { error: 'Gym konnte nicht geladen werden', detail: msg },
      { status: 500 },
    )
  }
}

async function handleGet(params: Promise<{ slug: string }>) {
  const { slug } = await params
  // Slug-Hardening (Audit 2026-05-09 / B-input-cap): Format + Length-Cap.
  // Cache-Header s-maxage=60 wird durch valides Format nicht poisoned —
  // ungültige Slugs landen im 400-Pfad und cachen nicht.
  if (!slug || typeof slug !== 'string' || slug.length > 100 || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Ungültiger Slug' }, { status: 400 })
  }
  const supabase = serviceClient()

  const { data: gym, error } = await supabase
    .from('gyms')
    .select(`
      id, name, logo_url, address, phone, email,
      class_types, belt_system, belt_system_enabled, sport_type,
      tagline, about, about_blocks, hero_image_url, hero_image_position, gallery_urls, video_url, video_urls,
      whatsapp_number, instagram_url, facebook_url, website_url,
      founded_year, opening_hours, impressum_text,
      trial_rules_template, wellpass_agreement_template
    `)
    .eq('slug', slug)
    .single()

  if (error || !gym) {
    return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  // Roll-of-Honor Cutoff: nur Tournaments der letzten 18 Monate, damit die
  // Seite nicht über die Jahre mit altem Material zugemüllt wird.
  const rolloHCutoff = new Date(Date.now() - 540 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: classes },
    { data: plans },
    { data: posts },
    { data: tournaments },
  ] = await Promise.all([
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
    // Public Roll-of-Honor: nur public_visible=true (Member-Consent), nur
    // Podium-Plätze (Gold/Silber/Bronze) + Finalisten, letzte 18 Monate.
    // DSGVO: zeigen Vorname + Nachname-Initiale (nicht voller Name).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('member_tournaments') as any)
      .select(`
        id, name, event_date, location, discipline, weight_class,
        age_division, belt_at_event, result, matches_won, matches_lost,
        smoothcomp_url,
        members!inner(first_name, last_name)
      `)
      .eq('gym_id', gym.id)
      .eq('public_visible', true)
      .in('result', ['gold', 'silver', 'bronze', 'finalist'])
      .gte('event_date', rolloHCutoff)
      .order('event_date', { ascending: false })
      .limit(30),
  ])

  const g = gym as typeof gym & Record<string, unknown>

  // Trial- und Wellpass-Vertrag rendern (Platzhalter durch Studio-Daten ersetzen)
  const { resolveTemplate } = await import('@/lib/legal/default-contract')
  const gymInfo = { name: gym.name, address: gym.address, url: g.website_url as string | null }
  const trialContract    = resolveTemplate('trial',    g.trial_rules_template as string | null, gymInfo)
  const wellpassContract = resolveTemplate('wellpass', g.wellpass_agreement_template as string | null, gymInfo)

  const payload = {
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
    trialContract,
    wellpassContract,
    // Audit 2026-05-14: Roll-of-Honor — public-visible tournament results.
    // DSGVO-Mindest: Vorname + Nachname-Initiale, keine Geburtsdaten.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tournaments: (tournaments ?? []).map((t: any) => ({
      id:             t.id,
      name:           t.name,
      event_date:     t.event_date,
      location:       t.location,
      discipline:     t.discipline,
      weight_class:   t.weight_class,
      age_division:   t.age_division,
      belt_at_event:  t.belt_at_event,
      result:         t.result,
      matches_won:    t.matches_won,
      matches_lost:   t.matches_lost,
      smoothcomp_url: t.smoothcomp_url,
      member_first_name: t.members?.first_name ?? null,
      member_last_initial: t.members?.last_name ? t.members.last_name.charAt(0).toUpperCase() + '.' : null,
    })),
  }

  return NextResponse.json(payload, {
    headers: {
      // Cache at CDN edge for 60s, stale-while-revalidate for 300s
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
