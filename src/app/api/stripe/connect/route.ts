import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'
import { getCachedUser } from '@/lib/auth/cached-user'

// Sprint D 2026-05-30: getCachedUser für Auth-Cache (Owner-Gym braucht
// stripe_account_id direkt — wir holen es inline statt CachedGym, da
// stripe_account_id Update-Flow das Cache invalidieren müsste)

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

// Returns the Stripe Connect account status (charges_enabled, payouts_enabled)
export async function GET(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const user = await getCachedUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase
    .from('gyms')
    .select('stripe_account_id')
    .eq('owner_id', user.id)
    .maybeSingle()
  const accountId = (gym as { stripe_account_id: string | null } | null)?.stripe_account_id ?? null
  if (!accountId) return NextResponse.json({ connected: false })

  try {
    const stripe = new Stripe(stripeKey)
    const account = await stripe.accounts.retrieve(accountId)
    const caps = account.capabilities ?? {}
    return NextResponse.json({
      connected: true,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      capabilities: {
        card:      caps.card_payments       ?? 'inactive',
        sepa:      caps.sepa_debit_payments ?? 'inactive',
        transfers: caps.transfers           ?? 'inactive',
      },
    })
  } catch {
    return NextResponse.json({ connected: false })
  }
}

// Creates a Stripe Express account for the gym + returns onboarding link
// No STRIPE_CLIENT_ID needed — account is created programmatically
export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const user = await getCachedUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase
    .from('gyms')
    .select('id, email, name, stripe_account_id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const gymData = gym as { id: string; email: string | null; name: string; stripe_account_id: string | null }
  const stripe = new Stripe(stripeKey)
  const appUrl = getAppUrl()

  let accountId = gymData.stripe_account_id

  // Create Express account if not yet existing
  // Note: previous version called stripe.accounts.list({ limit: 100 }) for dedup —
  // unusable beyond 100 platform accounts. If a gym disconnected previously, the old
  // Stripe account is orphaned (Stripe doesn't delete it; manual cleanup required).
  if (!accountId) {
    const account = await stripe.accounts.create(
      {
        type: 'express',
        country: 'DE',
        email: gymData.email ?? undefined,
        business_type: 'individual',
        capabilities: {
          card_payments:       { requested: true },
          transfers:           { requested: true },
          sepa_debit_payments: { requested: true },
        },
        metadata: { gymId: gymData.id, gymName: gymData.name },
      },
      { idempotencyKey: `connect-account-${gymData.id}` },
    )
    accountId = account.id
    await supabase.from('gyms').update({ stripe_account_id: accountId }).eq('id', gymData.id)
  } else {
    // For existing accounts: request additional capabilities that may be missing
    try {
      await stripe.accounts.update(
        accountId,
        {
          capabilities: {
            card_payments:       { requested: true },
            transfers:           { requested: true },
            sepa_debit_payments: { requested: true },
          },
        },
        { idempotencyKey: `connect-account-update-${gymData.id}-${accountId}` },
      )
    } catch { /* non-fatal */ }
  }

  // Auto-enable SEPA on the connected account's payment method configuration.
  // This avoids the gym owner having to manually activate it in Stripe Dashboard.
  // Only possible after the capability is approved — non-fatal if it fails.
  try {
    const configs = await stripe.paymentMethodConfigurations.list(
      {},
      { stripeAccount: accountId },
    )
    const configId = configs.data[0]?.id
    if (configId) {
      await stripe.paymentMethodConfigurations.update(
        configId,
        { sepa_debit: { display_preference: { preference: 'on' } } },
        { stripeAccount: accountId },
      )
    }
  } catch { /* non-fatal — capability may not yet be approved */ }

  // Generate onboarding link (or re-onboard if incomplete)
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/dashboard/settings?stripe_error=refresh`,
    return_url:  `${appUrl}/dashboard/settings?stripe_connected=1`,
    type: 'account_onboarding',
  })

  return NextResponse.json({ url: link.url })
}

// Disconnect: remove stripe_account_id
export async function DELETE(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const user = await getCachedUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  await supabase.from('gyms').update({ stripe_account_id: null }).eq('owner_id', user.id)
  return NextResponse.json({ success: true })
}
