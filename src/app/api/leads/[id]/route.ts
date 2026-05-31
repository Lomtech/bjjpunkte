import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint C 2026-05-30: resolveOwnerGym mit Redis-Cache

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead } = await (supabase.from('leads') as any).select('gym_id').eq('id', id).single()
  if (!lead || lead.gym_id !== auth.gym.id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('leads') as any).update(allowedFields).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead } = await (supabase.from('leads') as any).select('gym_id').eq('id', id).single()
  if (!lead || lead.gym_id !== auth.gym.id) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await supabase.from('leads').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
