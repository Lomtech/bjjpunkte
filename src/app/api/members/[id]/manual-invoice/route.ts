import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/members/[id]/manual-invoice
//
// Sprint 2026-05-27: Privattraining + Ad-Hoc-Rechnungen.
// Owner erfasst manuell eine Rechnung für ein Mitglied (z.B. 1:1-Training,
// Sondertraining, Lehrgang). Nicht von Stripe-Webhook getrieben, sondern
// vom Owner direkt eingegeben.
//
// Body:
//   { amount_cents, description, due_date?, paid?: boolean }
//
// Auth: Bearer-Token. Owner muss zum Gym des Members gehören.
//
// Side-Effects:
//   - INSERT payments mit kind='one_off', auto-generated invoice_number via RPC.
//   - Status default 'pending' (= soll-Rechnung), oder 'paid' wenn Owner sagt
//     dass Member schon bar bezahlt hat.
//   - PDF kann später unter /api/invoices/{paymentId} abgerufen werden.

export const dynamic = 'force-dynamic'

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = getSupabase(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase
    .from('gyms').select('id, name').eq('owner_id', user.id).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase.from('members') as any)
    .select('id, gym_id, first_name, last_name').eq('id', memberId).maybeSingle()
  if (!member || member.gym_id !== gym.id) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const amount_cents = typeof body.amount_cents === 'number' && body.amount_cents > 0
    ? Math.floor(body.amount_cents) : null
  const description = typeof body.description === 'string' ? body.description.slice(0, 500).trim() : ''
  const due_date = typeof body.due_date === 'string' ? body.due_date.slice(0, 10) : null
  const paid = body.paid === true

  if (!amount_cents) return NextResponse.json({ error: 'amount_cents > 0 erforderlich' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'description erforderlich (z.B. "Privattraining 60min")' }, { status: 400 })

  // Default-Zahlungsziel: +14 Tage
  const dueIso = due_date ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Invoice-Nummer atomar via RPC (existing increment_invoice_counter)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcErr } = await (supabase.rpc as any)('increment_invoice_counter', {
    p_gym_id: gym.id,
  })
  if (rpcErr) {
    console.error('[manual-invoice] increment_invoice_counter:', rpcErr.message)
    return NextResponse.json({ error: 'Invoice-Nummer konnte nicht erzeugt werden' }, { status: 500 })
  }

  const year = new Date().getFullYear()
  const invoiceNumber = `${year}-${String(rpcResult ?? 1).padStart(4, '0')}-PT`  // PT = Privat-Training

  const nowIso = new Date().toISOString()
  const memberName = `${member.first_name} ${member.last_name}`.trim()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payment, error: insertErr } = await (supabase.from('payments') as any).insert({
    gym_id:        gym.id,
    member_id:     memberId,
    amount_cents,
    status:        paid ? 'paid' : 'pending',
    paid_at:       paid ? nowIso : null,
    kind:          'one_off',
    description,
    due_date:      dueIso,
    invoice_number: invoiceNumber,
    member_name:   memberName,
    issued_at:     nowIso,
  }).select().single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    payment,
    invoice_url: `/api/invoices/${payment.id}`,
    note: paid
      ? `Rechnung ${invoiceNumber} als bezahlt vermerkt.`
      : `Rechnung ${invoiceNumber} erstellt, fällig zum ${dueIso}. PDF abrufbar unter /api/invoices/${payment.id}.`,
  })
}
