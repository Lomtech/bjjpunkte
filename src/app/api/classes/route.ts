import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function authedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authedClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms').select('id').single()
  if (!gym) return NextResponse.json({ error: 'Kein Gym gefunden' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') ?? new Date().toISOString()

  const { data, error } = await supabase.rpc('get_classes_for_gym', {
    p_gym_id: (gym as { id: string }).id,
    p_from: from,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authedClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await supabase.from('gyms').select('id').single()
  if (!gym) return NextResponse.json({ error: 'Kein Gym gefunden' }, { status: 404 })

  const body = await req.json()
  const { title, class_type, description, instructor, starts_at, ends_at, max_capacity } = body

  const { data, error } = await supabase.from('classes').insert({
    gym_id: (gym as { id: string }).id,
    title,
    class_type,
    description: description || null,
    instructor: instructor || null,
    starts_at,
    ends_at,
    max_capacity: max_capacity || null,
    is_cancelled: false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
