import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function GET(req: Request) {
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
