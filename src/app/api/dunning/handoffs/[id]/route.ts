import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// PATCH /api/dunning/handoffs/[id]
// Owner setzt Status-Übergänge: initiated -> pdf_exported -> sent_to_provider
//   -> accepted / rejected / paid / written_off / closed
//
// Body: { status, reference_id?, notes?, provider_response? }
//
// Pattern: cookie auth via @/lib/supabase/server, service-role für Schreibops
// nach Owner-Verify.

export const dynamic = 'force-dynamic'

const VALID_STATUS = new Set([
  'initiated', 'pdf_exported', 'sent_to_provider',
  'accepted', 'rejected', 'paid', 'written_off', 'closed',
])

// Timestamps die automatisch beim Status-Wechsel gesetzt werden
const STATUS_TO_TIMESTAMP_COL: Record<string, string | null> = {
  pdf_exported:     'exported_at',
  sent_to_provider: 'sent_at',
  accepted:         'accepted_at',
  rejected:         null,
  paid:             null,
  written_off:      null,
  closed:           'closed_at',
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Kein Gym' }, { status: 404 })

  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: handoff } = await (service.from('dunning_handoffs') as any)
    .select('id, gym_id, status').eq('id', id).maybeSingle()
  if (!handoff || handoff.gym_id !== gym.id) {
    return NextResponse.json({ error: 'Übergabe nicht gefunden' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const status = typeof body.status === 'string' ? body.status : ''
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({
      error: `status muss einer von: ${Array.from(VALID_STATUS).join(', ')}`,
    }, { status: 400 })
  }

  const nowIso = new Date().toISOString()
  const update: Record<string, unknown> = {
    status,
    last_status_change_at: nowIso,
  }
  const tsCol = STATUS_TO_TIMESTAMP_COL[status]
  if (tsCol) update[tsCol] = nowIso

  if (typeof body.reference_id === 'string') {
    update.reference_id = body.reference_id.slice(0, 200)
  }
  if (typeof body.notes === 'string') {
    update.notes = body.notes.slice(0, 5000)
  }
  if (body.provider_response && typeof body.provider_response === 'object') {
    update.provider_response = body.provider_response
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (service.from('dunning_handoffs') as any)
    .update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, handoff: updated })
}
