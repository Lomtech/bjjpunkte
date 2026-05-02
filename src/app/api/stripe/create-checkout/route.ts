import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'
import type { Database } from '@/types/database'

const PLATFORM_FEE_PERCENT = 0.03

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe nicht konfiguriert.' }, { status: 400 })
  }

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { memberId, gymId, memberEmail, memberName, amountCents } = await req.json()

  if (!amountCents || amountCents < 50) {
    return NextResponse.json({ error: 'Ungültiger Betrag (Minimum: 0,50 €)' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)

  const { data: gymData } = await supabase.from('gyms').select('stripe_account_id').eq('id', gymId).single()
  const connectedAccountId = gymData?.stripe_account_id

  const { data: memberData } = await supabase.from('members').select('stripe_customer_id').eq('id', memberId).single()
  let customerId = memberData?.stripe_customer_id

  const appUrl = getAppUrl()

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: memberEmail,
        name: memberName,
        metadata: { memberId, gymId },
      })
      customerId = customer.id
      await supabase.from('members').update({ stripe_customer_id: customerId }).eq('id', memberId)
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'Monatlicher Mitgliedsbeitrag', description: `Osss – ${memberName}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${appUrl}/dashboard/members/${memberId}?payment=success`,
      cancel_url:  `${appUrl}/dashboard/members/${memberId}`,
      metadata: { memberId, gymId },
    }

    if (connectedAccountId) {
      // 2% platform fee — minimum €0.50 to cover Stripe's own fixed fee
      const platformFeeCents = Math.max(50, Math.round(amountCents * PLATFORM_FEE_PERCENT))
      sessionParams.payment_intent_data = {
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: connectedAccountId },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    // Store session ID as primary match key — payment_intent may be null until payment completes
    await supabase.from('payments').insert({
      gym_id:                    gymId,
      member_id:                 memberId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:  typeof session.payment_intent === 'string' ? session.payment_intent : null,
      amount_cents:              amountCents,
      status:                    'pending',
      checkout_url:              session.url,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe-Fehler beim Erstellen des Zahlungslinks'
    console.error('Stripe create-checkout error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
