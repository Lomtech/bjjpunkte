import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/gym-mail/recipients?audience=members|leads|both&filter=active|all|recent
 *
 * Gibt nur die Anzahl + Filter-Vorschau zurück (keine Email-Liste).
 * Used für UI-Preview "X Mitglieder werden kontaktiert".
 *
 * Wichtig: Für Bestandsmitglieder mit aktivem Vertrag gilt Art. 6(1)(f) DSGVO
 * — kein expliziter Marketing-Consent nötig (berechtigtes Interesse bei
 *   bestehender Geschäftsbeziehung).
 * Für Leads brauchen wir marketing_email_consent = true.
 *
 * Auth: Dual-Pfad (Bearer-Token im Header ODER Cookie-Session) — analog
 * /api/invoices/[paymentId]. Das Frontend schickt den Bearer-Token explizit,
 * weil Cookie-Auth manchmal nicht zuverlässig durchkommt (Vercel-Edge usw.).
 */
export async function GET(req: Request) {
  // Dual-Auth: Bearer ODER Cookie
  let userId: string | null = null
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (accessToken) {
    const sb = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )
    const { data } = await sb.auth.getUser(accessToken)
    userId = data.user?.id ?? null
  } else {
    const sb = await createServerClient()
    const { data } = await sb.auth.getUser()
    userId = data.user?.id ?? null
  }
  if (!userId) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Datenzugriff via Server-Client (RLS aktiv) ODER Bearer-Client
  const supabase = accessToken
    ? createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      )
    : await createServerClient()

  const url = new URL(req.url)
  const audience = url.searchParams.get('audience') || 'members'
  const filter = url.searchParams.get('filter') || 'active'

  // Find user's gym (must be owner)
  const { data: gym } = await supabase
    .from('gyms').select('id, name').eq('owner_id', userId).maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Kein Gym gefunden' }, { status: 404 })

  let memberCount = 0
  let leadCount = 0

  if (audience === 'members' || audience === 'both') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from('members').select('*', { count: 'exact', head: true })
      .eq('gym_id', gym.id)
      .not('email', 'is', null)
    if (filter === 'active') q = q.eq('is_active', true)
    const { count } = await q
    memberCount = count ?? 0
  }

  if (audience === 'leads' || audience === 'both') {
    // Leads brauchen explizit marketing_email_consent — DSGVO
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('gym_id', gym.id)
      .eq('marketing_email_consent', true)
      .not('email', 'is', null)
    if (filter === 'recent') {
      const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString()
      q = q.gte('created_at', sixMonthsAgo)
    }
    const { count } = await q
    leadCount = count ?? 0
  }

  return NextResponse.json({
    audience,
    filter,
    member_count: memberCount,
    lead_count: leadCount,
    total: memberCount + leadCount,
    gym_name: gym.name,
  })
}
