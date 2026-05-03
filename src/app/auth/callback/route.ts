import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * OAuth callback — Supabase exchanges the code for a session.
 * After Google / Apple login the user lands here, then gets
 * redirected to /dashboard (or /dashboard/onboarding if new).
 */
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/dashboard'
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:    () => cookieStore.getAll(),
        setAll: (cs) => { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    }
  )

  const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code)

  if (exchErr || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // New OAuth users won't have a gym yet → send them to onboarding
  const { data: gym } = await supabase
    .from('gyms')
    .select('id, onboarding_completed_at')
    .eq('owner_id', data.session.user.id)
    .maybeSingle()

  if (!gym || !(gym as { onboarding_completed_at: string | null }).onboarding_completed_at) {
    return NextResponse.redirect(`${origin}/dashboard/onboarding`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
