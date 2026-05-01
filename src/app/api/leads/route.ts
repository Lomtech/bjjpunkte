import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const supabase = getSupabase(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })
  const { data } = await supabase.from('leads').select('*').eq('gym_id', gym.id).order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const supabase = getSupabase(token)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  const { data: gym } = await supabase.from('gyms').select('id').eq('owner_id', user.id).single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })
  const body = await req.json()
  const { data, error } = await supabase.from('leads').insert({ ...body, gym_id: gym.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
