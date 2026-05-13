import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/leads
//   ?status=new,contacted&city=München&martial=true&search=foo&page=0&pageSize=50
//   &sort=priority|next_followup|created|updated|name|city|status|rating  (default: priority)
//   &dir=asc|desc   (optional — sonst sinnvoller Default je Sort-Key)
//   &due=true       → only follow-ups due today or earlier
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const url = new URL(req.url)
  const statusCsv = url.searchParams.get('status')
  const city      = url.searchParams.get('city')
  const martial   = url.searchParams.get('martial')
  const search    = url.searchParams.get('search')?.trim()
  const due       = url.searchParams.get('due')
  const page      = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10) || 0)
  const pageSize  = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') ?? '50', 10) || 50))
  const sort      = url.searchParams.get('sort') ?? 'priority'
  const dirParam  = url.searchParams.get('dir')

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from('sales_leads').select('*', { count: 'exact' })

  if (statusCsv) {
    const statuses = statusCsv.split(',').map(s => s.trim()).filter(Boolean)
    if (statuses.length) q = q.in('status', statuses)
  }
  if (city)    q = q.ilike('city', `%${city}%`)
  if (martial === 'true')  q = q.eq('is_martial_arts', true)
  if (martial === 'false') q = q.eq('is_martial_arts', false)
  if (due === 'true') {
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    q = q.not('next_followup_at', 'is', null).lte('next_followup_at', endOfToday.toISOString())
  }
  if (search) {
    const safe = search.replace(/[%,]/g, '')
    // Audit 2026-05-11: erweiterte globale Suche.
    //
    // Was wir matchen:
    //   1. sales_leads:    name, formatted_address, phone, email, notes
    //   2. sales_leads:    international_phone, website, instagram_url, facebook_url
    //   3. sales_activities: subject, body, outcome (Anruf-Notizen, Mail-Inhalte)
    //   4. phone-digits-Normalisierung — siehe Phone-Like-Branch unten
    //
    // Activities werden via Pre-Query gefiltert: erst die lead_ids holen, die
    // im subject/body/outcome matchen, dann in den or()-Filter der Haupt-Query
    // einbauen mit id.in.(...).
    //
    // Activity-Search wird übersprungen wenn Search < 3 Zeichen — sonst floodet
    // die or()-Liste mit zu vielen IDs.
    const digits = safe.replace(/\D/g, '')
    const isPhoneLike = digits.length >= 5 && digits.length / safe.length > 0.5

    // Pre-Query: Lead-IDs aus sales_activities die im subject/body/outcome matchen
    let activityLeadIds: string[] = []
    if (safe.length >= 3 && !isPhoneLike) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: activityHits } = await (supabase.from('sales_activities') as any)
        .select('lead_id')
        .or(`subject.ilike.%${safe}%,body.ilike.%${safe}%,outcome.ilike.%${safe}%`)
        .limit(500)
      if (Array.isArray(activityHits)) {
        activityLeadIds = [...new Set(activityHits.map((r: { lead_id: string }) => r.lead_id).filter(Boolean))]
      }
    }

    // Build or()-Filter — kombiniert Lead-Felder + Activity-Match
    const orParts: string[] = [
      `name.ilike.%${safe}%`,
      `formatted_address.ilike.%${safe}%`,
      `phone.ilike.%${safe}%`,
      `email.ilike.%${safe}%`,
      `notes.ilike.%${safe}%`,
      `international_phone.ilike.%${safe}%`,
      `website.ilike.%${safe}%`,
      `instagram_url.ilike.%${safe}%`,
      `facebook_url.ilike.%${safe}%`,
    ]
    if (isPhoneLike) {
      // Letzte 7 Digits matchen lokalen Telefonteil unabhängig von Country-Code
      orParts.push(`phone.ilike.%${digits.slice(-7)}%`)
      orParts.push(`international_phone.ilike.%${digits.slice(-7)}%`)
    }
    if (activityLeadIds.length > 0) {
      orParts.push(`id.in.(${activityLeadIds.join(',')})`)
    }
    q = q.or(orParts.join(','))
  }

  // Sort: dir-Param ist optional — wenn nicht gesetzt, wird sinnvoller Default je Key gewählt.
  // Klick auf Spalten-Header übergibt direkt asc/desc → echte Bidirektionalität.
  function applyOrder(column: string, defaultDesc: boolean) {
    const ascending = dirParam ? dirParam === 'asc' : !defaultDesc
    return { ascending, nullsFirst: false }
  }

  switch (sort) {
    case 'next_followup': q = q.order('next_followup_at', applyOrder('next_followup_at', false)); break
    case 'created':       q = q.order('created_at',       applyOrder('created_at',       true));  break
    case 'updated':       q = q.order('updated_at',       applyOrder('updated_at',       true));  break
    case 'name':          q = q.order('name',             applyOrder('name',             false)); break
    case 'city':          q = q.order('city',             applyOrder('city',             false)); break
    case 'status':        q = q.order('status',           applyOrder('status',           false)); break
    case 'rating':        q = q.order('rating',           applyOrder('rating',           true));  break
    case 'priority':
    default:              q = q.order('priority', applyOrder('priority', true)).order('updated_at', { ascending: false })
  }

  q = q.range(page * pageSize, page * pageSize + pageSize - 1)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stats
  const { data: stats } = await supabase
    .from('sales_leads')
    .select('status, next_followup_at')
    .limit(10000)
  const statusCounts: Record<string, number> = {}
  let overdueCount = 0
  let todayCount = 0
  const now = Date.now()
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
  const endOfTodayMs = endOfToday.getTime()

  for (const r of (stats ?? []) as Array<{ status: string; next_followup_at: string | null }>) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1
    if (r.next_followup_at) {
      const t = new Date(r.next_followup_at).getTime()
      if (t <= now) overdueCount++
      else if (t <= endOfTodayMs) todayCount++
    }
  }

  return NextResponse.json({
    leads: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
    statusCounts,
    overdueCount,
    todayCount,
  })
}

// POST /api/admin/leads
// Manual lead creation — for when Places API doesn't have it.
export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const supabase = createServiceClient()
  const insert = {
    name,
    formatted_address: typeof body.address === 'string' ? body.address : null,
    phone: typeof body.phone === 'string' ? body.phone : null,
    email: typeof body.email === 'string' ? body.email : null,
    website: typeof body.website === 'string' ? body.website : null,
    instagram_url: typeof body.instagram_url === 'string' ? body.instagram_url : null,
    city: typeof body.city === 'string' ? body.city : null,
    notes: typeof body.notes === 'string' ? body.notes : null,
    priority: typeof body.priority === 'number' ? body.priority : 3,
    is_martial_arts: body.is_martial_arts === true,
    sports: Array.isArray(body.sports) ? body.sports.filter((s: unknown) => typeof s === 'string') : [],
    created_by: auth.user.id,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('sales_leads') as any).insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('sales_activities') as any).insert({
    lead_id: data.id,
    user_id: auth.user.id,
    kind: 'note',
    body: 'Manuell angelegt',
  })

  return NextResponse.json({ lead: data }, { status: 201 })
}
