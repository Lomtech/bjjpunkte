import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { cronGuard } from '@/lib/cron-guard'
import type { Database } from '@/types/database'

/**
 * Sub 0014e: Wendet fällige plan_price_changes an.
 *
 * Für jede Erhöhung mit applied_at IS NULL AND effective_date <= today:
 *   1. Erstelle neue Stripe-Price-Ressource (immutable history)
 *   2. Update alle aktiven Subscriptions für betroffene Members auf neue Price
 *      (proration_behavior: 'none' — Member zahlt neuen Preis ab nächstem Zyklus)
 *   3. Update member_contracts.monthly_fee_cents für betroffene Verträge
 *   4. Markiere price_change.applied_at + stripe_price_id_new
 *
 * Bei Fehler: apply_error + apply_attempts++, kein applied_at.
 * Schedule: täglich 04:00 (siehe vercel.json).
 */
export async function GET(req: Request) {
  const guard = cronGuard(req)
  if (guard) return guard

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  const todayIso = new Date().toISOString().slice(0, 10)

  const { data: due, error: dueErr } = await supabase
    .from('plan_price_changes')
    .select('id, gym_id, plan_id, new_price_cents, apply_attempts')
    .is('applied_at', null)
    .lte('effective_date', todayIso)
    .limit(50)

  if (dueErr) {
    console.error('[cron apply-price-changes] fetch error:', dueErr.message)
    return NextResponse.json({ error: dueErr.message }, { status: 500 })
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  let processed = 0
  let failed = 0

  for (const pc of due) {
    try {
      // Plan + Gym laden für Stripe-Connect Context
      const { data: plan } = await supabase
        .from('membership_plans')
        .select('id, name, billing_interval, stripe_product_id, stripe_price_id')
        .eq('id', pc.plan_id)
        .single()
      const { data: gym } = await supabase
        .from('gyms')
        .select('id, name')
        .eq('id', pc.gym_id)
        .single()
      if (!plan || !gym) {
        await markFailed(supabase, pc.id, pc.apply_attempts, 'plan_or_gym_missing')
        failed++
        continue
      }
      const planRow = plan as { stripe_product_id: string | null; billing_interval: string; name: string }
      if (!planRow.stripe_product_id) {
        await markFailed(supabase, pc.id, pc.apply_attempts, 'no_stripe_product')
        failed++
        continue
      }

      // 1. Neue Stripe-Price erstellen (immutable history)
      const interval: Stripe.Price.Recurring.Interval =
        planRow.billing_interval === 'year' ? 'year' : 'month'
      const newPrice = await stripe.prices.create({
        unit_amount: pc.new_price_cents,
        currency: 'eur',
        recurring: { interval },
        product: planRow.stripe_product_id,
        nickname: `${planRow.name} — ${new Date().toISOString().slice(0, 10)}`,
      })

      // 2. Alle aktiven Subscriptions auf neuen Preis migrieren
      // Members mit dem Plan + aktiver Stripe-Subscription holen
      const { data: members } = await supabase
        .from('members')
        .select('id, stripe_subscription_id')
        .eq('plan_id', pc.plan_id)
        .eq('gym_id', pc.gym_id)
        .not('stripe_subscription_id', 'is', null)
      const memberRows = (members ?? []) as Array<{ id: string; stripe_subscription_id: string | null }>

      let subUpdates = 0
      for (const m of memberRows) {
        if (!m.stripe_subscription_id) continue
        try {
          const sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id)
          const itemId = sub.items.data[0]?.id
          if (!itemId) continue
          await stripe.subscriptions.update(m.stripe_subscription_id, {
            items: [{ id: itemId, price: newPrice.id }],
            proration_behavior: 'none',
          })
          subUpdates++
        } catch (e) {
          console.error(`[cron apply-price-changes] sub-update failed for member ${m.id}:`, e)
        }
      }

      // 3. member_contracts.monthly_fee_cents für alle betroffenen Verträge updaten
      await supabase
        .from('member_contracts')
        .update({ monthly_fee_cents: pc.new_price_cents })
        .eq('plan_id', pc.plan_id)
        .eq('gym_id', pc.gym_id)
        .in('status', ['active', 'paused', 'cancelled_pending'])

      // 4. Plan selber auch updaten (neue Default-Price)
      await supabase
        .from('membership_plans')
        .update({ price_cents: pc.new_price_cents, stripe_price_id: newPrice.id })
        .eq('id', pc.plan_id)

      // 5. price_change markieren
      await supabase
        .from('plan_price_changes')
        .update({
          applied_at: new Date().toISOString(),
          stripe_price_id_new: newPrice.id,
          apply_error: null,
          notification_count: subUpdates,
        })
        .eq('id', pc.id)

      processed++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await markFailed(supabase, pc.id, pc.apply_attempts, msg)
      failed++
    }
  }

  return NextResponse.json({ ok: true, processed, failed, total: due.length })
}

async function markFailed(
  supabase: ReturnType<typeof createClient<Database>>,
  priceChangeId: string,
  attempts: number,
  errorMsg: string,
) {
  await supabase
    .from('plan_price_changes')
    .update({
      apply_attempts: attempts + 1,
      apply_error: errorMsg.slice(0, 500),
    })
    .eq('id', priceChangeId)
}
