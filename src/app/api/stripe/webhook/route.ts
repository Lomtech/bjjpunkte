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

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Atomic dedup via stripe_events table — UNIQUE index on event_id rejects duplicates
  const { error: dedupErr } = await supabase
    .from('stripe_events')
    .insert({ event_id: event.id } as never)
  // 23505 = unique_violation → duplicate event, already processed
  if (dedupErr) {
    if ((dedupErr as { code?: string }).code === '23505') return NextResponse.json({ received: true })
    console.error('[webhook] stripe_events insert error:', dedupErr)
    return NextResponse.json({ error: 'Dedup insert failed' }, { status: 500 })
  }

  // ── checkout.session.completed ──────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session         = event.data.object as Stripe.Checkout.Session
    const memberId        = session.metadata?.memberId ?? null
    const sessionId       = session.id
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

    if (session.metadata?.type === 'owner_plan') {
      const { gymId, plan } = session.metadata
      const { error: planErr } = await supabase.from('gyms').update({
        plan:                        plan as Database['public']['Tables']['gyms']['Update']['plan'],
        plan_member_limit:           PLAN_LIMITS[plan] ?? 30,
        osss_stripe_customer_id:     typeof session.customer    === 'string' ? session.customer    : undefined,
        osss_stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : undefined,
      }).eq('id', gymId)
      if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })
    }

    if (memberId && session.mode === 'subscription') {
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
      if (subscriptionId) {
        const { error: subErr } = await supabase.from('members')
          .update({ stripe_subscription_id: subscriptionId, subscription_status: 'active' })
          .eq('id', memberId)
        if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })
      }
    }

    if (session.payment_status === 'paid') {
      const now   = new Date().toISOString()
      const gymId = session.metadata?.gymId ?? null
      let matched = false

      const { data: bySession, error: bySessionErr } = await supabase
        .from('payments')
        .update({ status: 'paid', paid_at: now, stripe_payment_intent_id: paymentIntentId })
        .eq('stripe_checkout_session_id', sessionId)
        .limit(1)
        .select('id')
      if (bySessionErr) return NextResponse.json({ error: bySessionErr.message }, { status: 500 })
      if (bySession && bySession.length > 0) matched = true

      if (!matched && paymentIntentId) {
        const { data: byIntent, error: byIntentErr } = await supabase
          .from('payments')
          .update({ status: 'paid', paid_at: now })
          .eq('stripe_payment_intent_id', paymentIntentId)
          .limit(1)
          .select('id')
        if (byIntentErr) return NextResponse.json({ error: byIntentErr.message }, { status: 500 })
        if (byIntent && byIntent.length > 0) matched = true

        if (!matched && memberId) {
          const { data: pending, error: pendingErr } = await supabase
            .from('payments').select('id')
            .eq('member_id', memberId).eq('status', 'pending')
            .order('created_at', { ascending: false }).limit(1).single()
          if (pendingErr && pendingErr.code !== 'PGRST116') return NextResponse.json({ error: pendingErr.message }, { status: 500 })
          if (pending) {
            const { error: updErr } = await supabase.from('payments')
              .update({ status: 'paid', paid_at: now, stripe_payment_intent_id: paymentIntentId, stripe_checkout_session_id: sessionId })
              .eq('id', pending.id)
            if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
            matched = true
          }
        }
      }

      if (!matched && memberId && gymId && session.mode === 'subscription') {
        const { data: existing, error: existErr } = await supabase
          .from('payments').select('id')
          .eq('stripe_checkout_session_id', sessionId).limit(1)
        if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 })
        if (!existing || existing.length === 0) {
          const { data: mRow } = await supabase.from('members').select('first_name, last_name').eq('id', memberId).single()
          const memberName = mRow ? `${mRow.first_name} ${mRow.last_name}` : null
          const { error: insErr } = await supabase.from('payments').insert({
            gym_id:                     gymId,
            member_id:                  memberId,
            member_name:                memberName,
            amount_cents:               session.amount_total ?? 0,
            status:                     'paid',
            paid_at:                    now,
            stripe_payment_intent_id:   paymentIntentId,
            stripe_checkout_session_id: sessionId,
          })
          if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
        }
      }
    }
  }

  // ── account.updated ─────────────────────────────────────────────────────────
  if (event.type === 'account.updated') {
    const account = event.data.object as Stripe.Account
    const { data: gym, error: gymLookupErr } = await supabase.from('gyms').select('id').eq('stripe_account_id', account.id).single()
    if (gymLookupErr && gymLookupErr.code !== 'PGRST116') return NextResponse.json({ error: gymLookupErr.message }, { status: 500 })
    if (gym) {
      const { error: updErr } = await supabase.from('gyms').update({ stripe_charges_enabled: account.charges_enabled }).eq('id', gym.id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  }

  // ── charge.refunded ─────────────────────────────────────────────────────────
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    const piId   = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
    if (piId) {
      const { error: refErr } = await supabase.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent_id', piId)
      if (refErr) return NextResponse.json({ error: refErr.message }, { status: 500 })
    }
  }

  // ── payment_intent.payment_failed ───────────────────────────────────────────
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as Stripe.PaymentIntent
    const { error: failErr } = await supabase.from('payments').update({ status: 'failed' }).eq('stripe_payment_intent_id', pi.id)
    if (failErr) return NextResponse.json({ error: failErr.message }, { status: 500 })
  }

  // ── customer.subscription.created / updated ──────────────────────────────────
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub      = event.data.object as Stripe.Subscription
    const memberId = sub.metadata?.memberId
    if (memberId) {
      const status: Database['public']['Tables']['members']['Update']['subscription_status'] =
        sub.status === 'active'   ? 'active'    :
        sub.status === 'past_due' ? 'past_due'  :
        sub.status === 'canceled' ? 'cancelled' :
        'none'
      const { error: subUpdErr } = await supabase.from('members')
        .update({ stripe_subscription_id: sub.id, subscription_status: status })
        .eq('id', memberId)
      if (subUpdErr) return NextResponse.json({ error: subUpdErr.message }, { status: 500 })

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
  }

  // ── customer.subscription.deleted ───────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub      = event.data.object as Stripe.Subscription
    const memberId = sub.metadata?.memberId
    if (memberId) {
      const { error: delMemberErr } = await supabase.from('members')
        .update({ stripe_subscription_id: null, subscription_status: 'cancelled' })
        .eq('id', memberId)
      if (delMemberErr) return NextResponse.json({ error: delMemberErr.message }, { status: 500 })
    }

    const { data: gymWithSub, error: gymLookupErr } = await supabase.from('gyms').select('id').eq('osss_stripe_subscription_id', sub.id).single()
    if (gymLookupErr && gymLookupErr.code !== 'PGRST116') return NextResponse.json({ error: gymLookupErr.message }, { status: 500 })
    if (gymWithSub) {
      const { error: gymDownErr } = await supabase.from('gyms').update({
        plan:                        'free',
        plan_member_limit:           30,
        osss_stripe_subscription_id: null,
      }).eq('id', gymWithSub.id)
      if (gymDownErr) return NextResponse.json({ error: gymDownErr.message }, { status: 500 })
    }
  }

  // ── invoice.paid ─────────────────────────────────────────────────────────────
  if (event.type === 'invoice.paid') {
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
      if (invoiceId) {
        const { data: byInvoice } = await supabase
          .from('payments').select('id')
          .eq('stripe_invoice_id', invoiceId)
          .single()
        if (byInvoice) return NextResponse.json({ received: true })
      }
      if (paymentIntentId) {
        const { data: byIntent } = await supabase
          .from('payments').select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .single()
        if (byIntent) return NextResponse.json({ received: true })
      }

      const { data: mRow } = await supabase.from('members').select('first_name, last_name').eq('id', memberId).single()
      const memberName = mRow ? `${mRow.first_name} ${mRow.last_name}` : null
      const { error: insErr } = await supabase.from('payments').insert({
        gym_id:                   gymId ?? null,
        member_id:                memberId,
        member_name:              memberName,
        amount_cents:             amountCents,
        status:                   'paid',
        paid_at:                  new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
        stripe_invoice_id:        invoiceId ?? null,
      } as any)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  // ── payment_intent.succeeded (SEPA async confirmation) ──────────────────────
  if (event.type === 'payment_intent.succeeded') {
    const pi  = event.data.object as Stripe.PaymentIntent
    const now = new Date().toISOString()
    const { error: sepaErr } = await supabase
      .from('payments')
      .update({ status: 'paid', paid_at: now })
      .eq('stripe_payment_intent_id', pi.id)
      .eq('status', 'pending')
    if (sepaErr) return NextResponse.json({ error: sepaErr.message }, { status: 500 })
  }

  // ── invoice.payment_failed ───────────────────────────────────────────────────
  if (event.type === 'invoice.payment_failed') {
    const inv      = event.data.object as Stripe.Invoice
    const meta     = (inv as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata ?? inv.metadata ?? {}
    const memberId = meta.memberId

    if (memberId) {
      const { error: pastDueErr } = await supabase.from('members').update({ subscription_status: 'past_due' }).eq('id', memberId)
      if (pastDueErr) return NextResponse.json({ error: pastDueErr.message }, { status: 500 })
    } else if (meta.type === 'owner_plan') {
      const gymId = meta.gymId
      if (gymId) {
        const { error: downErr } = await supabase.from('gyms').update({ plan: 'free', plan_member_limit: 30 }).eq('id', gymId)
        if (downErr) return NextResponse.json({ error: downErr.message }, { status: 500 })
        console.warn(`[webhook] Owner plan payment failed for gym ${gymId} — downgraded to free`)
      }
    }
  }

  // ── invoice.upcoming ─────────────────────────────────────────────────────────
  if (event.type === 'invoice.upcoming') {
    const invoice = event.data.object as Stripe.Invoice
    const gymId   = invoice.metadata?.gymId
      ?? (invoice as unknown as { subscription_details?: { metadata?: Record<string, string> } }).subscription_details?.metadata?.gymId
    if (gymId) {
      const { data: gym } = await supabase.from('gyms').select('email, name').eq('id', gymId).single()
      const g = gym as any
      if (g?.email && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to:   g.email,
            subject: `Erinnerung: Dein Abonnement verlängert sich in 3 Tagen`,
            html: `
              <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
                <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1d4ed8">Verlängerung in 3 Tagen</p>
                <p style="font-size:15px;color:#374151;line-height:1.6">
                  Hallo ${g.name ?? 'Team'},<br/><br/>
                  dein Osss-Abonnement wird in <strong>3 Tagen</strong> automatisch verlängert.
                  Bitte stelle sicher, dass deine Zahlungsmethode aktuell ist.
                </p>
                <a href="https://dashboard.stripe.com/billing" style="display:inline-block;background:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
                  Zahlungsmethode prüfen →
                </a>
              </div>
            `,
          }),
        }).catch(e => console.error('[webhook] invoice.upcoming email error:', e))
      }
    }
    return NextResponse.json({ received: true })
  }

  // ── customer.subscription.trial_will_end ─────────────────────────────────────
  if (event.type === 'customer.subscription.trial_will_end') {
    const sub      = event.data.object as Stripe.Subscription
    const memberId = sub.metadata?.memberId
    if (memberId) {
      const { error: trialErr } = await supabase.from('members')
        .update({ subscription_status: 'trial' } as never)
        .eq('id', memberId)
      if (trialErr) console.error('[webhook] trial_will_end update error:', trialErr)
      else console.log(`[webhook] trial_will_end — member ${memberId} status set to trial`)
    }
    return NextResponse.json({ received: true })
  }

  // ── charge.dispute.closed ────────────────────────────────────────────────────
  if (event.type === 'charge.dispute.closed') {
    const dispute  = event.data.object as Stripe.Dispute
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
    if (chargeId) {
      const finalStatus = dispute.status === 'won' ? 'paid' : 'disputed_lost'
      const { error: disputeCloseErr } = await supabase.from('payments')
        .update({ status: finalStatus } as never)
        .eq('stripe_payment_intent_id', dispute.payment_intent as string)
      if (disputeCloseErr) return NextResponse.json({ error: disputeCloseErr.message }, { status: 500 })
    }
    return NextResponse.json({ received: true })
  }

  // ── charge.dispute.created ───────────────────────────────────────────────────
  if (event.type === 'charge.dispute.created') {
    const dispute  = event.data.object as Stripe.Dispute
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? ''

    if (chargeId) {
      const { data: charge } = await (async () => {
        try { return { data: await stripe.charges.retrieve(chargeId) } }
        catch { return { data: null } }
      })()
      const piId = typeof charge?.payment_intent === 'string' ? charge.payment_intent : null
      if (piId) {
        const { data: pmt, error: disputeUpdErr } = await supabase
          .from('payments')
          .update({ status: 'disputed' })
          .eq('stripe_payment_intent_id', piId)
          .select('gym_id, amount_cents')
          .single()
        if (disputeUpdErr && disputeUpdErr.code !== 'PGRST116') return NextResponse.json({ error: disputeUpdErr.message }, { status: 500 })

        if (pmt) {
          await notifyGymDispute(supabase, (pmt as any).gym_id, dispute.id, (pmt as any).amount_cents, chargeId)
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
