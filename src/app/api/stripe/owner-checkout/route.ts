import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

const PLAN_PRICES: Record<string, number> = {
  starter: 2900,
  grow: 5900,
  pro: 9900,
}

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter Plan',
  grow: 'Grow Plan',
  pro: 'Pro Plan',
}

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await (supabase.from('gyms') as any).select('id').eq('owner_id', user.id).single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const { plan } = await req.json()
  if (!plan || !PLAN_PRICES[plan]) {
    return NextResponse.json({ error: 'Ungültiger Plan' }, { status: 400 })
  }

  const stripe = new Stripe(stripeKey)
  const appUrl = getAppUrl()

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: { name: PLAN_NAMES[plan] },
          recurring: { interval: 'month' },
          unit_amount: PLAN_PRICES[plan],
        },
        quantity: 1,
      },
    ],
    metadata: { type: 'owner_plan', gymId: gym.id, plan },
    subscription_data: {
      metadata: { type: 'owner_plan', gymId: gym.id, plan },
    },
    success_url: `${appUrl}/dashboard/settings?upgraded=1`,
    cancel_url: `${appUrl}/dashboard/settings`,
  })

  return NextResponse.json({ url: session.url })
}
