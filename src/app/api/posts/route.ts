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

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const supabase = getSupabase(token)
  const gymId = await getGymId(supabase, token)
  if (!gymId) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const { data } = await supabase
    .from('posts')
    .select('id, title, cover_url, blocks, published_at, created_at, updated_at')
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const supabase = getSupabase(token)
  const gymId = await getGymId(supabase, token)
  if (!gymId) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('posts')
    .insert({ gym_id: gymId, title: body.title ?? '', blocks: body.blocks ?? [], cover_url: body.cover_url ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
