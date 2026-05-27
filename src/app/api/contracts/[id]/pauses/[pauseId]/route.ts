import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

// PATCH /api/contracts/[id]/pauses/[pauseId] — Pause beenden (Owner)
// Body: { paused_until: 'YYYY-MM-DD' }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; pauseId: string }> }
) {
  const { id: contractId, pauseId } = await params
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  // Verify Pause gehört zu Owner-Vertrag (RLS würde es auch blocken, aber klare 404)
  const { data: pause } = await supabase
    .from('contract_pauses')
    .select('id, contract_id, gym_id, paused_until')
    .eq('id', pauseId)
    .eq('contract_id', contractId)
    .eq('gym_id', gym.id)
    .maybeSingle()
  if (!pause) return NextResponse.json({ error: 'Pause nicht gefunden' }, { status: 404 })

  const body = await req.json() as { paused_until?: string }
  if (!body.paused_until || !/^\d{4}-\d{2}-\d{2}$/.test(body.paused_until)) {
    return NextResponse.json({ error: 'paused_until muss YYYY-MM-DD sein' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('close_contract_pause', {
    p_pause_id: pauseId,
    p_paused_until: body.paused_until,
    p_user_id: user.id,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('pause_already_closed')) {
      return NextResponse.json({ error: 'Pause ist bereits beendet', code: 'pause_already_closed' }, { status: 409 })
    }
    if (msg.includes('invalid_paused_until')) {
      return NextResponse.json({ error: 'Enddatum darf nicht vor Startdatum liegen', code: 'invalid_paused_until' }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, days_added: data })
}
