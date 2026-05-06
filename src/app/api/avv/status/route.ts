import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AVV_VERSION } from '@/lib/legal/avv-content'

export const dynamic = 'force-dynamic'

/**
 * GET /api/avv/status?gym_id=...
 *
 * Returns whether the gym has signed the current AVV version.
 * Used by the dashboard banner and the settings page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const gymId = url.searchParams.get('gym_id')
  if (!gymId) return NextResponse.json({ error: 'gym_id missing' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Belongs-to check: user must be owner of gym
  const { data: gym, error: gymErr } = await supabase
    .from('gyms')
    .select('id, owner_id')
    .eq('id', gymId)
    .maybeSingle()
  if (gymErr) return NextResponse.json({ error: gymErr.message }, { status: 500 })
  if (!gym) return NextResponse.json({ error: 'Gym not found' }, { status: 404 })
  if (gym.owner_id !== user.id) {
    return NextResponse.json({ error: 'Nur der Gym-Inhaber darf den AVV einsehen' }, { status: 403 })
  }

  // Service-role read for the avv_acceptances row (RLS allows it too, but we
  // want to bypass it cleanly). Latest acceptance for current version.
  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service.from('avv_acceptances') as any)
    .select('id, signed_name, signed_role, signed_email, avv_version, accepted_at, withdrawn_at')
    .eq('gym_id', gymId)
    .eq('avv_version', AVV_VERSION)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    current_version: AVV_VERSION,
    signed: !!data && !data.withdrawn_at,
    acceptance: data || null,
  })
}
