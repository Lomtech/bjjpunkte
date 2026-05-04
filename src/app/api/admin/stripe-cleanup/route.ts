import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// ONE-TIME USE: lists or deletes orphaned Stripe connected accounts.
// Protected by CRON_SECRET. DELETE after use.

export async function GET(req: Request) {
  const secret = req.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'No Stripe key' }, { status: 400 })

  const stripe = new Stripe(stripeKey)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get all connected accounts from Stripe
  const accounts = await stripe.accounts.list({ limit: 100 })

  // Get all gym stripe_account_ids from DB
  const { data: gyms } = await supabase.from('gyms').select('stripe_account_id').not('stripe_account_id', 'is', null)
  const activeIds = new Set((gyms ?? []).map((g: any) => g.stripe_account_id))

  const result = accounts.data.map(a => {
    const name = a.business_profile?.name
      || ((a.individual?.first_name || '') + ' ' + (a.individual?.last_name || '')).trim()
      || a.email || '?'
    return {
      id: a.id,
      name,
      email: a.email,
      gymId: a.metadata?.gymId || null,
      charges_enabled: a.charges_enabled,
      details_submitted: a.details_submitted,
      created: a.created ? new Date(a.created * 1000).toISOString().substring(0, 10) : '?',
      in_db: activeIds.has(a.id),
    }
  })

  const orphans = result.filter(a => !a.in_db)
  const active  = result.filter(a => a.in_db)

  return NextResponse.json({ active, orphans, total: result.length })
}

export async function DELETE(req: Request) {
  const secret = req.headers.get('x-admin-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'No Stripe key' }, { status: 400 })

  const stripe = new Stripe(stripeKey)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { ids } = await req.json() as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  // Safety: never delete accounts that are in the DB
  const { data: gyms } = await supabase.from('gyms').select('stripe_account_id').not('stripe_account_id', 'is', null)
  const activeIds = new Set((gyms ?? []).map((g: any) => g.stripe_account_id))

  const results: { id: string; status: string }[] = []

  for (const id of ids) {
    if (activeIds.has(id)) {
      results.push({ id, status: 'skipped — active in DB' })
      continue
    }
    try {
      await stripe.accounts.del(id)
      results.push({ id, status: 'deleted' })
    } catch (err: any) {
      results.push({ id, status: `error: ${err?.message}` })
    }
  }

  return NextResponse.json({ results })
}
