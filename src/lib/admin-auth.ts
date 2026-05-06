import { createClient } from '@supabase/supabase-js'

/**
 * Admin auth helper for the personal Sales-CRM (and any other internal tools).
 * Only emails listed in ADMIN_EMAILS (comma-separated env var) get through.
 *
 * Usage in an API route:
 *   const auth = await requireAdmin(req)
 *   if ('error' in auth) return auth.error
 *   const { user } = auth
 */
export async function requireAdmin(req: Request) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (adminEmails.length === 0) {
    return { error: jsonError('Admin not configured (ADMIN_EMAILS missing)', 500) } as const
  }

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '').trim()
  if (!accessToken) return { error: jsonError('Nicht autorisiert', 401) } as const

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return { error: jsonError('Nicht autorisiert', 401) } as const

  const email = (user.email ?? '').toLowerCase()
  if (!adminEmails.includes(email)) {
    return { error: jsonError('Forbidden — admin only', 403) } as const
  }

  return { user, email } as const
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
