import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, CommunicationMethod } from '@/types/database'

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

// POST /api/contracts/[id]/terminations/[tid] — Action auf bestehender Termination
// Body: { action: 'accept'|'reject'|'withdraw', rejected_reason?: string, communication_method?: CommunicationMethod }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; tid: string }> }
) {
  const { id: contractId, tid: terminationId } = await params
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  // Verify Termination gehört zum Owner-Vertrag
  const { data: termination } = await supabase
    .from('contract_terminations')
    .select('id, contract_id, gym_id, status')
    .eq('id', terminationId)
    .eq('contract_id', contractId)
    .eq('gym_id', gym.id)
    .maybeSingle()
  if (!termination) return NextResponse.json({ error: 'Kündigung nicht gefunden' }, { status: 404 })

  const body = await req.json() as {
    action?: string
    rejected_reason?: string
    communication_method?: string
  }

  const action = body.action
  if (action !== 'accept' && action !== 'reject' && action !== 'withdraw') {
    return NextResponse.json({ error: "action muss 'accept', 'reject' oder 'withdraw' sein" }, { status: 400 })
  }

  let rpcResult
  if (action === 'accept') {
    const method = (body.communication_method === 'email' || body.communication_method === 'manual')
      ? (body.communication_method as CommunicationMethod)
      : 'portal' as CommunicationMethod
    rpcResult = await supabase.rpc('accept_contract_termination', {
      p_termination_id: terminationId,
      p_user_id: user.id,
      p_communication_method: method,
    })
  } else if (action === 'reject') {
    if (!body.rejected_reason || body.rejected_reason.trim().length < 3) {
      return NextResponse.json({ error: 'rejected_reason muss mindestens 3 Zeichen haben' }, { status: 400 })
    }
    rpcResult = await supabase.rpc('reject_contract_termination', {
      p_termination_id: terminationId,
      p_rejected_reason: body.rejected_reason.trim(),
      p_user_id: user.id,
    })
  } else {
    rpcResult = await supabase.rpc('withdraw_contract_termination', {
      p_termination_id: terminationId,
      p_user_id: user.id,
    })
  }

  if (rpcResult.error) {
    const msg = rpcResult.error.message ?? ''
    if (msg.includes('termination_not_pending')) {
      return NextResponse.json({ error: 'Kündigung ist bereits beendet', code: 'termination_not_pending' }, { status: 409 })
    }
    if (msg.includes('rejected_reason_required')) {
      return NextResponse.json({ error: 'rejected_reason muss angegeben werden', code: 'rejected_reason_required' }, { status: 400 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action })
}
