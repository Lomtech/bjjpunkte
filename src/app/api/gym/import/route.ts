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

async function reuploadImage(
  src: string | null | undefined,
  bucket: string,
  storagePath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string | null> {
  if (!src) return null
  try {
    let blob: Blob
    let contentType: string

    if (src.startsWith('data:')) {
      // Base64 data URI — decode directly
      const commaIdx = src.indexOf(',')
      if (commaIdx === -1) return null
      const header = src.slice(0, commaIdx)          // "data:image/jpeg;base64"
      const b64    = src.slice(commaIdx + 1)
      contentType  = header.split(':')[1]?.split(';')[0] ?? 'image/jpeg'
      const buffer = Buffer.from(b64, 'base64')
      blob = new Blob([buffer], { type: contentType })
    } else {
      // Plain HTTPS URL — fetch it
      if (!isAllowedImageUrl(src)) return null
      const res = await fetch(src, { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) return null
      blob = await res.blob()
      contentType = blob.type || res.headers.get('content-type') || 'image/jpeg'
    }

    const ext      = contentType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') ?? 'jpg'
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
    members,
    classes,
    class_bookings,
    attendance,
    belt_promotions,
    leads,
    lead_bookings,
    staff,
    training_logs,
    payments: payments_data,
  } = body

  const ts = Date.now()

  // ── Gym settings ───────────────────────────────────────────────────────────
  // Re-upload main images in parallel, prefer base64 _data over URLs
  const [newLogoUrl, newHeroUrl] = await Promise.all([
    reuploadImage(gymData.logo_data ?? gymData.logo_url, 'gym-logos', `${user.id}/logo`, svc),
    reuploadImage(gymData.hero_data ?? gymData.hero_image_url, 'gym-media', `${gym.id}/hero-${ts}`, svc),
  ])

  // Gallery: prefer _data over URL
  const rawGalleryData: (string|null)[] = Array.isArray(gymData.gallery_data) ? gymData.gallery_data : []
  const rawGalleryUrls: string[] = Array.isArray(gymData.gallery_urls) ? gymData.gallery_urls : []
  const galleryCount = Math.max(rawGalleryData.length, rawGalleryUrls.length)
  const newGalleryUrls = await Promise.all(
    Array.from({ length: galleryCount }, (_, i) =>
      reuploadImage(rawGalleryData[i] ?? rawGalleryUrls[i], 'gym-media', `${gym.id}/gallery-${ts}-${i}`, svc)
        .then(u => u ?? rawGalleryUrls[i] ?? null)
    )
  )

  // about_blocks: prefer block._data over block.url
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAboutBlocks: any[] = Array.isArray(gymData.about_blocks) ? gymData.about_blocks : []
  const newAboutBlocks = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawAboutBlocks.map(async (block: any, i: number) => {
      if (block?.type === 'image') {
        const src = block._data ?? block.url
        const newUrl = await reuploadImage(src, 'gym-media', `${gym.id}/about-block-${ts}-${i}`, svc)
        const { _data: _, ...rest } = block
        return newUrl ? { ...rest, url: newUrl } : rest
      }
      return block
    })
  )

  const gymAllowed = [
    'name', 'address', 'phone', 'email', 'slug', 'founded_year',
    'sport_type', 'belt_system', 'belt_system_enabled', 'stripes_enabled', 'class_types',
    'contract_template', 'signup_enabled',
    'whatsapp_number', 'instagram_url', 'facebook_url', 'website_url',
    'tagline', 'about', 'opening_hours', 'impressum_text',
    'hero_title', 'hero_subtitle', 'accent_color', 'hero_image_position',
    'video_url', 'video_urls',
    'is_kleinunternehmer', 'invoice_prefix',
    'legal_name', 'legal_address', 'legal_email', 'tax_number', 'ustid',
    'bank_iban', 'bank_bic', 'bank_name',
    'datev_beraternummer', 'datev_mandantennummer', 'datev_sachkontenlänge',
    'latitude', 'longitude', 'gps_radius_meters',
    'callmebot_api_key',
  ]
  const gymUpdate: Record<string, unknown> = {}
  for (const key of gymAllowed) {
    if (gymData[key] !== undefined) gymUpdate[key] = gymData[key]
  }
  if (newLogoUrl) gymUpdate.logo_url       = newLogoUrl
  if (newHeroUrl) gymUpdate.hero_image_url = newHeroUrl
  if (newGalleryUrls.length > 0) gymUpdate.gallery_urls = newGalleryUrls.filter(Boolean)
  if (newAboutBlocks.length > 0) gymUpdate.about_blocks = newAboutBlocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('gyms') as any).update(gymUpdate).eq('id', gym.id)

  // ── Membership plans ───────────────────────────────────────────────────────
  // Keep plan index → new DB id for member plan linking
  const planIds: string[] = []
  if (Array.isArray(membership_plans) && membership_plans.length > 0) {
    for (const p of membership_plans) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted } = await (svc.from('membership_plans') as any).insert({
        gym_id:           gym.id,
        name:             p.name,
        description:      p.description ?? null,
        price_cents:      p.price_cents ?? 0,
        billing_interval: p.billing_interval ?? 'monthly',
        contract_months:  p.contract_months ?? 0,
        is_active:        p.is_active ?? true,
        sort_order:       p.sort_order ?? 0,
      }).select('id').single()
      planIds.push(inserted?.id ?? '')
    }
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
      const newCoverUrl = await reuploadImage(p._cover_data ?? p.cover_url, 'gym-media', `${gym.id}/post-${postTs}-cover`, svc)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let newBlocks = Array.isArray(p.blocks) ? [...p.blocks] : []
      newBlocks = await Promise.all(newBlocks.map(async (block: any, j: number) => {
        if (block?.type === 'image') {
          const src = block._data ?? block.url
          const newUrl = await reuploadImage(src, 'gym-media', `${gym.id}/post-${postTs}-block-${j}`, svc)
          const { _data: _, ...rest } = block
          return newUrl ? { ...rest, url: newUrl } : rest
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

  // ── Members — pass 1: insert all members (without parent/plan links) ───────
  const memberIds: string[] = []   // index → new DB id
  if (Array.isArray(members) && members.length > 0) {
    for (const m of members) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted } = await (svc.from('members') as any).insert({
        gym_id:                     gym.id,
        first_name:                 m.first_name,
        last_name:                  m.last_name,
        email:                      m.email ?? null,
        phone:                      m.phone ?? null,
        date_of_birth:              m.date_of_birth ?? null,
        address:                    m.address ?? null,
        belt:                       m.belt ?? 'white',
        stripes:                    m.stripes ?? 0,
        join_date:                  m.join_date ?? new Date().toISOString().split('T')[0],
        is_active:                  m.is_active ?? true,
        emergency_contact_name:     m.emergency_contact_name ?? null,
        emergency_contact_phone:    m.emergency_contact_phone ?? null,
        notes:                      m.notes ?? null,
        belt_awarded_at:            m.belt_awarded_at ?? null,
        subscription_status:        m.subscription_status ?? 'pending',
        contract_end_date:          m.contract_end_date ?? null,
        monthly_fee_override_cents: m.monthly_fee_override_cents ?? null,
        signature_data:             m.signature_data ?? null,
        contract_signed_at:         m.contract_signed_at ?? null,
        gdpr_consent_at:            m.gdpr_consent_at ?? null,
        onboarding_status:          m.onboarding_status ?? null,
        consent_ip:                 m.consent_ip ?? null,
        consent_user_agent:         m.consent_user_agent ?? null,
        consent_text:               m.consent_text ?? null,
        cancellation_requested_at:  m.cancellation_requested_at ?? null,
        cancellation_note:          m.cancellation_note ?? null,
      }).select('id').single()
      memberIds.push(inserted?.id ?? '')
    }
  }

  // ── Members — pass 2: link parent_member_id ────────────────────────────────
  if (Array.isArray(members) && members.length > 0) {
    for (let i = 0; i < members.length; i++) {
      const parentIdx = members[i].parent_member_index
      if (parentIdx != null && memberIds[parentIdx] && memberIds[i]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('members') as any)
          .update({ parent_member_id: memberIds[parentIdx] })
          .eq('id', memberIds[i])
      }
    }
  }

  // ── Members — pass 3: link plan_id and requested_plan_id ──────────────────
  if (Array.isArray(members) && members.length > 0 && planIds.length > 0) {
    for (let i = 0; i < members.length; i++) {
      const planIdx         = members[i].plan_index
      const reqPlanIdx      = members[i].requested_plan_index
      const hasPlan         = planIdx != null && planIds[planIdx]
      const hasRequestedPlan = reqPlanIdx != null && planIds[reqPlanIdx]
      if ((hasPlan || hasRequestedPlan) && memberIds[i]) {
        const update: Record<string, string> = {}
        if (hasPlan)          update.plan_id          = planIds[planIdx]
        if (hasRequestedPlan) update.requested_plan_id = planIds[reqPlanIdx]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (svc.from('members') as any).update(update).eq('id', memberIds[i])
      }
    }
  }

  // ── Classes (two passes for recurrence) ───────────────────────────────────
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

  // ── Class bookings ─────────────────────────────────────────────────────────
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

  // ── Attendance ─────────────────────────────────────────────────────────────
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

  // ── Belt promotions ────────────────────────────────────────────────────────
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

  // ── Leads ──────────────────────────────────────────────────────────────────
  const leadIds: string[] = []
  if (Array.isArray(leads) && leads.length > 0) {
    for (const l of leads) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted } = await (svc.from('leads') as any).insert({
        gym_id:       gym.id,
        first_name:   l.first_name,
        last_name:    l.last_name,
        email:        l.email ?? null,
        phone:        l.phone ?? null,
        status:       l.status ?? 'new',
        source:       l.source ?? 'other',
        notes:        l.notes ?? null,
        trial_date:   l.trial_date ?? null,
        referred_by:  l.referred_by ?? null,
        contacted_at: l.contacted_at ?? null,
        converted_at: l.converted_at ?? null,
      }).select('id').single()
      leadIds.push(inserted?.id ?? '')
    }
  }

  // ── Lead bookings ──────────────────────────────────────────────────────────
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

  // ── Staff ──────────────────────────────────────────────────────────────────
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

  // ── Training logs ──────────────────────────────────────────────────────────
  let trainingLogsImported = 0
  if (Array.isArray(training_logs) && training_logs.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toInsert = training_logs.flatMap((tl: any) => {
      const memberId = memberIds[tl.member_index]
      if (!memberId) return []
      return [{ gym_id: gym.id, member_id: memberId, note: tl.note ?? null, class_type: tl.class_type ?? null, logged_at: tl.logged_at }]
    })
    if (toInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('training_logs') as any).insert(toInsert)
      trainingLogsImported = toInsert.length
    }
  }

  // ── Payments ───────────────────────────────────────────────────────────────
  let paymentsImported = 0
  if (Array.isArray(payments_data) && payments_data.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toInsert = payments_data.flatMap((p: any) => {
      const memberId = memberIds[p.member_index]
      if (!memberId) return []
      return [{ gym_id: gym.id, member_id: memberId, amount_cents: p.amount_cents, status: p.status ?? 'paid', paid_at: p.paid_at ?? null, created_at: p.created_at ?? null, invoice_number: p.invoice_number ?? null }]
    })
    if (toInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('payments') as any).insert(toInsert)
      paymentsImported = toInsert.length
    }
  }

  return NextResponse.json({
    success: true,
    imported: {
      gym_settings:       true,
      logo_uploaded:      !!newLogoUrl,
      hero_uploaded:      !!newHeroUrl,
      gallery_images:     newGalleryUrls.filter(Boolean).length,
      about_blocks:       newAboutBlocks.filter((b: any) => b?.type === 'image').length, // eslint-disable-line @typescript-eslint/no-explicit-any
      plans:              planIds.filter(Boolean).length,
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
      training_logs:      trainingLogsImported,
      payments:           paymentsImported,
    }
  })
}
