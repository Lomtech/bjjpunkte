import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getApiProvider, type HandoffStatus } from '@/lib/inkasso'

// Inbound Inkasso provider webhook — provider-agnostic.
//   POST /api/inkasso/webhook/<provider>
// The provider posts status updates for cases it received. We dispatch to the
// matching adapter's verifyWebhook() (signature/secret) + parseWebhook()
// (payload → StatusUpdate[]), then patch the dunning_handoffs rows by their
// reference_id. No user auth — authenticity comes from the provider signature.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// status → which timestamp column to stamp on transition
function timestampPatch(status: HandoffStatus, nowIso: string): Record<string, string> {
  switch (status) {
    case 'accepted':
      return { accepted_at: nowIso }
    case 'paid':
    case 'written_off':
    case 'closed':
      return { closed_at: nowIso }
    default:
      return {}
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerName } = await params

  const adapter = getApiProvider(providerName)
  if (!adapter) {
    return NextResponse.json({ error: 'Unbekannter oder nicht konfigurierter Provider' }, { status: 404 })
  }

  const rawBody = await req.text()
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => { headers[k.toLowerCase()] = v })

  // 1. Authenticity — adapter verifies signature / shared secret
  if (!adapter.verifyWebhook || !adapter.verifyWebhook(rawBody, headers)) {
    return NextResponse.json({ error: 'Signatur ungültig' }, { status: 401 })
  }

  // 2. Parse payload → status updates
  let payload: unknown
  try {
    payload = rawBody ? JSON.parse(rawBody) : null
  } catch {
    return NextResponse.json({ error: 'Body ist kein gültiges JSON' }, { status: 400 })
  }
  const updates = adapter.parseWebhook?.(payload, headers) ?? null
  if (!updates || updates.length === 0) {
    return NextResponse.json({ error: 'Keine verwertbaren Status-Updates' }, { status: 400 })
  }

  // 3. Apply each update to the matching handoff (by provider + reference_id)
  const service = createServiceClient()
  const nowIso = new Date().toISOString()
  let applied = 0
  const misses: string[] = []

  for (const u of updates) {
    const patch = {
      status: u.status,
      provider_response: u.raw,
      last_status_change_at: nowIso,
      ...timestampPatch(u.status, nowIso),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (service.from('dunning_handoffs') as any)
      .update(patch)
      .eq('provider', providerName)
      .eq('reference_id', u.referenceId)
      .select('id')
    if (res.error) {
      console.error('[inkasso/webhook] update failed:', res.error.message)
      misses.push(u.referenceId)
    } else if (!res.data || res.data.length === 0) {
      misses.push(u.referenceId)
    } else {
      applied += res.data.length
    }
  }

  return NextResponse.json({ ok: true, applied, unmatched: misses })
}
