import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  // Require authentication — this endpoint reveals infrastructure details
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const configured = !!process.env.STRIPE_SECRET_KEY

  let webhookActive = false
  if (configured) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const webhookUrl = `${appUrl}/api/stripe/webhook`
      const { data: endpoints } = await stripe.webhookEndpoints.list({ limit: 20 })
      webhookActive = endpoints.some(e => e.url === webhookUrl && e.status === 'enabled')
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    configured,
    clientId: !!process.env.STRIPE_CLIENT_ID,
    webhookActive,
  })
}
