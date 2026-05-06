// Google Places API (New) — Text Search + Place Details
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
// API key needs: Places API (New) enabled in Google Cloud project

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'places.primaryType',
  'places.types',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.addressComponents',
  'nextPageToken',
].join(',')

type AddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

export type PlaceResult = {
  id: string
  displayName?: { text?: string; languageCode?: string }
  formattedAddress?: string
  shortFormattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  rating?: number
  userRatingCount?: number
  businessStatus?: string
  primaryType?: string
  types?: string[]
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  addressComponents?: AddressComponent[]
}

export async function searchPlacesText(args: {
  query: string
  maxResults?: number
  pageToken?: string
  /** Optional: bias around lat/lng with radius in meters */
  bias?: { latitude: number; longitude: number; radiusMeters: number }
}): Promise<{ places: PlaceResult[]; nextPageToken: string | null }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY not set')

  const body: Record<string, unknown> = {
    textQuery: args.query,
    pageSize: Math.min(args.maxResults ?? 20, 20),
  }
  if (args.pageToken) body.pageToken = args.pageToken
  if (args.bias) {
    body.locationBias = {
      circle: {
        center: { latitude: args.bias.latitude, longitude: args.bias.longitude },
        radius: args.bias.radiusMeters,
      },
    }
  }

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Google Places API ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = await res.json() as { places?: PlaceResult[]; nextPageToken?: string }
  return {
    places: data.places ?? [],
    nextPageToken: data.nextPageToken ?? null,
  }
}

/** Extract city / country from addressComponents — best effort */
export function extractCity(p: PlaceResult): { city: string | null; countryCode: string | null } {
  const comps = p.addressComponents ?? []
  let city: string | null = null
  let countryCode: string | null = null
  for (const c of comps) {
    if (c.types?.includes('locality') && c.longText) city = c.longText
    if (c.types?.includes('country') && c.shortText) countryCode = c.shortText
  }
  // fallback: postal_town if no locality
  if (!city) {
    for (const c of comps) {
      if (c.types?.includes('postal_town') && c.longText) { city = c.longText; break }
    }
  }
  return { city, countryCode }
}

const MARTIAL_KEYWORDS = [
  'bjj', 'jiu-jitsu', 'jiu jitsu', 'jiujitsu',
  'judo', 'karate', 'taekwondo', 'tae kwon do',
  'mma', 'mixed martial', 'kampfsport',
  'muay thai', 'thai box', 'kickbox', 'kick-box',
  'boxen', 'box club',
  'wrestling', 'ringen',
  'capoeira', 'krav maga', 'aikido', 'kung fu',
  'martial', 'combat',
]

export function detectSports(p: PlaceResult): { sports: string[]; isMartialArts: boolean } {
  const haystack = [
    p.displayName?.text ?? '',
    p.formattedAddress ?? '',
    (p.types ?? []).join(' '),
    p.primaryType ?? '',
  ].join(' ').toLowerCase()

  const found = new Set<string>()
  for (const kw of MARTIAL_KEYWORDS) {
    if (haystack.includes(kw)) found.add(kw)
  }
  return {
    sports: Array.from(found),
    isMartialArts: found.size > 0,
  }
}
