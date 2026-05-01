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
  const { note } = await req.json().catch(() => ({ note: '' }))

  const supabase = serviceClient()

  const { data: member, error } = await supabase
    .from('members').select('id').eq('portal_token', token).single()

  if (error || !member) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  await (supabase.from('members') as any).update({
    cancellation_requested_at: new Date().toISOString(),
    cancellation_note: note || null,
  }).eq('id', member.id)

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = serviceClient()

  const { data: member } = await supabase
    .from('members').select('id').eq('portal_token', token).single()

  if (!member) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await (supabase.from('members') as any).update({
    cancellation_requested_at: null,
    cancellation_note: null,
  }).eq('id', member.id)

  return NextResponse.json({ success: true })
}
