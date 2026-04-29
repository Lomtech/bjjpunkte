import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe nicht konfiguriert. Bitte STRIPE_SECRET_KEY in den Einstellungen hinterlegen.' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { memberId, gymId, memberEmail, memberName, amountCents } = await req.json()

  if (!amountCents || amountCents < 50) {
    return NextResponse.json({ error: 'Ungültiger Betrag (Minimum: 0,50 €)' }, { status: 400 })
  }

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

  // Create Checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: 'Monatlicher Mitgliedsbeitrag', description: `RollCall – ${memberName}` },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard/members/${memberId}?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/dashboard/members/${memberId}`,
    metadata: { memberId, gymId },
  })

  // Record pending payment
  await supabase.from('payments').insert({
    gym_id: gymId,
    member_id: memberId,
    stripe_payment_intent_id: session.payment_intent as string,
    amount_cents: amountCents,
    status: 'pending',
  })

  return NextResponse.json({ url: session.url })
}
