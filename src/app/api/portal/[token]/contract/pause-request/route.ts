import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, PauseReason } from '@/types/database'

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const VALID_REASONS: PauseReason[] = ['injury', 'travel', 'financial', 'other']

// POST /api/portal/[token]/contract/pause-request
// Member-Initiated Pause-Antrag — startet direkt eine Pause (Owner kann sie in Admin abbrechen).
// Body: { paused_from: 'YYYY-MM-DD', reason: PauseReason, reason_note?: string }
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

  // Aktiven Vertrag finden
  const { data: contract } = await supabase
    .from('member_contracts')
    .select('id, status')
    .eq('member_id', member.id)
    .in('status', ['active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!contract) {
    return NextResponse.json({ error: 'Kein aktiver Vertrag — nichts zu pausieren' }, { status: 404 })
  }

  const body = await req.json() as {
    paused_from?: string
    reason?: string
    reason_note?: string | null
  }

  if (!body.paused_from || !/^\d{4}-\d{2}-\d{2}$/.test(body.paused_from)) {
    return NextResponse.json({ error: 'paused_from muss YYYY-MM-DD sein' }, { status: 400 })
  }
  if (!body.reason || !VALID_REASONS.includes(body.reason as PauseReason)) {
    return NextResponse.json({ error: `reason muss eines sein von: ${VALID_REASONS.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('start_contract_pause', {
    p_contract_id: (contract as { id: string }).id,
    p_paused_from: body.paused_from,
    p_reason: body.reason as PauseReason,
    p_role: 'member',
    p_reason_note: body.reason_note ?? null,
    p_extends_contract: true,
    p_user_id: null,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('open_pause_exists')) {
      return NextResponse.json({ error: 'Es gibt bereits eine offene Pause', code: 'open_pause_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, pause_id: data })
}
