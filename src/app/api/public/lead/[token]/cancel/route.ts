import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  // Token-Hardening (Audit 2026-05-09 / A2): 20 → 32 Zeichen. Brute-Force-Schutz.
  if (!token || token.length < 32 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return NextResponse.json({ error: 'Ungültiger Token' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const { class_id } = body as { class_id?: string }
  if (!class_id || typeof class_id !== 'string' || class_id.length > 64) {
    return NextResponse.json({ error: 'class_id fehlt' }, { status: 400 })
  }

  const supabase = serviceClient()

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, gym_id')
    .eq('lead_token', token)
    .single()

  if (leadErr || !lead) {
    return NextResponse.json({ error: 'Interessent nicht gefunden' }, { status: 404 })
  }

  const { data: cls, error: clsErr } = await supabase
    .from('classes')
    .select('gym_id')
    .eq('id', class_id)
    .single()

  if (clsErr || !cls || cls.gym_id !== lead.gym_id) {
    return NextResponse.json({ error: 'Klasse nicht gefunden' }, { status: 404 })
  }

  const { error } = await supabase
    .from('lead_bookings')
    .update({ status: 'cancelled' })
    .eq('lead_id', lead.id)
    .eq('class_id', class_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
