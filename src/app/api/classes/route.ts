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

// Generate all dates for a recurring series
function generateDates(
  startDate: Date,
  startTime: string,
  endTime: string,
  recurrenceType: string,
  until: Date,
): Array<{ starts_at: string; ends_at: string }> {
  const dates: Array<{ starts_at: string; ends_at: string }> = []
  const current = new Date(startDate)

  // Max 500 instances as safety cap
  while (current <= until && dates.length < 500) {
    const dateStr = current.toISOString().split('T')[0]
    dates.push({
      starts_at: `${dateStr}T${startTime}:00`,
      ends_at:   `${dateStr}T${endTime}:00`,
    })

    // Advance to next occurrence
    if (recurrenceType === 'daily') {
      current.setDate(current.getDate() + 1)
    } else if (recurrenceType === 'weekly') {
      current.setDate(current.getDate() + 7)
    } else if (recurrenceType === 'monthly') {
      current.setMonth(current.getMonth() + 1)
    } else {
      break
    }
  }

  return dates
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
  const {
    title, class_type, description, instructor,
    date, start_time, end_time, max_capacity,
    recurrence_type = 'none', recurrence_until = null,
  } = body

  const gymId = (gym as { id: string }).id

  const baseFields = {
    gym_id:       gymId,
    title,
    class_type,
    description:  description || null,
    instructor:   instructor || null,
    max_capacity: max_capacity || null,
    is_cancelled: false,
    recurrence_type,
    recurrence_until: recurrence_until || null,
  }

  // Single class
  if (recurrence_type === 'none') {
    const { data, error } = await supabase.from('classes').insert({
      ...baseFields,
      starts_at: `${date}T${start_time}:00`,
      ends_at:   `${date}T${end_time}:00`,
      recurrence_parent_id: null,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  }

  // Recurring series — generate instances
  const startDate  = new Date(date)
  const untilDate  = new Date(recurrence_until)
  const occurrences = generateDates(startDate, start_time, end_time, recurrence_type, untilDate)

  if (occurrences.length === 0) {
    return NextResponse.json({ error: 'Keine Termine generiert (Enddatum vor Startdatum?)' }, { status: 400 })
  }

  // Insert first occurrence to get the parent id
  const { data: firstClass, error: firstErr } = await supabase.from('classes').insert({
    ...baseFields,
    starts_at: occurrences[0].starts_at,
    ends_at:   occurrences[0].ends_at,
    recurrence_parent_id: null,
  }).select('id').single()

  if (firstErr || !firstClass) {
    return NextResponse.json({ error: firstErr?.message ?? 'Fehler' }, { status: 500 })
  }

  const parentId = (firstClass as { id: string }).id

  // Update first occurrence to point to itself as parent
  await supabase.from('classes').update({ recurrence_parent_id: parentId }).eq('id', parentId)

  // Insert remaining occurrences in batches of 50
  const rest = occurrences.slice(1).map(o => ({
    ...baseFields,
    starts_at: o.starts_at,
    ends_at:   o.ends_at,
    recurrence_parent_id: parentId,
  }))

  for (let i = 0; i < rest.length; i += 50) {
    const batch = rest.slice(i, i + 50)
    const { error: batchErr } = await supabase.from('classes').insert(batch)
    if (batchErr) console.error('Batch insert error:', batchErr.message)
  }

  return NextResponse.json({ parentId, count: occurrences.length }, { status: 201 })
}
