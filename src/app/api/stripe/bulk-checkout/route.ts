import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const PLATFORM_FEE_PERCENT = 0.02

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe nicht konfiguriert.' }, { status: 400 })
  }

  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { gymId, amountCents } = await req.json()
  if (!gymId) return NextResponse.json({ error: 'gymId fehlt' }, { status: 400 })

  const stripe = new Stripe(stripeKey)

  // Get gym's connected Stripe account
  const { data: gymData } = await supabase
    .from('gyms').select('stripe_account_id').eq('id', gymId).single()
  const connectedAccountId = (gymData as { stripe_account_id: string | null } | null)?.stripe_account_id

  // Fetch all active members with email
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, stripe_customer_id, monthly_fee_override_cents')
    .eq('gym_id', gymId)
    .eq('is_active', true)
    .not('email', 'is', null)

  if (!members || members.length === 0) {
    return NextResponse.json({ count: 0, message: 'Keine aktiven Mitglieder mit E-Mail gefunden.' })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bjjpunkte.vercel.app'
  let created = 0

  for (const member of members) {
    try {
      const fee = (member.monthly_fee_override_cents ?? amountCents ?? 0) as number
      if (fee < 50) continue

      let customerId = member.stripe_customer_id as string | null
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: member.email as string,
          name: `${member.first_name} ${member.last_name}`,
          metadata: { memberId: member.id, gymId },
        })
        customerId = customer.id
        await supabase.from('members').update({ stripe_customer_id: customerId }).eq('id', member.id)
      }

      const memberName = `${member.first_name} ${member.last_name}`

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'eur',
            product_data: { name: 'Monatlicher Mitgliedsbeitrag', description: `RollCall – ${memberName}` },
            unit_amount: fee,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${appUrl}/dashboard/members/${member.id}?payment=success`,
        cancel_url: `${appUrl}/dashboard/members/${member.id}`,
        metadata: { memberId: member.id, gymId },
      }

      if (connectedAccountId) {
        const platformFeeCents = Math.max(50, Math.round(fee * PLATFORM_FEE_PERCENT))
        sessionParams.payment_intent_data = {
          application_fee_amount: platformFeeCents,
          transfer_data: { destination: connectedAccountId },
        }
      }

      const session = await stripe.checkout.sessions.create(sessionParams)

      await supabase.from('payments').insert({
        gym_id: gymId,
        member_id: member.id,
        stripe_payment_intent_id: session.payment_intent as string,
        amount_cents: fee,
        status: 'pending',
      })

      created++
    } catch {
      // Skip member on error, continue with others
    }
  }

  return NextResponse.json({ count: created })
}
