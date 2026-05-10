import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyRateLimit } from '@/lib/rate-limit-handler'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  // Rate-Limit: max 5 Registration-Versuche pro IP / 10 Min.
  // Verhindert Bot-Spam der Supabase-User-Quota leerlaufen lässt + Mail-
  // Delivery-Reputation kaputt macht. Proxy-Matcher exkludiert /api/auth/*
  // wegen Edge-Runtime, daher Handler-Side.
  const rl = await applyRateLimit(req, { kind: 'register', limit: 5, windowSec: 600 })
  if (rl) return rl

  // Defensiv: malformed JSON → 400 statt 500.
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  const { gymName, email, password } = body as { gymName?: string; email?: string; password?: string }

  if (!gymName?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Alle Felder sind erforderlich' }, { status: 400 })
  }

  const admin = adminClient()

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: userError?.message ?? 'Registrierung fehlgeschlagen' },
      { status: 400 }
    )
  }

  const { error: gymError } = await admin.from('gyms').insert({
    owner_id: userData.user.id,
    name: gymName.trim(),
    signup_enabled: true,
  })

  if (gymError) {
    await admin.auth.admin.deleteUser(userData.user.id)
    return NextResponse.json(
      { error: 'Gym konnte nicht erstellt werden. Bitte erneut versuchen.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
