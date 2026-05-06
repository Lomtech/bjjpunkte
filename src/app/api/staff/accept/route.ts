import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return new Response('Ungültiger Link', { status: 400 })

  // Reject malformed tokens early — prevents brute-force and odd inputs
  if (token.length < 20 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return new Response('Link ungültig', { status: 400 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: staff } = await supabase
    .from('gym_staff')
    .select('*, gyms(name)')
    .eq('invite_token', token)
    .single()

  if (!staff) return new Response('Link ungültig oder abgelaufen', { status: 404 })

  // Use canonical app URL — never req.url (Host-Header injection → open redirect)
  const base = getAppUrl()
  const target = staff.accepted_at
    ? new URL('/login?trainer=1', base)
    : new URL(`/staff/accept?token=${encodeURIComponent(token)}`, base)
  return NextResponse.redirect(target)
}
