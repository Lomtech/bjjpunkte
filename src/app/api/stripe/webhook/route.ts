import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Uses anon key + SECURITY DEFINER RPC function to bypass RLS
// Stripe signature is validated before any DB call — this is safe
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

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

  const supabase = anonClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const memberId = session.metadata?.memberId ?? null
    const paymentIntentId = session.payment_intent as string | null

    if (session.payment_status === 'paid') {
      // First try to update by payment_intent_id (normal case)
      if (paymentIntentId) {
        const { data: updated } = await supabase
          .from('payments')
          .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_payment_intent_id: paymentIntentId })
          .eq('stripe_payment_intent_id', paymentIntentId)
          .select('id')

        // Fallback: if nothing was updated (payment_intent was null when record was created),
        // find the most recent pending payment for this member and update it
        if ((!updated || updated.length === 0) && memberId) {
          await supabase
            .from('payments')
            .update({ status: 'paid', paid_at: new Date().toISOString(), stripe_payment_intent_id: paymentIntentId })
            .eq('member_id', memberId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
        }
      } else if (memberId) {
        // No payment_intent at all — update most recent pending for this member
        await supabase
          .from('payments')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('member_id', memberId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
      }
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent

    // Find member_id from payments table first
    const { data: payment } = await supabase
      .from('payments')
      .select('member_id')
      .eq('stripe_payment_intent_id', pi.id)
      .single()

    await supabase.rpc('handle_stripe_payment', {
      p_payment_intent_id: pi.id,
      p_status: 'failed',
      p_member_id: (payment as { member_id: string } | null)?.member_id ?? null,
    })
  }

  return NextResponse.json({ received: true })
}
