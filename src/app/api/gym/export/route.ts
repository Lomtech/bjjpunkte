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

  const { data: { user }, error: userErr } = await authClient(accessToken).auth.getUser(accessToken)
  if (!user || userErr) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const svc = serviceClient()

  // ── Gym ───────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gym, error: gymErr } = await (svc.from('gyms') as any)
    .select('*').eq('owner_id', user.id).single()

  if (gymErr || !gym) {
    return NextResponse.json({ error: 'Gym nicht gefunden', detail: gymErr?.message ?? null }, { status: 404 })
  }

  // ── Fetch all tables in parallel ──────────────────────────────────────────
  const [
    { data: plans },
    { data: announcements },
    { data: posts },
    { data: members },
    { data: classes },
    { data: leads },
    { data: staff },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('membership_plans') as any)
      .select('name, description, price_cents, billing_interval, contract_months, is_active, sort_order')
      .eq('gym_id', gym.id).order('sort_order'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('gym_announcements') as any)
      .select('title, body, is_pinned, expires_at').eq('gym_id', gym.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('posts') as any)
      .select('title, cover_url, blocks, published_at').eq('gym_id', gym.id).not('published_at', 'is', null),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('members') as any)
      .select([
        'id, first_name, last_name, email, phone, date_of_birth, address,',
        'belt, stripes, join_date, is_active, emergency_contact_name, emergency_contact_phone,',
        'notes, belt_awarded_at, subscription_status, contract_end_date,',
        'monthly_fee_override_cents, signature_data, contract_signed_at,',
        'gdpr_consent_at, onboarding_status, consent_ip, consent_user_agent, consent_text,',
        'cancellation_requested_at, cancellation_note, parent_member_id, plan_id, requested_plan_id',
      ].join(' '))
      .eq('gym_id', gym.id).order('created_at'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('classes') as any)
      .select('id, title, class_type, description, instructor, starts_at, ends_at, max_capacity, is_cancelled, recurrence_type, recurrence_until, recurrence_parent_id')
      .eq('gym_id', gym.id).order('starts_at'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('leads') as any)
      .select('id, first_name, last_name, email, phone, status, source, notes, trial_date, created_at, referred_by, contacted_at, converted_at')
      .eq('gym_id', gym.id).order('created_at'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (svc.from('staff') as any)
      .select('name, email, role, accepted_at').eq('gym_id', gym.id),
  ])

  // ── Build ID → index maps ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberIdx: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(members ?? []).forEach((m: any, i: number) => { memberIdx[m.id] = i })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planIdx: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(plans ?? []).forEach((p: any, i: number) => { if (p.id) planIdx[p.id] = i })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classIdx: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(classes ?? []).forEach((c: any, i: number) => { classIdx[c.id] = i })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadIdx: Record<string, number> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(leads ?? []).forEach((l: any, i: number) => { leadIdx[l.id] = i })

  const classIds  = (classes  ?? []).map((c: any) => c.id) // eslint-disable-line @typescript-eslint/no-explicit-any
  const memberIds = (members  ?? []).map((m: any) => m.id) // eslint-disable-line @typescript-eslint/no-explicit-any
  const leadIds   = (leads    ?? []).map((l: any) => l.id) // eslint-disable-line @typescript-eslint/no-explicit-any

  // ── Fetch relational tables ───────────────────────────────────────────────
  const [
    { data: bookings },
    { data: attendance },
    { data: beltPromotions },
    { data: leadBookings },
    { data: trainingLogs },
    { data: payments },
  ] = await Promise.all([
    classIds.length && memberIds.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (svc.from('class_bookings') as any)
          .select('member_id, class_id, status, created_at')
          .in('class_id', classIds).in('member_id', memberIds).neq('status', 'cancelled')
      : { data: [] },
    memberIds.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (svc.from('attendance') as any)
          .select('member_id, class_id, class_type, checked_in_at')
          .eq('gym_id', gym.id).in('member_id', memberIds)
      : { data: [] },
    memberIds.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (svc.from('belt_promotions') as any)
          .select('member_id, previous_belt, new_belt, promoted_at, notes')
          .eq('gym_id', gym.id).in('member_id', memberIds).order('promoted_at')
      : { data: [] },
    leadIds.length && classIds.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (svc.from('lead_bookings') as any)
          .select('lead_id, class_id, status, booked_at')
          .in('lead_id', leadIds).in('class_id', classIds).neq('status', 'cancelled')
      : { data: [] },
    memberIds.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (svc.from('training_logs') as any)
          .select('member_id, note, class_type, logged_at')
          .eq('gym_id', gym.id).in('member_id', memberIds)
      : { data: [] },
    memberIds.length
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (svc.from('payments') as any)
          .select('member_id, amount_cents, status, paid_at, created_at, invoice_number')
          .eq('gym_id', gym.id).in('member_id', memberIds)
      : { data: [] },
  ])

  // ── Serialize with index references ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membersExport = (members ?? []).map((m: any) => ({
    first_name:                 m.first_name,
    last_name:                  m.last_name,
    email:                      m.email,
    phone:                      m.phone,
    date_of_birth:              m.date_of_birth,
    address:                    m.address,
    belt:                       m.belt,
    stripes:                    m.stripes,
    join_date:                  m.join_date,
    is_active:                  m.is_active,
    emergency_contact_name:     m.emergency_contact_name,
    emergency_contact_phone:    m.emergency_contact_phone,
    notes:                      m.notes,
    belt_awarded_at:            m.belt_awarded_at,
    subscription_status:        m.subscription_status,
    contract_end_date:          m.contract_end_date,
    monthly_fee_override_cents: m.monthly_fee_override_cents,
    signature_data:             m.signature_data,
    contract_signed_at:         m.contract_signed_at,
    gdpr_consent_at:            m.gdpr_consent_at,
    onboarding_status:          m.onboarding_status,
    consent_ip:                 m.consent_ip,
    consent_user_agent:         m.consent_user_agent,
    consent_text:               m.consent_text,
    cancellation_requested_at:  m.cancellation_requested_at,
    cancellation_note:          m.cancellation_note,
    parent_member_index:        m.parent_member_id != null ? (memberIdx[m.parent_member_id] ?? null) : null,
    plan_index:                 m.plan_id != null ? (planIdx[m.plan_id] ?? null) : null,
    requested_plan_index:       m.requested_plan_id != null ? (planIdx[m.requested_plan_id] ?? null) : null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const classesExport = (classes ?? []).map((c: any) => ({
    title:                   c.title,
    class_type:              c.class_type,
    description:             c.description,
    instructor:              c.instructor,
    starts_at:               c.starts_at,
    ends_at:                 c.ends_at,
    max_capacity:            c.max_capacity,
    is_cancelled:            c.is_cancelled,
    recurrence_type:         c.recurrence_type,
    recurrence_until:        c.recurrence_until,
    recurrence_parent_index: c.recurrence_parent_id != null ? (classIdx[c.recurrence_parent_id] ?? null) : null,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookingsExport = (bookings ?? []).flatMap((b: any) => {
    const mi = memberIdx[b.member_id]
    const ci = classIdx[b.class_id]
    if (mi === undefined || ci === undefined) return []
    return [{ member_index: mi, class_index: ci, status: b.status, created_at: b.created_at }]
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attendanceExport = (attendance ?? []).flatMap((a: any) => {
    const mi = memberIdx[a.member_id]
    if (mi === undefined) return []
    const ci = a.class_id != null ? (classIdx[a.class_id] ?? null) : null
    return [{ member_index: mi, class_index: ci, class_type: a.class_type, checked_in_at: a.checked_in_at }]
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beltPromotionsExport = (beltPromotions ?? []).flatMap((p: any) => {
    const mi = memberIdx[p.member_id]
    if (mi === undefined) return []
    return [{ member_index: mi, previous_belt: p.previous_belt, new_belt: p.new_belt, promoted_at: p.promoted_at, notes: p.notes }]
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadsExport = (leads ?? []).map((l: any) => ({
    first_name:   l.first_name,
    last_name:    l.last_name,
    email:        l.email,
    phone:        l.phone,
    status:       l.status,
    source:       l.source,
    notes:        l.notes,
    trial_date:   l.trial_date,
    created_at:   l.created_at,
    referred_by:  l.referred_by,
    contacted_at: l.contacted_at,
    converted_at: l.converted_at,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leadBookingsExport = (leadBookings ?? []).flatMap((lb: any) => {
    const li = leadIdx[lb.lead_id]
    const ci = classIdx[lb.class_id]
    if (li === undefined || ci === undefined) return []
    return [{ lead_index: li, class_index: ci, status: lb.status, booked_at: lb.booked_at }]
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trainingLogsExport = (trainingLogs ?? []).flatMap((tl: any) => {
    const mi = memberIdx[tl.member_id]
    if (mi === undefined) return []
    return [{ member_index: mi, note: tl.note, class_type: tl.class_type, logged_at: tl.logged_at }]
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentsExport = (payments ?? []).flatMap((p: any) => {
    const mi = memberIdx[p.member_id]
    if (mi === undefined) return []
    return [{ member_index: mi, amount_cents: p.amount_cents, status: p.status, paid_at: p.paid_at, created_at: p.created_at, invoice_number: p.invoice_number }]
  })

  return NextResponse.json({
    version: 4,
    exported_at: new Date().toISOString(),
    gym: {
      // Identity
      name:                gym.name,
      address:             gym.address,
      phone:               gym.phone,
      email:               gym.email,
      slug:                gym.slug,
      founded_year:        gym.founded_year ?? null,
      // Sport / belt
      sport_type:          gym.sport_type,
      belt_system:         gym.belt_system,
      belt_system_enabled: gym.belt_system_enabled,
      stripes_enabled:     gym.stripes_enabled ?? null,
      class_types:         gym.class_types,
      // Member portal
      contract_template:   gym.contract_template,
      signup_enabled:      gym.signup_enabled,
      // Contact / social
      whatsapp_number:     gym.whatsapp_number,
      instagram_url:       gym.instagram_url,
      facebook_url:        gym.facebook_url,
      website_url:         gym.website_url,
      // Website builder
      tagline:             gym.tagline ?? null,
      about:               gym.about ?? null,
      about_blocks:        gym.about_blocks ?? [],
      opening_hours:       gym.opening_hours ?? null,
      impressum_text:      gym.impressum_text ?? null,
      hero_title:          gym.hero_title ?? null,
      hero_subtitle:       gym.hero_subtitle ?? null,
      accent_color:        gym.accent_color ?? null,
      hero_image_position: gym.hero_image_position,
      // Media (URLs — re-uploaded on import)
      logo_url:            gym.logo_url,
      hero_image_url:      gym.hero_image_url,
      gallery_urls:        gym.gallery_urls ?? [],
      video_url:           gym.video_url,
      video_urls:          gym.video_urls ?? [],
      // Billing / legal
      is_kleinunternehmer:  gym.is_kleinunternehmer ?? null,
      invoice_prefix:       gym.invoice_prefix ?? null,
      legal_name:           gym.legal_name ?? null,
      legal_address:        gym.legal_address ?? null,
      legal_email:          gym.legal_email ?? null,
      tax_number:           gym.tax_number ?? null,
      ustid:                gym.ustid ?? null,
      bank_iban:            gym.bank_iban ?? null,
      bank_bic:             gym.bank_bic ?? null,
      bank_name:            gym.bank_name ?? null,
      // DATEV
      datev_beraternummer:   gym.datev_beraternummer ?? null,
      datev_mandantennummer: gym.datev_mandantennummer ?? null,
      datev_sachkontenlänge: gym.datev_sachkontenlänge ?? 4,
      // GPS check-in
      latitude:          gym.latitude ?? null,
      longitude:         gym.longitude ?? null,
      gps_radius_meters: gym.gps_radius_meters ?? 300,
      // Integrations
      callmebot_api_key: gym.callmebot_api_key ?? null,
    },
    membership_plans:  plans              ?? [],
    announcements:     announcements      ?? [],
    posts:             posts              ?? [],
    members:           membersExport,
    classes:           classesExport,
    class_bookings:    bookingsExport,
    attendance:        attendanceExport,
    belt_promotions:   beltPromotionsExport,
    leads:             leadsExport,
    lead_bookings:     leadBookingsExport,
    staff:             staff              ?? [],
    training_logs:     trainingLogsExport,
    payments:          paymentsExport,
  })
}
