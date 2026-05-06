import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'
import { getPlacesQuota } from '@/lib/places-quota'

export const dynamic = 'force-dynamic'

// GET /api/admin/leads/places-quota
// Returns daily/monthly Google Places API usage + cost.
// Used by the CRM UI top banner ("Heute: 12 / 100 Calls · ~$0.42").
export async function GET(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error
  const quota = await getPlacesQuota(createServiceClient())
  return NextResponse.json(quota)
}
