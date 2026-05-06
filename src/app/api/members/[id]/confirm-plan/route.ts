import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getAppUrl } from '@/lib/app-url'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params

  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms')
    .select('id, stripe_account_id')
    .eq('owner_id', user.id)
    .single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })
  const gymData = gym as { id: string; stripe_account_id: string | null }

  // Get member (verify belongs to this gym)
  const { data: memberRaw } = await supabase.from('members')
    .select('id, requested_plan_id, stripe_customer_id, stripe_subscription_id, email, first_name, last_name')
    .eq('id', memberId)
    .eq('gym_id', gymData.id)
    .single()
  if (!memberRaw) return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })

  const member = memberRaw as {
    id: string
    requested_plan_id: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    email: string | null
    first_name: string
    last_name: string
  }

  if (!member.requested_plan_id) {
    return NextResponse.json({ error: 'Keine Plan-Anfrage vorhanden' }, { status: 400 })
  }

  // Get the requested plan
  const { data: planRaw } = await supabase.from('membership_plans')
    .select('id, name, price_cents, billing_interval, stripe_price_id, contract_months')
    .eq('id', member.requested_plan_id)
    .eq('gym_id', gymData.id)
    .single()
  if (!planRaw) return NextResponse.json({ error: 'Tarif nicht gefunden' }, { status: 404 })

  const plan = planRaw as {
    id: string
    name: string
    price_cents: number
    billing_interval: string
    stripe_price_id: string | null
    contract_months: number | null
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const connectedAccountId = gymData.stripe_account_id
  const stripeOpts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined

  // Double-charge guard: if member has an active subscription AND new plan is paid,
  // schedule the old subscription to end at period end before assigning the new plan.
  // Owner must start the new checkout manually after the old period closes.
  if (
    stripeKey &&
    plan.price_cents &&
    member.stripe_subscription_id &&
    connectedAccountId
  ) {
    try {
      const stripe = new Stripe(stripeKey)
      await stripe.subscriptions.update(
        member.stripe_subscription_id,
        { cancel_at_period_end: true },
        stripeOpts,
      )
    } catch (err) {
      console.error('Stripe confirm-plan: failed to schedule old sub cancel:', err)
      return NextResponse.json(
        { error: 'Altes Abo konnte nicht zum Periodenende beendet werden. Bitte manuell prüfen.' },
        { status: 502 },
      )
    }
    // Assign new plan but DO NOT start a new checkout — old sub still runs to period end.
    await supabase.from('members')
      .update({ plan_id: plan.id, requested_plan_id: null })
      .eq('id', memberId)
    return NextResponse.json({
      success: true,
      pending_old_subscription: true,
      message: 'Plan zugewiesen. Altes Abo endet zum Periodenende — neuen Checkout danach manuell starten.',
    })
  }

  // Assign the plan and clear the request
  await supabase.from('members')
    .update({ plan_id: plan.id, requested_plan_id: null })
    .eq('id', memberId)

  // If plan has price_cents and member does NOT already have a subscription
  if (
    stripeKey &&
    plan.price_cents &&
    !member.stripe_subscription_id
  ) {
    try {
      const stripe = new Stripe(stripeKey)
      const appUrl = getAppUrl()
      const platformFeePercent = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? '0') || 0

      // Verify/create customer on connected account
      let customerId = member.stripe_customer_id
      if (customerId && connectedAccountId) {
        try {
          await stripe.customers.retrieve(customerId, {}, { stripeAccount: connectedAccountId })
        } catch {
          customerId = null
        }
      }
      if (!customerId) {
        if (!member.email) return NextResponse.json({ error: 'Mitglied hat keine E-Mail' }, { status: 400 })
        const customer = await stripe.customers.create(
          { email: member.email, name: `${member.first_name} ${member.last_name}`, metadata: { memberId, gymId: gymData.id } },
          {
            ...(stripeOpts ?? {}),
            idempotencyKey: `customer-${memberId}-${connectedAccountId ?? 'platform'}`,
          },
        )
        customerId = customer.id
        await supabase.from('members').update({ stripe_customer_id: customerId }).eq('id', memberId)
      }

      // If contract has a fixed duration, auto-cancel the subscription at the end
      let cancelAt: number | undefined
      if (plan.contract_months && plan.contract_months > 0) {
        const end = new Date()
        end.setDate(1)
        end.setMonth(end.getMonth() + plan.contract_months)
        cancelAt = Math.floor(end.getTime() / 1000)
      }

      // Use price_data inline (avoids platform vs connected account price mismatch)
      const billingInterval = plan.billing_interval === 'biannual'
        ? { interval: 'month' as const, interval_count: 6 }
        : plan.billing_interval === 'annual'
          ? { interval: 'year' as const }
          : { interval: 'month' as const }

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        line_items: [{
          price_data: {
            currency: 'eur',
            unit_amount: plan.price_cents,
            recurring: billingInterval,
            product_data: { name: plan.name },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        billing_address_collection: 'required',
        success_url: `${appUrl}/dashboard/members/${memberId}?sub=success`,
        cancel_url: `${appUrl}/dashboard/members/${memberId}`,
        metadata: { memberId, gymId: gymData.id },
        subscription_data: {
          metadata: { memberId, gymId: gymData.id, ...(cancelAt ? { cancel_at_ts: String(cancelAt) } : {}) },
          ...(platformFeePercent > 0 ? { application_fee_percent: platformFeePercent } : {}),
        },
      }

      // Direct charge: session on connected account so customer is found; no on_behalf_of needed
      const session = await stripe.checkout.sessions.create(sessionParams, {
        ...stripeOpts,
        idempotencyKey: `confirm-plan-${memberId}-${plan.id}-${Math.floor(Date.now() / 60000)}`,
      })
      return NextResponse.json({ success: true, checkout_url: session.url })
    } catch (err: any) {
      console.error('Stripe confirm-plan checkout error:', err?.message)
      // Don't fail — plan was already assigned
    }
  }

  return NextResponse.json({ success: true })
}
