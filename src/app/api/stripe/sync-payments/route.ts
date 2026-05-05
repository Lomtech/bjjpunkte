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

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST /api/stripe/sync-payments
// Fetches all paid Stripe invoices from the connected account and
// inserts any missing records into the payments table.
export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const authed = authClient(accessToken)
  const { data: { user } } = await authed.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Fetch gym + connected account
  const { data: gym } = await authed.from('gyms').select('id, stripe_account_id').single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const connectedAccountId = (gym as any).stripe_account_id as string | null
  if (!connectedAccountId) return NextResponse.json({ error: 'Kein Stripe-Konto verbunden' }, { status: 400 })

  const stripe = new Stripe(stripeKey)
  const supabase = serviceClient()
  const stripeOpts = { stripeAccount: connectedAccountId }

  let inserted   = 0
  let alreadyHad = 0
  let noMemberId = 0
  let startingAfter: string | undefined = undefined

  // Paginate through all paid invoices on the connected account
  while (true) {
    const invoices: Stripe.ApiList<Stripe.Invoice> = await stripe.invoices.list(
      { status: 'paid', limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) },
      stripeOpts,
    )

    for (const inv of invoices.data) {
      const amountCents = inv.amount_paid
      if (amountCents <= 0) { noMemberId++; continue }

      // Extract memberId + gymId — try multiple sources:
      // 1. subscription_details.metadata (newer Stripe API)
      // 2. inv.metadata directly
      // 3. Expand the subscription object to read its metadata
      let meta: Record<string, string> = (inv as any).subscription_details?.metadata ?? inv.metadata ?? {}
      let memberId = meta.memberId as string | undefined
      const gymId  = (meta.gymId as string | undefined) ?? gym.id

      const invSub = (inv as any).subscription
      if (!memberId && invSub && typeof invSub === 'string') {
        try {
          const sub = await stripe.subscriptions.retrieve(invSub, {}, stripeOpts)
          memberId = sub.metadata?.memberId
        } catch { /* non-fatal */ }
      }

      // Last fallback: match by Stripe customer ID stored on the member
      if (!memberId) {
        const customerId = typeof (inv as any).customer === 'string' ? (inv as any).customer as string : null
        if (customerId) {
          const { data: memberByCustomer } = await supabase
            .from('members')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .eq('gym_id', gym.id)
            .single()
          memberId = (memberByCustomer as any)?.id
        }
      }

      if (!memberId) { noMemberId++; continue }

      const paymentIntentId = typeof (inv as any).payment_intent === 'string'
        ? (inv as any).payment_intent as string
        : null

      // Check if already recorded (by payment_intent or by invoice id in description)
      let exists = false
      if (paymentIntentId) {
        const { data } = await supabase
          .from('payments')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .limit(1)
        exists = !!(data && data.length > 0)
      }
      if (!exists) {
        // Also check by member + amount + date (±1 day) to avoid duplicates without payment_intent
        const paidAt  = inv.status_transitions?.paid_at
          ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
          : new Date().toISOString()
        const dayBefore = new Date(new Date(paidAt).getTime() - 86_400_000).toISOString()
        const dayAfter  = new Date(new Date(paidAt).getTime() + 86_400_000).toISOString()
        const { data: nearby } = await supabase
          .from('payments')
          .select('id')
          .eq('member_id', memberId)
          .eq('amount_cents', amountCents)
          .eq('status', 'paid')
          .gte('paid_at', dayBefore)
          .lte('paid_at', dayAfter)
          .limit(1)
        exists = !!(nearby && nearby.length > 0)
      }

      if (exists) { alreadyHad++; continue }

      // Insert missing payment record — also fetch member name for future-proofing
      const paidAt = inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
        : new Date().toISOString()

      const { data: mRow } = await supabase.from('members').select('first_name, last_name').eq('id', memberId).single()
      const memberName = mRow ? `${(mRow as any).first_name} ${(mRow as any).last_name}` : null

      await (supabase.from('payments') as any).insert({
        gym_id:                   gymId,
        member_id:                memberId,
        member_name:              memberName,
        amount_cents:             amountCents,
        status:                   'paid',
        paid_at:                  paidAt,
        stripe_payment_intent_id: paymentIntentId,
      })
      inserted++
    }

    if (!invoices.has_more) break
    startingAfter = invoices.data[invoices.data.length - 1].id
  }

  return NextResponse.json({ success: true, inserted, alreadyHad, noMemberId })
}
