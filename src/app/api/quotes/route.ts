import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

// Sprint 2026-05-27: Angebote (Quotes) — sevdesk-feature-parity.
//
// GET  /api/quotes               → Liste aller Angebote des Gym-Owners
// POST /api/quotes                → neues Angebot mit line_items[]
//
// Status-Lifecycle: draft → sent → accepted/rejected/expired → converted

export const dynamic = 'force-dynamic'

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

interface QuoteItemInput {
  description: string
  qty: number
  unit_price_cents: number
  tax_rate_pct: number
}

function validateItem(raw: unknown): QuoteItemInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const description = typeof r.description === 'string' ? r.description.slice(0, 500).trim() : ''
  const qty = typeof r.qty === 'number' && r.qty > 0 ? r.qty : null
  const unit_price_cents = typeof r.unit_price_cents === 'number' && r.unit_price_cents >= 0
    ? Math.floor(r.unit_price_cents) : null
  const tax_rate_pct = typeof r.tax_rate_pct === 'number' && r.tax_rate_pct >= 0 && r.tax_rate_pct <= 25
    ? r.tax_rate_pct : 19
  if (!description || qty === null || unit_price_cents === null) return null
  return { description, qty, unit_price_cents, tax_rate_pct }
}

export async function GET(req: Request) {
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)
  const gym = auth.gym

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('quotes') as any)
    .select('*')
    .eq('gym_id', gym.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ quotes: data ?? [] })
}

export async function POST(req: Request) {
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)
  const gym = auth.gym

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const member_id = typeof body.member_id === 'string' ? body.member_id : null
  const recipient_name = typeof body.recipient_name === 'string' ? body.recipient_name.slice(0, 200).trim() : null
  const recipient_email = typeof body.recipient_email === 'string' ? body.recipient_email.slice(0, 320).trim() : null
  const recipient_address = typeof body.recipient_address === 'string' ? body.recipient_address.slice(0, 500) : null
  const valid_until = typeof body.valid_until === 'string' ? body.valid_until.slice(0, 10) : null
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 5000) : null
  const conditions = typeof body.conditions === 'string' ? body.conditions.slice(0, 5000) : null

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items[] erforderlich (mind. 1 Position)' }, { status: 400 })
  }
  const items: QuoteItemInput[] = []
  for (const raw of body.items) {
    const item = validateItem(raw)
    if (!item) return NextResponse.json({ error: 'Ungültiges line-item' }, { status: 400 })
    items.push(item)
  }

  // Wenn member_id gesetzt: validieren dass Member zum Gym gehört
  if (member_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: m } = await (supabase.from('members') as any)
      .select('id, gym_id').eq('id', member_id).maybeSingle()
    if (!m || m.gym_id !== gym.id) {
      return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
    }
  } else if (!recipient_name || !recipient_email) {
    return NextResponse.json({ error: 'Wenn kein member_id: recipient_name + recipient_email Pflicht' }, { status: 400 })
  }

  // Totals
  const totalNet = items.reduce((s, i) => s + Math.round(i.qty * i.unit_price_cents), 0)
  const totalTax = items.reduce((s, i) => s + Math.round(i.qty * i.unit_price_cents * i.tax_rate_pct / 100), 0)
  const totalGross = totalNet + totalTax

  // Quote-Nummer via existing counter + AN-Suffix
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: counter } = await (supabase.rpc as any)('increment_invoice_counter', { p_gym_id: gym.id })
  const year = new Date().getFullYear()
  const quoteNumber = `${year}-${String(counter ?? 1).padStart(4, '0')}-AN`

  // Default-Gültigkeit: +14 Tage
  const validUntilIso = valid_until ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, error } = await (supabase.from('quotes') as any).insert({
    gym_id: gym.id,
    member_id,
    recipient_name,
    recipient_email,
    recipient_address,
    quote_number: quoteNumber,
    status: 'draft',
    total_net_cents: totalNet,
    total_tax_cents: totalTax,
    total_gross_cents: totalGross,
    valid_until: validUntilIso,
    notes,
    conditions,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Items insert
  const itemRows = items.map((item, idx) => ({
    quote_id: quote.id,
    position: idx + 1,
    description: item.description,
    qty: item.qty,
    unit_price_cents: item.unit_price_cents,
    tax_rate_pct: item.tax_rate_pct,
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: liErr } = await (supabase.from('quote_line_items') as any).insert(itemRows)
  if (liErr) console.error('[quotes] line-items insert failed:', liErr.message)

  return NextResponse.json({ ok: true, quote, items: itemRows })
}
