import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const PLAN_LIMITS: Record<string, number> = { starter: 50, grow: 150, pro: 9999 }

export async function POST(req: Request) {
  const stripeKey    = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing stripe-signature', { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Webhook-Signatur ungültig' }, { status: 400 })
  }

  const supabase = adminClient()

  // ── checkout.session.completed ──────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session       = event.data.object as Stripe.Checkout.Session
    const memberId      = session.metadata?.memberId ?? null
    const sessionId     = session.id
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

    // Owner plan upgrade
    if (session.metadata?.type === 'owner_plan') {
      const { gymId, plan } = session.metadata
      await supabase.from('gyms').update({
        plan:                       plan as Database['public']['Tables']['gyms']['Update']['plan'],
        plan_member_limit:          PLAN_LIMITS[plan] ?? 30,
        // customer is already stored by owner-checkout, but update in case it changed
        osss_stripe_customer_id:    typeof session.customer   === 'string' ? session.customer   : undefined,
        osss_stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : undefined,
      }).eq('id', gymId)
    }

    if (session.payment_status === 'paid') {
      const now = new Date().toISOString()

      // 1st priority: match by checkout session ID — always unique, set at payment creation time
      const { data: bySession } = await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: now, stripe_payment_intent_id: paymentIntentId })
        .eq('stripe_checkout_session_id', sessionId)
        .select('id')

      if (bySession && bySession.length > 0) {
        // matched cleanly — done
      } else if (paymentIntentId) {
        // 2nd priority: match by payment_intent (legacy records created before session ID was stored)
        const { data: byIntent } = await supabase
          .from('payments')
          .update({ status: 'paid', paid_at: now, stripe_payment_intent_id: paymentIntentId })
          .eq('stripe_payment_intent_id', paymentIntentId)
          .select('id')

        // 3rd priority: most recent pending for this member — last resort for legacy records
        if ((!byIntent || byIntent.length === 0) && memberId) {
          const { data: pending } = await supabase
            .from('payments')
            .select('id')
            .eq('member_id', memberId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
          if (pending) {
            await supabase.from('payments')
              .update({ status: 'paid', paid_at: now, stripe_payment_intent_id: paymentIntentId, stripe_checkout_session_id: sessionId })
              .eq('id', pending.id)
          }
        }
      } else if (memberId) {
        // No payment_intent at all (e.g. free checkout) — fall back to member
        const { data: pending } = await supabase
          .from('payments')
          .select('id')
          .eq('member_id', memberId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (pending) {
          await supabase.from('payments')
            .update({ status: 'paid', paid_at: now, stripe_checkout_session_id: sessionId })
            .eq('id', pending.id)
        }
      }
    }
  }

  // ── account.updated (Stripe Connect onboarding / restriction) ───────────────
  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    const { data: gym } = await supabase.from('gyms').select('id').eq('stripe_account_id', account.id).single()
    if (gym) {
      await supabase.from('gyms').update({ stripe_charges_enabled: account.charges_enabled }).eq('id', gym.id)
    }
  }

  // ── charge.refunded ─────────────────────────────────────────────────────────
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
    if (piId) {
      await supabase.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent_id', piId)
    }
  }

  // ── payment_intent.payment_failed ───────────────────────────────────────────
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    await supabase.from('payments').update({ status: 'failed' }).eq('stripe_payment_intent_id', pi.id)
  }

  // ── customer.subscription.created / updated ──────────────────────────────────
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub      = event.data.object as Stripe.Subscription
    const memberId = sub.metadata?.memberId
    if (memberId) {
      const status: Database['public']['Tables']['members']['Update']['subscription_status'] =
        sub.status === 'active'    ? 'active'    :
        sub.status === 'past_due'  ? 'past_due'  :
        sub.status === 'canceled'  ? 'cancelled' :
        'none'
      await supabase.from('members')
        .update({ stripe_subscription_id: sub.id, subscription_status: status })
        .eq('id', memberId)
    }
  }

  // ── customer.subscription.deleted ───────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription

    // Member subscription cancelled
    const memberId = sub.metadata?.memberId
    if (memberId) {
      await supabase.from('members')
        .update({ stripe_subscription_id: null, subscription_status: 'cancelled' })
        .eq('id', memberId)
    }

    // Owner plan subscription cancelled — downgrade gym to free
    const { data: gymWithSub } = await supabase.from('gyms').select('id').eq('osss_stripe_subscription_id', sub.id).single()
    if (gymWithSub) {
      await supabase.from('gyms').update({
        plan:                        'free',
        plan_member_limit:           30,
        osss_stripe_subscription_id: null,
      }).eq('id', gymWithSub.id)
    }
  }

  // ── invoice.paid (recurring subscription charge) ─────────────────────────────
  if (event.type === 'invoice.paid') {
    const inv           = event.data.object as Stripe.Invoice
    // Stripe exposes metadata via subscription_details for subscription invoices
    const meta          = (inv as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata ?? inv.metadata ?? {}
    const memberId      = meta.memberId
    const gymId         = meta.gymId
    const amountCents   = inv.amount_paid
    const paymentIntentId = typeof (inv as unknown as { payment_intent?: string }).payment_intent === 'string'
      ? (inv as unknown as { payment_intent: string }).payment_intent
      : null

    if (memberId && amountCents > 0) {
      // Idempotency: skip if already recorded for this payment_intent
      if (paymentIntentId) {
        const { data: existing } = await supabase
          .from('payments')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .single()
        if (existing) return NextResponse.json({ received: true })
      }

      await supabase.from('payments').insert({
        gym_id:                   gymId ?? null,
        member_id:                memberId,
        amount_cents:             amountCents,
        status:                   'paid',
        paid_at:                  new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
    }
  }

  // ── invoice.payment_failed ───────────────────────────────────────────────────
  if (event.type === 'invoice.payment_failed') {
    const inv      = event.data.object as Stripe.Invoice
    const meta     = (inv as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata ?? inv.metadata ?? {}
    const memberId = meta.memberId
    if (memberId) {
      await supabase.from('members').update({ subscription_status: 'past_due' }).eq('id', memberId)
    }
  }

  return NextResponse.json({ received: true })
}
