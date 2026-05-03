import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'

const PLATFORM_FEE_PERCENT = 0.03

function authClient(accessToken: string) {
  return createClient(
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

  const { data: gym } = await (supabase.from('gyms') as any)
    .select('id, stripe_account_id')
    .eq('owner_id', user.id)
    .single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })
  const gymData = gym as { id: string; stripe_account_id: string | null }

  // Get member (verify belongs to this gym)
  const { data: memberRaw } = await (supabase.from('members') as any)
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
  const { data: planRaw } = await (supabase.from('membership_plans') as any)
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

  // Assign the plan and clear the request
  await (supabase.from('members') as any)
    .update({ plan_id: plan.id, requested_plan_id: null })
    .eq('id', memberId)

  // If plan has a stripe_price_id, member has a stripe_customer_id, and member does NOT already have a subscription
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (
    stripeKey &&
    plan.stripe_price_id &&
    member.stripe_customer_id &&
    !member.stripe_subscription_id
  ) {
    try {
      const stripe = new Stripe(stripeKey)
      const appUrl = getAppUrl()

      // If contract has a fixed duration, auto-cancel the subscription at the end
      let cancelAt: number | undefined
      if (plan.contract_months && plan.contract_months > 0) {
        const end = new Date()
        end.setMonth(end.getMonth() + plan.contract_months)
        cancelAt = Math.floor(end.getTime() / 1000)
      }

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: member.stripe_customer_id,
        payment_method_types: ['card', 'sepa_debit'],
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        mode: 'subscription',
        success_url: `${appUrl}/dashboard/members/${memberId}?sub=success`,
        cancel_url: `${appUrl}/dashboard/members/${memberId}`,
        metadata: { memberId, gymId: gymData.id },
        subscription_data: {
          metadata: { memberId, gymId: gymData.id },
          ...(cancelAt ? { cancel_at: cancelAt } : {}),
        },
      }

      if (gymData.stripe_account_id) {
        sessionParams.subscription_data = {
          ...sessionParams.subscription_data,
          application_fee_percent: PLATFORM_FEE_PERCENT * 100,
          transfer_data: { destination: gymData.stripe_account_id },
        }
      }

      const session = await stripe.checkout.sessions.create(sessionParams)
      return NextResponse.json({ success: true, checkout_url: session.url })
    } catch (err: any) {
      console.error('Stripe confirm-plan checkout error:', err?.message)
      // Don't fail — plan was already assigned
    }
  }

  return NextResponse.json({ success: true })
}
