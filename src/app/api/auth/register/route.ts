import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  const { gymName, email, password } = await req.json()

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
