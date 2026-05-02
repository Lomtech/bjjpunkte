import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

async function getGymId(supabase: ReturnType<typeof getSupabase>, token: string) {
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null
  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).single()
  return gym?.id ?? null
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const supabase = getSupabase(token)
  const gymId = await getGymId(supabase, token)
  if (!gymId) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const body = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('title'        in body) patch.title        = body.title
  if ('blocks'       in body) patch.blocks       = body.blocks
  if ('cover_url'    in body) patch.cover_url    = body.cover_url
  if ('published_at' in body) patch.published_at = body.published_at

  const { data, error } = await supabase
    .from('posts')
    .update(patch)
    .eq('id', id)
    .eq('gym_id', gymId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const supabase = getSupabase(token)
  const gymId = await getGymId(supabase, token)
  if (!gymId) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const { error } = await supabase.from('posts').delete().eq('id', id).eq('gym_id', gymId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
