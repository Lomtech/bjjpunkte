import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/leads
//   ?status=new,contacted&city=München&martial=true&search=foo&page=0&pageSize=50
//   &sort=priority|next_followup|created|updated|name (default: priority)
//   &due=true   → only follow-ups due today or earlier
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
    q = q.or(`name.ilike.%${safe}%,formatted_address.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`)
  }

  // sort
  switch (sort) {
    case 'next_followup': q = q.order('next_followup_at', { ascending: true, nullsFirst: false }); break
    case 'created':       q = q.order('created_at', { ascending: false }); break
    case 'updated':       q = q.order('updated_at', { ascending: false }); break
    case 'name':          q = q.order('name', { ascending: true }); break
    case 'priority':
    default:              q = q.order('priority', { ascending: false }).order('updated_at', { ascending: false })
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
