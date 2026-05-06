import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'
import { searchPlacesText, extractCity, detectSports } from '@/lib/google-places'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CACHE_TTL_DAYS = 7
const CACHE_TTL_MS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000

// POST /api/admin/leads/places-search
// Body: { query, maxPages?, bias?, force? }
//   - force=true: bypass cache (re-call Google API even if recent)
//   - force=false (default): if same query ran <7d ago, return cached info + skip Google call
//
// Cache logic uses sales_search_history table — keyed by lower(query) + bias.
// Existing leads (matched by google_place_id) are NEVER overwritten on
// status/notes/priority — those are user-edited fields. Only metadata
// (rating, hours, website etc.) is refreshed.
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({})) as {
    query?: string
    maxPages?: number
    force?: boolean
    bias?: { lat: number; lng: number; radiusMeters: number }
  }
  const query = (body.query ?? '').trim()
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const maxPages = Math.min(Math.max(body.maxPages ?? 3, 1), 5)
  const force    = body.force === true
  const bias     = body.bias

  const supabase = createServiceClient()
  const queryLower = query.toLowerCase()
  const biasLat    = bias?.lat ?? null
  const biasLng    = bias?.lng ?? null
  const biasRad    = bias?.radiusMeters ?? null

  // ── Step 1: Cache lookup ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cacheLookup: any = supabase
    .from('sales_search_history')
    .select('*')
    .ilike('query', queryLower)
    .order('ran_at', { ascending: false })
    .limit(1)
  const { data: lastRuns } = await cacheLookup
  const lastRun = (lastRuns ?? [])[0] as {
    ran_at: string; result_count: number; inserted_count: number;
    updated_count: number; bias_lat: number | null; bias_lng: number | null; bias_radius: number | null;
  } | undefined

  const sameBias = lastRun
    && (lastRun.bias_lat ?? null) === biasLat
    && (lastRun.bias_lng ?? null) === biasLng
    && (lastRun.bias_radius ?? null) === biasRad
  const ageMs = lastRun ? Date.now() - new Date(lastRun.ran_at).getTime() : Infinity
  const isFresh = sameBias && ageMs < CACHE_TTL_MS

  // ── Step 2: Count existing leads matching this query ─────
  // (Best-effort name match — user wants to know how many are already in DB)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: existingMatch } = await (supabase.from('sales_leads') as any)
    .select('id', { count: 'exact', head: true })
    .ilike('name', `%${query.split(' ').slice(0, 1)[0]}%`)
    .limit(1)

  if (isFresh && !force) {
    return NextResponse.json({
      cached: true,
      message: `Diese Suche lief vor ${Math.floor(ageMs / (1000 * 60 * 60 * 24))} Tagen. Erneuere mit "force=true" um Google API erneut anzufragen.`,
      lastRunAt: lastRun!.ran_at,
      lastResultCount: lastRun!.result_count,
      lastInsertedCount: lastRun!.inserted_count,
      lastUpdatedCount: lastRun!.updated_count,
      cacheTtlDays: CACHE_TTL_DAYS,
      existingMatchCount: existingMatch ?? 0,
      query,
      inserted: 0,
      updated: 0,
      totalFound: 0,
    })
  }

  // ── Step 3: Run Google Places search ─────────────────────
  let totalFound = 0
  let inserted = 0
  let updated = 0
  const errors: string[] = []
  let pageToken: string | undefined = undefined

  for (let page = 0; page < maxPages; page++) {
    let result: Awaited<ReturnType<typeof searchPlacesText>>
    try {
      result = await searchPlacesText({
        query,
        pageToken,
        maxResults: 20,
        bias: bias ? { latitude: bias.lat, longitude: bias.lng, radiusMeters: bias.radiusMeters } : undefined,
      })
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'places api error')
      break
    }
    totalFound += result.places.length

    for (const p of result.places) {
      const { city, countryCode } = extractCity(p)
      const { sports, isMartialArts } = detectSports(p)

      const row = {
        google_place_id: p.id,
        name: p.displayName?.text ?? 'Unbenannt',
        formatted_address: p.formattedAddress ?? p.shortFormattedAddress ?? null,
        phone: p.nationalPhoneNumber ?? null,
        international_phone: p.internationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
        google_maps_url: p.googleMapsUri ?? null,
        latitude: p.location?.latitude ?? null,
        longitude: p.location?.longitude ?? null,
        rating: p.rating ?? null,
        user_ratings_total: p.userRatingCount ?? null,
        business_status: p.businessStatus ?? null,
        primary_type: p.primaryType ?? null,
        types: p.types ?? null,
        city,
        country_code: countryCode ?? 'DE',
        sports,
        is_martial_arts: isMartialArts,
        created_by: auth.user.id,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase.from('sales_leads') as any)
        .select('id, status').eq('google_place_id', p.id).maybeSingle()

      if (!existing) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: created, error: insErr } = await (supabase.from('sales_leads') as any)
          .insert(row).select('id').single()
        if (insErr) {
          errors.push(`${row.name}: ${insErr.message}`)
        } else {
          inserted++
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('sales_activities') as any).insert({
            lead_id: created.id,
            user_id: auth.user.id,
            kind: 'place_imported',
            subject: query,
          })
        }
      } else {
        // refresh metadata only — don't touch pipeline state
        const refresh = {
          formatted_address: row.formatted_address,
          phone: row.phone,
          international_phone: row.international_phone,
          website: row.website,
          google_maps_url: row.google_maps_url,
          latitude: row.latitude,
          longitude: row.longitude,
          rating: row.rating,
          user_ratings_total: row.user_ratings_total,
          business_status: row.business_status,
          primary_type: row.primary_type,
          types: row.types,
          sports: row.sports,
          is_martial_arts: row.is_martial_arts,
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updErr } = await (supabase.from('sales_leads') as any)
          .update(refresh).eq('id', existing.id)
        if (updErr) errors.push(`${row.name}: ${updErr.message}`)
        else updated++
      }
    }

    if (!result.nextPageToken) break
    pageToken = result.nextPageToken
    await new Promise(r => setTimeout(r, 2000))
  }

  // ── Step 4: Log this search to history ───────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('sales_search_history') as any).insert({
    query,
    bias_lat: biasLat,
    bias_lng: biasLng,
    bias_radius: biasRad,
    result_count: totalFound,
    inserted_count: inserted,
    updated_count: updated,
    ran_by: auth.user.id,
  })

  return NextResponse.json({
    cached: false,
    query,
    totalFound,
    inserted,
    updated,
    errors: errors.slice(0, 10),
  })
}

// GET /api/admin/leads/places-search/history?limit=50 — show recent searches
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('sales_search_history')
    .select('*')
    .order('ran_at', { ascending: false })
    .limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ history: data ?? [] })
}
