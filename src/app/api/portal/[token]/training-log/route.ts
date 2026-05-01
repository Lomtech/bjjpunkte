import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = serviceClient()
  const { data: member } = await supabase.from('members').select('id').eq('portal_token', token).single()
  if (!member) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const { data } = await supabase
    .from('training_logs')
    .select('*')
    .eq('member_id', member.id)
    .order('logged_at', { ascending: false })
    .limit(20)
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { note, class_type } = await req.json()
  if (!note?.trim()) return NextResponse.json({ error: 'Notiz fehlt' }, { status: 400 })

  const supabase = serviceClient()
  const { data: member } = await supabase.from('members').select('id, gym_id').eq('portal_token', token).single()
  if (!member) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const { data, error } = await supabase
    .from('training_logs')
    .insert({
      member_id: member.id,
      gym_id: member.gym_id,
      note: note.trim(),
      class_type: class_type || null,
      logged_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
