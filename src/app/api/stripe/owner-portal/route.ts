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

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms')
    .select('id, name, email, osss_stripe_customer_id')
    .eq('owner_id', user.id)
    .single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const stripe = new Stripe(stripeKey)
  let customerId = gym.osss_stripe_customer_id

  // Fallback: webhook may have failed to write the customer ID.
  // Search Stripe by email and heal the DB if found.
  if (!customerId) {
    const email = user.email ?? gym.email
    if (email) {
      const { data: customers } = await stripe.customers.list({ email, limit: 5 })
      // Pick the customer whose metadata.gymId matches — avoids collisions across gyms
      const match = customers.find(c => c.metadata?.gymId === gym.id) ?? customers[0]
      if (match) {
        customerId = match.id
        await supabase.from('gyms').update({ osss_stripe_customer_id: customerId }).eq('id', gym.id)
      }
    }
  }

  if (!customerId) {
    return NextResponse.json(
      { error: 'Kein Stripe-Abonnement gefunden. Bitte wähle zuerst einen Plan.' },
      { status: 400 }
    )
  }

  const appUrl = getAppUrl()
  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${appUrl}/dashboard/settings`,
  })

  return NextResponse.json({ url: portalSession.url })
}
