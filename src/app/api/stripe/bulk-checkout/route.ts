import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'

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

  // Fetch all active members with email (also check subscription status)
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, stripe_customer_id, monthly_fee_override_cents, stripe_subscription_id')
    .eq('gym_id', gymId)
    .eq('is_active', true)
    .not('email', 'is', null)

  if (!members || members.length === 0) {
    return NextResponse.json({ count: 0, message: 'Keine aktiven Mitglieder mit E-Mail gefunden.' })
  }

  // Find members who already have a paid payment this month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { data: paidThisMonth } = await supabase
    .from('payments')
    .select('member_id')
    .eq('gym_id', gymId)
    .eq('status', 'paid')
    .gte('paid_at', monthStart)
  const paidMemberIds = new Set((paidThisMonth ?? []).map((p: { member_id: string }) => p.member_id))

  const appUrl = getAppUrl()
  let created = 0
  const results: { memberId: string; memberName: string; memberEmail: string; checkoutUrl: string | null; amountCents: number }[] = []

  for (const member of members) {
    try {
      // Skip members who already paid this month
      if (paidMemberIds.has(member.id)) continue
      // Skip members with active subscription (they're billed automatically)
      if ((member as { stripe_subscription_id?: string | null }).stripe_subscription_id) continue

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
        payment_method_types: ['card', 'sepa_debit'],
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('payments') as any).insert({
        gym_id: gymId,
        member_id: member.id,
        stripe_payment_intent_id: session.payment_intent as string,
        amount_cents: fee,
        status: 'pending',
        checkout_url: session.url,
      })

      results.push({
        memberId: member.id,
        memberName,
        memberEmail: member.email as string,
        checkoutUrl: session.url,
        amountCents: fee,
      })
      created++
    } catch {
      // Skip member on error, continue with others
    }
  }

  return NextResponse.json({ count: created, members: results })
}
