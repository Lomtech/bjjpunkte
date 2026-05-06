import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'
import { searchPlacesText, extractCity, detectSports } from '@/lib/google-places'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/admin/leads/places-search
// Body: { query: "BJJ München", maxPages?: 3, bias?: { lat, lng, radiusMeters } }
// Searches Google Places (New) Text Search and bulk-imports results into sales_leads.
// Dedupes by google_place_id.
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({})) as {
    query?: string
    maxPages?: number
    bias?: { lat: number; lng: number; radiusMeters: number }
  }
  const query = (body.query ?? '').trim()
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const maxPages = Math.min(Math.max(body.maxPages ?? 3, 1), 5) // 5 pages × 20 = up to 100
  const bias = body.bias
    ? { latitude: body.bias.lat, longitude: body.bias.lng, radiusMeters: body.bias.radiusMeters }
    : undefined

  const supabase = createServiceClient()
  let totalFound = 0
  let inserted = 0
  let updated = 0
  const errors: string[] = []
  let pageToken: string | undefined = undefined

  for (let page = 0; page < maxPages; page++) {
    let result: Awaited<ReturnType<typeof searchPlacesText>>
    try {
      result = await searchPlacesText({ query, pageToken, bias, maxResults: 20 })
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

      // upsert by google_place_id; only update fields when we have new data,
      // never overwrite status/notes/priority that the user has set
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
    // Google requires a short delay before nextPageToken becomes valid (~2s)
    await new Promise(r => setTimeout(r, 2000))
  }

  return NextResponse.json({
    query,
    totalFound,
    inserted,
    updated,
    errors: errors.slice(0, 10),
  })
}
