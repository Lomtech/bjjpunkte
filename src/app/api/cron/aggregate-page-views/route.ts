import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cronGuard } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * GET /api/cron/aggregate-page-views
 *
 * Aggregiert raw `page_views` vom Vortag in `page_views_daily` und löscht
 * raw Rows älter als 90 Tage (Retention).
 *
 * Hintergrund: bei 500 Studios × ~1000 Views/Monat × 30 Tage entstehen
 * 15-30M Rows/Monat. Ohne Aggregat timeouted /api/admin/analytics.
 *
 * Granularität: tag × path × event_type × country × device × browser × referrer_source.
 *
 * Vercel-Cron: täglich 03:00 UTC (= 04:00/05:00 Berlin). Niedrige Last.
 * Auth: Bearer ${CRON_SECRET} via cronGuard.
 *
 * Idempotenz:
 *  - DB-Level: cron_runs(job_name='aggregate_page_views', executed_at=YYYY-MM-DD) UNIQUE.
 *    2× Aufruf am gleichen Tag = early-return.
 *  - Logik-Level: UPSERT auf den Composite-PK von page_views_daily — ein erneuter
 *    Lauf mit denselben Quelldaten produziert dieselben Aggregat-Rows
 *    (idempotent, idempotenter geht nicht).
 *
 * Retention: raw `page_views` > 90 Tage werden gelöscht. Aggregat bleibt unbegrenzt.
 */
export async function GET(req: Request) {
  const guard = cronGuard(req)
  if (guard) return guard

  const todayKey = new Date().toISOString().split('T')[0]
  const supabase = createServiceClient()

  // ── DB-Level Dedup: ein Run pro Kalendertag
  const { error: dedupErr } = await supabase
    .from('cron_runs')
    .insert({ job_name: 'aggregate_page_views', executed_at: todayKey })
  if (dedupErr) {
    if (dedupErr.code === '23505') {
      return NextResponse.json({ skipped: true, reason: 'already ran today' })
    }
    return NextResponse.json({ error: dedupErr.message }, { status: 500 })
  }

  // ── Vortag bestimmen (UTC-Tagesgrenze, weil page_views.created_at default `now()` UTC ist)
  const now = new Date()
  const yesterday = new Date(now.getTime() - 86400000)
  const yKey = yesterday.toISOString().slice(0, 10) // YYYY-MM-DD

  const dayStart = `${yKey}T00:00:00.000Z`
  const dayEnd   = `${yKey}T23:59:59.999Z`

  // ── Raw Rows vom Vortag laden — paginiert wegen 30M-Row-Skala.
  // Pro Page max 1000 (Supabase-Default-Range). Wir holen so lange, bis weniger
  // als PAGE_SIZE zurückkommen — kein "echter" Total-Count nötig.
  type RawRow = {
    path: string | null
    event_type: string | null
    country: string | null
    device_type: string | null
    browser: string | null
    referrer_source: string | null
    visitor_hash: string | null
    is_bot: boolean | null
  }

  // Bucket-Key → { unique_visitors-Set, total_views-Counter }
  type Bucket = { visitors: Set<string>; views: number }
  const buckets = new Map<string, Bucket>()

  const PAGE_SIZE = 1000
  let from = 0
  let scanned = 0
  let bots = 0

  // Hard-Loop-Cap: 30M / 1000 = 30k Pages. Wir setzen 50k als safety net.
  for (let safetyLoop = 0; safetyLoop < 50_000; safetyLoop++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('page_views') as any)
      .select('path, event_type, country, device_type, browser, referrer_source, visitor_hash, is_bot')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      return NextResponse.json({ error: `select page_views: ${error.message}` }, { status: 500 })
    }

    const rows = (data ?? []) as RawRow[]
    if (rows.length === 0) break

    for (const r of rows) {
      scanned++

      // Bots werden separat gezählt, aber NICHT aggregiert — sie verfälschen Stats.
      // Wer Bot-Stats braucht, kann später eine zweite Tabelle bauen.
      if (r.is_bot === true) {
        bots++
        continue
      }

      const path           = r.path ?? ''
      if (!path) continue

      const eventType      = r.event_type ?? 'page_view'
      const country        = r.country ?? null
      const deviceType     = r.device_type ?? null
      const browser        = r.browser ?? null
      const referrerSource = r.referrer_source ?? null

      // Bucket-Key — exakt die PK-Dimensionen von page_views_daily.
      // \x1f als Trenner (information separator one) — kommt in keinem realen Wert vor.
      const key = [
        path,
        eventType,
        country ?? '',
        deviceType ?? '',
        browser ?? '',
        referrerSource ?? '',
      ].join('\x1f')

      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = { visitors: new Set(), views: 0 }
        buckets.set(key, bucket)
      }
      bucket.views++
      if (r.visitor_hash) bucket.visitors.add(r.visitor_hash)
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  // ── Buckets in UPSERT-Rows konvertieren
  type DailyRow = {
    date: string
    path: string
    event_type: string
    country: string | null
    device_type: string | null
    browser: string | null
    referrer_source: string | null
    unique_visitors: number
    total_views: number
  }

  const upsertRows: DailyRow[] = []
  for (const [key, bucket] of buckets.entries()) {
    const [path, eventType, country, deviceType, browser, referrerSource] = key.split('\x1f')
    upsertRows.push({
      date:            yKey,
      path,
      event_type:      eventType,
      country:         country         === '' ? null : country,
      device_type:     deviceType      === '' ? null : deviceType,
      browser:         browser         === '' ? null : browser,
      referrer_source: referrerSource  === '' ? null : referrerSource,
      unique_visitors: bucket.visitors.size,
      total_views:     bucket.views,
    })
  }

  // ── UPSERT in Batches (Supabase-Default 1000 reicht)
  const errors: string[] = []
  const UPSERT_BATCH = 500
  let upserted = 0
  for (let i = 0; i < upsertRows.length; i += UPSERT_BATCH) {
    const batch = upsertRows.slice(i, i + UPSERT_BATCH)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upErr } = await (supabase.from('page_views_daily') as any)
      .upsert(batch, {
        onConflict: 'date,path,event_type,country,device_type,browser,referrer_source',
      })
    if (upErr) {
      errors.push(`upsert batch ${i}: ${upErr.message}`)
    } else {
      upserted += batch.length
    }
  }

  // ── Retention: raw Rows > 90 Tage löschen
  const cutoff90 = new Date(now.getTime() - 90 * 86400000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: delErr, count: deletedCount } = await (supabase.from('page_views') as any)
    .delete({ count: 'exact' })
    .lt('created_at', cutoff90)

  if (delErr) {
    errors.push(`retention delete: ${delErr.message}`)
  }

  return NextResponse.json({
    ok: errors.length === 0,
    aggregated_date: yKey,
    raw_rows_scanned: scanned,
    bots_skipped: bots,
    aggregate_rows_upserted: upserted,
    aggregate_buckets: upsertRows.length,
    raw_rows_deleted_retention: deletedCount ?? 0,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  })
}
