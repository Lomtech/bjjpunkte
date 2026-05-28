import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

// PATCH /api/gym/settings
//
// Sprint 2026-05-27: Server-Side Save für gym-settings.
// Umgeht CORS-Probleme die manche Browser-Extensions auf direkten PATCH zu
// supabase.co machen — der Browser ruft same-origin /api/... statt
// cross-origin supabase.co.
//
// Auth: Bearer-Token. Owner-Verifizierung gegen gyms.owner_id, dann
// Update via Service-Role (bypass RLS für defense-in-depth).
//
// Whitelist: nur die hier aufgelisteten Felder werden übernommen, kein
// Mass-Assignment-Risiko.

export const dynamic = 'force-dynamic'

const ALLOWED_FIELDS = new Set([
  // DATEV
  'datev_beraternummer',
  'datev_mandantennummer',
  'datev_debitor_account',
  // Verzugszinsen
  'dunning_interest_basisrate_pct',
  'dunning_interest_surcharge_pct',
  // Steuerberater-Versand
  'accountant_email',
  'accountant_dispatch_enabled',
  'accountant_send_day',
  // Mahnwesen (bereits in DunningSection genutzt)
  'dunning_late_fee_cents',
  'dunning_days_to_level_2',
  'dunning_days_to_level_3',
])

function getSupabaseAuth(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function PATCH(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const authClient = getSupabaseAuth(token)
  const { data: { user } } = await authClient.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await authClient.from('gyms').select('id').eq('owner_id', user.id).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  // Whitelist-Filter
  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_FIELDS.has(key)) continue
    update[key] = value
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Keine erlaubten Felder im Body' }, { status: 400 })
  }

  // Update via Service-Client (bypass RLS, aber Owner-Check oben war strict)
  const service = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (service.from('gyms') as any)
    .update(update)
    .eq('id', gym.id)
    .select('id, ' + Array.from(ALLOWED_FIELDS).join(', '))
    .single()

  if (error) {
    console.error('[gym/settings] update failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, gym: data })
}
