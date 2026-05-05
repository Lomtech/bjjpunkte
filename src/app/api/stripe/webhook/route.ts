import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const PLAN_LIMITS: Record<string, number> = { starter: 50, grow: 150, pro: 9999 }

function priceAmountToPlan(amountCents: number): string {
  // Annual amounts (10× monthly — 2 months free)
  if (amountCents >= 99000) return 'pro'
  if (amountCents >= 59000) return 'grow'
  if (amountCents >= 29000) return 'starter'
  // Monthly amounts
  if (amountCents >= 9900) return 'pro'
  if (amountCents >= 5900) return 'grow'
  return 'starter'
}

async function notifyGymDispute(
  supabase: ReturnType<typeof createClient<Database>>,
  gymId: string,
  disputeId: string,
  amountCents: number,
  chargeId: string,
) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return
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
  const stripeKey     = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)
  const body   = await req.text()
  const sig    = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing stripe-signature', { status: 400 })

  let event: Stripe.Event | null = null
  for (const secret of [webhookSecret, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[]) {
    try { event = stripe.webhooks.constructEvent(body, sig, secret); break }
    catch { /* try next */ }
  }
  if (!event) return NextResponse.json({ error: 'Webhook-Signatur ungültig' }, { status: 400 })

  // Single client for the entire request — not recreated per event handler.
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── checkout.session.completed ──────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    try {
      const session         = event.data.object as Stripe.Checkout.Session
      const memberId        = session.metadata?.memberId ?? null
      const sessionId       = session.id
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

      if (session.metadata?.type === 'owner_plan') {
        const { gymId, plan } = session.metadata
        await supabase.from('gyms').update({
          plan:                        plan as Database['public']['Tables']['gyms']['Update']['plan'],
          plan_member_limit:           PLAN_LIMITS[plan] ?? 30,
          osss_stripe_customer_id:     typeof session.customer    === 'string' ? session.customer    : undefined,
          osss_stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : undefined,
        }).eq('id', gymId)
      }

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

        const { data: bySession } = await supabase
          .from('payments')
          .update({ status: 'paid', paid_at: now, stripe_payment_intent_id: paymentIntentId })
          .eq('stripe_checkout_session_id', sessionId)
          .select('id')
        if (bySession && bySession.length > 0) matched = true

        if (!matched && paymentIntentId) {
          const { data: byIntent } = await supabase
            .from('payments')
            .update({ status: 'paid', paid_at: now })
            .eq('stripe_payment_intent_id', paymentIntentId)
            .select('id')
          if (byIntent && byIntent.length > 0) matched = true

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

        if (!matched && memberId && gymId && session.mode === 'subscription') {
          const { data: existing } = await supabase
            .from('payments').select('id')
            .eq('stripe_checkout_session_id', sessionId).limit(1)
          if (!existing || existing.length === 0) {
            const { data: mRow } = await supabase.from('members').select('first_name, last_name').eq('id', memberId).single()
            const memberName = mRow ? `${mRow.first_name} ${mRow.last_name}` : null
            await supabase.from('payments').insert({
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
    } catch (err) {
      console.error('[webhook] checkout.session.completed error:', err)
    }
  }

  // ── account.updated ─────────────────────────────────────────────────────────
  if (event.type === 'account.updated') {
    try {
      const account = event.data.object as Stripe.Account
      const { data: gym } = await supabase.from('gyms').select('id').eq('stripe_account_id', account.id).single()
      if (gym) {
        await supabase.from('gyms').update({ stripe_charges_enabled: account.charges_enabled }).eq('id', gym.id)
      }
    } catch (err) {
      console.error('[webhook] account.updated error:', err)
    }
  }

  // ── charge.refunded ─────────────────────────────────────────────────────────
  if (event.type === 'charge.refunded') {
    try {
      const charge = event.data.object as Stripe.Charge
      const piId   = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
      if (piId) {
        await supabase.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent_id', piId)
      }
    } catch (err) {
      console.error('[webhook] charge.refunded error:', err)
    }
  }

  // ── payment_intent.payment_failed ───────────────────────────────────────────
  if (event.type === 'payment_intent.payment_failed') {
    try {
      const pi = event.data.object as Stripe.PaymentIntent
      await supabase.from('payments').update({ status: 'failed' }).eq('stripe_payment_intent_id', pi.id)
    } catch (err) {
      console.error('[webhook] payment_intent.payment_failed error:', err)
    }
  }

  // ── customer.subscription.created / updated ──────────────────────────────────
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    try {
      const sub      = event.data.object as Stripe.Subscription
      const memberId = sub.metadata?.memberId
      if (memberId) {
        const status: Database['public']['Tables']['members']['Update']['subscription_status'] =
          sub.status === 'active'   ? 'active'    :
          sub.status === 'past_due' ? 'past_due'  :
          sub.status === 'canceled' ? 'cancelled' :
          'none'
        await supabase.from('members')
          .update({ stripe_subscription_id: sub.id, subscription_status: status })
          .eq('id', memberId)

        if (event.type === 'customer.subscription.created') {
          const cancelAtTs = sub.metadata?.cancel_at_ts
          if (cancelAtTs && !sub.cancel_at) {
            try {
              const connectedAccount = req.headers.get('stripe-account') ?? undefined
              await stripe.subscriptions.update(
                sub.id,
                { cancel_at: parseInt(cancelAtTs, 10) },
                connectedAccount ? { stripeAccount: connectedAccount } : undefined,
              )
            } catch (err) {
              console.error('[webhook] Failed to set cancel_at on subscription:', err)
            }
          }
        }
      }
    } catch (err) {
      console.error('[webhook] customer.subscription.created/updated error:', err)
    }
  }

  // ── customer.subscription.deleted ───────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    try {
      const sub      = event.data.object as Stripe.Subscription
      const memberId = sub.metadata?.memberId
      if (memberId) {
        await supabase.from('members')
          .update({ stripe_subscription_id: null, subscription_status: 'cancelled' })
          .eq('id', memberId)
      }

      const { data: gymWithSub } = await supabase.from('gyms').select('id').eq('osss_stripe_subscription_id', sub.id).single()
      if (gymWithSub) {
        await supabase.from('gyms').update({
          plan:                        'free',
          plan_member_limit:           30,
          osss_stripe_subscription_id: null,
        }).eq('id', gymWithSub.id)
      }
    } catch (err) {
      console.error('[webhook] customer.subscription.deleted error:', err)
    }
  }

  // ── invoice.paid ─────────────────────────────────────────────────────────────
  if (event.type === 'invoice.paid') {
    try {
      const inv             = event.data.object as Stripe.Invoice
      const meta            = (inv as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata ?? inv.metadata ?? {}
      const memberId        = meta.memberId
      const gymId           = meta.gymId
      const amountCents     = inv.amount_paid
      const paymentIntentId = typeof (inv as unknown as { payment_intent?: string }).payment_intent === 'string'
        ? (inv as unknown as { payment_intent: string }).payment_intent
        : null
      const invoiceId = inv.id

      if (memberId && amountCents > 0) {
        // Deterministic dedup: stripe_invoice_id is unique and present for every invoice.paid.
        if (invoiceId) {
          const { data: byInvoice } = await supabase
            .from('payments').select('id')
            .eq('stripe_invoice_id', invoiceId)
            .single()
          if (byInvoice) return NextResponse.json({ received: true })
        }
        // Secondary dedup for card payments: payment_intent arrives at checkout.session.completed.
        if (paymentIntentId) {
          const { data: byIntent } = await supabase
            .from('payments').select('id')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .single()
          if (byIntent) return NextResponse.json({ received: true })
        }

        const { data: mRow } = await supabase.from('members').select('first_name, last_name').eq('id', memberId).single()
        const memberName = mRow ? `${mRow.first_name} ${mRow.last_name}` : null
        await supabase.from('payments').insert({
          gym_id:                   gymId ?? null,
          member_id:                memberId,
          member_name:              memberName,
          amount_cents:             amountCents,
          status:                   'paid',
          paid_at:                  new Date().toISOString(),
          stripe_payment_intent_id: paymentIntentId,
          stripe_invoice_id:        invoiceId ?? null,
        } as any)
      }
    } catch (err) {
      console.error('[webhook] invoice.paid error:', err)
    }
  }

  // ── payment_intent.succeeded (SEPA async confirmation) ──────────────────────
  if (event.type === 'payment_intent.succeeded') {
    try {
      const pi  = event.data.object as Stripe.PaymentIntent
      const now = new Date().toISOString()
      await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: now })
        .eq('stripe_payment_intent_id', pi.id)
        .eq('status', 'pending')
    } catch (err) {
      console.error('[webhook] payment_intent.succeeded error:', err)
    }
  }

  // ── invoice.payment_failed ───────────────────────────────────────────────────
  if (event.type === 'invoice.payment_failed') {
    try {
      const inv      = event.data.object as Stripe.Invoice
      const meta     = (inv as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata ?? inv.metadata ?? {}
      const memberId = meta.memberId

      if (memberId) {
        await supabase.from('members').update({ subscription_status: 'past_due' }).eq('id', memberId)
      } else if (meta.type === 'owner_plan') {
        const gymId = meta.gymId
        if (gymId) {
          await supabase.from('gyms').update({ plan: 'free', plan_member_limit: 30 }).eq('id', gymId)
          console.warn(`[webhook] Owner plan payment failed for gym ${gymId} — downgraded to free`)
        }
      }
    } catch (err) {
      console.error('[webhook] invoice.payment_failed error:', err)
    }
  }

  // ── charge.dispute.created ───────────────────────────────────────────────────
  if (event.type === 'charge.dispute.created') {
    try {
      const dispute  = event.data.object as Stripe.Dispute
      const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? ''

      if (chargeId) {
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

          if (pmt) {
            await notifyGymDispute(supabase, (pmt as any).gym_id, dispute.id, (pmt as any).amount_cents, chargeId)
          }
        }
      }
    } catch (err) {
      console.error('[webhook] charge.dispute.created error:', err)
    }
  }

  return NextResponse.json({ received: true })
}
