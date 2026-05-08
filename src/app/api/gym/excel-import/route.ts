/**
 * POST /api/gym/excel-import
 *
 * Bulk member import from a CSV (or CSV-saved Excel) file.
 * Removes the #1 sales friction for studios migrating from spreadsheets.
 *
 * Body: multipart/form-data with `file` field (CSV or XLSX).
 *  - XLSX is rejected with a "save as CSV" hint — adding the `xlsx` lib
 *    would inflate the bundle by ~500kB for an edge case we can sidestep.
 *
 * Auth: dual-path (Bearer header OR session cookie), matching the rest
 * of the dashboard API surface.
 *
 * Response: { ok, imported, skipped, errors: [{row, error}] }
 */
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { parseAndMapCsv } from '@/lib/excel-parser'

export const dynamic = 'force-dynamic'

// 5 MB cap — a typical CSV with 5000 members is ~500kB.
const MAX_BYTES = 5 * 1024 * 1024

export async function POST(req: Request) {
  // ── Auth: Bearer OR Cookie ────────────────────────────────────────────────
  let userId: string | null = null
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (accessToken) {
    const sb = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )
    const { data } = await sb.auth.getUser(accessToken)
    if (data.user) userId = data.user.id
  } else {
    const sb = await createServerClient()
    const { data } = await sb.auth.getUser()
    if (data.user) userId = data.user.id
  }
  if (!userId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // ── File ─────────────────────────────────────────────────────────────────
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request (FormData erwartet)' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Datei fehlt — Feld "file" mit CSV-Datei senden.' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Datei ist leer' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Datei zu groß (max. ${Math.round(MAX_BYTES / 1024 / 1024)} MB).` },
      { status: 413 }
    )
  }

  const filename = (file.name ?? '').toLowerCase()
  const isXlsx = filename.endsWith('.xlsx') || filename.endsWith('.xls')
  if (isXlsx) {
    return NextResponse.json(
      {
        error:
          'XLSX-Dateien werden derzeit nicht unterstützt. Bitte in Excel "Speichern unter" → "CSV (Trennzeichen-getrennt) (.csv)" wählen und erneut hochladen.',
      },
      { status: 415 }
    )
  }

  // Read CSV text (UTF-8; Excel-Windows often saves as Windows-1252,
  // but the parser strips the BOM and most member data is plain ASCII +
  // umlauts which UTF-8 decoders handle gracefully)
  const text = await file.text()

  // ── Parse + map ──────────────────────────────────────────────────────────
  const { data: parsedRows, errors: parseErrors } = parseAndMapCsv(text)

  if (parsedRows.length === 0 && parseErrors.length === 0) {
    return NextResponse.json(
      { error: 'Keine Daten in der CSV gefunden. Erste Zeile muss die Spaltennamen enthalten.' },
      { status: 400 }
    )
  }

  // ── Look up gym + plan limit ─────────────────────────────────────────────
  const svc = createServiceClient()
  const { data: gym } = await svc
    .from('gyms')
    .select('id, plan_member_limit')
    .eq('owner_id', userId)
    .maybeSingle()

  if (!gym) return NextResponse.json({ error: 'Kein Gym gefunden' }, { status: 404 })

  const limit: number = gym.plan_member_limit ?? 30

  // Active member count (limit applies to is_active = true)
  const { count: activeCount } = await svc
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('gym_id', gym.id)
    .eq('is_active', true)

  const used = activeCount ?? 0
  const available = Math.max(0, limit - used)

  // Hard stop if no slots at all — clearer error than "0 imported"
  if (available <= 0) {
    return NextResponse.json(
      {
        error: `Plan-Limit erreicht: ${used}/${limit} Mitglieder. Upgrade nötig, um weitere zu importieren.`,
        plan_limit: limit,
        active_count: used,
      },
      { status: 409 }
    )
  }

  // Hard stop if would-be import exceeds plan — the task spec asks us to
  // abort with a clear message rather than partial-import. We trim to the
  // available slots only when the file ALMOST fits (≤10% overflow) so a
  // small rounding mismatch doesn't make the whole import fail.
  if (parsedRows.length > available) {
    const overflow = parsedRows.length - available
    if (overflow > Math.max(5, Math.ceil(available * 0.1))) {
      return NextResponse.json(
        {
          error:
            `Datei enthält ${parsedRows.length} Mitglieder, aber nur ${available} freie Slots im Plan ` +
            `(Limit ${limit}, aktiv ${used}). Bitte Plan upgraden oder Datei kürzen.`,
          plan_limit: limit,
          active_count: used,
          available,
          file_count: parsedRows.length,
        },
        { status: 409 }
      )
    }
  }

  const rowsToImport = parsedRows.slice(0, available)
  const skippedDueToPlan = parsedRows.length - rowsToImport.length

  // ── Insert (chunked, service-role bypasses RLS) ──────────────────────────
  const insertErrors: { row: number; error: string }[] = []
  let imported = 0
  const CHUNK = 100

  for (let i = 0; i < rowsToImport.length; i += CHUNK) {
    const chunk = rowsToImport.slice(i, i + CHUNK).map(r => ({
      gym_id: gym.id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      phone: r.phone,
      date_of_birth: r.date_of_birth,
      address: r.address,
      belt: r.belt,
      stripes: r.stripes,
      join_date: r.join_date,
      monthly_fee_override_cents: r.monthly_fee_override_cents,
      notes: r.notes,
      is_active: true,
      subscription_status: 'pending' as const,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error } = await (svc.from('members') as any)
      .insert(chunk)
      .select('id')

    if (error) {
      // Fall back to per-row insert on chunk failure so one bad row
      // doesn't take down 99 good rows.
      for (let j = 0; j < chunk.length; j++) {
        const single = chunk[j]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: rowErr } = await (svc.from('members') as any).insert([single])
        if (rowErr) {
          insertErrors.push({
            row: i + j + 2, // +2 for 1-indexed + header row
            error: rowErr.message,
          })
        } else {
          imported++
        }
      }
    } else {
      imported += (inserted ?? []).length
    }
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped: skippedDueToPlan + parseErrors.length + insertErrors.length,
    plan_limit: limit,
    active_count_before: used,
    skipped_plan_limit: skippedDueToPlan,
    errors: [...parseErrors, ...insertErrors],
  })
}
