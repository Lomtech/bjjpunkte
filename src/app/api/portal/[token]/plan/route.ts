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
    .select('id, gym_id, first_name, last_name')
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

  // Notify gym owner
  try {
    const { data: gymData } = await (supabase.from('gyms') as any)
      .select('name, email')
      .eq('id', member.gym_id)
      .single()
    const { data: planData } = await (supabase.from('membership_plans') as any)
      .select('name')
      .eq('id', plan_id)
      .single()
    if (gymData?.email && process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@osss.app',
          to: gymData.email,
          subject: `Plan-Änderung beantragt von ${member.first_name} ${member.last_name}`,
          html: `<p>Hallo,</p><p><strong>${member.first_name} ${member.last_name}</strong> möchte den Tarif wechseln${planData?.name ? ` zu <strong>${planData.name}</strong>` : ''}.</p><p>Bitte bearbeite die Anfrage im Dashboard.</p>`,
        }),
      })
    }
  } catch {}

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
