import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const UPDATABLE = new Set([
  'name', 'phone', 'email', 'website', 'instagram_url', 'facebook_url',
  'city', 'notes', 'status', 'priority', 'is_martial_arts', 'sports',
  'next_followup_at', 'assigned_to',
])

const STATUSES = new Set([
  'new','researching','contacted','qualified','demo_scheduled','demo_done',
  'negotiating','won','lost','not_a_fit','do_not_contact',
])

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const update: Record<string, unknown> = {}
  for (const k of Object.keys(body)) {
    if (UPDATABLE.has(k)) update[k] = body[k]
  }
  if (typeof update.status === 'string' && !STATUSES.has(update.status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch current state for activity log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await (supabase.from('sales_leads') as any)
    .select('status, priority').eq('id', id).maybeSingle()

  // Auto-set last_contacted_at if status moves to contacted+
  if (update.status === 'contacted' || update.status === 'qualified' || update.status === 'demo_scheduled') {
    update.last_contacted_at = new Date().toISOString()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sales_leads') as any)
    .update(update).eq('id', id).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 })

  // Activity log on status change
  if (typeof update.status === 'string' && before && before.status !== update.status) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('sales_activities') as any).insert({
      lead_id: id,
      user_id: auth.user.id,
      kind: 'status_change',
      subject: `${before.status} → ${update.status}`,
    })
  }

  return NextResponse.json({ lead: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('sales_leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
