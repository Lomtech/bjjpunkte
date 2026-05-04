import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { getAppUrl } from '@/lib/app-url'
import { sendWhatsApp } from '@/lib/whatsapp'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Get gym
  const { data: gym } = await (supabase.from('gyms') as any).select('id, name, email, stripe_account_id, payment_method_types').single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  // Get member (verify ownership)
  const { data: member } = await (supabase.from('members') as any)
    .select('id, first_name, last_name, email, phone, gym_id, plan_id, stripe_customer_id, portal_token')
    .eq('id', memberId)
    .eq('gym_id', gym.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })

  // Activate the member
  await (supabase.from('members') as any)
    .update({ is_active: true, onboarding_status: 'complete' })
    .eq('id', memberId)

  // Try to create and send Stripe checkout if member has a plan
  let checkoutUrl: string | null = null
  if (member.plan_id && member.email && process.env.STRIPE_SECRET_KEY) {
    try {
      const { data: plan } = await (supabase.from('membership_plans') as any)
        .select('id, name, price_cents, billing_interval, stripe_price_id')
        .eq('id', member.plan_id)
        .single()

      if (plan?.stripe_price_id) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
        const appUrl = getAppUrl()

        // Get or create Stripe customer
        let customerId = member.stripe_customer_id
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: member.email,
            name: `${member.first_name} ${member.last_name}`,
            metadata: { memberId, gymId: gym.id },
          })
          customerId = customer.id
          await (supabase.from('members') as any)
            .update({ stripe_customer_id: customerId })
            .eq('id', memberId)
        }

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          customer: customerId,
          payment_method_types: ['card', 'sepa_debit'],
          line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
          mode: 'subscription',
          billing_address_collection: 'required',
          success_url: `${appUrl}/portal/${member.portal_token ?? ''}?payment=success`,
          cancel_url: `${appUrl}/portal/${member.portal_token ?? ''}`,
          metadata: { memberId, gymId: gym.id },
          subscription_data: {
            metadata: { memberId, gymId: gym.id },
          },
        }

        if (gym.stripe_account_id) {
          sessionParams.subscription_data = {
            ...sessionParams.subscription_data,
            on_behalf_of: gym.stripe_account_id,
            // transfer_data is NOT used for subscriptions — on_behalf_of alone routes funds
          }
        }

        const session = await stripe.checkout.sessions.create(sessionParams)
        checkoutUrl = session.url

        // Send email with checkout link
        if (process.env.RESEND_API_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL ?? 'noreply@osss.app',
              to: member.email,
              subject: `Willkommen bei ${gym.name} – Beitrag bezahlen`,
              html: `<p>Hallo ${member.first_name},</p><p>Deine Mitgliedschaft bei <strong>${gym.name}</strong> wurde bestätigt! 🎉</p><p>Bitte schließe jetzt die Zahlung für deinen gewählten Tarif (<strong>${plan.name}</strong>) ab:</p><p style="margin:24px 0"><a href="${checkoutUrl}" style="background:#f59e0b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Jetzt bezahlen →</a></p><p>Oss!</p>`,
            }),
          })
        }

        // WhatsApp welcome + checkout link
        if (member.phone) {
          await sendWhatsApp({
            to: member.phone,
            body: `Hallo ${member.first_name}! 🥋 Willkommen bei ${gym.name}!\n\nDeine Mitgliedschaft wurde bestätigt. Bitte schließe jetzt die Zahlung für *${plan.name}* ab:\n${checkoutUrl}\n\nOss!`,
          })
        }
      }
    } catch (err) {
      console.error('Stripe/email error during activation:', err)
      // Don't fail — member is already activated
    }
  }

  // WhatsApp welcome without checkout (no plan or Stripe not configured)
  if (!checkoutUrl && member.phone) {
    const portalUrl = member.portal_token ? `${getAppUrl()}/portal/${member.portal_token}` : null
    await sendWhatsApp({
      to: member.phone,
      body: `Hallo ${member.first_name}! 🥋 Willkommen bei ${gym.name}!\n\nDeine Mitgliedschaft wurde bestätigt.${portalUrl ? `\n\nZum Mitgliederportal: ${portalUrl}` : ''}\n\nOss!`,
    }).catch(() => {/* best-effort */})
  }

  return NextResponse.json({ success: true, checkout_url: checkoutUrl })
}
