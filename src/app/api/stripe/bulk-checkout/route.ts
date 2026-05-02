import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'
import type { Database } from '@/types/database'

const PLATFORM_FEE_PERCENT = 0.03

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert.' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { gymId, amountCents } = await req.json()
  if (!gymId) return NextResponse.json({ error: 'gymId fehlt' }, { status: 400 })

  const stripe = new Stripe(stripeKey)

  const { data: gymData } = await supabase.from('gyms').select('stripe_account_id').eq('id', gymId).single()
  const connectedAccountId = gymData?.stripe_account_id

  // Active members with email, no active subscription
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, stripe_customer_id, stripe_subscription_id, monthly_fee_override_cents')
    .eq('gym_id', gymId)
    .eq('is_active', true)
    .not('email', 'is', null)

  if (!members || members.length === 0) {
    return NextResponse.json({ count: 0, message: 'Keine aktiven Mitglieder mit E-Mail gefunden.' })
  }

  // Members who already paid or have pending link this month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const [{ data: paidWithDate }, { data: paidNullDate }, { data: pendingThisMonth }] = await Promise.all([
    supabase.from('payments').select('member_id').eq('gym_id', gymId).eq('status', 'paid').gte('paid_at', monthStart),
    supabase.from('payments').select('member_id').eq('gym_id', gymId).eq('status', 'paid').is('paid_at', null).gte('created_at', monthStart),
    supabase.from('payments').select('member_id, checkout_url, amount_cents').eq('gym_id', gymId).eq('status', 'pending').gte('created_at', monthStart),
  ])

  const paidMemberIds = new Set([
    ...(paidWithDate  ?? []).map(p => p.member_id),
    ...(paidNullDate  ?? []).map(p => p.member_id),
  ])
  const pendingMap = new Map(
    (pendingThisMonth ?? []).map(p => [p.member_id, { checkout_url: p.checkout_url, amount_cents: p.amount_cents }])
  )

  const appUrl = getAppUrl()
  let created = 0
  const results: { memberId: string; memberName: string; memberEmail: string; checkoutUrl: string | null; amountCents: number }[] = []

  for (const member of members) {
    try {
      if (paidMemberIds.has(member.id)) continue
      // Skip members billed via active subscription
      if (member.stripe_subscription_id) continue

      // Reuse existing pending link — don't flood member with duplicate checkout URLs
      const existing = pendingMap.get(member.id)
      if (existing) {
        results.push({ memberId: member.id, memberName: `${member.first_name} ${member.last_name}`, memberEmail: member.email!, checkoutUrl: existing.checkout_url, amountCents: existing.amount_cents })
        created++
        continue
      }

      const fee = (member.monthly_fee_override_cents ?? amountCents ?? 0) as number
      if (fee < 50) continue

      let customerId = member.stripe_customer_id
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: member.email!,
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
            product_data: { name: 'Monatlicher Mitgliedsbeitrag', description: `Osss – ${memberName}` },
            unit_amount: fee,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${appUrl}/dashboard/members/${member.id}?payment=success`,
        cancel_url:  `${appUrl}/dashboard/members/${member.id}`,
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
        gym_id:                    gymId,
        member_id:                 member.id,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id:  typeof session.payment_intent === 'string' ? session.payment_intent : null,
        amount_cents:              fee,
        status:                    'pending',
        checkout_url:              session.url,
      })

      results.push({ memberId: member.id, memberName, memberEmail: member.email!, checkoutUrl: session.url, amountCents: fee })
      created++
    } catch (err: unknown) {
      console.error('Bulk-checkout error for member', member.id, err instanceof Error ? err.message : err)
    }
  }

  return NextResponse.json({ count: created, members: results })
}
