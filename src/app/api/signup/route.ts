import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Uses service role to bypass RLS — safe because we validate the signup_token
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })

  const supabase = serviceClient()
  const { data: gym, error } = await supabase
    .from('gyms')
    .select('id, name, contract_template, signup_enabled')
    .eq('signup_token', token)
    .single()

  if (error || !gym) return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 })
  if (!gym.signup_enabled) return NextResponse.json({ error: 'Anmeldung deaktiviert' }, { status: 403 })

  return NextResponse.json({
    gymId:            gym.id,
    gymName:          gym.name,
    contractTemplate: gym.contract_template,
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  const {
    token, gymId,
    firstName, lastName, email, phone,
    dateOfBirth, address,
    emergencyContactName, emergencyContactPhone,
    signatureData, belt,
  } = body

  if (!token || !gymId || !firstName || !lastName || !email) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
  }

  const supabase = serviceClient()

  // Validate token still matches this gym and signup is enabled
  const { data: gym } = await supabase
    .from('gyms')
    .select('id, signup_enabled')
    .eq('id', gymId)
    .eq('signup_token', token)
    .single()

  if (!gym || !gym.signup_enabled) {
    return NextResponse.json({ error: 'Ungültiger oder deaktivierter Link' }, { status: 403 })
  }

  // Check for duplicate email in this gym
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('gym_id', gymId)
    .eq('email', email.toLowerCase().trim())
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Diese E-Mail ist bereits registriert.' }, { status: 409 })
  }

  const now = new Date().toISOString()

  const { data: member, error } = await supabase
    .from('members')
    .insert({
      gym_id:                  gymId,
      first_name:              firstName.trim(),
      last_name:               lastName.trim(),
      email:                   email.toLowerCase().trim(),
      phone:                   phone?.trim() || null,
      date_of_birth:           dateOfBirth || null,
      address:                 address?.trim() || null,
      emergency_contact_name:  emergencyContactName?.trim() || null,
      emergency_contact_phone: emergencyContactPhone?.trim() || null,
      signature_data:          signatureData || null,
      contract_signed_at:      now,
      gdpr_consent_at:         now,
      belt:                    belt || 'white',
      stripes:                 0,
      is_active:               false,          // pending until gym activates
      onboarding_status:       'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Signup insert error:', error)
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, memberId: member.id })
}
