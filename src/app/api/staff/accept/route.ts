import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return new Response('Ungültiger Link', { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: staff } = await supabase
    .from('gym_staff')
    .select('*, gyms(name)')
    .eq('invite_token', token)
    .single()

  if (!staff) return new Response('Link ungültig oder abgelaufen', { status: 404 })
  if (staff.accepted_at) {
    return NextResponse.redirect(new URL('/login?trainer=1', req.url))
  }

  return NextResponse.redirect(new URL(`/staff/accept?token=${token}`, req.url))
}
