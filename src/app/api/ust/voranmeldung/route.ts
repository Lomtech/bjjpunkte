import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/ust/voranmeldung?year=2026&month=1
//
// Sprint 2026-05-27: USt-Voranmeldungs-Helper (sevdesk parity, light).
// Aggregiert payments + invoice_line_items im Zeitraum nach USt-Satz.
//
// Output:
// {
//   period: { year, month, from, to },
//   gym: { id, name, is_kleinunternehmer },
//   gross_by_rate: { '19': cents, '7': cents, '0': cents },
//   net_by_rate:   { '19': cents, '7': cents, '0': cents },
//   tax_by_rate:   { '19': cents, '7': cents, '0': cents },
//   total: { net, tax, gross },
//   credit_notes: { count, gross_cents },     -- werden separat ausgewiesen
//   note: 'Kleinunternehmer §19 UStG → keine USt' / null
// }
//
// Nur als Hilfe für Steuerberater — KEINE offizielle UStVA-Generation.

export const dynamic = 'force-dynamic'

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = getSupabase(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase
    .from('gyms')
    .select('id, name, is_kleinunternehmer')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()), 10)
  const monthParam = url.searchParams.get('month')
  const month = monthParam ? parseInt(monthParam, 10) : null

  if (year < 2000 || year > 2100) return NextResponse.json({ error: 'Ungültiges Jahr' }, { status: 400 })
  if (month !== null && (month < 1 || month > 12)) {
    return NextResponse.json({ error: 'Monat muss 1-12 sein' }, { status: 400 })
  }

  // Zeitraum
  const from = month
    ? new Date(Date.UTC(year, month - 1, 1))
    : new Date(Date.UTC(year, 0, 1))
  const to = month
    ? new Date(Date.UTC(year, month, 1))
    : new Date(Date.UTC(year + 1, 0, 1))

  // Payments im Zeitraum (paid only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payments, error } = await (supabase.from('payments') as any)
    .select('id, amount_cents, kind, tax_rate_pct, paid_at')
    .eq('gym_id', gym.id)
    .eq('status', 'paid')
    .gte('paid_at', from.toISOString())
    .lt('paid_at', to.toISOString())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Optional: line-items für Multi-Position-Rechnungen
  const paymentIds = (payments ?? []).map((p: { id: string }) => p.id)
  let lineItems: Array<{ payment_id: string; tax_rate_pct: number; line_net_cents: number; line_tax_cents: number; line_gross_cents: number }> = []
  if (paymentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: li } = await (supabase.from('invoice_line_items') as any)
      .select('payment_id, tax_rate_pct, line_net_cents, line_tax_cents, line_gross_cents')
      .in('payment_id', paymentIds)
    lineItems = li ?? []
  }

  // Aggregation
  const grossByRate: Record<string, number> = { '0': 0, '7': 0, '19': 0 }
  const netByRate: Record<string, number> = { '0': 0, '7': 0, '19': 0 }
  const taxByRate: Record<string, number> = { '0': 0, '7': 0, '19': 0 }
  let creditNotesCount = 0
  let creditNotesGross = 0

  // Welche payments haben line-items? Für die nutzen wir items, sonst payment-Header.
  const paymentsWithItems = new Set(lineItems.map(li => li.payment_id))

  for (const li of lineItems) {
    const rate = String(Math.round(li.tax_rate_pct))
    if (!(rate in grossByRate)) { grossByRate[rate] = 0; netByRate[rate] = 0; taxByRate[rate] = 0 }
    grossByRate[rate] += li.line_gross_cents
    netByRate[rate]   += li.line_net_cents
    taxByRate[rate]   += li.line_tax_cents
  }

  for (const p of (payments ?? []) as Array<{ id: string; amount_cents: number; kind: string; tax_rate_pct: number | null }>) {
    if (paymentsWithItems.has(p.id)) continue // schon über line-items berücksichtigt

    if (p.kind === 'credit_note') {
      creditNotesCount++
      creditNotesGross += Math.abs(p.amount_cents)
      // Gutschrift reduziert den Erlös — wir verbuchen als negative gross
      const rate = String(Math.round(p.tax_rate_pct ?? 19))
      const gross = p.amount_cents // bereits negativ
      const net = Math.round(gross / (1 + (p.tax_rate_pct ?? 19) / 100))
      const tax = gross - net
      grossByRate[rate] = (grossByRate[rate] ?? 0) + gross
      netByRate[rate]   = (netByRate[rate] ?? 0) + net
      taxByRate[rate]   = (taxByRate[rate] ?? 0) + tax
    } else {
      const rate = String(Math.round(p.tax_rate_pct ?? 19))
      if (!(rate in grossByRate)) { grossByRate[rate] = 0; netByRate[rate] = 0; taxByRate[rate] = 0 }
      const gross = p.amount_cents
      const net = Math.round(gross / (1 + (p.tax_rate_pct ?? 19) / 100))
      const tax = gross - net
      grossByRate[rate] += gross
      netByRate[rate]   += net
      taxByRate[rate]   += tax
    }
  }

  const totalNet   = Object.values(netByRate).reduce((s, v) => s + v, 0)
  const totalTax   = Object.values(taxByRate).reduce((s, v) => s + v, 0)
  const totalGross = Object.values(grossByRate).reduce((s, v) => s + v, 0)

  return NextResponse.json({
    period: {
      year, month,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    },
    gym: { id: gym.id, name: gym.name, is_kleinunternehmer: (gym as { is_kleinunternehmer?: boolean }).is_kleinunternehmer ?? false },
    gross_by_rate: grossByRate,
    net_by_rate: netByRate,
    tax_by_rate: taxByRate,
    total: { net_cents: totalNet, tax_cents: totalTax, gross_cents: totalGross },
    credit_notes: { count: creditNotesCount, gross_cents: creditNotesGross },
    note: (gym as { is_kleinunternehmer?: boolean }).is_kleinunternehmer
      ? 'Kleinunternehmer §19 UStG → keine USt ausweisen. Aggregation zeigt 19/7% wenn versehentlich gesetzt (Hinweis fürs Korrigieren).'
      : 'Werte sind Approximationen aus payments.tax_rate_pct + invoice_line_items. Für offizielle UStVA bitte Steuerberater + Elster nutzen.',
  })
}
