import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

// POST /api/members/[id]/parent-signature
//
// Feature #1 (2026-05-27): Eltern-Co-Sign für Minderjährige.
//
// Erfasst die Unterschrift des/der Erziehungsberechtigten + Beziehung
// + sole_custody-Erklärung. Server stempelt parent_signed_at + IP + UA
// als eIDAS-Art-25-Simple-Electronic-Signature.
//
// Body:
// {
//   parent_first_name: string,
//   parent_last_name: string,
//   parent_email?: string,
//   parent_phone?: string,
//   parent_relationship: 'mother' | 'father' | 'guardian' | 'other',
//   parent_signature_data: string,        // Base64 PNG der gezeichneten Signatur
//   parent_consent_text?: string,         // Was wurde dem/der Erziehungsberechtigten gezeigt
//   sole_custody_declared?: boolean       // 'Ich erkläre eidesstattlich, allein sorgeberechtigt zu sein'
// }
//
// Auth: Owner via Bearer-Token. RLS filtert auf eigenes Gym.
//
// Hinweis: Wir prüfen BGB §1626/§1629 NICHT serverseitig — Owner ist verant-
// wortlich, dass die korrekte sorgeberechtigte Person unterschrieben hat.
// Wir speichern nur den Audit-Trail (IP/UA/Timestamp).

const RELATIONSHIPS = new Set(['mother', 'father', 'guardian', 'other'])

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)
  const gym = auth.gym

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase.from('members') as any)
    .select('id, gym_id, first_name, last_name, date_of_birth')
    .eq('id', id)
    .maybeSingle()
  if (!member || member.gym_id !== gym.id) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>

  const parent_first_name = typeof body.parent_first_name === 'string' ? body.parent_first_name.slice(0, 100).trim() : ''
  const parent_last_name  = typeof body.parent_last_name  === 'string' ? body.parent_last_name.slice(0, 100).trim()  : ''
  const parent_email      = typeof body.parent_email      === 'string' ? body.parent_email.slice(0, 200).trim()      : null
  const parent_phone      = typeof body.parent_phone      === 'string' ? body.parent_phone.slice(0, 50).trim()        : null
  const parent_relationship = typeof body.parent_relationship === 'string' ? body.parent_relationship : ''
  const parent_signature_data = typeof body.parent_signature_data === 'string' ? body.parent_signature_data : ''
  const parent_consent_text = typeof body.parent_consent_text === 'string' ? body.parent_consent_text.slice(0, 5000) : null
  const sole_custody_declared = body.sole_custody_declared === true

  if (!parent_first_name || !parent_last_name) {
    return NextResponse.json({ error: 'Vor- und Nachname des/der Erziehungsberechtigten sind Pflicht' }, { status: 400 })
  }
  if (!RELATIONSHIPS.has(parent_relationship)) {
    return NextResponse.json({ error: 'parent_relationship muss einer von mother/father/guardian/other sein' }, { status: 400 })
  }
  if (!parent_signature_data || !parent_signature_data.startsWith('data:image/')) {
    return NextResponse.json({ error: 'parent_signature_data muss ein data:image/...;base64,... String sein' }, { status: 400 })
  }
  if (parent_signature_data.length > 500_000) {
    return NextResponse.json({ error: 'parent_signature_data zu groß (max 500 KB Base64)' }, { status: 413 })
  }

  // Beweis-Trail: IP + User-Agent vom Request mitschreiben (Vercel-Edge-Header)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? req.headers.get('x-real-ip')?.trim()
        ?? null
  const ua = req.headers.get('user-agent')?.slice(0, 500) ?? null

  const now = new Date().toISOString()
  const update = {
    parent_first_name,
    parent_last_name,
    parent_email,
    parent_phone,
    parent_relationship,
    parent_signature_data,
    parent_signed_at: now,
    parent_consent_ip: ip,
    parent_consent_user_agent: ua,
    parent_consent_text,
    sole_custody_declared,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase.from('members') as any)
    .update(update).eq('id', id).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    member: updated,
    legal_note: 'eIDAS Art. 25 Abs. 1 Simple Electronic Signature. Audit-Trail: parent_signed_at + parent_consent_ip + parent_consent_user_agent gespeichert.',
  })
}

// DELETE /api/members/[id]/parent-signature — Reset (z.B. bei Korrektur)
// Owner-only, behält die Audit-Spur indirekt via audit_log Trigger.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)
  const gym = auth.gym

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase.from('members') as any)
    .select('id, gym_id').eq('id', id).maybeSingle()
  if (!member || member.gym_id !== gym.id) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('members') as any).update({
    parent_first_name: null,
    parent_last_name: null,
    parent_email: null,
    parent_phone: null,
    parent_relationship: null,
    parent_signature_data: null,
    parent_signed_at: null,
    parent_consent_ip: null,
    parent_consent_user_agent: null,
    parent_consent_text: null,
    sole_custody_declared: false,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
