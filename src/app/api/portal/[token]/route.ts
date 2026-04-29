import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Uses anon key + SECURITY DEFINER RPC — no service role needed
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 10) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const supabase = anonClient()
  const { data, error } = await supabase.rpc('get_member_portal', { p_token: token })

  if (error || !data) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  // Map snake_case from Postgres to camelCase expected by frontend
  const d = data as {
    member: object; gym: object
    attendance: object[]; total_sessions: number
    payments: object[]; total_paid_cents: number
  }

  return NextResponse.json({
    member:         d.member,
    gym:            d.gym,
    attendance:     d.attendance ?? [],
    totalSessions:  d.total_sessions ?? 0,
    payments:       d.payments ?? [],
    totalPaidCents: d.total_paid_cents ?? 0,
  })
}
