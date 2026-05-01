import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getUserSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const supabase = getUserSupabase(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })
  const { data } = await supabase.from('gym_staff').select('*').eq('gym_id', gym.id).order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const supabase = getUserSupabase(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const { data: gym } = await supabase.from('gyms').select('id, name').eq('owner_id', user.id).single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const { email, name, role } = await req.json()
  if (!email || !name) return NextResponse.json({ error: 'Email und Name erforderlich' }, { status: 400 })

  const sc = serviceClient()
  const { data: staff, error } = await sc.from('gym_staff').insert({
    gym_id: gym.id,
    email: email.toLowerCase().trim(),
    name: name.trim(),
    role: role ?? 'trainer',
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Send invite email via Resend if configured
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bjjpunkte.vercel.app'
    const inviteUrl = `${appUrl}/staff/accept?token=${staff.invite_token}`
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `Einladung: ${gym.name} – Trainer-Zugang`,
        html: `<h2>Hallo ${name}!</h2><p>Du wurdest als Trainer bei <strong>${gym.name}</strong> eingeladen.</p><p><a href="${inviteUrl}" style="background:#f59e0b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Zugang aktivieren →</a></p><p style="color:#666;font-size:12px;">Link: ${inviteUrl}</p>`,
      }),
    }).catch(() => {})
  }

  return NextResponse.json(staff)
}
