import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const OUTCOMES = new Set([
  'answered','no_answer','voicemail','interested','not_interested','call_back','wrong_number',
  'sent','replied','bounced','positive','neutral','negative',
])

// PATCH /api/admin/leads/[leadId]/activity/[activityId]
// Edit subject / body / outcome / occurred_at on an existing activity.
// Kind stays fixed (a call remains a call).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; activityId: string }> }) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { id: leadId, activityId } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const update: Record<string, unknown> = {}
  if (typeof body.subject === 'string') update.subject = body.subject.slice(0, 500) || null
  if (typeof body.body === 'string')    update.body    = body.body.slice(0, 5000) || null
  if (typeof body.duration_seconds === 'number') update.duration_seconds = body.duration_seconds
  if (typeof body.occurred_at === 'string') update.occurred_at = body.occurred_at
  if (body.outcome === null) update.outcome = null
  else if (typeof body.outcome === 'string') {
    if (!OUTCOMES.has(body.outcome)) return NextResponse.json({ error: 'invalid outcome' }, { status: 400 })
    update.outcome = body.outcome
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
  }

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sales_activities') as any)
    .update(update)
    .eq('id', activityId)
    .eq('lead_id', leadId) // belongs-to check (defense-in-depth)
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Aktivität nicht gefunden' }, { status: 404 })

  return NextResponse.json({ activity: data })
}

// DELETE /api/admin/leads/[leadId]/activity/[activityId]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; activityId: string }> }) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { id: leadId, activityId } = await params
  const supabase = createServiceClient()

  // Fetch first to know the kind (so we can adjust contact_count)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: act } = await (supabase.from('sales_activities') as any)
    .select('kind').eq('id', activityId).eq('lead_id', leadId).maybeSingle()

  const { error } = await supabase.from('sales_activities')
    .delete().eq('id', activityId).eq('lead_id', leadId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Decrement contact_count if it was a contact-kind
  if (act && ['call','email','sms','whatsapp','meeting','demo'].includes(act.kind)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead } = await (supabase.from('sales_leads') as any)
      .select('contact_count').eq('id', leadId).maybeSingle()
    if (lead && (lead.contact_count ?? 0) > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('sales_leads') as any)
        .update({ contact_count: Math.max(0, (lead.contact_count ?? 0) - 1) })
        .eq('id', leadId)
    }
  }

  return NextResponse.json({ ok: true })
}
