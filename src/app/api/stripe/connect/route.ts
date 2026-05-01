import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
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
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms').select('id, email, name, stripe_account_id').single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const gymData = gym as { id: string; email: string | null; name: string; stripe_account_id: string | null }
  const stripe = new Stripe(stripeKey)
  const appUrl = getAppUrl()

  let accountId = gymData.stripe_account_id

  // Create Express account if not yet existing
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'DE',
      email: gymData.email ?? undefined,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { gymId: gymData.id, gymName: gymData.name },
    })
    accountId = account.id
    await supabase.from('gyms').update({ stripe_account_id: accountId }).eq('id', gymData.id)
  }

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
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  await supabase.from('gyms').update({ stripe_account_id: null }).eq('owner_id', user.id)
  return NextResponse.json({ success: true })
}
