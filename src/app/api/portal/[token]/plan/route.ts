import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { plan_id } = await req.json()

  if (!token || !plan_id) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const supabase = serviceClient()

  const { data: member, error } = await supabase
    .from('members')
    .select('id, gym_id')
    .eq('portal_token', token)
    .single()

  if (error || !member) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  // Verify the plan belongs to the same gym
  const { data: plan } = await (supabase.from('membership_plans') as any)
    .select('id')
    .eq('id', plan_id)
    .eq('gym_id', member.gym_id)
    .eq('is_active', true)
    .single()

  if (!plan) {
    return NextResponse.json({ error: 'Plan nicht gefunden' }, { status: 404 })
  }

  await (supabase.from('members') as any)
    .update({ requested_plan_id: plan_id })
    .eq('id', member.id)

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = serviceClient()

  const { data: member } = await supabase
    .from('members').select('id').eq('portal_token', token).single()

  if (!member) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await (supabase.from('members') as any)
    .update({ requested_plan_id: null })
    .eq('id', member.id)

  return NextResponse.json({ success: true })
}
