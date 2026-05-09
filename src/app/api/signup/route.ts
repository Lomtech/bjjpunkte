import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import Stripe from 'stripe'
import { notifyGym } from '@/lib/notify'
import { sendWhatsApp } from '@/lib/whatsapp'
import { getAppUrl } from '@/lib/app-url'
import { uploadSignature } from '@/lib/signature-storage'

// Uses service role to bypass RLS — safe because we validate the signup_token
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server nicht konfiguriert (Umgebungsvariablen fehlen)')
  return createClient<Database>(url, key)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  // Token-Hardening (Audit 2026-05-09 / A2): mind. 32 Zeichen + Char-Class.
  // Service-Role-Bypass-Endpoint, Brute-Force ohne Rate-Limit-bezogenen Token-
  // Hash würde sonst Member-Insert + Stripe-Customer-Erzeugung triggern können.
  if (!token || token.length < 32 || token.length > 256 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return NextResponse.json({ error: 'Token fehlt' }, { status: 400 })
  }

  let supabase
  try { supabase = serviceClient() }
  catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 503 })
  }
  const { data: gym, error } = await supabase
    .from('gyms')
    .select('id, name, address, contract_template, signup_enabled, website_url')
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

  // Wenn kein eigenes Template → Default mit Hausordnung+Haftungsausschluss verwenden.
  // Platzhalter ({{gym_name}} usw.) werden hier serverseitig durch Studio-Daten ersetzt.
  const { resolveContractTemplate } = await import('@/lib/legal/default-contract')

  return NextResponse.json({
    gymId:            gym.id,
    gymName:          gym.name,
    contractTemplate: resolveContractTemplate(gym.contract_template, {
      name:    gym.name,
      address: gym.address ?? null,
      url:     gym.website_url ?? null,
    }),
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
  // Token-Hardening (Audit 2026-05-09 / A2): Format-Check vor DB-Hit.
  if (typeof token !== 'string' || token.length < 32 || token.length > 256 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }
  // Input-Length-Caps gegen Body-Bloat (Service-Client-INSERT, RLS-bypass).
  // 200 ist Komfortabel: Vornamen können hyphenated sein; lange Adressen
  // erlauben wir bis 500.
  if (
    typeof firstName !== 'string' || firstName.length > 200 ||
    typeof lastName  !== 'string' || lastName.length  > 200 ||
    typeof email     !== 'string' || email.length     > 320 ||
    (phone     != null && typeof phone     === 'string' && phone.length     > 50) ||
    (address   != null && typeof address   === 'string' && address.length   > 500) ||
    (emergencyContactName  != null && typeof emergencyContactName  === 'string' && emergencyContactName.length  > 200) ||
    (emergencyContactPhone != null && typeof emergencyContactPhone === 'string' && emergencyContactPhone.length > 50) ||
    (typeof gymId !== 'string' || gymId.length > 64)
  ) {
    return NextResponse.json({ error: 'Eingabe zu lang' }, { status: 400 })
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

  // Fetch plan for contract_months (used for contract_end_date calculation)
  let selectedPlan: { contract_months: number | null } | null = null
  if (plan_id) {
    const { data: planData } = await supabase
      .from('membership_plans')
      .select('contract_months')
      .eq('id', plan_id)
      .single()
    selectedPlan = planData as { contract_months: number | null } | null
  }

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
      // Plaintext-base64 wird NIE in die DB geschrieben — Upload zu Storage erfolgt
      // direkt nach dem Insert (siehe unten). DSGVO Art. 32: signature_data hält
      // ab jetzt nur noch Storage-Paths.
      signature_data:          null,
      consent_ip:              consentIp,
      consent_user_agent:      consentUserAgent,
      consent_text:            consentText,
      contract_signed_at:      now,
      gdpr_consent_at:         now,
      belt:                    belt || 'white',
      plan_id:                 plan_id || null,
      stripes:                 0,
      is_active:               true,           // auto-activated — gym gets notified
      onboarding_status:       'complete',
      // Auto-set contract_end_date based on plan's contract_months
      contract_end_date: (() => {
        const months = selectedPlan?.contract_months
        if (!months || months <= 0) return null
        const end = new Date()
        end.setMonth(end.getMonth() + months)
        return end.toISOString().substring(0, 10)
      })(),
    })
    .select('id, portal_token')
    .single()

  if (error) {
    console.error('Signup insert error:', error)
    return NextResponse.json({ error: 'Registrierung fehlgeschlagen.' }, { status: 500 })
  }

  // ── Signatur ins private Storage hochladen ──────────────────────────────────
  // Plaintext-base64-PNG (data:image/...) wird zum binären PNG im privaten
  // Bucket `member-signatures`. Die Spalte `signature_data` hält danach nur
  // noch den Storage-Path. Bei Upload-Fehler bleibt signature_data NULL —
  // PDF rendert dann die leere Unterschriftslinie statt zu crashen.
  if (signatureData && typeof signatureData === 'string' && signatureData.startsWith('data:image/')) {
    try {
      const sigPath = await uploadSignature(gymId, member.id, signatureData)
      if (sigPath) {
        const { error: updErr } = await supabase
          .from('members')
          .update({ signature_data: sigPath })
          .eq('id', member.id)
        if (updErr) {
          console.warn('Signup: signature path update failed:', updErr.message)
        }
      } else {
        console.warn('Signup: signature upload returned null — member', member.id, 'has no signature stored')
      }
    } catch (sigErr) {
      console.warn('Signup: signature upload threw:', sigErr instanceof Error ? sigErr.message : sigErr)
    }
  }

  // Auto-create lead so the gym owner sees new signups in Interessenten
  await supabase.from('leads').upsert(
    {
      gym_id:     gymId,
      first_name: firstName.trim(),
      last_name:  lastName.trim(),
      email:      email.toLowerCase().trim(),
      phone:      phone?.trim() || null,
      source:     'signup_link',
      status:     'new',
      notes:      'Angemeldet via Mitglieder-Anmeldelink',
    },
    { onConflict: 'gym_id,email', ignoreDuplicates: true }
  )

  const fullName    = `${firstName.trim()} ${lastName.trim()}`
  const portalToken = (member as { id: string; portal_token: string | null }).portal_token
  const appUrl      = getAppUrl()
  const portalUrl   = portalToken ? `${appUrl}/portal/${portalToken}` : null
  const gymName     = gymWithName?.name ?? 'deinem Gym'

  // WhatsApp-Gruppen-Link laden (falls Owner einen hinterlegt hat)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gymWa } = await (supabase.from('gyms') as any)
    .select('whatsapp_group_url')
    .eq('id', gymId)
    .maybeSingle()
  const whatsappGroupUrl: string | null = (gymWa as { whatsapp_group_url?: string | null } | null)?.whatsapp_group_url ?? null

  // ── Stripe subscription checkout (if plan has stripe_price_id) ────────────
  let checkoutUrl: string | null = null
  if (plan_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const { data: plan } = await supabase
        .from('membership_plans')
        .select('id, name, price_cents, billing_interval, stripe_price_id')
        .eq('id', plan_id)
        .eq('gym_id', gymId)  // cross-gym plan injection guard
        .single()

      const { data: gymStripe } = await supabase.from('gyms')
        .select('stripe_account_id')
        .eq('id', gymId)
        .single()

      if ((plan as any)?.price_cents) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
        const platformFeePercent = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? '0') || 0
        const connectedAccountId = (gymStripe as any)?.stripe_account_id as string | null
        const stripeOpts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined

        // Get or create Stripe customer on connected account
        const { data: memberRow } = await supabase
          .from('members')
          .select('stripe_customer_id')
          .eq('id', member.id)
          .single()

        let customerId = (memberRow as any)?.stripe_customer_id as string | null

        // Verify existing customer is on connected account; recreate if not
        if (customerId && connectedAccountId) {
          try {
            await stripe.customers.retrieve(customerId, {}, { stripeAccount: connectedAccountId })
          } catch {
            customerId = null
          }
        }
        if (!customerId) {
          const customer = await stripe.customers.create(
            { email: email.toLowerCase().trim(), name: fullName, metadata: { memberId: member.id, gymId } },
            stripeOpts ?? {},
          )
          customerId = customer.id
          await supabase.from('members').update({ stripe_customer_id: customerId }).eq('id', member.id)
        }

        // Use price_data inline (avoids platform vs connected account price mismatch)
        const billingInterval = (plan as any)?.billing_interval === 'biannual'
          ? { interval: 'month' as const, interval_count: 6 }
          : (plan as any)?.billing_interval === 'annual'
            ? { interval: 'year' as const }
            : { interval: 'month' as const }

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          customer: customerId,
          line_items: [{
            price_data: {
              currency: 'eur',
              unit_amount: (plan as any)?.price_cents,
              recurring: billingInterval,
              product_data: { name: (plan as any)?.name ?? 'Mitgliedschaft' },
            },
            quantity: 1,
          }],
          mode: 'subscription',
          billing_address_collection: 'required',
          success_url: `${appUrl}/portal/${portalToken ?? ''}?payment=success`,
          cancel_url:  `${appUrl}/portal/${portalToken ?? ''}`,
          metadata: { memberId: member.id, gymId },
          subscription_data: {
            metadata: { memberId: member.id, gymId },
            ...(platformFeePercent > 0 ? { application_fee_percent: platformFeePercent } : {}),
          },
        }

        // Direct charge: session on connected account so customer is found; no on_behalf_of needed
        const session = await stripe.checkout.sessions.create(sessionParams, stripeOpts)
        checkoutUrl = session.url
      }
    } catch (err) {
      console.error('Stripe checkout at signup error:', err instanceof Error ? err.message : err)
      // Non-fatal — member is already created and active
    }
  }

  // ── 1. Bestätigungs-Email → Mitglied ──────────────────────────────────────
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    process.env.RESEND_FROM_EMAIL,
        to:      email.toLowerCase().trim(),
        subject: `Willkommen bei ${gymName}! 🥋`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Hallo ${firstName.trim()}! 🥋</p>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
              Herzlich willkommen bei <strong>${gymName}</strong>!
              Deine Mitgliedschaft wurde bestätigt. 🎉
            </p>
            ${checkoutUrl ? `
            <p style="margin:0 0 16px;font-size:14px;color:#374151">
              Bitte schließe jetzt dein Abonnement ab, um deinen Mitgliedsbeitrag einzurichten:
            </p>
            <a href="${checkoutUrl}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#fff;font-weight:700;font-size:14px;border-radius:12px;text-decoration:none;margin-bottom:16px">
              Jetzt Abonnement abschließen →
            </a>
            ` : ''}
            ${portalUrl ? `
            <p style="margin:0 0 16px;font-size:14px;color:#374151">
              Über deinen persönlichen Mitglieder-Link kannst du jederzeit deine Daten,
              Trainingsanwesenheit und Beiträge einsehen:
            </p>
            <a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#f59e0b;color:#0f172a;font-weight:700;font-size:14px;border-radius:12px;text-decoration:none">
              Zum Mitgliederportal →
            </a>
            ` : ''}
            ${whatsappGroupUrl ? `
            <div style="margin-top:24px;padding:16px;background:#dcfce7;border:1px solid #86efac;border-radius:12px">
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#166534">
                💬 WhatsApp-Gruppe
              </p>
              <p style="margin:0 0 12px;font-size:13px;color:#166534;line-height:1.5">
                Tritt unserer WhatsApp-Gruppe bei, um über Termine, Events und News informiert zu bleiben:
              </p>
              <a href="${whatsappGroupUrl}" style="display:inline-block;padding:10px 20px;background:#25D366;color:#fff;font-weight:700;font-size:13px;border-radius:10px;text-decoration:none">
                Gruppe beitreten →
              </a>
            </div>
            ` : ''}
            <p style="margin:24px 0 0;font-size:12px;color:#94a3b8">Oss!</p>
          </div>
        `,
      }),
    }).catch(() => {})
  }

  // ── 2. Bestätigungs-WhatsApp → Mitglied (Twilio) ─────────────────────────
  if (phone?.trim()) {
    const groupSuffix = whatsappGroupUrl ? `\n\n💬 WhatsApp-Gruppe beitreten:\n${whatsappGroupUrl}` : ''
    const waBody = checkoutUrl
      ? `Hallo ${firstName.trim()}! 🥋 Willkommen bei ${gymName}!\n\nDeine Mitgliedschaft wurde bestätigt. Bitte schließe jetzt dein Abonnement ab:\n${checkoutUrl}${portalUrl ? `\n\nMitgliederportal: ${portalUrl}` : ''}${groupSuffix}\n\nOss!`
      : `Hallo ${firstName.trim()}! 🥋 Willkommen bei ${gymName}!\n\nDeine Mitgliedschaft wurde bestätigt.${portalUrl ? `\n\nZum Mitgliederportal: ${portalUrl}` : ''}${groupSuffix}\n\nOss!`
    await sendWhatsApp({
      to:   phone.trim(),
      body: waBody,
    }).catch(() => {})
  }

  // ── 3. Notify gym owner via email + WhatsApp ──────────────────────────────
  await notifyGym({
    gymId,
    subject: `Neue Mitglieder-Anmeldung: ${fullName}`,
    html: `
      <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Neue Anmeldung! 🎉</p>
      <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
        <strong>${fullName}</strong> hat sich gerade über deinen Mitglieder-Anmeldelink registriert.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Name</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600">${fullName}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">E-Mail</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${email.toLowerCase().trim()}</td></tr>
        ${phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Telefon</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${phone.trim()}</td></tr>` : ''}
      </table>
      <p style="margin:20px 0 0;font-size:14px;color:#64748b">Der Interessent wurde automatisch in deinem Dashboard unter <strong>Interessenten</strong> angelegt.</p>
    `,
    whatsappText: `🎉 Neue Anmeldung!\n${fullName}\n${email.toLowerCase().trim()}${phone ? '\n' + phone.trim() : ''}\n\nhttps://www.osss.pro/dashboard`,
  })

  return NextResponse.json({ success: true, memberId: member.id, checkoutUrl })
}
