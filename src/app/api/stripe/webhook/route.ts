import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Webhook-Signatur ungültig' }, { status: 400 })
  }

  const supabase = await createClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const memberId = session.metadata?.memberId
    const paymentIntentId = session.payment_intent as string

    if (memberId && session.payment_status === 'paid') {
      await supabase.from('payments')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('stripe_payment_intent_id', paymentIntentId)

      await supabase.from('members')
        .update({ subscription_status: 'active' })
        .eq('id', memberId)
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    await supabase.from('payments')
      .update({ status: 'failed' })
      .eq('stripe_payment_intent_id', pi.id)

    const { data: payment } = await supabase.from('payments').select('member_id').eq('stripe_payment_intent_id', pi.id).single()
    if (payment) {
      await supabase.from('members').update({ subscription_status: 'past_due' }).eq('id', payment.member_id)
    }
  }

  return NextResponse.json({ received: true })
}
