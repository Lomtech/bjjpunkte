import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'

// Platform fee: 2% of each transaction goes to RollCall
const PLATFORM_FEE_PERCENT = 0.02

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe nicht konfiguriert. Bitte STRIPE_SECRET_KEY in den Einstellungen hinterlegen.' }, { status: 400 })
  }

  // Verify auth via Bearer token (localStorage-based session)
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const stripe = new Stripe(stripeKey)

  const { memberId, gymId, memberEmail, memberName, amountCents } = await req.json()

  if (!amountCents || amountCents < 50) {
    return NextResponse.json({ error: 'Ungültiger Betrag (Minimum: 0,50 €)' }, { status: 400 })
  }

  // Get gym's connected Stripe account (if any)
  const { data: gymData } = await supabase
    .from('gyms').select('stripe_account_id').eq('id', gymId).single()
  const connectedAccountId = (gymData as { stripe_account_id: string | null } | null)?.stripe_account_id

  // Get or create Stripe customer
  const { data: memberRaw } = await supabase.from('members').select('stripe_customer_id').eq('id', memberId).single()
  const member = memberRaw as { stripe_customer_id: string | null } | null
  let customerId = member?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: memberEmail,
      name: memberName,
      metadata: { memberId, gymId },
    })
    customerId = customer.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('members') as any).update({ stripe_customer_id: customerId }).eq('id', memberId)
  }

  const appUrl = getAppUrl()

  // Build session params — route to connected account if available
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    payment_method_types: ['card', 'sepa_debit'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: 'Monatlicher Mitgliedsbeitrag', description: `RollCall – ${memberName}` },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${appUrl}/dashboard/members/${memberId}?payment=success`,
    cancel_url: `${appUrl}/dashboard/members/${memberId}`,
    metadata: { memberId, gymId },
  }

  // Connect: platform takes 2%, rest goes to gym's Stripe account
  if (connectedAccountId) {
    const platformFeeCents = Math.max(50, Math.round(amountCents * PLATFORM_FEE_PERCENT))
    sessionParams.payment_intent_data = {
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: connectedAccountId },
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  // Record pending payment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('payments') as any).insert({
    gym_id: gymId,
    member_id: memberId,
    stripe_payment_intent_id: session.payment_intent as string,
    amount_cents: amountCents,
    status: 'pending',
    checkout_url: session.url,
  })

  return NextResponse.json({ url: session.url })
}
