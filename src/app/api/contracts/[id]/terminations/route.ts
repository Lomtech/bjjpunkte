import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, TerminationKind, TerminationReasonCategory } from '@/types/database'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

const VALID_CATEGORIES: TerminationReasonCategory[] = [
  'moved','injury','financial','dissatisfaction','medical','contract_breach','other'
]

// POST /api/contracts/[id]/terminations — Owner stößt Kündigung an
// Body: { termination_kind: 'regular'|'special_right', reason_text: string, effective_date: 'YYYY-MM-DD', reason_category?: TerminationReasonCategory }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = authClient(auth.token)
  const gym = auth.gym

  const { data: contract } = await supabase
    .from('member_contracts').select('id, gym_id').eq('id', contractId).eq('gym_id', gym.id).maybeSingle()
  if (!contract) return NextResponse.json({ error: 'Vertrag nicht gefunden' }, { status: 404 })

  const body = await req.json() as {
    termination_kind?: string
    reason_text?: string
    effective_date?: string
    reason_category?: string
  }

  if (body.termination_kind !== 'regular' && body.termination_kind !== 'special_right') {
    return NextResponse.json({ error: "termination_kind muss 'regular' oder 'special_right' sein" }, { status: 400 })
  }
  if (!body.reason_text || body.reason_text.trim().length < 3) {
    return NextResponse.json({ error: 'reason_text muss mindestens 3 Zeichen haben' }, { status: 400 })
  }
  if (!body.effective_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.effective_date)) {
    return NextResponse.json({ error: 'effective_date muss YYYY-MM-DD sein' }, { status: 400 })
  }
  const category = body.reason_category && VALID_CATEGORIES.includes(body.reason_category as TerminationReasonCategory)
    ? (body.reason_category as TerminationReasonCategory)
    : null

  const { data, error } = await supabase.rpc('request_contract_termination', {
    p_contract_id: contractId,
    p_requested_by_role: 'owner',
    p_termination_kind: body.termination_kind as TerminationKind,
    p_reason_text: body.reason_text.trim(),
    p_effective_date: body.effective_date,
    p_reason_category: category,
    p_user_id: auth.user.id,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('termination_already_pending')) {
      return NextResponse.json({ error: 'Es gibt bereits eine offene Kündigung für diesen Vertrag', code: 'termination_already_pending' }, { status: 409 })
    }
    if (msg.includes('contract_not_terminable')) {
      return NextResponse.json({ error: 'Vertrag kann nicht gekündigt werden (bereits gekündigt/beendet)', code: 'contract_not_terminable' }, { status: 409 })
    }
    if (msg.includes('contract_not_found')) {
      return NextResponse.json({ error: 'Vertrag nicht gefunden', code: 'contract_not_found' }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, termination_id: data })
}
