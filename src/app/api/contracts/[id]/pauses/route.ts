import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, PauseReason } from '@/types/database'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

const VALID_REASONS: PauseReason[] = ['injury', 'travel', 'financial', 'other']

// POST /api/contracts/[id]/pauses — Pause starten (Owner)
// Body: { paused_from: 'YYYY-MM-DD', reason: PauseReason, reason_note?: string, extends_contract?: boolean }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: contractId } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = authClient(auth.token)
  const gym = auth.gym

  // RLS prüft auch via Contract-Lookup, aber wir wollen klare 404
  const { data: contract } = await supabase
    .from('member_contracts')
    .select('id, gym_id, status')
    .eq('id', contractId)
    .eq('gym_id', gym.id)
    .maybeSingle()
  if (!contract) return NextResponse.json({ error: 'Vertrag nicht gefunden' }, { status: 404 })

  const body = await req.json() as {
    paused_from?: string
    reason?: string
    reason_note?: string | null
    extends_contract?: boolean
  }

  if (!body.paused_from || !/^\d{4}-\d{2}-\d{2}$/.test(body.paused_from)) {
    return NextResponse.json({ error: 'paused_from muss YYYY-MM-DD sein' }, { status: 400 })
  }
  if (!body.reason || !VALID_REASONS.includes(body.reason as PauseReason)) {
    return NextResponse.json({ error: `reason muss eines sein von: ${VALID_REASONS.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('start_contract_pause', {
    p_contract_id: contractId,
    p_paused_from: body.paused_from,
    p_reason: body.reason as PauseReason,
    p_role: 'owner',
    p_reason_note: body.reason_note ?? null,
    p_extends_contract: body.extends_contract ?? true,
    p_user_id: auth.user.id,
  })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('open_pause_exists')) {
      return NextResponse.json({ error: 'Es gibt bereits eine offene Pause für diesen Vertrag', code: 'open_pause_exists' }, { status: 409 })
    }
    if (msg.includes('contract_not_active')) {
      return NextResponse.json({ error: 'Vertrag ist nicht aktiv', code: 'contract_not_active' }, { status: 409 })
    }
    if (msg.includes('contract_not_found')) {
      return NextResponse.json({ error: 'Vertrag nicht gefunden', code: 'contract_not_found' }, { status: 404 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true, pause_id: data })
}
