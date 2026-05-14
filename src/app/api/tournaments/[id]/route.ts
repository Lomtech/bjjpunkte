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

async function authorizeForTournament(req: Request, tournamentId: string) {
  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return { error: NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 }) }

  const supabase = authClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return { error: NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 }) }

  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: t } = await (service.from('member_tournaments') as any)
    .select('id, gym_id, member_id')
    .eq('id', tournamentId)
    .maybeSingle()
  if (!t) return { error: NextResponse.json({ error: 'Turnier nicht gefunden' }, { status: 404 }) }

  const { data: gym } = await service.from('gyms').select('id, owner_id').eq('id', t.gym_id).maybeSingle()
  if (!gym || gym.owner_id !== user.id) {
    return { error: NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 }) }
  }

  return { tournament: t, service, user }
}

/**
 * PATCH /api/tournaments/[id]
 * Updates a tournament entry. Only the gym owner can edit.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authorizeForTournament(req, id)
  if ('error' in auth) return auth.error
  const { service } = auth

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if (typeof body.name === 'string')           updates.name           = body.name.trim().slice(0, 200)
  if (typeof body.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.event_date))
                                               updates.event_date     = body.event_date
  if (typeof body.location === 'string')       updates.location       = body.location.trim().slice(0, 200) || null
  if (typeof body.discipline === 'string' && VALID_DISCIPLINES.has(body.discipline))
                                               updates.discipline     = body.discipline
  if (typeof body.weight_class === 'string')   updates.weight_class   = body.weight_class.trim().slice(0, 100) || null
  if (typeof body.age_division === 'string')   updates.age_division   = body.age_division.trim().slice(0, 100) || null
  if (typeof body.belt_at_event === 'string')  updates.belt_at_event  = body.belt_at_event.trim().slice(0, 50) || null
  if (typeof body.result === 'string' && VALID_RESULTS.has(body.result))
                                               updates.result         = body.result
  if (Number.isFinite(body.matches_won))       updates.matches_won    = (body.matches_won  as number) >= 0 ? body.matches_won  : null
  if (Number.isFinite(body.matches_lost))      updates.matches_lost   = (body.matches_lost as number) >= 0 ? body.matches_lost : null
  if (typeof body.notes === 'string')          updates.notes          = body.notes.trim().slice(0, 1000) || null
  if (typeof body.smoothcomp_url === 'string') updates.smoothcomp_url = /^https?:\/\/(www\.)?smoothcomp\.com\//i.test(body.smoothcomp_url) ? body.smoothcomp_url.trim() : null
  if (typeof body.public_visible === 'boolean') updates.public_visible = body.public_visible

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Keine erlaubten Felder zum Update' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service.from('member_tournaments') as any)
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[api/tournaments/[id] PATCH] failed:', error)
    return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 })
  }
  return NextResponse.json({ tournament: data })
}

/**
 * DELETE /api/tournaments/[id]
 * Removes a tournament entry. Only the gym owner can delete.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await authorizeForTournament(req, id)
  if ('error' in auth) return auth.error
  const { service } = auth

  const { error } = await service.from('member_tournaments').delete().eq('id', id)
  if (error) {
    console.error('[api/tournaments/[id] DELETE] failed:', error)
    return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
