import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Ownership guard: fetch the staff record and verify it belongs to the caller's gym
  const { data: gym } = await supabase
    .from('gyms')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!gym) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })

  const { data: staffRecord } = await supabase
    .from('gym_staff')
    .select('gym_id')
    .eq('id', id)
    .single()
  if (!staffRecord || staffRecord.gym_id !== gym.id) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  await supabase.from('gym_staff').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
