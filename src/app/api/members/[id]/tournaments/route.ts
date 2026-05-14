import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/types/database'
import { TOURNAMENT_DISCIPLINES, TOURNAMENT_RESULTS } from '@/lib/tournaments'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_DISCIPLINES: Set<string> = new Set(TOURNAMENT_DISCIPLINES.map(d => d.value))
const VALID_RESULTS:     Set<string> = new Set(TOURNAMENT_RESULTS.map(r => r.value))

function authClient(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

/**
 * GET /api/members/[id]/tournaments
 * Returns all tournaments for a member (newest first).
 * Auth: Bearer access-token, Owner/Staff of the member's gym.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Ownership-Check via service-role (RLS würde funktionieren, aber expliziter Check
  // liefert klarere Error-Codes).
  const service = createServiceClient()
  const { data: member } = await service.from('members').select('id, gym_id').eq('id', memberId).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })

  const { data: gym } = await service.from('gyms').select('id, owner_id').eq('id', member.gym_id).maybeSingle()
  if (!gym || gym.owner_id !== user.id) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service.from('member_tournaments') as any)
    .select('*')
    .eq('member_id', memberId)
    .order('event_date', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[api/members/[id]/tournaments GET] failed:', error)
    return NextResponse.json({ error: 'Lesefehler' }, { status: 500 })
  }
  return NextResponse.json({ tournaments: data ?? [] })
}

/**
 * POST /api/members/[id]/tournaments
 * Creates a new tournament entry for the member.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  // Validation
  const name        = typeof body.name === 'string' ? body.name.trim() : ''
  const event_date  = typeof body.event_date === 'string' ? body.event_date : ''
  const discipline  = typeof body.discipline === 'string' ? body.discipline : ''
  const result      = typeof body.result === 'string' ? body.result : ''

  if (!name || name.length > 200)        return NextResponse.json({ error: 'Name fehlt oder zu lang' }, { status: 400 })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) return NextResponse.json({ error: 'event_date muss YYYY-MM-DD sein' }, { status: 400 })
  if (!VALID_DISCIPLINES.has(discipline))     return NextResponse.json({ error: 'Ungültige Disziplin' }, { status: 400 })
  if (!VALID_RESULTS.has(result))             return NextResponse.json({ error: 'Ungültiges Ergebnis' }, { status: 400 })

  const service = createServiceClient()
  const { data: member } = await service.from('members').select('id, gym_id').eq('id', memberId).maybeSingle()
  if (!member) return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })

  const { data: gym } = await service.from('gyms').select('id, owner_id').eq('id', member.gym_id).maybeSingle()
  if (!gym || gym.owner_id !== user.id) {
    return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  }

  const payload = {
    member_id:          memberId,
    gym_id:             member.gym_id,
    name,
    event_date,
    location:           typeof body.location === 'string' && body.location.trim() ? body.location.trim().slice(0, 200) : null,
    discipline,
    weight_class:       typeof body.weight_class === 'string' && body.weight_class.trim() ? body.weight_class.trim().slice(0, 100) : null,
    age_division:       typeof body.age_division === 'string' && body.age_division.trim() ? body.age_division.trim().slice(0, 100) : null,
    belt_at_event:      typeof body.belt_at_event === 'string' && body.belt_at_event.trim() ? body.belt_at_event.trim().slice(0, 50) : null,
    result,
    matches_won:        Number.isFinite(body.matches_won)  && (body.matches_won  as number) >= 0 ? (body.matches_won  as number) : null,
    matches_lost:       Number.isFinite(body.matches_lost) && (body.matches_lost as number) >= 0 ? (body.matches_lost as number) : null,
    notes:              typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null,
    smoothcomp_url:     typeof body.smoothcomp_url === 'string' && /^https?:\/\/(www\.)?smoothcomp\.com\//i.test(body.smoothcomp_url) ? body.smoothcomp_url.trim() : null,
    public_visible:     body.public_visible === true,
    created_by_user_id: user.id,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service.from('member_tournaments') as any)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    console.error('[api/members/[id]/tournaments POST] failed:', error)
    return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 })
  }
  return NextResponse.json({ tournament: data })
}
