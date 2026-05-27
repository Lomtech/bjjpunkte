/**
 * GET /api/members/[id]/dunning/handoff-pdf
 *
 * Owner-only Download des **Inkasso-Übergabe-Dossiers** als PDF.
 *
 * Wenn der Owner den Fall an einen Inkasso-Dienstleister abgibt
 * (`dunning_level >= 3`), kann er hier die komplette Akte als ein einziges
 * Standard-PDF bekommen — anbieter-agnostisch (kein Creditreform-/Atradius-/…
 * spezifisches Format).
 *
 * Auth: Dual-Auth (Bearer-Token ODER Cookie-Session) wie in
 * `members/[id]/contract/route.tsx`. Owner-Check via `gym.owner_id`.
 *
 * Stream: NodeJS.ReadableStream → Web ReadableStream<Uint8Array>.
 */

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { getIbanFromGym } from '@/lib/encryption'
import {
  renderHandoffPdf,
  buildHandoffFileNumber,
  type HandoffPdfAction,
} from '@/lib/dunning-handoff-pdf'

// @react-pdf/renderer braucht Node-Runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Dual-Auth: Bearer-Token (Frontend `fetch`) ODER Cookie-Session (direkter
 * Browser-Aufruf via <a href>). Returns null wenn unauthentifiziert.
 */
async function authenticateUser(
  req: Request,
): Promise<{ id: string } | null> {
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (accessToken) {
    const sb = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data } = await sb.auth.getUser(accessToken)
    return data.user ? { id: data.user.id } : null
  }
  const sb = await createServerClient()
  const { data } = await sb.auth.getUser()
  return data.user ? { id: data.user.id } : null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: memberId } = await params

  const user = await authenticateUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  // Service-Client für DB-Reads (RLS-Bypass; Ownership prüfen wir explizit).
  const service = createServiceClient()

  // Owner-Check via gym.owner_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gym } = await (service.from('gyms') as any)
    .select(
      'id, name, address, phone, email, tax_number, bank_iban_enc, dunning_interest_basisrate_pct, dunning_interest_surcharge_pct',
    )
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!gym) {
    return NextResponse.json({ error: 'Kein Gym' }, { status: 404 })
  }

  // Mitglied laden + sicherstellen, dass er zum Gym gehört
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (service.from('members') as any)
    .select(
      'id, gym_id, first_name, last_name, email, phone, address, date_of_birth, ' +
        'join_date, contract_end_date, contract_signed_at, consent_ip, consent_user_agent, ' +
        'dunning_level, dunning_amount_cents',
    )
    .eq('id', memberId)
    .eq('gym_id', gym.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json(
      { error: 'Mitglied nicht gefunden' },
      { status: 404 },
    )
  }

  // Dunning-Aktionen laden — chronologisch absteigend (neueste oben).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actionsRaw } = await (service.from('dunning_actions') as any)
    .select('id, action_type, amount_cents, notes, performed_by, performed_at')
    .eq('member_id', memberId)
    .eq('gym_id', gym.id)
    .order('performed_at', { ascending: false })

  const dunningActions: HandoffPdfAction[] = Array.isArray(actionsRaw)
    ? actionsRaw
    : []

  const totalAmount = Math.max(
    0,
    Math.round(member.dunning_amount_cents ?? 0),
  )

  const stream = await renderHandoffPdf({
    member: {
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      phone: member.phone,
      address: member.address,
      date_of_birth: member.date_of_birth,
      join_date: member.join_date,
      contract_end_date: member.contract_end_date,
      contract_signed_at: member.contract_signed_at,
      consent_ip: member.consent_ip,
      consent_user_agent: member.consent_user_agent,
    },
    gym: {
      name: gym.name,
      address: gym.address,
      phone: gym.phone,
      email: gym.email,
      tax_number: gym.tax_number,
      iban: getIbanFromGym(gym),
      dunning_interest_basisrate_pct: gym.dunning_interest_basisrate_pct,
      dunning_interest_surcharge_pct: gym.dunning_interest_surcharge_pct,
    },
    dunningActions,
    totalAmount,
  })

  // NodeJS.ReadableStream → Web ReadableStream<Uint8Array>
  const webStream = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk: Buffer) =>
        controller.enqueue(new Uint8Array(chunk)),
      )
      stream.on('end', () => controller.close())
      stream.on('error', (e: unknown) => controller.error(e))
    },
  })

  // Filename: Inkasso-Dossier_<lastname>_<aktenzeichen>.pdf
  const fileNo = buildHandoffFileNumber(member.last_name, member.id, new Date())
  const safeLastName = (member.last_name ?? 'Mitglied').replace(
    /[^a-zA-Z0-9_.-]/g,
    '_',
  )
  const filename = `Inkasso-Dossier_${safeLastName}_${fileNo}.pdf`.replace(
    /[^a-zA-Z0-9_.-]/g,
    '_',
  )

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  })
}
