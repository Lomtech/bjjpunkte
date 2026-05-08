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
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert.' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { gymId, amountCents } = await req.json()
  if (!gymId) return NextResponse.json({ error: 'gymId fehlt' }, { status: 400 })

  const stripe = new Stripe(stripeKey)

  const { data: gymData } = await (supabase.from('gyms') as any)
    .select('id, stripe_account_id, payment_method_types')
    .eq('id', gymId)
    .eq('owner_id', user.id)  // ownership guard
    .single()
  if (!gymData) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })
  const connectedAccountId = gymData?.stripe_account_id
  const platformFeePercent = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? '0') || 0

  // Active members with email, no active subscription — plan_id auch laden,
  // damit wir die korrekte Tarif-Hierarchie auflösen können (override > plan > 0).
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, stripe_customer_id, stripe_subscription_id, monthly_fee_override_cents, plan_id')
    .eq('gym_id', gymId)
    .eq('is_active', true)
    .not('email', 'is', null)

  if (!members || members.length === 0) {
    return NextResponse.json({ count: 0, message: 'Keine aktiven Mitglieder mit E-Mail gefunden.' })
  }

  // Plan-Preise als Map laden — vermeidet N+1 Queries beim fee-Resolve
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plans } = await (supabase.from('membership_plans') as any)
    .select('id, price_cents')
    .eq('gym_id', gymId)
    .eq('is_active', true)
  const planPriceMap = new Map<string, number>(
    (plans ?? []).map((p: { id: string; price_cents: number }) => [p.id, p.price_cents])
  )

  /**
   * Tarif-Hierarchie: Mitglieds-Override > zugewiesener Plan > expliziter
   * `amountCents`-Fallback aus dem Owner-Aufruf > 0.
   * KEIN automatischer Fallback auf `gyms.monthly_fee_cents` — das ist
   * Legacy-Default aus Pre-Plan-Zeiten und ignoriert den Tarif komplett.
   */
  const resolveFee = (m: { monthly_fee_override_cents: number | null; plan_id: string | null }): number => {
    if (m.monthly_fee_override_cents != null) return m.monthly_fee_override_cents
    if (m.plan_id && planPriceMap.has(m.plan_id)) return planPriceMap.get(m.plan_id)!
    if (typeof amountCents === 'number' && amountCents > 0) return amountCents
    return 0
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
  const BATCH_SIZE = 10
  let created = 0
  const results: { memberId: string; memberName: string; memberEmail: string; checkoutUrl: string | null; amountCents: number }[] = []
  const errors: string[] = []

  // Filter eligible members (not paid, no active subscription, fee >= 50)
  const eligibleMembers = members.filter(member => {
    if (paidMemberIds.has(member.id)) return false
    if (member.stripe_subscription_id) return false
    const fee = resolveFee(member)
    if (fee < 50) return false
    return true
  })

  // Reuse existing pending links synchronously — no Stripe call needed
  for (const member of eligibleMembers) {
    const existing = pendingMap.get(member.id)
    if (existing) {
      results.push({ memberId: member.id, memberName: `${member.first_name} ${member.last_name}`, memberEmail: member.email!, checkoutUrl: existing.checkout_url, amountCents: existing.amount_cents })
      created++
    }
  }

  // Members that need a new checkout session
  const needsCheckout = eligibleMembers.filter(m => !pendingMap.has(m.id))

  // Process in batches of 10 — Stripe rate limit friendly
  for (let i = 0; i < needsCheckout.length; i += BATCH_SIZE) {
    const batch = needsCheckout.slice(i, i + BATCH_SIZE)
    await Promise.all(batch.map(async (member) => {
      try {
        const fee = resolveFee(member)

        let customerId = member.stripe_customer_id
        const stripeOpts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined

        // Verify existing customer is on connected account; recreate if not
        if (customerId && connectedAccountId) {
          try {
            await stripe.customers.retrieve(customerId, {}, { stripeAccount: connectedAccountId })
          } catch {
            customerId = null
          }
        }
        if (!customerId) {
          const customer = await stripe.customers.create(
            { email: member.email!, name: `${member.first_name} ${member.last_name}`, metadata: { memberId: member.id, gymId } },
            { ...(stripeOpts ?? {}), idempotencyKey: `customer-${member.id}-${connectedAccountId}` },
          )
          customerId = customer.id
          await supabase.from('members').update({ stripe_customer_id: customerId }).eq('id', member.id)
        }

        const memberName = `${member.first_name} ${member.last_name}`
        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          customer: customerId,
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
          const platformFee = Math.round(fee * platformFeePercent / 100)
          sessionParams.payment_intent_data = {
            ...(platformFee > 0 ? { application_fee_amount: platformFee } : {}),
          }
        }

        // Direct charge: session on connected account so customer is found
        const session = await stripe.checkout.sessions.create(sessionParams, { ...stripeOpts, idempotencyKey: `bulk-${member.id}-${gymId}-${Math.floor(Date.now()/60000)}` })

        const { error: insertError } = await supabase.from('payments').insert({
          gym_id:                    gymId,
          member_id:                 member.id,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id:  typeof session.payment_intent === 'string' ? session.payment_intent : null,
          amount_cents:              fee,
          status:                    'pending',
          checkout_url:              session.url,
        })

        if (insertError) throw insertError

        results.push({ memberId: member.id, memberName, memberEmail: member.email!, checkoutUrl: session.url, amountCents: fee })
        created++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('Bulk-checkout error for member', member.id, msg)
        errors.push(`${member.first_name} ${member.last_name}: ${msg}`)
      }
    }))
  }

  return NextResponse.json({ count: created, members: results, ...(errors.length > 0 ? { errors } : {}) })
}
