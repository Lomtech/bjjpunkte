import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { verifyOAuthState } from '@/lib/oauth-state'

// Stripe redirects here after Express onboarding (legacy OAuth flow):
// /api/stripe/connect/callback?code=...&state=<signedState>
//
// NOTE: The primary Connect flow uses programmatic account creation
// (POST /api/stripe/connect) which does NOT use this callback.
// This route exists for compatibility with the OAuth flow.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code       = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const error      = searchParams.get('error')
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.osss.pro'

  if (error) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe_error=${encodeURIComponent(error)}`)
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe_error=missing_params`)
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe_error=not_configured`)
  }

  // ── CSRF guard: verify HMAC-signed state ────────────────────────────────────
  let gymId: string
  try {
    gymId = await verifyOAuthState(stateParam)
  } catch {
    console.error('Stripe Connect callback: invalid state signature')
    return NextResponse.redirect(`${appUrl}/dashboard/settings?stripe_error=invalid_state`)
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

    // Save to gyms table using service-level access — gymId is now verified via HMAC
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!  // service role required for RPC
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
