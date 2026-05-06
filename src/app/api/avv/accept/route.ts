import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AVV_VERSION } from '@/lib/legal/avv-content'

export const dynamic = 'force-dynamic'

/**
 * POST /api/avv/accept
 * Body: { gym_id, signed_name, signed_role?, accept: true }
 *
 * Records an electronic signature for the current AVV version.
 * Audit-Trail: signed_name, signed_email (from auth.users), IP, User-Agent, Timestamp
 *
 * Idempotent for same (gym_id, avv_version) — returns existing acceptance.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const gymId = typeof body.gym_id === 'string' ? body.gym_id : null
  const signedName = typeof body.signed_name === 'string' ? body.signed_name.trim() : ''
  const signedRole = typeof body.signed_role === 'string' ? body.signed_role.trim() : null
  const accepted = body.accept === true

  if (!gymId)              return NextResponse.json({ error: 'gym_id fehlt' }, { status: 400 })
  if (!signedName)         return NextResponse.json({ error: 'Name muss angegeben werden' }, { status: 400 })
  if (signedName.length < 3) return NextResponse.json({ error: 'Name zu kurz' }, { status: 400 })
  if (!accepted)           return NextResponse.json({ error: 'Zustimmung erforderlich' }, { status: 400 })

  // Belongs-to check: user must be the gym owner (only owner can sign AVV)
  const { data: gym, error: gymErr } = await supabase
    .from('gyms')
    .select('id, owner_id, name')
    .eq('id', gymId)
    .maybeSingle()
  if (gymErr) return NextResponse.json({ error: gymErr.message }, { status: 500 })
  if (!gym)   return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })
  if (gym.owner_id !== user.id) {
    return NextResponse.json({ error: 'Nur der Gym-Inhaber kann den AVV unterzeichnen' }, { status: 403 })
  }

  // Audit data
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  const userAgent = req.headers.get('user-agent') || null

  const service = createServiceClient()

  // Idempotent: if already signed for this version, return existing record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (service.from('avv_acceptances') as any)
    .select('*')
    .eq('gym_id', gymId)
    .eq('avv_version', AVV_VERSION)
    .maybeSingle()

  if (existing && !existing.withdrawn_at) {
    return NextResponse.json({ acceptance: existing, already_signed: true })
  }

  // If withdrawn previously, allow re-signing by deleting the old withdrawn record
  // (UNIQUE constraint would otherwise block insert)
  if (existing && existing.withdrawn_at) {
    await service.from('avv_acceptances').delete().eq('id', existing.id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service.from('avv_acceptances') as any)
    .insert({
      gym_id: gymId,
      user_id: user.id,
      signed_name: signedName.slice(0, 200),
      signed_role: signedRole?.slice(0, 100) || null,
      signed_email: user.email ?? '',
      avv_version: AVV_VERSION,
      ip_address: ip,
      user_agent: userAgent?.slice(0, 500) || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ acceptance: data, already_signed: false }, { status: 201 })
}
