import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'
import type { Database } from '@/types/database'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

// Create subscription checkout
export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert.' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { memberId, gymId, memberEmail, memberName, amountCents } = await req.json()
  if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents < 100) {
    return NextResponse.json({ error: 'Mindestbetrag: 1,00 € (muss eine ganze Zahl in Cent sein)' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)

  const { data: gymData } = await (supabase.from('gyms') as any)
    .select('id, stripe_account_id')
    .eq('id', gymId)
    .eq('owner_id', user.id)  // ensures caller owns this gym
    .single()
  if (!gymData) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
  const connectedAccountId = gymData?.stripe_account_id

  // Cross-gym guard: member must belong to the caller's gym
  const { data: memberData } = await supabase.from('members')
    .select('stripe_customer_id, plan_id, gym_id')
    .eq('id', memberId)
    .single()
  if (!memberData || memberData.gym_id !== gymId) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 403 })
  }
  let customerId = memberData?.stripe_customer_id
  const planId   = (memberData as any)?.plan_id as string | null

  // Look up contract_months from the member's current plan
  let cancelAt: number | undefined
  if (planId) {
    const { data: planData } = await (supabase.from('membership_plans') as any)
      .select('contract_months')
      .eq('id', planId)
      .single()
    const months = (planData as any)?.contract_months as number | null
    if (months && months > 0) {
      const end = new Date()
      end.setMonth(end.getMonth() + months)
      cancelAt = Math.floor(end.getTime() / 1000)
    }
  }

  const appUrl = getAppUrl()
  const platformFeePercent = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? '0') || 0
  const stripeOpts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined

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
      { email: memberEmail, name: memberName, metadata: { memberId, gymId } },
      stripeOpts ?? {},
    )
    customerId = customer.id
    await supabase.from('members').update({ stripe_customer_id: customerId }).eq('id', memberId)
  }

  try {
    const price = await stripe.prices.create(
      {
        currency: 'eur',
        unit_amount: amountCents,
        recurring: { interval: 'month' },
        product_data: { name: 'Monatlicher Mitgliedsbeitrag' },
      },
      connectedAccountId ? { stripeAccount: connectedAccountId } : {},
    )

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      mode: 'subscription',
      billing_address_collection: 'required',
      success_url: `${appUrl}/dashboard/members/${memberId}?sub=success`,
      cancel_url:  `${appUrl}/dashboard/members/${memberId}`,
      metadata: { memberId, gymId },
      subscription_data: {
        // cancel_at is NOT supported in subscription_data for checkout sessions.
        // Instead, we pass cancel_at_ts in metadata and set it via webhook after creation.
        metadata: { memberId, gymId, ...(cancelAt ? { cancel_at_ts: String(cancelAt) } : {}) },
        ...(platformFeePercent > 0 ? { application_fee_percent: platformFeePercent } : {}),
      },
    }

    // Direct charge: session on connected account so customer is found; no on_behalf_of needed
    const session = await stripe.checkout.sessions.create(sessionParams, stripeOpts)
    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe-Fehler beim Erstellen des Abonnements'
    console.error('Stripe subscribe error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Cancel subscription
export async function DELETE(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert.' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { memberId } = await req.json()

  // Verify member belongs to the caller's gym
  const { data: gym } = await (supabase.from('gyms') as any).select('id, stripe_account_id').eq('owner_id', user.id).single()
  if (!gym) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: memberCheck } = await supabase.from('members').select('gym_id, stripe_subscription_id').eq('id', memberId).single()
  if (!memberCheck || memberCheck.gym_id !== gym.id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const subId = memberCheck.stripe_subscription_id
  if (!subId) return NextResponse.json({ error: 'Kein aktives Abonnement gefunden' }, { status: 404 })

  const stripe = new Stripe(stripeKey)
  // Subscriptions live on the connected account (direct charges model)
  const connectedAccountId = (gym as any).stripe_account_id as string | null
  const stripeOpts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined
  await stripe.subscriptions.cancel(subId, {}, stripeOpts)
  await supabase.from('members').update({ stripe_subscription_id: null, subscription_status: 'cancelled' }).eq('id', memberId)

  return NextResponse.json({ success: true })
}
