import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

// POST /api/payments/[id]/credit
//
// Sprint 2026-05-27: Gutschrift (Credit Note) — sevdesk-feature-parity.
// Owner storniert eine ausgestellte Rechnung mit einer Gutschrift.
// Gutschrift bekommt eigene invoice_number mit Suffix -GS,
// kind='credit_note', amount_cents negativ (zur Rechnungs-Summe gedacht),
// credits_payment_id referenziert das Original.
//
// Body: { reason?: string, amount_cents?: number }
//   - reason: Begründung (steht im Gutschrift-PDF)
//   - amount_cents: optional — Teilgutschrift. Default = volle Original-Summe
//
// Idempotent: wenn schon eine Gutschrift für diese payment_id existiert,
// gibt 409 zurück.

export const dynamic = 'force-dynamic'

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: paymentId } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)
  const gym = auth.gym

  // Original-Rechnung laden + Owner-Check via RLS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: original } = await (supabase.from('payments') as any)
    .select('id, gym_id, member_id, amount_cents, invoice_number, kind, member_name, description')
    .eq('id', paymentId).maybeSingle()
  if (!original || original.gym_id !== gym.id) {
    return NextResponse.json({ error: 'Rechnung nicht gefunden' }, { status: 404 })
  }
  if (original.kind === 'credit_note') {
    return NextResponse.json({ error: 'Gutschriften können nicht gutgeschrieben werden' }, { status: 400 })
  }

  // Idempotenz: schon Gutschrift vorhanden?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingCredit } = await (supabase.from('payments') as any)
    .select('id, invoice_number')
    .eq('credits_payment_id', paymentId).maybeSingle()
  if (existingCredit) {
    return NextResponse.json({
      error: `Gutschrift bereits ausgestellt (${existingCredit.invoice_number})`,
      existing_credit_id: existingCredit.id,
    }, { status: 409 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500).trim() : null
  const requestedAmount = typeof body.amount_cents === 'number' && body.amount_cents > 0
    ? Math.floor(body.amount_cents) : null

  // Default: volle Original-Summe
  const creditAmount = requestedAmount ?? original.amount_cents
  if (creditAmount > original.amount_cents) {
    return NextResponse.json({
      error: `Gutschrift (${creditAmount/100} EUR) übersteigt Original-Rechnung (${original.amount_cents/100} EUR)`
    }, { status: 400 })
  }

  // Eigene Invoice-Nummer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: counter } = await (supabase.rpc as any)('increment_invoice_counter', { p_gym_id: gym.id })
  const year = new Date().getFullYear()
  const creditNumber = `${year}-${String(counter ?? 1).padStart(4, '0')}-GS`

  const nowIso = new Date().toISOString()

  // INSERT credit note: amount_cents NEGATIV (Buchhalterisch Storno), status='paid'
  // (Gutschrift ist kein offener Posten mehr — sie reduziert die Schuld direkt)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: credit, error } = await (supabase.from('payments') as any).insert({
    gym_id: gym.id,
    member_id: original.member_id,
    amount_cents: -creditAmount, // negative für Storno-Buchung
    status: 'paid',
    paid_at: nowIso,
    kind: 'credit_note',
    description: reason
      ? `Gutschrift zu ${original.invoice_number}: ${reason}`
      : `Gutschrift zu ${original.invoice_number}`,
    invoice_number: creditNumber,
    member_name: original.member_name,
    issued_at: nowIso,
    credits_payment_id: paymentId,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    credit_note: credit,
    original_invoice_number: original.invoice_number,
    invoice_url: `/api/invoices/${credit.id}`,
    note: `Gutschrift ${creditNumber} über ${(creditAmount/100).toFixed(2)} EUR ausgestellt. PDF abrufbar unter /api/invoices/${credit.id}.`,
  })
}
