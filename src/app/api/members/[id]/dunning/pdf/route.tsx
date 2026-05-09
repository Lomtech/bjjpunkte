/**
 * GET /api/members/[id]/dunning/pdf?level=1|2|3
 *
 * Owner-only Vorschau/Download des Mahnungs-PDFs für ein Mitglied.
 *
 * Mit `level` lässt sich gezielt eine andere Stufe rendern (z. B. 2. Mahnung
 * vorab als Vorschau). Default = aktueller `dunning_level` des Mitglieds (mind. 1).
 *
 * Auth: Dual-Auth (Bearer-Token ODER Cookie-Session) wie in
 * `members/[id]/contract/route.tsx`. Owner-Check via gym.owner_id.
 */

import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { getIbanFromGym } from '@/lib/encryption'
import { renderDunningPdf, type DunningKind } from '@/lib/dunning-pdf'

// @react-pdf/renderer braucht Node-Runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function authenticateUser(req: Request): Promise<{ id: string } | null> {
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

function levelToKind(level: number): DunningKind {
  if (level >= 3) return 'final_warning'
  if (level === 2) return 'second_reminder'
  return 'first_reminder'
}

function feeForKind(kind: DunningKind): number {
  if (kind === 'second_reminder') return 1000
  if (kind === 'final_warning') return 1000
  return 0
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: memberId } = await params
  const { searchParams } = new URL(req.url)
  const levelParam = searchParams.get('level')
  const requestedLevel = levelParam ? Number(levelParam) : NaN

  const user = await authenticateUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }

  const service = createServiceClient()

  // Gym + Owner-Check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gym } = await (service.from('gyms') as any)
    .select('id, name, address, email, bank_iban_enc')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!gym) {
    return NextResponse.json({ error: 'Kein Gym' }, { status: 404 })
  }

  // Member laden + sicherstellen, dass er zum Gym gehört
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (service.from('members') as any)
    .select(
      'id, gym_id, first_name, last_name, email, address, dunning_level, dunning_amount_cents, dunning_started_at',
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

  // Level/Kind bestimmen
  const currentLevel = Math.max(1, Number(member.dunning_level ?? 1) || 1)
  const useLevel =
    Number.isFinite(requestedLevel) && requestedLevel >= 1 && requestedLevel <= 3
      ? Math.round(requestedLevel)
      : currentLevel
  const kind = levelToKind(useLevel)

  const amountCents = Math.max(0, Math.round(member.dunning_amount_cents ?? 0))
  const issuedAt = new Date()
  const dueDate = new Date(issuedAt.getTime() + 14 * 24 * 60 * 60 * 1000)

  const stream = await renderDunningPdf({
    member: {
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      address: member.address,
    },
    gym: {
      name: gym.name,
      address: gym.address,
      email: gym.email,
      iban: getIbanFromGym(gym),
    },
    dunning: {
      amount_cents: amountCents,
      started_at: member.dunning_started_at ?? null,
      issued_at: issuedAt,
      due_date: dueDate,
      fee_cents: feeForKind(kind),
    },
    kind,
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

  const safeName = `${member.last_name}_${member.first_name}`.replace(
    /[^a-zA-Z0-9_.-]/g,
    '_',
  )
  const filename = `Mahnung_${safeName}_${useLevel}.pdf`

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    },
  })
}
