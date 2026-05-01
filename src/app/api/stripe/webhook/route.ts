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

  // ── Subscription events ────────────────────────────────────────────────────

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const memberId = sub.metadata?.memberId
    if (memberId) {
      const status = sub.status === 'active' ? 'active'
        : sub.status === 'past_due' ? 'past_due'
        : sub.status === 'canceled' ? 'cancelled'
        : sub.status
      await (supabase.from('members') as any)
        .update({ stripe_subscription_id: sub.id, subscription_status: status })
        .eq('id', memberId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const memberId = sub.metadata?.memberId
    if (memberId) {
      await (supabase.from('members') as any)
        .update({ stripe_subscription_id: null, subscription_status: 'cancelled' })
        .eq('id', memberId)
    }
  }

  if (event.type === 'invoice.paid') {
    const inv = event.data.object as Stripe.Invoice
    const memberId   = (inv as any).subscription_details?.metadata?.memberId ?? inv.metadata?.memberId
    const gymId      = (inv as any).subscription_details?.metadata?.gymId    ?? inv.metadata?.gymId
    const amountCents = inv.amount_paid
    if (memberId && amountCents > 0) {
      await supabase.from('payments').insert({
        gym_id:    gymId ?? null,
        member_id: memberId,
        amount_cents: amountCents,
        status:    'paid',
        paid_at:   new Date().toISOString(),
        stripe_payment_intent_id: typeof (inv as any).payment_intent === 'string' ? (inv as any).payment_intent : null,
      })
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const inv = event.data.object as Stripe.Invoice
    const memberId = (inv as any).subscription_details?.metadata?.memberId ?? inv.metadata?.memberId
    if (memberId) {
      await (supabase.from('members') as any)
        .update({ subscription_status: 'past_due' })
        .eq('id', memberId)
    }
  }

  return NextResponse.json({ received: true })
}
