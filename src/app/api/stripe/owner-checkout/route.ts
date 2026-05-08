import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'
import type { Database } from '@/types/database'
import { PRICING_TIERS, annualPriceCents, type PlanKey } from '@/lib/pricing'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

// Single-source-of-truth: pricing comes from src/lib/pricing.ts.
// Pricing realignment 2026-05: 29/49/99 → 49/89/149 EUR. The Stripe
// Checkout used to hardcode the old numbers — keeping a derived map
// here ensures the pricing page and the checkout can never drift again.
const PAID_TIERS = PRICING_TIERS.filter(t => t.planKey !== 'free')
const PLAN_PRICES        = Object.fromEntries(PAID_TIERS.map(t => [t.planKey, t.monthlyCents]))            as Record<PlanKey, number>
const PLAN_PRICES_ANNUAL = Object.fromEntries(PAID_TIERS.map(t => [t.planKey, annualPriceCents(t.monthlyCents)])) as Record<PlanKey, number>
const PLAN_NAMES         = Object.fromEntries(PAID_TIERS.map(t => [t.planKey, `${t.name} Plan`]))           as Record<PlanKey, string>

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { plan, annual = false } = await req.json()
  // Reject unknown plans AND the free tier — Free does not go through Stripe Checkout.
  const isPaidPlan = (p: unknown): p is Exclude<PlanKey, 'free'> =>
    typeof p === 'string' && p in PLAN_PRICES
  if (!isPaidPlan(plan)) return NextResponse.json({ error: 'Ungültiger Plan' }, { status: 400 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms')
    .select('id, name, email, osss_stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const stripe = new Stripe(stripeKey)
  const appUrl = getAppUrl()

  // Ensure a Stripe customer exists for this gym owner BEFORE creating the session.
  // This makes the customer ID available immediately — no webhook dependency.
  let customerId = gym.osss_stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? gym.email ?? undefined,
      name: gym.name,
      metadata: { gymId: gym.id, ownerId: user.id },
    })
    customerId = customer.id
    // Persist immediately — portal works even if webhook is delayed/fails
    await supabase.from('gyms').update({ osss_stripe_customer_id: customerId }).eq('id', gym.id)
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer:  customerId,
      mode:      'subscription',
      line_items: [{
        price_data: {
          currency:     'eur',
          product_data: { name: annual ? `${PLAN_NAMES[plan]} (Jährlich)` : PLAN_NAMES[plan] },
          recurring:    { interval: annual ? 'year' : 'month' },
          unit_amount:  annual ? PLAN_PRICES_ANNUAL[plan] : PLAN_PRICES[plan],
        },
        quantity: 1,
      }],
      metadata: { type: 'owner_plan', gymId: gym.id, plan, billing: annual ? 'annual' : 'monthly' },
      subscription_data: {
        metadata: { type: 'owner_plan', gymId: gym.id, plan, billing: annual ? 'annual' : 'monthly' },
      },
      success_url: `${appUrl}/dashboard/settings?upgraded=1`,
      cancel_url:  `${appUrl}/dashboard/settings`,
    }, { idempotencyKey: `owner-checkout-${gym.id}-${Math.floor(Date.now()/60000)}` })
    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe-Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
