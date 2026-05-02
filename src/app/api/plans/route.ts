import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await (supabase.from('gyms') as any).select('id, name, stripe_account_id').eq('owner_id', user.id).single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })
  const gymData = gym as { id: string; name: string; stripe_account_id: string | null }

  const { name, description, price_cents, billing_interval, contract_months } = await req.json()
  if (!name) return NextResponse.json({ error: 'Name fehlt' }, { status: 400 })
  if (!price_cents || price_cents < 0) return NextResponse.json({ error: 'Ungültiger Preis' }, { status: 400 })

  let stripe_price_id: string | null = null
  let stripe_product_id: string | null = null

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey)

      let recurringInterval: Stripe.PriceCreateParams.Recurring
      if (billing_interval === 'monthly') {
        recurringInterval = { interval: 'month' }
      } else if (billing_interval === 'biannual') {
        recurringInterval = { interval: 'month', interval_count: 6 }
      } else {
        recurringInterval = { interval: 'year' }
      }

      const product = await stripe.products.create({
        name: `${name} – ${gymData.name}`,
      })
      stripe_product_id = product.id

      const price = await stripe.prices.create({
        currency: 'eur',
        unit_amount: price_cents,
        recurring: recurringInterval,
        product: product.id,
      })
      stripe_price_id = price.id
    } catch (err: any) {
      console.error('Stripe product/price creation error:', err?.message)
    }
  }

  const { data: plan, error } = await (supabase.from('membership_plans') as any).insert({
    gym_id: gymData.id,
    name,
    description: description ?? null,
    price_cents,
    billing_interval: billing_interval ?? 'monthly',
    contract_months: contract_months ?? 0,
    is_active: true,
    sort_order: 0,
    stripe_price_id,
    stripe_product_id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ plan }, { status: 201 })
}
