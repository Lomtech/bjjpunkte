import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/members/[id]/export
//
// DSGVO Art. 15 — Auskunftsrecht des Betroffenen.
// Liefert ALLE personenbezogenen Daten die zum Mitglied gespeichert sind:
// Stammdaten + Anwesenheit + Zahlungen + Buchungen + Beförderungen +
// Turniere + Punch-Card-Käufe + Vertragsverlauf + Mahnungen.
//
// Auth: Gym-Owner via Bearer-Token. Wir validieren explizit gym-ownership,
// damit Cross-Gym-Anfragen sauber als 404 (nicht 500 via RLS-Filter) zurückkommen.
//
// Output: JSON mit Content-Disposition Header — Browser bietet Download an.
// Format ist Art-15-konform: maschinen-lesbar + üblicher Standard.

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = getSupabase(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase
    .from('gyms')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  // Member-Stammdaten + Gym-Zugehörigkeit prüfen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase.from('members') as any)
    .select('*').eq('id', id).maybeSingle()
  if (!member || member.gym_id !== gym.id) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  // Member-Contracts zuerst, damit wir contract_ids für Pauses+Terminations haben
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contractsRes = await (supabase.from('member_contracts') as any)
    .select('*').eq('member_id', id)
  const contracts = (contractsRes.data ?? []) as Array<{ id: string }>
  const contractIds = contracts.map(c => c.id)

  // Alle Sub-Tabellen parallel laden — Performance bei großen Members ok,
  // RLS filtert pro Tabelle, Service-Role nicht benötigt.
  const [
    attendance,
    payments,
    classBookings,
    beltPromotions,
    tournaments,
    punchCardPurchases,
    dunningActions,
    pauses,
    terminations,
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('attendance') as any).select('*').eq('member_id', id).order('checked_in_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('payments') as any).select('*').eq('member_id', id).order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('class_bookings') as any).select('*').eq('member_id', id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('belt_promotions') as any).select('*').eq('member_id', id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('member_tournaments') as any).select('*').eq('member_id', id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('punch_card_purchases') as any).select('*').eq('member_id', id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('dunning_actions') as any).select('*').eq('member_id', id),
    contractIds.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (supabase.from('contract_pauses') as any).select('*').in('contract_id', contractIds)
      : Promise.resolve({ data: [] }),
    contractIds.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (supabase.from('contract_terminations') as any).select('*').in('contract_id', contractIds)
      : Promise.resolve({ data: [] }),
  ])

  const exportData = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    exported_by_user_id: user.id,
    gym: { id: gym.id, name: gym.name },
    legal_basis: {
      article: 'DSGVO Art. 15 Abs. 1 — Auskunftsrecht der betroffenen Person',
      note: 'Diese Datei enthält alle personenbezogenen Daten, die zum Zeitpunkt des Exports im System gespeichert sind. Verarbeitungszweck: Vertragserfüllung gem. Art. 6 Abs. 1 lit. b DSGVO.',
    },
    member,
    attendance:           attendance.data ?? [],
    payments:             payments.data ?? [],
    class_bookings:       classBookings.data ?? [],
    belt_promotions:      beltPromotions.data ?? [],
    member_tournaments:   tournaments.data ?? [],
    punch_card_purchases: punchCardPurchases.data ?? [],
    dunning_actions:      dunningActions.data ?? [],
    member_contracts:     contracts,
    contract_pauses:      pauses.data ?? [],
    contract_terminations: terminations.data ?? [],
  }

  // Counts für Audit-Trail-Loglevel (was wurde exportiert)
  const counts = {
    attendance: exportData.attendance.length,
    payments: exportData.payments.length,
    class_bookings: exportData.class_bookings.length,
    belt_promotions: exportData.belt_promotions.length,
    tournaments: exportData.member_tournaments.length,
    punch_card_purchases: exportData.punch_card_purchases.length,
    dunning_actions: exportData.dunning_actions.length,
    contracts: exportData.member_contracts.length,
    pauses: exportData.contract_pauses.length,
    terminations: exportData.contract_terminations.length,
  }

  const filename = `member-${id}-export-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Export-Counts': JSON.stringify(counts),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    },
  })
}
