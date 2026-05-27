import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * GET /api/datev/export?year=2025
 *
 * Returns a DATEV EXTF Buchungsstapel CSV for all paid payments of the
 * authenticated gym owner in the requested year (defaults to current year).
 *
 * Optional query params:
 *   year  – 4-digit year (default: current year)
 *   from  – ISO date string, overrides year-based range start
 *   to    – ISO date string, overrides year-based range end
 */
export async function GET(req: Request) {
  const authHeader  = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const authedClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const { data: { user } } = await authedClient.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Resolve gym for this owner
  const { data: gym } = await (authedClient as ReturnType<typeof createClient>)
    .from('gyms')
    .select('id, name, datev_beraternummer, datev_mandantennummer, is_kleinunternehmer, datev_debitor_account')
    .eq('owner_id', user.id)
    .single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const gymData = gym as {
    id: string
    name: string
    datev_beraternummer: string | null
    datev_mandantennummer: string | null
    is_kleinunternehmer: boolean | null
    datev_debitor_account: string | null
  }

  // Date range
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)
  const from = searchParams.get('from') ?? `${year}-01-01T00:00:00.000Z`
  const to   = searchParams.get('to')   ?? `${year + 1}-01-01T00:00:00.000Z`

  // Fetch paid payments with member names (service client bypasses RLS for the join)
  const supabase = createServiceClient()
  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, amount_cents, paid_at, invoice_number, member_id, members(first_name, last_name)')
    .eq('gym_id', gymData.id)
    .eq('status', 'paid')
    .gte('paid_at', from)
    .lt('paid_at', to)
    .order('paid_at', { ascending: true })

  if (error) {
    console.error('[datev/export] DB error:', error)
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  if (!payments?.length) {
    return NextResponse.json({ error: 'Keine bezahlten Zahlungen im gewählten Zeitraum' }, { status: 404 })
  }

  // ── Build DATEV EXTF CSV ────────────────────────────────────────────────────

  const p2  = (n: number) => String(n).padStart(2, '0')
  const p3  = (n: number) => String(n).padStart(3, '0')
  const now = new Date()
  const ts  = `${now.getFullYear()}${p2(now.getMonth()+1)}${p2(now.getDate())}${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}${p3(now.getMilliseconds())}`

  const dates    = payments.map(p => new Date((p as Record<string, unknown>).paid_at as string))
  const fromDate = formatDatev(new Date(Math.min(...dates.map(d => d.getTime()))))
  const toDate   = formatDatev(new Date(Math.max(...dates.map(d => d.getTime()))))

  const berater  = gymData.datev_beraternummer  ?? '0'
  const mandant  = gymData.datev_mandantennummer ?? '0'
  const wjBeginn = `${now.getFullYear()}0101`
  const label    = `"${gymData.name} Zahlungen ${year}"`.replace(/[;]/g, ' ')

  // Vorlaufsatz (Zeile 1) — EXTF Format 700, Datenkategorie 21, Version 9
  const vorlauf = [
    '"EXTF"', '700', '21', '"Buchungsstapel"', '9',
    ts, '', '"Osss"', '', '',
    berater, mandant, wjBeginn, '4',
    fromDate, toDate, label, '',
    '1', '0', '"EUR"', '', '', '', '', '', '', '', '', '', '', '',
  ].join(';')

  // Spaltenüberschriften (Zeile 2)
  const headers = [
    'Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz',
    'Kurs', 'Basis-Umsatz', 'WKZ Basis-Umsatz',
    'Konto', 'Gegenkonto (ohne BU-Schlüssel)', 'BU-Schlüssel',
    'Belegdatum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext',
  ].join(';')

  // Buchungszeilen
  const rows = payments.map(p => {
    const pRow       = p as Record<string, unknown>
    const memberRaw  = pRow.members as Record<string, string> | null
    const memberName = memberRaw
      ? `${memberRaw.first_name ?? ''} ${memberRaw.last_name ?? ''}`.trim()
      : ''

    const d          = new Date(pRow.paid_at as string)
    const belegdatum = `${p2(d.getDate())}${p2(d.getMonth()+1)}`
    const betrag     = ((pRow.amount_cents as number) / 100).toFixed(2).replace('.', ',')
    const text       = `Mitgliedsbeitrag ${memberName}`.substring(0, 60).replace(/[";]/g, ' ')
    const beleg1     = ((pRow.invoice_number ?? (pRow.id as string).substring(0, 20)) as string).replace(/[";]/g, '')

    // SKR03: 8400 = Erlöse (steuerpflichtig 19%), 8200 = Erlöse Kleinunternehmer
    const gegenkonto = gymData.is_kleinunternehmer ? '8200' : '8400'
    const buSchluessel = gymData.is_kleinunternehmer ? '40' : ''  // BU 40 = §19 UStG

    // Debitorenkonto: gym-konfigurierbar via gyms.datev_debitor_account
    // (Default 10000 = SKR03 Standard-Debitor). Steuerberater kann pro Studio
    // anpassen (z.B. separate Sammel-Konten pro Niederlassung).
    const debitor = gymData.datev_debitor_account?.trim() || '10000'

    return [
      betrag, 'H', 'EUR', '', '', '',
      debitor,
      gegenkonto,
      buSchluessel,
      belegdatum, beleg1, '', '', `"${text}"`,
    ].join(';')
  })

  const content  = [vorlauf, headers, ...rows].join('\r\n')
  // BOM (﻿) for Excel compatibility
  const csvBytes = Buffer.from('﻿' + content, 'utf-8')
  const filename = `datev-buchungsstapel-${gymData.name.replace(/[^a-zA-Z0-9]/g, '-')}-${year}.csv`

  return new Response(csvBytes, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function formatDatev(d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}`
}
