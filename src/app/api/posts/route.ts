import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function GET(req: Request) {
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)

  const { data } = await supabase
    .from('posts')
    .select('id, title, cover_url, blocks, published_at, created_at, updated_at')
    .eq('gym_id', auth.gym.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = getSupabase(auth.token)

  const body = await req.json()
  const title = (body.title ?? '').toString().trim().slice(0, 500)
  const blocks = Array.isArray(body.blocks) ? body.blocks.slice(0, 100) : []
  if (!title) return NextResponse.json({ error: 'Titel fehlt' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('posts') as any)
    .insert({ gym_id: auth.gym.id, title, blocks, cover_url: body.cover_url ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
