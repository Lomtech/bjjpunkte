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

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await (supabase.from('gyms') as any)
    .select('id, stripe_account_id')
    .eq('owner_id', user.id)
    .single()

  const accountId = gym?.stripe_account_id as string | null
  if (!accountId) return NextResponse.json({ error: 'Kein Stripe-Account verbunden' }, { status: 400 })

  const stripe = new Stripe(stripeKey)

  try {
    await stripe.accounts.update(accountId, {
      capabilities: {
        card_payments:       { requested: true },
        transfers:           { requested: true },
        sepa_debit_payments: { requested: true },
      },
    })
  } catch (err: any) {
    console.error('Capability request error:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Fehler beim Anfordern' }, { status: 500 })
  }

  const account = await stripe.accounts.retrieve(accountId)
  const caps = account.capabilities ?? {}
  return NextResponse.json({
    success: true,
    capabilities: {
      card:      caps.card_payments       ?? 'inactive',
      sepa:      caps.sepa_debit_payments ?? 'inactive',
      transfers: caps.transfers           ?? 'inactive',
    },
  })
}
