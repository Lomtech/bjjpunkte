import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

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
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getUserSupabase(auth.token)
  const { data } = await supabase.from('gym_staff').select('*').eq('gym_id', auth.gym.id).order('created_at', { ascending: false }).limit(500)
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const gym = auth.gym

  const { email, name, role } = await req.json()

  const VALID_ROLES = ['trainer', 'admin', 'viewer']
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 })
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ error: 'Name darf maximal 100 Zeichen lang sein' }, { status: 400 })
  }
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return NextResponse.json({ error: 'Email ist erforderlich' }, { status: 400 })
  }
  if (email.trim().length > 254) {
    return NextResponse.json({ error: 'Email darf maximal 254 Zeichen lang sein (RFC 5321)' }, { status: 400 })
  }
  const resolvedRole = VALID_ROLES.includes(role) ? role : 'trainer'

  const sc = serviceClient()
  const { data: staff, error } = await sc.from('gym_staff').insert({
    gym_id: gym.id,
    email: email.toLowerCase().trim(),
    name: name.trim(),
    role: resolvedRole,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let emailSent = false
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bjjpunkte.vercel.app'
    const inviteUrl = `${appUrl}/staff/accept?token=${staff.invite_token}`
    const emailRes = await fetch('https://api.resend.com/emails', {
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
    }).catch(() => null)
    emailSent = emailRes?.ok === true
  }

  return NextResponse.json({ ...staff, emailSent })
}
