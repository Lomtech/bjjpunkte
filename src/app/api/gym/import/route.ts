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

function isAllowedImageUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    const h = hostname.toLowerCase()
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false
    if (/^10\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /^192\.168\./.test(h)) return false
    if (h.endsWith('.internal') || h.endsWith('.local')) return false
    return true
  } catch { return false }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reuploadImage(originalUrl: string | null | undefined, bucket: string, storagePath: string, supabase: any): Promise<string | null> {
  if (!originalUrl) return null
  if (!isAllowedImageUrl(originalUrl)) return null
  try {
    const res = await fetch(originalUrl, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const blob = await res.blob()
    const contentType = blob.type || res.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') ?? 'jpg'
    const fullPath = `${storagePath}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(fullPath, blob, { contentType, upsert: true })
    if (error) return null
    const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath)
    return data.publicUrl
  } catch { return null }
}

export async function POST(req: Request) {
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const auth = authClient(accessToken)
  const { data: { user } } = await auth.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const svc = serviceClient()

  const body = await req.json()
  if (!body?.version || !body?.gym) return NextResponse.json({ error: 'Ungültiges Import-Format' }, { status: 400 })

  // Look up existing gym — maybeSingle() returns null without error if none found
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: gym } = await (svc.from('gyms') as any).select('id').eq('owner_id', user.id).maybeSingle()

  // New Google/OAuth users have no gym yet — create one from the import data
  if (!gym) {
    const gymData = body.gym as Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newGym, error: insertErr } = await (svc.from('gyms') as any)
      .insert({ owner_id: user.id, name: gymData.name ?? 'Importiertes Gym' })
      .select('id')
      .single()
    if (insertErr || !newGym) {
      return NextResponse.json({ error: 'Gym konnte nicht erstellt werden' }, { status: 500 })
    }
    gym = newGym
  }

  const {
    gym: gymData,
    membership_plans,
    announcements,
    posts,
    // v3 fields
    members,
    classes,
    class_bookings,
    attendance,
    belt_promotions,
    leads,
    lead_bookings,
    staff,
  } = body

  const ts = Date.now()

  // ── Gym settings ───────────────────────────────────────────────────────────
  const [newLogoUrl, newHeroUrl] = await Promise.all([
    reuploadImage(gymData.logo_url,       'gym-logos', `${user.id}/logo`,      svc),
    reuploadImage(gymData.hero_image_url, 'gym-media', `${gym.id}/hero-${ts}`, svc),
  ])

  const gymAllowed = [
    'name', 'address', 'phone', 'email', 'sport_type',
    'belt_system', 'belt_system_enabled', 'stripes_enabled', 'class_types',
    'contract_template', 'signup_enabled', 'whatsapp_number', 'instagram_url',
    'facebook_url', 'website_url', 'hero_title', 'hero_subtitle', 'accent_color',
    'is_kleinunternehmer', 'invoice_prefix', 'hero_image_position', 'video_url', 'video_urls',
  ]
  const gymUpdate: Record<string, unknown> = {}
  for (const key of gymAllowed) {
    if (gymData[key] !== undefined) gymUpdate[key] = gymData[key]
  }
  if (newLogoUrl) gymUpdate.logo_url       = newLogoUrl
  if (newHeroUrl) gymUpdate.hero_image_url = newHeroUrl
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('gyms') as any).update(gymUpdate).eq('id', gym.id)

  // ── Membership plans ───────────────────────────────────────────────────────
  if (Array.isArray(membership_plans) && membership_plans.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('membership_plans') as any).insert(membership_plans.map((p: any) => ({
      gym_id: gym.id, name: p.name, description: p.description ?? null,
      price_cents: p.price_cents ?? 0, billing_interval: p.billing_interval ?? 'monthly',
      contract_months: p.contract_months ?? 0, is_active: p.is_active ?? true, sort_order: p.sort_order ?? 0,
    })))
  }

  // ── Announcements ──────────────────────────────────────────────────────────
  if (Array.isArray(announcements) && announcements.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('gym_announcements') as any).insert(announcements.map((a: any) => ({
      gym_id: gym.id, title: a.title, body: a.body ?? null,
      is_pinned: a.is_pinned ?? false, expires_at: a.expires_at ?? null,
    })))
  }

  // ── Posts ──────────────────────────────────────────────────────────────────
  let postsImported = 0
  if (Array.isArray(posts) && posts.length > 0) {
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i]
      const postTs = ts + i
      const newCoverUrl = await reuploadImage(p.cover_url, 'gym-media', `${gym.id}/post-${postTs}-cover`, svc)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let newBlocks = Array.isArray(p.blocks) ? [...p.blocks] : []
      newBlocks = await Promise.all(newBlocks.map(async (block: any, j: number) => {
        if (block?.type === 'image' && block?.url) {
          const newUrl = await reuploadImage(block.url, 'gym-media', `${gym.id}/post-${postTs}-block-${j}`, svc)
          return newUrl ? { ...block, url: newUrl } : block
        }
        return block
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('posts') as any).insert({
        gym_id: gym.id, title: p.title,
        cover_url: newCoverUrl ?? p.cover_url ?? null,
        blocks: newBlocks, published_at: p.published_at ?? null,
      })
      postsImported++
    }
  }

  // ── v3: Members ────────────────────────────────────────────────────────────
  const memberIds: string[] = []   // index → new DB id
  if (Array.isArray(members) && members.length > 0) {
    for (const m of members) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted } = await (svc.from('members') as any).insert({
        gym_id:                  gym.id,
        first_name:              m.first_name,
        last_name:               m.last_name,
        email:                   m.email ?? null,
        phone:                   m.phone ?? null,
        date_of_birth:           m.date_of_birth ?? null,
        address:                 m.address ?? null,
        belt:                    m.belt ?? 'white',
        stripes:                 m.stripes ?? 0,
        join_date:               m.join_date ?? new Date().toISOString().split('T')[0],
        is_active:               m.is_active ?? true,
        emergency_contact_name:  m.emergency_contact_name ?? null,
        emergency_contact_phone: m.emergency_contact_phone ?? null,
        notes:                   m.notes ?? null,
        belt_awarded_at:         m.belt_awarded_at ?? null,
        subscription_status:     m.subscription_status ?? 'pending',
      }).select('id').single()
      memberIds.push(inserted?.id ?? '')
    }
  }

  // ── v3: Classes (two passes for recurrence) ────────────────────────────────
  const classIds: string[] = []   // index → new DB id
  if (Array.isArray(classes) && classes.length > 0) {
    // Pass 1: insert without recurrence_parent_id
    for (const c of classes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted } = await (svc.from('classes') as any).insert({
        gym_id:           gym.id,
        title:            c.title,
        class_type:       c.class_type ?? 'gi',
        description:      c.description ?? null,
        instructor:       c.instructor ?? null,
        starts_at:        c.starts_at,
        ends_at:          c.ends_at,
        max_capacity:     c.max_capacity ?? null,
        is_cancelled:     c.is_cancelled ?? false,
        recurrence_type:  c.recurrence_type ?? 'none',
        recurrence_until: c.recurrence_until ?? null,
      }).select('id').single()
      classIds.push(inserted?.id ?? '')
    }
    // Pass 2: link recurrence parents
    for (let i = 0; i < classes.length; i++) {
      const parentIdx = classes[i].recurrence_parent_index
      if (parentIdx != null && classIds[parentIdx] && classIds[i]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('classes') as any)
          .update({ recurrence_parent_id: classIds[parentIdx] })
          .eq('id', classIds[i])
      }
    }
  }

  // ── v3: Class bookings ─────────────────────────────────────────────────────
  let bookingsImported = 0
  if (Array.isArray(class_bookings) && class_bookings.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toInsert = class_bookings.flatMap((b: any) => {
      const memberId = memberIds[b.member_index]
      const classId  = classIds[b.class_index]
      if (!memberId || !classId) return []
      return [{ gym_id: gym.id, member_id: memberId, class_id: classId, status: b.status ?? 'confirmed' }]
    })
    if (toInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('class_bookings') as any).insert(toInsert)
      bookingsImported = toInsert.length
    }
  }

  // ── v3: Attendance ─────────────────────────────────────────────────────────
  let attendanceImported = 0
  if (Array.isArray(attendance) && attendance.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toInsert = attendance.flatMap((a: any) => {
      const memberId = memberIds[a.member_index]
      if (!memberId) return []
      const classId = a.class_index != null ? (classIds[a.class_index] ?? null) : null
      return [{
        gym_id: gym.id, member_id: memberId,
        class_id: classId, class_type: a.class_type ?? null, checked_in_at: a.checked_in_at,
      }]
    })
    if (toInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('attendance') as any).insert(toInsert)
      attendanceImported = toInsert.length
    }
  }

  // ── v3: Belt promotions ────────────────────────────────────────────────────
  let beltPromotionsImported = 0
  if (Array.isArray(belt_promotions) && belt_promotions.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toInsert = belt_promotions.flatMap((p: any) => {
      const memberId = memberIds[p.member_index]
      if (!memberId) return []
      return [{
        gym_id: gym.id, member_id: memberId,
        previous_belt: p.previous_belt, new_belt: p.new_belt,
        promoted_at: p.promoted_at, notes: p.notes ?? null,
      }]
    })
    if (toInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('belt_promotions') as any).insert(toInsert)
      beltPromotionsImported = toInsert.length
    }
  }

  // ── v3: Leads ──────────────────────────────────────────────────────────────
  const leadIds: string[] = []
  if (Array.isArray(leads) && leads.length > 0) {
    for (const l of leads) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted } = await (svc.from('leads') as any).insert({
        gym_id:     gym.id,
        first_name: l.first_name,
        last_name:  l.last_name,
        email:      l.email ?? null,
        phone:      l.phone ?? null,
        status:     l.status ?? 'new',
        source:     l.source ?? 'other',
        notes:      l.notes ?? null,
        trial_date: l.trial_date ?? null,
      }).select('id').single()
      leadIds.push(inserted?.id ?? '')
    }
  }

  // ── v3: Lead bookings ──────────────────────────────────────────────────────
  let leadBookingsImported = 0
  if (Array.isArray(lead_bookings) && lead_bookings.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toInsert = lead_bookings.flatMap((lb: any) => {
      const leadId  = leadIds[lb.lead_index]
      const classId = classIds[lb.class_index]
      if (!leadId || !classId) return []
      return [{ gym_id: gym.id, lead_id: leadId, class_id: classId, status: lb.status ?? 'booked' }]
    })
    if (toInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('lead_bookings') as any).insert(toInsert)
      leadBookingsImported = toInsert.length
    }
  }

  // ── v3: Staff ──────────────────────────────────────────────────────────────
  let staffImported = 0
  if (Array.isArray(staff) && staff.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toInsert = staff.map((s: any) => ({
      gym_id: gym.id, name: s.name, email: s.email, role: s.role ?? 'trainer',
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('staff') as any).insert(toInsert)
    staffImported = toInsert.length
  }

  return NextResponse.json({
    success: true,
    imported: {
      gym_settings:       true,
      logo_uploaded:      !!newLogoUrl,
      hero_uploaded:      !!newHeroUrl,
      plans:              membership_plans?.length ?? 0,
      announcements:      announcements?.length    ?? 0,
      posts:              postsImported,
      members:            memberIds.filter(Boolean).length,
      classes:            classIds.filter(Boolean).length,
      class_bookings:     bookingsImported,
      attendance:         attendanceImported,
      belt_promotions:    beltPromotionsImported,
      leads:              leadIds.filter(Boolean).length,
      lead_bookings:      leadBookingsImported,
      staff:              staffImported,
    }
  })
}
