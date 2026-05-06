import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/me — returns 200 + { admin: true } if caller is admin, else 403.
// Used by the dashboard sidebar to conditionally show the "Sales-CRM" link.
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error
  return NextResponse.json({ admin: true, email: auth.email })
}
