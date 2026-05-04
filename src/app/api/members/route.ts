import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'
import { sendWhatsApp } from '@/lib/whatsapp'

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
  } = body

  // Eingabevalidierung
  if (!first_name?.trim()) return NextResponse.json({ error: 'Vorname fehlt' }, { status: 400 })
  if (!last_name?.trim()) return NextResponse.json({ error: 'Nachname fehlt' }, { status: 400 })
  if (!join_date) return NextResponse.json({ error: 'Eintrittsdatum fehlt' }, { status: 400 })
  const VALID_BELTS = ['white', 'blue', 'purple', 'brown', 'black']
  if (belt && !VALID_BELTS.includes(belt)) return NextResponse.json({ error: 'Ungültiger Gürtel' }, { status: 400 })

  // Insert + get portal_token in one call (no separate SELECT needed)
  const { data: member, error } = await (supabase.from('members') as any).insert({
    gym_id: gymData.id,
    first_name,
    last_name,
    email: email || null,
    phone: phone || null,
    date_of_birth: date_of_birth || null,
    join_date,
    belt,
    stripes,
    notes: notes || null,
    contract_end_date: contract_end_date || null,
    is_active: true,
    parent_member_id: parent_member_id || null,
  }).select('id, portal_token').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const memberId   = (member as { id: string; portal_token: string | null }).id
  const portalToken = (member as { id: string; portal_token: string | null }).portal_token
  const appUrl     = getAppUrl()
  const portalUrl  = portalToken ? `${appUrl}/portal/${portalToken}` : null
  const gymName    = gymData.name ?? 'Deinem Gym'

  // Welcome email
  if (email && portalUrl && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `Willkommen bei ${gymName}!`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Hallo ${first_name}! 🥋</p>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
              Herzlich willkommen bei <strong>${gymName}</strong>! Wir freuen uns, dich dabei zu haben.
            </p>
            <p style="margin:0 0 16px;font-size:14px;color:#374151">
              Über deinen persönlichen Mitglieder-Link kannst du jederzeit deine Daten,
              Trainingsanwesenheit und Beiträge einsehen:
            </p>
            <a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:#0f172a;font-weight:700;font-size:14px;border-radius:12px;text-decoration:none">
              Mein Mitglieder-Portal →
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">Oss!</p>
          </div>
        `,
      }),
    }).catch(() => {/* best-effort */})
  }

  // Welcome WhatsApp
  if (phone && portalUrl) {
    sendWhatsApp({
      to: phone,
      body: `Hallo ${first_name}! 🥋 Willkommen bei ${gymName}!\n\nDein persönlicher Mitglieder-Link:\n${portalUrl}\n\nOss!`,
    }).catch(() => {/* best-effort */})
  }

  return NextResponse.json({ id: memberId }, { status: 201 })
}
