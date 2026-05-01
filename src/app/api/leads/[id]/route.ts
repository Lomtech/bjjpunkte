import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const supabase = getSupabase(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Gym-Ownership verifizieren
  const { data: gym } = await supabase.from('gyms').select('id').single()
  if (!gym) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: lead } = await supabase.from('leads').select('gym_id').eq('id', id).single()
  if (!lead || lead.gym_id !== gym.id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  // Nur erlaubte Felder übernehmen (kein Mass Assignment)
  const body = await req.json()
  const { status, notes, trial_date, source, phone, email } = body
  const allowedFields: Record<string, unknown> = {}
  if (status !== undefined)     allowedFields.status     = status
  if (notes !== undefined)      allowedFields.notes      = notes
  if (trial_date !== undefined) allowedFields.trial_date = trial_date
  if (source !== undefined)     allowedFields.source     = source
  if (phone !== undefined)      allowedFields.phone      = phone
  if (email !== undefined)      allowedFields.email      = email

  const { data, error } = await supabase.from('leads').update(allowedFields).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const supabase = getSupabase(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Gym-Ownership verifizieren
  const { data: gym } = await supabase.from('gyms').select('id').single()
  if (!gym) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: lead } = await supabase.from('leads').select('gym_id').eq('id', id).single()
  if (!lead || lead.gym_id !== gym.id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await supabase.from('leads').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
