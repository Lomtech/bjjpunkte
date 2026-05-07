import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'
import { sendWhatsApp } from '@/lib/whatsapp'
import { notifyGym } from '@/lib/notify'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await (supabase.from('gyms') as any)
    .select('id, name, plan_member_limit')
    .eq('owner_id', user.id)
    .single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const gymData = gym as { id: string; name: string; plan_member_limit: number | null }
  const limit = gymData.plan_member_limit ?? 30

  const { count: activeCount } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('gym_id', gymData.id)
    .eq('is_active', true)

  if ((activeCount ?? 0) >= limit) {
    return NextResponse.json({ error: 'PLAN_LIMIT_REACHED', limit }, { status: 403 })
  }

  const body = await req.json()
  const {
    first_name, last_name, email, phone, date_of_birth, join_date,
    belt, stripes, notes, contract_end_date, parent_member_id,
    membership_source,
  } = body

  if (!first_name?.trim()) return NextResponse.json({ error: 'Vorname fehlt' }, { status: 400 })
  if (!last_name?.trim()) return NextResponse.json({ error: 'Nachname fehlt' }, { status: 400 })
  if (first_name.trim().length > 100) return NextResponse.json({ error: 'Vorname max. 100 Zeichen' }, { status: 400 })
  if (last_name.trim().length > 100) return NextResponse.json({ error: 'Nachname max. 100 Zeichen' }, { status: 400 })
  if (email && email.length > 254) return NextResponse.json({ error: 'E-Mail max. 254 Zeichen' }, { status: 400 })
  if (phone && phone.length > 50) return NextResponse.json({ error: 'Telefon max. 50 Zeichen' }, { status: 400 })
  if (notes && notes.length > 5000) return NextResponse.json({ error: 'Notizen max. 5000 Zeichen' }, { status: 400 })
  if (!join_date) return NextResponse.json({ error: 'Eintrittsdatum fehlt' }, { status: 400 })
  const VALID_BELTS = ['white', 'blue', 'purple', 'brown', 'black']
  if (belt && !VALID_BELTS.includes(belt)) return NextResponse.json({ error: 'Ungültiger Gürtel' }, { status: 400 })

  // Mitgliedschaftsart-Validierung + Volljährigkeits-Hard-Check
  const VALID_SOURCES = ['direct', 'wellpass', 'hansefit', 'egym', 'urban_sports']
  const ADULT_ONLY_SOURCES = new Set(['wellpass', 'hansefit', 'egym'])
  const sourceVal: string = (typeof membership_source === 'string' && VALID_SOURCES.includes(membership_source))
    ? membership_source
    : 'direct'
  if (ADULT_ONLY_SOURCES.has(sourceVal) && date_of_birth) {
    const dob = new Date(date_of_birth)
    if (!Number.isNaN(dob.getTime())) {
      const today = new Date()
      let age = today.getFullYear() - dob.getFullYear()
      const md = today.getMonth() - dob.getMonth()
      if (md < 0 || (md === 0 && today.getDate() < dob.getDate())) age--
      if (age < 18) {
        return NextResponse.json({
          error: `${sourceVal} ist nur für Erwachsene zulässig (Anbieter-Vertrag).`,
        }, { status: 400 })
      }
    }
  }

  // Insert — get portal_token in same call (no extra SELECT)
  const { data: member, error } = await (supabase.from('members') as any).insert({
    gym_id:            gymData.id,
    first_name,
    last_name,
    email:             email || null,
    phone:             phone || null,
    date_of_birth:     date_of_birth || null,
    join_date,
    belt,
    stripes,
    notes:             notes || null,
    contract_end_date: contract_end_date || null,
    is_active:         true,
    parent_member_id:  parent_member_id || null,
    membership_source: sourceVal,
  }).select('id, portal_token').single()

  if (error) {
    // Check if this is a plan-limit constraint violation (race condition)
    if (error.code === '23514' || error.code === '23505' || error.message?.includes('plan_member_limit')) {
      return NextResponse.json({ error: 'PLAN_LIMIT_REACHED', limit }, { status: 403 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const memberId    = (member as { id: string; portal_token: string | null }).id
  const portalToken = (member as { id: string; portal_token: string | null }).portal_token
  const appUrl      = getAppUrl()
  const portalUrl   = portalToken ? `${appUrl}/portal/${portalToken}` : null
  const gymName     = gymData.name ?? 'Deinem Gym'
  const fullName    = `${first_name} ${last_name}`

  // ── 1. Welcome email → member ────────────────────────────────────────────
  if (email && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    const portalSection = portalUrl
      ? `
            <p style="margin:0 0 16px;font-size:14px;color:#374151">
              Über deinen persönlichen Mitglieder-Link kannst du jederzeit deine Daten,
              Trainingsanwesenheit und Beiträge einsehen:
            </p>
            <a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:#0f172a;font-weight:700;font-size:14px;border-radius:12px;text-decoration:none">
              Mein Mitglieder-Portal →
            </a>`
      : `
            <p style="margin:0 0 16px;font-size:14px;color:#374151">
              Bitte wende dich an deinen Gym-Admin für deinen Portal-Zugang.
            </p>`
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to:   email,
        subject: `Willkommen bei ${gymName}!`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Hallo ${first_name}! 🥋</p>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
              Herzlich willkommen bei <strong>${gymName}</strong>! Wir freuen uns, dich dabei zu haben.
            </p>${portalSection}
            <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">Oss!</p>
          </div>
        `,
      }),
    }).catch(() => {/* best-effort */})
  }

  // ── 2. Welcome WhatsApp → member (Twilio) ────────────────────────────────
  if (phone && portalUrl) {
    await sendWhatsApp({
      to:   phone,
      body: `Hallo ${first_name}! 🥋 Willkommen bei ${gymName}!\n\nDein persönlicher Mitglieder-Link:\n${portalUrl}\n\nOss!`,
    }).catch(() => {/* best-effort */})
  }

  // ── 3. Notify gym owner (email + WhatsApp via gym settings) ─────────────
  await notifyGym({
    gymId: gymData.id,
    subject: `Neues Mitglied: ${fullName}`,
    html: `
      <p style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a">Neues Mitglied hinzugefügt 🥋</p>
      <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
        <strong>${fullName}</strong> wurde als aktives Mitglied in <strong>${gymName}</strong> eingetragen.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280;width:120px">Name</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600">${fullName}</td></tr>
        ${email ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">E-Mail</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${email}</td></tr>` : ''}
        ${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Telefon</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${phone}</td></tr>` : ''}
        ${belt ? `<tr><td style="padding:8px 0;color:#6b7280">Gürtel</td><td style="padding:8px 0;text-transform:capitalize">${belt}</td></tr>` : ''}
      </table>
    `,
    whatsappText: `🥋 Neues Mitglied!\n${fullName}${email ? '\n' + email : ''}${phone ? '\n' + phone : ''}\n\nhttps://www.osss.pro/dashboard`,
  }).catch(() => {/* best-effort */})

  return NextResponse.json({ id: memberId }, { status: 201 })
}
