import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'

export const runtime = 'nodejs'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Creates a new Stripe Checkout session for a member's current plan via portal token.
// Used when the member has a plan_id but no active subscription.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token || token.length < 20 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const supabase = adminClient()

  const { data: memberRaw } = await supabase
    .from('members')
    .select('id, gym_id, email, first_name, last_name, plan_id, stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('portal_token', token)
    .single()

  if (!memberRaw) return NextResponse.json({ error: 'Ungültiger Token' }, { status: 401 })

  const member = memberRaw as {
    id: string
    gym_id: string
    email: string | null
    first_name: string
    last_name: string
    plan_id: string | null
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    subscription_status: string | null
  }

  if (!member.plan_id) {
    return NextResponse.json({ error: 'Kein Tarif zugewiesen' }, { status: 400 })
  }

  if (member.stripe_subscription_id && member.subscription_status === 'active') {
    return NextResponse.json({ error: 'Abo bereits aktiv' }, { status: 400 })
  }

  const { data: gymRaw } = await supabase
    .from('gyms')
    .select('id, stripe_account_id')
    .eq('id', member.gym_id)
    .single()

  const gym = gymRaw as { id: string; stripe_account_id: string | null } | null
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const { data: planRaw } = await (supabase.from('membership_plans') as any)
    .select('id, name, price_cents, billing_interval, stripe_price_id, contract_months')
    .eq('id', member.plan_id)
    .eq('gym_id', member.gym_id)
    .single()

  const plan = planRaw as { stripe_price_id: string | null; price_cents: number; name: string; billing_interval: string; contract_months: number | null }

  if (!planRaw || !planRaw.price_cents) {
    return NextResponse.json({ error: 'Tarif nicht gefunden oder ungültiger Preis' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)
  const appUrl = getAppUrl()
  const platformFeePercent = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? '0') || 0
  const connectedAccountId = gym.stripe_account_id
  const stripeOpts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined

  // Ensure Stripe customer exists on connected account
  let customerId = member.stripe_customer_id
  if (customerId && connectedAccountId) {
    try {
      await stripe.customers.retrieve(customerId, {}, { stripeAccount: connectedAccountId })
    } catch {
      customerId = null
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create(
      {
        email: member.email ?? undefined,
        name: `${member.first_name} ${member.last_name}`,
        metadata: { memberId: member.id, gymId: member.gym_id },
      },
      stripeOpts ?? {},
    )
    customerId = customer.id
    await supabase.from('members').update({ stripe_customer_id: customerId }).eq('id', member.id)
  }

  let cancelAt: number | undefined
  if (planRaw.contract_months && planRaw.contract_months > 0) {
    const end = new Date()
    end.setMonth(end.getMonth() + planRaw.contract_months)
    cancelAt = Math.floor(end.getTime() / 1000)
  }

  // Use price_data inline (avoids platform vs connected account price mismatch)
  const billingInterval = planRaw.billing_interval === 'biannual'
    ? { interval: 'month' as const, interval_count: 6 }
    : planRaw.billing_interval === 'annual'
      ? { interval: 'year' as const }
      : { interval: 'month' as const }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: planRaw.price_cents,
        recurring: billingInterval,
        product_data: { name: planRaw.name },
      },
      quantity: 1,
    }],
    mode: 'subscription',
    billing_address_collection: 'required',
    success_url: `${appUrl}/portal/${token}?sub=success`,
    cancel_url:  `${appUrl}/portal/${token}`,
    metadata: { memberId: member.id, gymId: member.gym_id },
    subscription_data: {
      metadata: {
        memberId: member.id,
        gymId: member.gym_id,
        ...(cancelAt ? { cancel_at_ts: String(cancelAt) } : {}),
      },
      ...(platformFeePercent > 0 ? { application_fee_percent: platformFeePercent } : {}),
    },
  }

  // Direct charge: session on connected account so customer is found; no on_behalf_of needed
  try {
    const session = await stripe.checkout.sessions.create(sessionParams, stripeOpts)
    return NextResponse.json({ checkout_url: session.url })
  } catch (err: any) {
    console.error('Portal subscribe error:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Checkout konnte nicht erstellt werden' }, { status: 500 })
  }
}
