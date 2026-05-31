import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { getCachedUser } from '@/lib/auth/cached-user'
import { getCachedGymForOwner } from '@/lib/auth/cached-gym'

// PATCH /api/members/[id]/update
//
// Server-Side Member-Update (CORS-resistent gegen Browser-Extensions die
// PATCH zu supabase.co blockieren). Same-Origin Bearer-Auth.
//
// Whitelist: nur die hier aufgelisteten Felder werden uebernommen, kein
// Mass-Assignment-Risiko.

export const dynamic = 'force-dynamic'

const ALLOWED_FIELDS = new Set<string>([
  // Basis-Profil
  'first_name', 'last_name', 'email', 'phone', 'address',
  'date_of_birth', 'join_date', 'belt', 'stripes', 'is_active', 'notes',
  'emergency_contact_name', 'emergency_contact_phone',
  // Parent/Kid Vertragslink + Quelle
  'parent_member_id', 'membership_source',
  // Kuendigungs-Lifecycle (Owner-Approval)
  'cancellation_requested_at', 'cancellation_note',
  // Vertragsende-Override
  'contract_end_date',
  // Plan/Override
  'plan_id', 'requested_plan_id', 'monthly_fee_override_cents',
  // Subscription-Status (z.B. nach manueller Korrektur)
  'subscription_status',
])

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Redis-cached: spart ~50–150ms pro Call (Sprint A 2026-05-30)
  const user = await getCachedUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const authClient = getSupabase(token)

  // Sprint B 2026-05-30: Redis-cached Owner→Gym-Resolution
  const gym = await getCachedGymForOwner(user.id)
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  // Verify member gehoert zum gym
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (authClient.from('members') as any)
    .select('id, gym_id')
    .eq('id', memberId)
    .maybeSingle()
  if (!member || member.gym_id !== gym.id) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const update: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(k)) update[k] = v
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Keine erlaubten Felder im Body' }, { status: 400 })
  }

  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service.from('members') as any)
    .update(update).eq('id', memberId).select().single()
  if (error) {
    console.error('[members/update]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, member: data })
}
