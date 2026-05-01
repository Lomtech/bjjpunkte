import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'

const PLATFORM_FEE_PERCENT = 0.04

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert.' }, { status: 400 })

  const authHeader  = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { memberId, gymId, memberEmail, memberName, amountCents } = await req.json()
  if (!amountCents || amountCents < 100) {
    return NextResponse.json({ error: 'Mindestbetrag: 1,00 €' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)

  // Get gym Stripe account
  const { data: gymData } = await supabase.from('gyms').select('stripe_account_id').eq('id', gymId).single()
  const connectedAccountId = (gymData as { stripe_account_id: string | null } | null)?.stripe_account_id

  // Get or create Stripe customer
  const { data: memberRaw } = await supabase.from('members').select('stripe_customer_id').eq('id', memberId).single()
  let customerId = (memberRaw as { stripe_customer_id: string | null } | null)?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: memberEmail,
      name: memberName,
      metadata: { memberId, gymId },
    })
    customerId = customer.id
    await (supabase.from('members') as any).update({ stripe_customer_id: customerId }).eq('id', memberId)
  }

  const appUrl = getAppUrl()

  try {
    // Create a recurring Price for this amount (€/month)
    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: amountCents,
      recurring: { interval: 'month' },
      product_data: { name: 'Monatlicher Mitgliedsbeitrag' },
    })

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'], // sepa_debit nicht für Subscriptions verfügbar ohne extra Stripe-Aktivierung
      line_items: [{ price: price.id, quantity: 1 }],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard/members/${memberId}?sub=success`,
      cancel_url:  `${appUrl}/dashboard/members/${memberId}`,
      metadata: { memberId, gymId },
      subscription_data: {
        metadata: { memberId, gymId },
      },
    }

    if (connectedAccountId) {
      sessionParams.subscription_data = {
        ...sessionParams.subscription_data,
        application_fee_percent: PLATFORM_FEE_PERCENT * 100,
        transfer_data: { destination: connectedAccountId },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Stripe subscribe error:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Stripe-Fehler beim Erstellen des Abonnements' }, { status: 500 })
  }
}

// Cancel subscription
export async function DELETE(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert.' }, { status: 400 })

  const authHeader  = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { memberId } = await req.json()

  // Gym-Ownership: Member muss zum Gym des Users gehören
  const { data: gym } = await supabase.from('gyms').select('id').single()
  if (!gym) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: memberCheck } = await supabase.from('members').select('gym_id').eq('id', memberId).single()
  if (!memberCheck || memberCheck.gym_id !== gym.id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const { data: memberRaw } = await supabase.from('members').select('stripe_subscription_id').eq('id', memberId).single()
  const subId = (memberRaw as any)?.stripe_subscription_id
  if (!subId) return NextResponse.json({ error: 'Kein Abonnement gefunden' }, { status: 404 })

  const stripe = new Stripe(stripeKey)
  await stripe.subscriptions.cancel(subId)
  await (supabase.from('members') as any).update({ stripe_subscription_id: null, subscription_status: 'cancelled' }).eq('id', memberId)

  return NextResponse.json({ success: true })
}
