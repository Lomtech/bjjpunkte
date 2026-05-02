import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Uses service role to bypass RLS — safe because we validate the signup_token
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server nicht konfiguriert (Umgebungsvariablen fehlen)')
  return createClient(url, key)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })

  let supabase
  try { supabase = serviceClient() }
  catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 })
  }
  const { data: gym, error } = await supabase
    .from('gyms')
    .select('id, name, contract_template, signup_enabled')
    .eq('signup_token', token)
    .single()

  if (error || !gym) return NextResponse.json({ error: 'Ungültiger Link' }, { status: 404 })
  if (!gym.signup_enabled) return NextResponse.json({ error: 'Anmeldung deaktiviert' }, { status: 403 })

  const { data: plans } = await supabase
    .from('membership_plans')
    .select('id, name, description, price_cents, billing_interval, contract_months')
    .eq('gym_id', gym.id)
    .eq('is_active', true)
    .order('sort_order')

  return NextResponse.json({
    gymId:            gym.id,
    gymName:          gym.name,
    contractTemplate: gym.contract_template,
    plans:            plans ?? [],
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  const {
    token, gymId,
    firstName, lastName, email, phone,
    dateOfBirth, address,
    emergencyContactName, emergencyContactPhone,
    signatureData, belt, plan_id,
  } = body

  if (!token || !gymId || !firstName || !lastName || !email) {
    return NextResponse.json({ error: 'Pflichtfelder fehlen' }, { status: 400 })
  }

  let supabase
  try { supabase = serviceClient() }
  catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 })
  }

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

  // Extract IP and User-Agent for consent documentation
  const forwarded = req.headers.get('x-forwarded-for')
  const consentIp = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') ?? 'unknown'
  const consentUserAgent = req.headers.get('user-agent') ?? ''

  // Fetch gym name for consent text
  const { data: gymWithName } = await supabase.from('gyms').select('name').eq('id', gymId).single()
  const consentText = `Ich stimme den AGB und der Datenschutzerklärung von ${gymWithName?.name ?? 'dem Gym'} zu. Digitale Unterschrift geleistet am ${new Date().toLocaleString('de-DE')}.`

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
      consent_ip:              consentIp,
      consent_user_agent:      consentUserAgent,
      consent_text:            consentText,
      contract_signed_at:      now,
      gdpr_consent_at:         now,
      belt:                    belt || 'white',
      plan_id:                 plan_id || null,
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
