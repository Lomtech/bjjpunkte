import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function authedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authedClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('classes').update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') // 'single' | 'future' | 'all'

  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authedClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  if (scope === 'future' || scope === 'all') {
    // Get this class to find parent + starts_at
    const { data: cls } = await supabase
      .from('classes').select('recurrence_parent_id, starts_at').eq('id', id).single()

    const parentId = (cls as { recurrence_parent_id: string | null } | null)?.recurrence_parent_id

    if (parentId) {
      if (scope === 'all') {
        // Cancel all in series
        await supabase.from('classes')
          .update({ is_cancelled: true })
          .eq('recurrence_parent_id', parentId)
      } else {
        // Cancel this and all future in series
        const startsAt = (cls as { starts_at: string }).starts_at
        await supabase.from('classes')
          .update({ is_cancelled: true })
          .eq('recurrence_parent_id', parentId)
          .gte('starts_at', startsAt)
      }
      return NextResponse.json({ success: true })
    }
  }

  // Default: cancel single
  const { error } = await supabase.from('classes').update({ is_cancelled: true }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
