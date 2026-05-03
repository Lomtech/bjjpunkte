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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reuploadImage(
  originalUrl: string | null | undefined,
  bucket: string,
  storagePath: string,
  supabase: any
): Promise<string | null> {
  if (!originalUrl) return null
  try {
    const res = await fetch(originalUrl, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const blob = await res.blob()
    const contentType = blob.type || res.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') ?? 'jpg'
    const fullPath = `${storagePath}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(fullPath, blob, {
      contentType,
      upsert: true,
    })
    if (error) return null
    const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath)
    return data.publicUrl
  } catch {
    return null
  }
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
  const service = serviceClient()
  const ts = Date.now()

  // ── Re-upload media files ──────────────────────────────────────────────────
  const [newLogoUrl, newHeroUrl] = await Promise.all([
    reuploadImage(gymData.logo_url,       'gym-logos',  `${user.id}/logo`,       service),
    reuploadImage(gymData.hero_image_url, 'gym-media',  `${gym.id}/hero-${ts}`,  service),
  ])

  // ── Update gym settings ────────────────────────────────────────────────────
  const gymUpdate: Record<string, unknown> = {}
  const allowed = [
    'name', 'address', 'phone', 'email', 'monthly_fee_cents', 'sport_type',
    'belt_system', 'belt_system_enabled', 'stripes_enabled', 'class_types',
    'contract_template', 'signup_enabled', 'whatsapp_number', 'instagram_url',
    'facebook_url', 'website_url', 'hero_title', 'hero_subtitle', 'accent_color',
    'is_kleinunternehmer', 'invoice_prefix',
    // media positions / external video URLs are safe to copy as-is
    'hero_image_position', 'video_url', 'video_urls',
  ]
  for (const key of allowed) {
    if (gymData[key] !== undefined) gymUpdate[key] = gymData[key]
  }
  // Override with freshly re-uploaded URLs (null if upload failed → keep existing)
  if (newLogoUrl)  gymUpdate.logo_url       = newLogoUrl
  if (newHeroUrl)  gymUpdate.hero_image_url = newHeroUrl

  await (supabase.from('gyms') as any).update(gymUpdate).eq('id', gym.id)

  // ── Import membership plans ────────────────────────────────────────────────
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

  // ── Import announcements ───────────────────────────────────────────────────
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

  // ── Import posts with image re-upload ──────────────────────────────────────
  let postsImported = 0
  if (Array.isArray(posts) && posts.length > 0) {
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i]
      const postTs = ts + i

      // Re-upload cover image
      const newCoverUrl = await reuploadImage(
        p.cover_url,
        'gym-media',
        `${gym.id}/post-${postTs}-cover`,
        service
      )

      // Re-upload image blocks
      let newBlocks = Array.isArray(p.blocks) ? [...p.blocks] : []
      newBlocks = await Promise.all(
        newBlocks.map(async (block: any, j: number) => {
          if (block?.type === 'image' && block?.url) {
            const newUrl = await reuploadImage(
              block.url,
              'gym-media',
              `${gym.id}/post-${postTs}-block-${j}`,
              service
            )
            return newUrl ? { ...block, url: newUrl } : block
          }
          return block
        })
      )

      await (supabase.from('posts') as any).insert({
        gym_id:       gym.id,
        title:        p.title,
        cover_url:    newCoverUrl ?? p.cover_url ?? null,
        blocks:       newBlocks,
        published_at: p.published_at ?? null,
      })
      postsImported++
    }
  }

  return NextResponse.json({
    success: true,
    imported: {
      gym_settings:  true,
      logo_uploaded: !!newLogoUrl,
      hero_uploaded: !!newHeroUrl,
      plans:         membership_plans?.length ?? 0,
      announcements: announcements?.length ?? 0,
      posts:         postsImported,
    }
  })
}
