import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

const KINDS = new Set(['call','email','sms','whatsapp','meeting','demo','note','followup_scheduled'])
const OUTCOMES = new Set([
  'answered','no_answer','voicemail','interested','not_interested','call_back','wrong_number',
  'sent','replied','bounced','positive','neutral','negative',
])

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sales_activities')
    .select('*')
    .eq('lead_id', id)
    .order('occurred_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activities: data ?? [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const kind = typeof body.kind === 'string' ? body.kind : ''
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'invalid kind' }, { status: 400 })

  const outcome = typeof body.outcome === 'string' ? body.outcome : null
  if (outcome && !OUTCOMES.has(outcome)) return NextResponse.json({ error: 'invalid outcome' }, { status: 400 })

  const supabase = createServiceClient()
  const insert = {
    lead_id: id,
    user_id: auth.user.id,
    kind,
    outcome,
    subject: typeof body.subject === 'string' ? body.subject.slice(0, 500) : null,
    body: typeof body.body === 'string' ? body.body.slice(0, 5000) : null,
    duration_seconds: typeof body.duration_seconds === 'number' ? body.duration_seconds : null,
    occurred_at: typeof body.occurred_at === 'string' ? body.occurred_at : new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sales_activities') as any).insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bump lead's contact_count + last_contacted_at on contact-kinds
  if (['call','email','sms','whatsapp','meeting','demo'].includes(kind)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead } = await (supabase.from('sales_leads') as any)
      .select('contact_count').eq('id', id).maybeSingle()
    const next = (lead?.contact_count ?? 0) + 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('sales_leads') as any).update({
      contact_count: next,
      last_contacted_at: new Date().toISOString(),
    }).eq('id', id)
  }

  return NextResponse.json({ activity: data }, { status: 201 })
}
