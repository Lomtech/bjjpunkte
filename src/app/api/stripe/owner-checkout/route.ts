import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'
import type { Database } from '@/types/database'
import { STANDARD_TIER, FREE_TRIAL_DAYS, type PlanKey } from '@/lib/pricing'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

// Single-source-of-truth: pricing comes from src/lib/pricing.ts.
// 2026-05 single-tier model: Standard 49 €/Mo monthly · 39 €/Mo annual.
// 14-day trial via subscription_data.trial_period_days, no card required up-front.
const PLAN_PRICE_MONTHLY = STANDARD_TIER.monthlyCents
// Annual = 39 €/Mo × 12 = 468 €/year. Stripe charges full year upfront.
const PLAN_PRICE_ANNUAL  = STANDARD_TIER.annualMonthlyCents * 12

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Accept only the single 'standard' plan. `plan` is kept in the body for
  // forward-compatibility (future tiers) but currently only validates one value.
  const { plan = 'standard', annual = false } = await req.json()
  if (plan !== 'standard') return NextResponse.json({ error: 'Ungültiger Plan' }, { status: 400 })
  const planKey: PlanKey = 'standard'

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms')
    .select('id, name, email, osss_stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const stripe = new Stripe(stripeKey)
  const appUrl = getAppUrl()

  // Ensure a Stripe customer exists for this gym owner BEFORE creating the session.
  // This makes the customer ID available immediately — no webhook dependency.
  let customerId = gym.osss_stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? gym.email ?? undefined,
      name: gym.name,
      metadata: { gymId: gym.id, ownerId: user.id },
    })
    customerId = customer.id
    // Persist immediately — portal works even if webhook is delayed/fails
    await supabase.from('gyms').update({ osss_stripe_customer_id: customerId }).eq('id', gym.id)
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer:  customerId,
      mode:      'subscription',
      line_items: [{
        price_data: {
          currency:     'eur',
          product_data: { name: annual ? `${STANDARD_TIER.name} (Jährlich)` : `${STANDARD_TIER.name} Plan` },
          recurring:    { interval: annual ? 'year' : 'month' },
          unit_amount:  annual ? PLAN_PRICE_ANNUAL : PLAN_PRICE_MONTHLY,
        },
        quantity: 1,
      }],
      metadata: { type: 'owner_plan', gymId: gym.id, plan: planKey, billing: annual ? 'annual' : 'monthly' },
      subscription_data: {
        metadata: { type: 'owner_plan', gymId: gym.id, plan: planKey, billing: annual ? 'annual' : 'monthly' },
        // 14-Tage-Trial. Stripe rechnet erst nach Trial-Ende ab. Studios können
        // ohne Kreditkarte starten (siehe payment_method_collection unten).
        trial_period_days: FREE_TRIAL_DAYS,
        trial_settings: {
          end_behavior: { missing_payment_method: 'cancel' },
        },
      },
      // Keine Kreditkarte zwingend — Stripe kassiert nur ab wenn auf bezahltes
      // Abo upgegradet wird. Das match'd die Marketing-Versprechen
      // "ohne Kreditkarte testen".
      payment_method_collection: 'if_required',
      // Audit 2026-05-13: Lifetime-Pilot-Discount (PILOT10) entfernt — Studios
      // bezahlen den Standard-Tarif. Wir lassen allow_promotion_codes trotzdem
      // an, damit zukünftige Werbe-Codes ohne Code-Änderung funktionieren.
      allow_promotion_codes: true,
      // Stripe Tax handles EU B2B reverse-charge automatically once the customer
      // provides a valid USt-IdNr / VAT-ID. Without this we'd ship plain 19% DE
      // VAT to all studios — the first Austrian studio with a valid ATU... ID
      // would demand a corrected invoice and we'd have to write it manually.
      // Requires Stripe Tax to be enabled in the Dashboard (Settings → Tax).
      automatic_tax: { enabled: true },
      // Auto-collect address + tax-ID from the checkout form.
      tax_id_collection: { enabled: true },
      customer_update: {
        address: 'auto',
        name:    'auto',
      },
      // Localise checkout language — Stripe also uses this for tax-display copy.
      locale: 'de',
      success_url: `${appUrl}/dashboard/settings?upgraded=1`,
      cancel_url:  `${appUrl}/dashboard/settings`,
    }, { idempotencyKey: `owner-checkout-${gym.id}-${Math.floor(Date.now()/60000)}` })
    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Stripe-Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
