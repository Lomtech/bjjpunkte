import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Generates Stripe Connect Express OAuth URL for a gym owner
export async function GET(req: Request) {
  const clientId = process.env.STRIPE_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bjjpunkte.vercel.app'

  if (!clientId) {
    return NextResponse.json({ error: 'STRIPE_CLIENT_ID nicht konfiguriert' }, { status: 400 })
  }

  // Verify auth
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Get gym id as state (CSRF protection)
  const { data: gym } = await supabase.from('gyms').select('id').single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: `${appUrl}/api/stripe/connect/callback`,
    state: (gym as { id: string }).id,
    'suggested_capabilities[]': 'card_payments',
  })

  const url = `https://connect.stripe.com/express/oauth/authorize?${params}`
  return NextResponse.json({ url })
}

// Disconnect: remove stripe_account_id
export async function DELETE(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  await supabase.from('gyms').update({ stripe_account_id: null }).eq('owner_id', user.id)
  return NextResponse.json({ success: true })
}
