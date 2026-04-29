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
  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') // 'single' | 'future' | 'all'

  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabase = authedClient(accessToken)
  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const body = await req.json()

  // For a recurring series update (future or all), we update multiple rows.
  // We only update the non-time fields + time fields.
  // starts_at / ends_at are recalculated per row (same time, different date).
  if (scope === 'future' || scope === 'all') {
    const { data: cls } = await supabase
      .from('classes')
      .select('recurrence_parent_id, starts_at')
      .eq('id', id)
      .single()

    const parentId = (cls as { recurrence_parent_id: string | null } | null)?.recurrence_parent_id

    if (parentId) {
      // Fields that apply uniformly across instances (no date change)
      const { start_time, end_time, ...metaFields } = body

      // Get all affected rows to recalculate their times
      let query = supabase
        .from('classes')
        .select('id, starts_at, ends_at')
        .eq('recurrence_parent_id', parentId)

      if (scope === 'future') {
        const startsAt = (cls as { starts_at: string }).starts_at
        query = query.gte('starts_at', startsAt)
      }

      const { data: rows } = await query

      if (rows && rows.length > 0) {
        // If times changed, update each row individually with its own date
        if (start_time || end_time) {
          for (const row of rows as { id: string; starts_at: string; ends_at: string }[]) {
            const dateStr = row.starts_at.split('T')[0]
            const newStartsAt = start_time ? `${dateStr}T${start_time}:00` : row.starts_at
            const newEndsAt   = end_time   ? `${dateStr}T${end_time}:00`   : row.ends_at
            await supabase
              .from('classes')
              .update({ ...metaFields, starts_at: newStartsAt, ends_at: newEndsAt })
              .eq('id', row.id)
          }
        } else {
          // No time change — bulk update metadata only
          let updateQ = supabase
            .from('classes')
            .update(metaFields)
            .eq('recurrence_parent_id', parentId)
          if (scope === 'future') {
            const startsAt = (cls as { starts_at: string }).starts_at
            updateQ = updateQ.gte('starts_at', startsAt)
          }
          await updateQ
        }
      }

      return NextResponse.json({ success: true })
    }
  }

  // Default: update single occurrence
  // Rebuild starts_at / ends_at from date + time fields if provided
  const { date, start_time, end_time, ...rest } = body
  const updatePayload: Record<string, unknown> = { ...rest }
  if (date && start_time) updatePayload.starts_at = `${date}T${start_time}:00`
  if (date && end_time)   updatePayload.ends_at   = `${date}T${end_time}:00`

  const { data, error } = await supabase
    .from('classes')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

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
