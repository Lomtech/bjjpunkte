import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AVV_VERSION } from '@/lib/legal/avv-meta'
import { getCachedUser } from '@/lib/auth/cached-user'

export const dynamic = 'force-dynamic'

/**
 * GET /api/avv/status?gym_id=...
 *
 * Returns whether the gym has signed the current AVV version.
 * Used by the dashboard banner and the settings page.
 *
 * Auth: Dual-Pfad (Bearer-Token im Header ODER Cookie-Session) — analog
 * /api/invoices/[paymentId] und /api/gym-mail/*. Cookie-Auth allein ist
 * bei Vercel-Edge nicht zuverlässig genug.
 */
export async function GET(req: Request) {
  // Wrap entire handler in try/catch: AVV-Banner ist non-critical UI —
  // ein 500 darf das ganze Dashboard nicht in den Console-Fehler-Modus zwingen.
  // Bei unerwartetem Fehler returnen wir { signed: false } statt zu crashen.
  try {
    const url = new URL(req.url)
    const gymId = url.searchParams.get('gym_id')
    if (!gymId) return NextResponse.json({ error: 'gym_id missing' }, { status: 400 })

    // Dual-Auth: Bearer ODER Cookie
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')
    const accessToken = authHeader?.replace('Bearer ', '')
    if (accessToken) {
      // Redis-cached, Sprint A 2026-05-30
      const cached = await getCachedUser(accessToken)
      userId = cached?.id ?? null
    } else {
      const sb = await createServerClient()
      const { data } = await sb.auth.getUser()
      userId = data.user?.id ?? null
    }
    if (!userId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

    // Belongs-to check via service-role: vermeidet RLS-Fallstricke wenn der
    // anon-Client wegen vergessener Policy 0 rows liefert obwohl gym existiert.
    // Wir machen den ownership-check selbst.
    const service = createServiceClient()
    const { data: gym, error: gymErr } = await service
      .from('gyms')
      .select('id, owner_id')
      .eq('id', gymId)
      .maybeSingle()
    if (gymErr) {
      console.error('[avv/status] gym lookup failed:', gymErr)
      return NextResponse.json({ error: 'Gym lookup failed', detail: gymErr.message }, { status: 500 })
    }
    if (!gym) return NextResponse.json({ error: 'Gym not found' }, { status: 404 })
    if (gym.owner_id !== userId) {
      return NextResponse.json({ error: 'Nur der Gym-Inhaber darf den AVV einsehen' }, { status: 403 })
    }

    // Latest acceptance for current version
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (service.from('avv_acceptances') as any)
      .select('id, signed_name, signed_role, signed_email, avv_version, accepted_at, withdrawn_at')
      .eq('gym_id', gymId)
      .eq('avv_version', AVV_VERSION)
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[avv/status] avv_acceptances lookup failed:', error)
      // Graceful fallback: AVV-Banner zeigt "noch nicht unterschrieben" statt
      // das ganze Dashboard mit einem 500-Error zu zerstören.
      return NextResponse.json({
        current_version: AVV_VERSION,
        signed: false,
        acceptance: null,
        warning: 'avv-status-unavailable',
      })
    }

    return NextResponse.json({
      current_version: AVV_VERSION,
      signed: !!data && !data.withdrawn_at,
      acceptance: data || null,
    })
  } catch (err) {
    // Letzte Verteidigung: jeder unerwartete Crash → graceful "unsigned"-Response
    console.error('[avv/status] unexpected error:', err)
    return NextResponse.json({
      current_version: AVV_VERSION,
      signed: false,
      acceptance: null,
      warning: 'avv-status-error',
    })
  }
}
