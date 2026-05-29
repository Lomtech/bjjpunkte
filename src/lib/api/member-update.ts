'use client'

import { createClient } from '@/lib/supabase/client'

// Client-Helper für Member-Updates (CORS-resistent gegen Browser-Extensions
// die PATCH zu supabase.co blocken). Ruft same-origin /api/members/[id]/update
// mit Bearer-Auth. Whitelist + Service-Role im Server-Handler.
//
// Verwende statt direktem `supabase.from('members').update(...).eq('id', ...)`.

export async function updateMember(
  memberId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: true; member: Record<string, unknown> }> {
  const sb = createClient()
  const { data: { session } } = await sb.auth.getSession()
  const res = await fetch(`/api/members/${memberId}/update`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(json.error || `Update fehlgeschlagen (${res.status})`)
  }
  return res.json()
}
