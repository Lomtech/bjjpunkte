import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

// Import data is raw JSON from user exports — bypass strict Supabase Insert types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function anyRow(obj: Record<string, unknown>): any { return obj }

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

// Parse Supabase public storage URL → { bucket, path }
function parseSupabaseUrl(url: string): { bucket: string; path: string } | null {
  try {
    const m = url.match(/\/storage\/v1\/object\/(?:public|authenticated)\/([^/?]+)\/(.+)/)
    if (!m) return null
    return { bucket: m[1], path: decodeURIComponent(m[2].split('?')[0]) }
  } catch { return null }
}

 
async function reuploadImage(
  src: string | null | undefined,
  destBucket: string,
  storagePath: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string | null> {
  if (!src) return null
  try {
    let blob: Blob
    let contentType: string

    if (src.startsWith('data:')) {
      // Base64 data URI
      const commaIdx = src.indexOf(',')
      if (commaIdx === -1) return null
      contentType = src.slice(0, commaIdx).split(':')[1]?.split(';')[0] ?? 'image/jpeg'
      blob = new Blob([Buffer.from(src.slice(commaIdx + 1), 'base64')], { type: contentType })
    } else if (SUPABASE_URL && src.startsWith(SUPABASE_URL)) {
      // Same Supabase project — use service-role storage API (bypasses RLS / bucket policies)
      const parsed = parseSupabaseUrl(src)
      if (!parsed) return null
      const { data: fileData, error: dlErr } = await supabase.storage.from(parsed.bucket).download(parsed.path)
      if (dlErr || !fileData) return null
      blob = fileData as Blob
      contentType = blob.type || 'image/jpeg'
    } else {
      // External HTTPS URL
      if (!isAllowedImageUrl(src)) return null
      const res = await fetch(src, { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) return null
      blob = await res.blob()
      contentType = blob.type || res.headers.get('content-type') || 'image/jpeg'
    }

    const ext      = contentType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') ?? 'jpg'
    const fullPath = `${storagePath}.${ext}`
    const { error } = await supabase.storage.from(destBucket).upload(fullPath, blob, { contentType, upsert: true })
    if (error) return null
    const { data } = supabase.storage.from(destBucket).getPublicUrl(fullPath)
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

  // ── Array size caps to prevent DoS / quota exhaustion ─────────────────────
  const LIMITS: Record<string, number> = {
    membership_plans: 50, announcements: 200, posts: 500,
    members: 2000, classes: 5000, class_bookings: 20000,
    attendance: 50000, belt_promotions: 5000,
    leads: 2000, lead_bookings: 10000, staff: 100,
    training_logs: 50000, payments: 20000,
  }
  for (const [key, max] of Object.entries(LIMITS)) {
    if (Array.isArray(body[key]) && body[key].length > max) {
      return NextResponse.json({ error: `Zu viele Einträge in "${key}" (Maximum: ${max})` }, { status: 400 })
    }
  }

  // Look up existing gym — maybeSingle() returns null without error if none found
   
  let { data: gym } = await svc.from('gyms').select('id').eq('owner_id', user.id).maybeSingle()

  // New Google/OAuth users have no gym yet — create one from the import data
  if (!gym) {
    const gymData = body.gym as Record<string, unknown>
     
    const { data: newGym, error: insertErr } = await svc.from('gyms')
      .insert({ owner_id: user.id, name: (gymData.name as string | undefined) ?? 'Importiertes Gym' })
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
  // Re-upload images via Supabase storage API (service role bypasses bucket policies)
  const [newLogoUrl, newHeroUrl] = await Promise.all([
    reuploadImage(gymData.logo_url, 'gym-logos', `${user.id}/logo`, svc),
    reuploadImage(gymData.hero_image_url, 'gym-media', `${gym.id}/hero-${ts}`, svc),
  ])

  // Gallery
  const rawGalleryUrls: string[] = Array.isArray(gymData.gallery_urls) ? gymData.gallery_urls : []
  const newGalleryUrls = await Promise.all(
    rawGalleryUrls.map((url: string, i: number) =>
      reuploadImage(url, 'gym-media', `${gym.id}/gallery-${ts}-${i}`, svc)
        .then(u => u ?? url)
    )
  )

  // about_blocks images
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawAboutBlocks: any[] = Array.isArray(gymData.about_blocks) ? gymData.about_blocks : []
  const newAboutBlocks = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawAboutBlocks.map(async (block: any, i: number) => {
      if (block?.type === 'image' && block?.url) {
        const newUrl = await reuploadImage(block.url, 'gym-media', `${gym.id}/about-block-${ts}-${i}`, svc)
        return newUrl ? { ...block, url: newUrl } : block
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planRows = membership_plans.map((p: any) => ({
      gym_id:           gym.id,
      name:             p.name,
      description:      p.description ?? null,
      price_cents:      p.price_cents ?? 0,
      billing_interval: p.billing_interval ?? 'monthly',
      contract_months:  p.contract_months ?? 0,
      is_active:        p.is_active ?? true,
      sort_order:       p.sort_order ?? 0,
    }))
    const PLAN_CHUNK = 50
    for (let i = 0; i < planRows.length; i += PLAN_CHUNK) {
      const chunk = planRows.slice(i, i + PLAN_CHUNK)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted } = await (svc.from('membership_plans') as any).insert(chunk).select('id')
       
      for (const row of (inserted ?? [])) planIds.push(row.id ?? '')
    }
  }

  // ── Announcements ──────────────────────────────────────────────────────────
  if (Array.isArray(announcements) && announcements.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await svc.from('gym_announcements').insert(announcements.map((a: any) => ({
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
       
      let newBlocks = Array.isArray(p.blocks) ? [...p.blocks] : []
      newBlocks = await Promise.all(newBlocks.map(async (block: any, j: number) => {
        if (block?.type === 'image' && block?.url) {
          const newUrl = await reuploadImage(block.url, 'gym-media', `${gym.id}/post-${postTs}-block-${j}`, svc)
          return newUrl ? { ...block, url: newUrl } : block
        }
        return block
      }))
       
      await svc.from('posts').insert({
        gym_id: gym.id, title: p.title,
        cover_url: newCoverUrl ?? p.cover_url ?? null,
        blocks: newBlocks, published_at: p.published_at ?? null,
      })
      postsImported++
    }
  }

  // ── Members — pass 1: insert all members (without parent/plan links) ───────
  const memberIds: string[] = []   // index → new DB id
  const errors: string[] = []
  if (Array.isArray(members) && members.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberRows = members.map((m: any) => anyRow({
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
    }))
    const MEMBER_CHUNK = 100
    for (let i = 0; i < memberRows.length; i += MEMBER_CHUNK) {
      const chunk = memberRows.slice(i, i + MEMBER_CHUNK)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (svc.from('members') as any).insert(chunk).select('id')
      if (error) {
        errors.push(`members batch ${i}: ${error.message}`)
        // Fill memberIds with empty strings to preserve index alignment for later passes
        for (let j = 0; j < chunk.length; j++) memberIds.push('')
      } else {
         
        for (const row of (inserted ?? [])) memberIds.push(row.id ?? '')
        // If fewer rows returned than sent (partial insert), pad with empty strings
        const returned = (inserted ?? []).length
        for (let j = returned; j < chunk.length; j++) memberIds.push('')
      }
    }
  }

  // ── Members — pass 2: link parent_member_id (parallel) ───────────────────
  if (Array.isArray(members) && members.length > 0) {
    const parentLinks = members
      .map((m, i) => ({ parentIdx: m.parent_member_index, i }))
      .filter(({ parentIdx, i }) => parentIdx != null && memberIds[parentIdx] && memberIds[i])
    if (parentLinks.length > 0) {
      const LINK_CHUNK = 50
      for (let c = 0; c < parentLinks.length; c += LINK_CHUNK) {
        await Promise.all(parentLinks.slice(c, c + LINK_CHUNK).map(({ parentIdx, i }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (svc.from('members') as any).update({ parent_member_id: memberIds[parentIdx] }).eq('id', memberIds[i])
        ))
      }
    }
  }

  // ── Members — pass 3: link plan_id and requested_plan_id (parallel) ───────
  if (Array.isArray(members) && members.length > 0 && planIds.length > 0) {
    const planLinks = members
      .map((m, i) => {
        const planIdx = m.plan_index
        const reqPlanIdx = m.requested_plan_index
        const hasPlan = planIdx != null && planIds[planIdx]
        const hasReq = reqPlanIdx != null && planIds[reqPlanIdx]
        if (!(hasPlan || hasReq) || !memberIds[i]) return null
        const update: Record<string, string> = {}
        if (hasPlan) update.plan_id = planIds[planIdx]
        if (hasReq) update.requested_plan_id = planIds[reqPlanIdx]
        return { update, id: memberIds[i] }
      })
      .filter(Boolean) as Array<{ update: Record<string, string>; id: string }>
    if (planLinks.length > 0) {
      const LINK_CHUNK = 50
      for (let c = 0; c < planLinks.length; c += LINK_CHUNK) {
        await Promise.all(planLinks.slice(c, c + LINK_CHUNK).map(({ update, id }) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (svc.from('members') as any).update(update as any).eq('id', id)
        ))
      }
    }
  }

  // ── Classes (two passes for recurrence) ───────────────────────────────────
  // Pre-generate UUIDs so Pass 2 doesn't need IDs back from DB
   
  const classIds: string[] = Array.isArray(classes) ? classes.map(() => crypto.randomUUID()) : []
  if (Array.isArray(classes) && classes.length > 0) {
    const CLASS_CHUNK = 100
    // Pass 1: bulk insert in chunks — N/100 roundtrips instead of N
    for (let i = 0; i < classes.length; i += CLASS_CHUNK) {
      const chunk = classes.slice(i, i + CLASS_CHUNK)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = chunk.map((c: any, j: number) => anyRow({
        id:               classIds[i + j],
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
      }))
      await svc.from('classes').insert(rows)
    }
    // Pass 2: link recurrence parents — parallel within 50-item windows
     
    const recurrenceUpdates = classes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any, i: number) => ({ classId: classIds[i], parentIdx: c.recurrence_parent_index as number | null }))
      .filter(({ parentIdx, classId }) => parentIdx != null && classIds[parentIdx] && classId)
    const UPDATE_CHUNK = 50
    for (let i = 0; i < recurrenceUpdates.length; i += UPDATE_CHUNK) {
      const chunk = recurrenceUpdates.slice(i, i + UPDATE_CHUNK)
      await Promise.all(chunk.map(({ classId, parentIdx }) =>
        svc.from('classes')
          .update(anyRow({ recurrence_parent_id: classIds[parentIdx!] }))
          .eq('id', classId)
      ))
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
      await svc.from('class_bookings').insert(toInsert as any[])
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
      await svc.from('attendance').insert(toInsert as any[])
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
      await svc.from('belt_promotions').insert(toInsert as any[])
      beltPromotionsImported = toInsert.length
    }
  }

  // ── Leads ──────────────────────────────────────────────────────────────────
  const leadIds: string[] = []
  if (Array.isArray(leads) && leads.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leadRows = leads.map((l: any) => anyRow({
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
    }))
    const LEAD_CHUNK = 100
    for (let i = 0; i < leadRows.length; i += LEAD_CHUNK) {
      const chunk = leadRows.slice(i, i + LEAD_CHUNK)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error } = await (svc.from('leads') as any).insert(chunk).select('id')
      if (error) {
        errors.push(`leads batch ${i}: ${error.message}`)
        for (let j = 0; j < chunk.length; j++) leadIds.push('')
      } else {
         
        for (const row of (inserted ?? [])) leadIds.push(row.id ?? '')
        const returned = (inserted ?? []).length
        for (let j = returned; j < chunk.length; j++) leadIds.push('')
      }
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
      await svc.from('lead_bookings').insert(toInsert as any[])
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
    await svc.from('gym_staff').insert(toInsert as any[])
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
      await svc.from('training_logs').insert(toInsert as any[])
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
      // Force status to 'imported' — never trust caller-supplied status.
      // This prevents fabricating 'paid' records without actual Stripe payments.
      const amountCents = typeof p.amount_cents === 'number' && p.amount_cents >= 0 ? Math.round(p.amount_cents) : 0
      return [{ gym_id: gym.id, member_id: memberId, amount_cents: amountCents, status: 'imported', paid_at: p.paid_at ?? null, invoice_number: p.invoice_number ?? null }]
    })
    if (toInsert.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await svc.from('payments').insert(toInsert as any[])
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
