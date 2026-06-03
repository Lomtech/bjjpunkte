import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyRateLimit } from '@/lib/rate-limit-handler'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { getAppUrl } from '@/lib/app-url'

// POST /api/auth/register — Owner-Signup fuer neues Gym.
//
// Sicherheits-Lifecycle (Sprint 2026-05-29 nach Bot-Wave):
// 1. Rate-Limit: 3 / 1 h / IP (vorher 5 / 10 min — zu lasch fuer Bot-Sweep)
// 2. Honeypot 'website' Field — Bots fuellen aus, Menschen sehen es nicht
// 3. Random-Name-Heuristik — bots erzeugen consonant-only Strings wie
//    'tlAoMBMRkOSbbedouICt' — verworfen mit silent fake-success
// 4. Standard Supabase-Signup-Flow (signUp() ohne email_confirm:true) statt
//    admin.createUser — Sup schickt automatisch Confirm-Mail, User kann erst
//    nach Klick einloggen. Vorher: Bots waren in 1 s confirmed=true im System.
// 5. Gym wird mit signup_enabled=false angelegt und erst nach Confirm aktiv

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Bot-Heuristik: Random-Strings ohne Vokale (z.B. 'tlAoMBMRkOSbbedouICt')
// haben weniger als 20% Vokal-Anteil. Echte Gym-Namen wie 'CSC FFB' = >25%.
function looksLikeRandomString(s: string): boolean {
  const clean = s.replace(/[^a-zA-Z]/g, '')
  if (clean.length < 10) return false
  const vowels = clean.match(/[aeiouAEIOU]/g)?.length ?? 0
  const vowelRatio = vowels / clean.length
  return vowelRatio < 0.20
}

export async function POST(req: Request) {
  // Rate-Limit
  const rl = await applyRateLimit(req, { kind: 'register', limit: 3, windowSec: 3600 })
  if (rl) return rl

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  const { gymName, email, password, website, turnstileToken } = body as {
    gymName?: string
    email?: string
    password?: string
    website?: string // Honeypot
    turnstileToken?: string // Cloudflare Turnstile
  }

  // Sprint Phase-1 (2026-05-31): Turnstile als 5. Bot-Defense-Schicht.
  // Skip ist OK wenn TURNSTILE_SECRET_KEY nicht gesetzt — Dev/staging.
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                ?? req.headers.get('x-real-ip')
                ?? null
  const turnstile = await verifyTurnstileToken(turnstileToken, clientIp)
  if (!turnstile.success) {
    return NextResponse.json(
      { error: 'CAPTCHA-Verifizierung fehlgeschlagen, bitte erneut versuchen' },
      { status: 400 },
    )
  }

  // Honeypot — silent 200 (Bot weiss nicht dass es gemerkt wurde)
  if (typeof website === 'string' && website.trim() !== '') {
    return NextResponse.json({ ok: true, pendingConfirmation: true })
  }

  if (!gymName?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Alle Felder sind erforderlich' }, { status: 400 })
  }

  const trimmedName = gymName.trim()
  if (trimmedName.length < 3 || trimmedName.length > 100) {
    return NextResponse.json({ error: 'Gym-Name muss zwischen 3 und 100 Zeichen sein' }, { status: 400 })
  }

  // Bot-Heuristik: silent fake-success
  if (looksLikeRandomString(trimmedName)) {
    console.warn('[register] random-name suspect:', { gymName: trimmedName, email })
    return NextResponse.json({ ok: true, pendingConfirmation: true })
  }

  // Sup signUp() — kein email_confirm Bypass mehr.
  // Sup schickt automatisch Confirm-Mail, email_confirmed_at bleibt null
  // bis User klickt. signInWithPassword wirft 'Email not confirmed' bis dahin.
  const pub = publicClient()
  const siteUrl = getAppUrl()  // kanonische Domain (NEXT_PUBLIC_APP_URL) — konsistent mit dem Rest der App
  const { data: userData, error: userError } = await pub.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${siteUrl}/login?welcome=1`,
      data: { gym_name: trimmedName },
    },
  })

  if (userError || !userData.user) {
    return NextResponse.json(
      { error: userError?.message ?? 'Registrierung fehlgeschlagen' },
      { status: 400 }
    )
  }

  // Gym anlegen — owner_id verknuepft, signup_enabled=false bis Confirm
  const admin = adminClient()
  const { error: gymError } = await admin.from('gyms').insert({
    owner_id: userData.user.id,
    name: trimmedName,
    signup_enabled: false,
  })

  if (gymError) {
    await admin.auth.admin.deleteUser(userData.user.id)
    return NextResponse.json(
      { error: 'Gym konnte nicht erstellt werden. Bitte erneut versuchen.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    pendingConfirmation: true,
  })
}
