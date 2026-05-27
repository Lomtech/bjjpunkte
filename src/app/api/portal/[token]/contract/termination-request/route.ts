import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, TerminationKind, TerminationReasonCategory } from '@/types/database'

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const VALID_CATEGORIES: TerminationReasonCategory[] = [
  'moved','injury','financial','dissatisfaction','medical','contract_breach','other'
]

// POST /api/portal/[token]/contract/termination-request
// Member-Initiated Kündigungsantrag — geht in pending-Status, Owner muss in Admin accept/reject.
// Body: { termination_kind: 'regular'|'special_right', reason_text: string, effective_date: 'YYYY-MM-DD', reason_category?: TerminationReasonCategory }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token || token.length < 32 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const supabase = serviceClient()
  const { data: member, error: memberErr } = await supabase
    .from('members')
    .select('id, gym_id, is_active')
    .eq('portal_token', token)
    .eq('is_active', true)
    .single()
  if (memberErr || !member) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  const { data: contract } = await supabase
    .from('member_contracts')
    .select('id, status')
    .eq('member_id', member.id)
    .in('status', ['active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!contract) {
    return NextResponse.json({ error: 'Kein laufender Vertrag' }, { status: 404 })
  }

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
    return NextResponse.json({ error: 'Begründung mit mindestens 3 Zeichen erforderlich' }, { status: 400 })
  }
  if (!body.effective_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.effective_date)) {
    return NextResponse.json({ error: 'effective_date muss YYYY-MM-DD sein' }, { status: 400 })
  }
  const category = body.reason_category && VALID_CATEGORIES.includes(body.reason_category as TerminationReasonCategory)
    ? (body.reason_category as TerminationReasonCategory)
    : null

  const { data, error } = await supabase.rpc('request_contract_termination', {
    p_contract_id: (contract as { id: string }).id,
    p_requested_by_role: 'member',
    p_termination_kind: body.termination_kind as TerminationKind,
    p_reason_text: body.reason_text.trim(),
    p_effective_date: body.effective_date,
    p_reason_category: category,
    p_user_id: null,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('termination_already_pending')) {
      return NextResponse.json({ error: 'Es gibt bereits eine offene Kündigung', code: 'termination_already_pending' }, { status: 409 })
    }
    if (msg.includes('contract_not_terminable')) {
      return NextResponse.json({ error: 'Vertrag kann nicht gekündigt werden', code: 'contract_not_terminable' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, termination_id: data })
}
