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
  // starts_at / ends_at are recalculated per row (same time, different date).
  if (scope === 'future' || scope === 'all') {
    const { data: cls } = await supabase
      .from('classes')
      .select('recurrence_parent_id, starts_at')
      .eq('id', id)
      .single()

    const parentId = (cls as { recurrence_parent_id: string | null } | null)?.recurrence_parent_id

    if (parentId) {
      // Strip time/tz fields — meta only for bulk update
      const { start_time, end_time, starts_at: _sa, ends_at: _ea, tz_offset_min, ...metaFields } = body
      const tzOffsetMin: number = typeof tz_offset_min === 'number' ? tz_offset_min : 0

      // Build timezone suffix (e.g. '+02:00') for reconstructed timestamps
      const tzSign   = tzOffsetMin <= 0 ? '+' : '-'
      const tzAbsMin = Math.abs(tzOffsetMin)
      const tzSuffix = `${tzSign}${String(Math.floor(tzAbsMin / 60)).padStart(2, '0')}:${String(tzAbsMin % 60).padStart(2, '0')}`

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
        // If times changed, update each row individually with its correct LOCAL date
        if (start_time || end_time) {
          for (const row of rows as { id: string; starts_at: string; ends_at: string }[]) {
            // Convert stored UTC timestamp → local date using the client's tz offset
            const utcMs   = new Date(row.starts_at).getTime()
            const localMs = utcMs - tzOffsetMin * 60 * 1000  // local = UTC - tzOffset
            const localD  = new Date(localMs)
            const dateStr = `${localD.getUTCFullYear()}-${String(localD.getUTCMonth() + 1).padStart(2, '0')}-${String(localD.getUTCDate()).padStart(2, '0')}`

            const newStartsAt = start_time ? `${dateStr}T${start_time}:00${tzSuffix}` : row.starts_at
            const newEndsAt   = end_time   ? `${dateStr}T${end_time}:00${tzSuffix}`   : row.ends_at
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
  // Use timezone-aware starts_at / ends_at sent by the client
  const { starts_at, ends_at, start_time: _st, end_time: _et, date: _d, tz_offset_min: _tz, ...rest } = body
  const updatePayload: Record<string, unknown> = { ...rest }
  if (starts_at) updatePayload.starts_at = starts_at
  if (ends_at)   updatePayload.ends_at   = ends_at

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
