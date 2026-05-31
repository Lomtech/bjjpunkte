import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = authClient(auth.token)
  const gym = auth.gym

  const { data: plan } = await (supabase.from('membership_plans') as any)
    .select('id, stripe_price_id, stripe_product_id')
    .eq('id', id)
    .eq('gym_id', gym.id)
    .single()

  if (!plan) return NextResponse.json({ error: 'Tarif nicht gefunden' }, { status: 404 })
  const planData = plan as { id: string; stripe_price_id: string | null; stripe_product_id: string | null }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey)
      if (planData.stripe_price_id) {
        await stripe.prices.update(planData.stripe_price_id, { active: false })
      }
      if (planData.stripe_product_id) {
        await stripe.products.update(planData.stripe_product_id, { active: false })
      }
    } catch (err: any) {
      console.error('Stripe archive error:', err?.message)
    }
  }

  await (supabase.from('membership_plans') as any).delete().eq('id', id)

  return NextResponse.json({ success: true })
}
