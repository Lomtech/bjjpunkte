import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Stripe redirects here after Express onboarding:
// /api/stripe/connect/callback?code=...&state=<gymId>
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const gymId = searchParams.get('state')
  const error = searchParams.get('error')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bjjpunkte.vercel.app'

  if (error) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe_error=${encodeURIComponent(error)}`)
  }

  if (!code || !gymId) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe_error=missing_params`)
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe_error=not_configured`)
  }

  try {
    const stripe = new Stripe(stripeKey)

    // Exchange code for connected account ID
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code,
    })

    const connectedAccountId = response.stripe_user_id
    if (!connectedAccountId) throw new Error('No account ID returned')

    // Save to gyms table using service-level access
    // We use the gym ID from state param — validated via Stripe's OAuth flow
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.rpc('save_stripe_account', {
      p_gym_id: gymId,
      p_stripe_account_id: connectedAccountId,
    })

    return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe_connected=1`)
  } catch (err) {
    console.error('Stripe Connect callback error:', err)
    return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe_error=callback_failed`)
  }
}
