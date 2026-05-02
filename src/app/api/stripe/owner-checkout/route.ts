import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'
import type { Database } from '@/types/database'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

const PLAN_PRICES: Record<string, number> = { starter: 2900, grow: 5900, pro: 9900 }
const PLAN_NAMES:  Record<string, string>  = { starter: 'Starter Plan', grow: 'Grow Plan', pro: 'Pro Plan' }

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { plan } = await req.json()
  if (!plan || !PLAN_PRICES[plan]) return NextResponse.json({ error: 'Ungültiger Plan' }, { status: 400 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms')
    .select('id, name, email, osss_stripe_customer_id')
    .eq('owner_id', user.id)
    .single()
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
          currency:    'eur',
          product_data: { name: PLAN_NAMES[plan] },
          recurring:   { interval: 'month' },
          unit_amount: PLAN_PRICES[plan],
        },
        quantity: 1,
      }],
      metadata: { type: 'owner_plan', gymId: gym.id, plan },
      subscription_data: {
        metadata: { type: 'owner_plan', gymId: gym.id, plan },
      },
      success_url: `${appUrl}/dashboard/settings?upgraded=1`,
      cancel_url:  `${appUrl}/dashboard/settings`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe-Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
