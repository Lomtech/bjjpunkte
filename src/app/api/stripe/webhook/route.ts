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

/** Map Stripe price amount to plan name. Adjust thresholds to match your pricing. */
function priceAmountToPlan(amountCents: number): string {
  if (amountCents >= 9900) return 'pro'     // e.g. 99€/mo
  if (amountCents >= 4900) return 'grow'    // e.g. 49€/mo
  return 'starter'                           // e.g. 29€/mo or below
}

/** Send an urgent email to gym owner via Resend when a dispute is opened. */
async function notifyGymDispute(gymId: string, disputeId: string, amountCents: number, chargeId: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return
  const supabase = adminClient()
  const { data: gym } = await supabase.from('gyms').select('email, name').eq('id', gymId).single()
  if (!gym || !(gym as any).email) return
  const g = gym as any
  const amountEur = (amountCents / 100).toFixed(2).replace('.', ',')
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: g.email,
      subject: `⚠️ Chargeback eröffnet – ${amountEur} € – Sofortmaßnahme erforderlich`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#dc2626">⚠️ Chargeback / Dispute eröffnet</p>
          <p style="font-size:15px;color:#374151;line-height:1.6">
            Ein Mitglied oder die Bank hat eine Zahlung über <strong>${amountEur} €</strong> zurückgebucht.
            Du hast in der Regel <strong>7 Tage</strong>, um Beweise einzureichen.
          </p>
          <table style="width:100%;margin:16px 0;font-size:14px;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280">Dispute-ID</td><td style="padding:6px 0;font-weight:600">${disputeId}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Betrag</td><td style="padding:6px 0;font-weight:600">${amountEur} €</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280">Charge-ID</td><td style="padding:6px 0">${chargeId}</td></tr>
          </table>
          <a href="https://dashboard.stripe.com/disputes/${disputeId}" style="display:inline-block;background:#dc2626;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
            Jetzt in Stripe-Dashboard ansehen →
          </a>
        </div>
      `,
    }),
  }).catch(e => console.error('Dispute notify email error:', e))
}

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

  // Try platform webhook secret first, then Connect webhook secret.
  // This allows a single URL to serve both account and Connect webhook endpoints.
  let event: Stripe.Event | null = null
  for (const secret of [webhookSecret, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[]) {
    try { event = stripe.webhooks.constructEvent(body, sig, secret); break }
    catch { /* try next */ }
  }
  if (!event) return NextResponse.json({ error: 'Webhook-Signatur ungültig' }, { status: 400 })

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

    // Member subscription checkout completed — set subscription_id + status immediately.
    // Avoids waiting for customer.subscription.created which may not arrive if the webhook
    // is not yet configured as a Stripe Connect webhook.
    if (memberId && session.mode === 'subscription') {
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
      if (subscriptionId) {
        await supabase.from('members')
          .update({ stripe_subscription_id: subscriptionId, subscription_status: 'active' })
          .eq('id', memberId)
      }
    }

    if (session.payment_status === 'paid') {
      const now   = new Date().toISOString()
      const gymId = session.metadata?.gymId ?? null
      let matched = false

      // 1st priority: match by checkout session ID — always unique
      const { data: bySession } = await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: now, stripe_payment_intent_id: paymentIntentId })
        .eq('stripe_checkout_session_id', sessionId)
        .select('id')
      if (bySession && bySession.length > 0) matched = true

      if (!matched && paymentIntentId) {
        // 2nd priority: match by payment_intent
        const { data: byIntent } = await supabase
          .from('payments')
          .update({ status: 'paid', paid_at: now })
          .eq('stripe_payment_intent_id', paymentIntentId)
          .select('id')
        if (byIntent && byIntent.length > 0) matched = true

        // 3rd priority: pending row for this member
        if (!matched && memberId) {
          const { data: pending } = await supabase
            .from('payments').select('id')
            .eq('member_id', memberId).eq('status', 'pending')
            .order('created_at', { ascending: false }).limit(1).single()
          if (pending) {
            await supabase.from('payments')
              .update({ status: 'paid', paid_at: now, stripe_payment_intent_id: paymentIntentId, stripe_checkout_session_id: sessionId })
              .eq('id', pending.id)
            matched = true
          }
        }
      }

      // 4th priority (subscription payments): no pending row exists — INSERT directly.
      // This handles subscription first-payments and portal-initiated checkouts where
      // no pending row was pre-created.
      if (!matched && memberId && session.mode === 'subscription') {
        // Idempotency: skip if already recorded via invoice.paid
        const { data: existing } = await supabase
          .from('payments').select('id')
          .eq('stripe_checkout_session_id', sessionId).limit(1)
        if (!existing || existing.length === 0) {
          const { data: mRow } = await supabase.from('members').select('first_name, last_name').eq('id', memberId).single()
          const memberName = mRow ? `${mRow.first_name} ${mRow.last_name}` : null
          await (supabase.from('payments') as any).insert({
            gym_id:                     gymId,
            member_id:                  memberId,
            member_name:                memberName,
            amount_cents:               session.amount_total ?? 0,
            status:                     'paid',
            paid_at:                    now,
            stripe_payment_intent_id:   paymentIntentId,
            stripe_checkout_session_id: sessionId,
          })
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

      // If a contract end date was requested, set cancel_at on the subscription now.
      // (cancel_at cannot be passed during checkout session creation — set it here instead.)
      if (event.type === 'customer.subscription.created') {
        const cancelAtTs = sub.metadata?.cancel_at_ts
        if (cancelAtTs && !sub.cancel_at) {
          try {
            // For direct charges, the subscription lives on the connected account.
            // Read the Stripe-Account header sent with Connect webhook events.
            const connectedAccount = req.headers.get('stripe-account') ?? undefined
            await stripe.subscriptions.update(
              sub.id,
              { cancel_at: parseInt(cancelAtTs, 10) },
              connectedAccount ? { stripeAccount: connectedAccount } : undefined,
            )
          } catch (err) {
            console.error('Failed to set cancel_at on subscription:', err)
          }
        }
      }
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

    const invoiceId = inv.id  // always unique per Stripe invoice

    if (memberId && amountCents > 0) {
      // Idempotency: check by payment_intent first, then by invoice ID.
      // SEPA invoices may not have a payment_intent at the time of the event —
      // using invoice ID as the secondary dedup key prevents duplicate inserts
      // on Stripe retry deliveries.
      if (paymentIntentId) {
        const { data: existing } = await supabase
          .from('payments')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .single()
        if (existing) return NextResponse.json({ received: true })
      } else if (invoiceId) {
        // No payment_intent (e.g. SEPA debit before settlement) — dedup by invoice ID.
        // stripe_invoice_id column must exist in DB for this to work; fall back to
        // checking recent payments for this member within a 10-minute window.
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
        const { data: recent } = await (supabase.from('payments') as any)
          .select('id')
          .eq('member_id', memberId)
          .eq('amount_cents', amountCents)
          .eq('status', 'paid')
          .gte('paid_at', tenMinAgo)
          .limit(1)
        if (recent && (Array.isArray(recent) ? recent.length > 0 : true)) {
          return NextResponse.json({ received: true })
        }
      }

      const { data: mRow } = await supabase.from('members').select('first_name, last_name').eq('id', memberId).single()
      const memberName = mRow ? `${mRow.first_name} ${mRow.last_name}` : null
      await (supabase.from('payments') as any).insert({
        gym_id:                   gymId ?? null,
        member_id:                memberId,
        member_name:              memberName,
        amount_cents:             amountCents,
        status:                   'paid',
        paid_at:                  new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
    }
  }

  // ── payment_intent.succeeded (SEPA async confirmation) ──────────────────────
  // Card payments are confirmed synchronously at checkout.session.completed.
  // SEPA debit settles days later — this event is the authoritative "paid" signal.
  if (event.type === 'payment_intent.succeeded') {
    const pi  = event.data.object as Stripe.PaymentIntent
    const now = new Date().toISOString()
    await supabase
      .from('payments')
      .update({ status: 'paid', paid_at: now })
      .eq('stripe_payment_intent_id', pi.id)
      .eq('status', 'pending')
  }

  // ── invoice.payment_failed ───────────────────────────────────────────────────
  if (event.type === 'invoice.payment_failed') {
    const inv      = event.data.object as Stripe.Invoice
    const meta     = (inv as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata ?? inv.metadata ?? {}
    const memberId = meta.memberId

    if (memberId) {
      // Member subscription past due
      await supabase.from('members').update({ subscription_status: 'past_due' }).eq('id', memberId)
    } else if (meta.type === 'owner_plan') {
      // H-2: Owner plan payment failed — downgrade gym to free
      const gymId = meta.gymId
      if (gymId) {
        await supabase.from('gyms').update({
          plan:              'free',
          plan_member_limit: 30,
        }).eq('id', gymId)
        console.warn(`[webhook] Owner plan payment failed for gym ${gymId} — downgraded to free`)
      }
    }
  }

  // ── customer.subscription.updated (owner plan) ────────────────────────────
  // H-3: Sync owner plan changes made via Stripe billing portal back to DB.
  // Member subscription.updated is already handled above (line ~135).
  // We handle owner plan here for completeness — if the gym upgrades/downgrades
  // via Stripe directly, the DB stays in sync.
  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    if (sub.metadata?.type === 'owner_plan' && !sub.metadata?.memberId) {
      const gymId = sub.metadata?.gymId
      if (gymId && sub.status === 'active') {
        // Derive plan from the first line item's price amount
        const priceAmount = sub.items.data[0]?.price?.unit_amount ?? 0
        const plan = priceAmountToPlan(priceAmount) as Database['public']['Tables']['gyms']['Update']['plan']
        await supabase.from('gyms').update({
          plan,
          plan_member_limit:           PLAN_LIMITS[priceAmountToPlan(priceAmount)] ?? 30,
          osss_stripe_subscription_id: sub.id,
        }).eq('id', gymId)
      }
    }
  }

  // ── charge.dispute.created ───────────────────────────────────────────────────
  // H-1: A cardholder or bank has disputed a payment. Mark the payment as disputed,
  // notify the gym owner immediately (they have ~7 days to respond).
  if (event.type === 'charge.dispute.created') {
    const dispute  = event.data.object as Stripe.Dispute
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? ''

    // Mark matching payment as disputed
    if (chargeId) {
      // Disputes link via charge → payment_intent; try to match via stored payment_intent
      const { data: charge } = await (async () => {
        try { return { data: await stripe.charges.retrieve(chargeId) } }
        catch { return { data: null } }
      })()
      const piId = typeof charge?.payment_intent === 'string' ? charge.payment_intent : null
      if (piId) {
        const { data: pmt } = await supabase
          .from('payments')
          .update({ status: 'disputed' })
          .eq('stripe_payment_intent_id', piId)
          .select('gym_id, amount_cents')
          .single()

        // Notify gym owner
        if (pmt) {
          await notifyGymDispute((pmt as any).gym_id, dispute.id, (pmt as any).amount_cents, chargeId)
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
