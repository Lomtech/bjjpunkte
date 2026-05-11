import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withApiHandler } from '@/lib/api/with-error-handler'

export const DELETE = withApiHandler('attendance.byId.delete', async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params

  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Ownership guard: verify the attendance record belongs to the caller's gym
  const { data: gym } = await supabase
    .from('gyms')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!gym) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 403 })

  const { data: record } = await supabase
    .from('attendance')
    .select('gym_id')
    .eq('id', id)
    .single()

  if (!record || (record as any).gym_id !== gym.id) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }

  await supabase.from('attendance').delete().eq('id', id)

  return NextResponse.json({ success: true })
})
