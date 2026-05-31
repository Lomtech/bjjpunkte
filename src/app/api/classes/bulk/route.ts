import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withApiHandler } from '@/lib/api/with-error-handler'
import { resolveOwnerGym } from '@/lib/auth/owner-gym-auth'

// Sprint D 2026-05-30: resolveOwnerGym mit Redis-Cache

function authedClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const DE_DAYS: Record<number, string> = {
  0: 'Sonntag', 1: 'Montag', 2: 'Dienstag', 3: 'Mittwoch',
  4: 'Donnerstag', 5: 'Freitag', 6: 'Samstag',
}

function toHHMM(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * GET /api/classes/bulk
 * Returns all future classes as a CSV backup (import-compatible format).
 * De-duplicates recurring series — one row per series (earliest occurrence).
 */
export const GET = withApiHandler('classes.bulk.get', async (req: Request) => {
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const supabase = authedClient(auth.token)
  const gym = auth.gym

  const now = new Date().toISOString()

  const { data: rows } = await supabase
    .from('classes')
    .select('id, title, class_type, instructor, starts_at, ends_at, max_capacity, recurrence_parent_id, recurrence_type')
    .eq('gym_id', gym.id)
    .eq('is_cancelled', false)
    .gte('starts_at', now)
    .order('starts_at', { ascending: true })

  if (!rows || rows.length === 0) {
    return new Response('tag,start,end,titel,typ,trainer,kapazitaet\n', {
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    })
  }

  // De-duplicate: for recurring series take only the first occurrence
  const seen = new Set<string>()
  const deduped: typeof rows = []
  for (const row of rows as typeof rows) {
    const key = (row as { recurrence_parent_id: string | null }).recurrence_parent_id ?? row.id
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(row)
    }
  }

  const header = 'tag,start,end,titel,typ,trainer,kapazitaet'
  const csvRows = deduped.map(r => {
    const d = new Date((r as { starts_at: string }).starts_at)
    const day = DE_DAYS[d.getDay()]
    const start = toHHMM((r as { starts_at: string }).starts_at)
    const end   = toHHMM((r as { ends_at: string }).ends_at)
    const title = ((r as { title: string }).title ?? '').replace(/"/g, '""')
    const typ   = (r as { class_type: string }).class_type ?? 'gi'
    const trainer = ((r as { instructor: string | null }).instructor ?? '').replace(/"/g, '""')
    const cap   = (r as { max_capacity: number | null }).max_capacity ?? ''
    return `"${day}","${start}","${end}","${title}","${typ}","${trainer}","${cap}"`
  })

  const csv = [header, ...csvRows].join('\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="stundenplan-backup-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
})

/**
 * DELETE /api/classes/bulk
 * Deletes all future (non-cancelled) classes for this gym.
 * Use GET first to download a CSV backup.
 */
export const DELETE = withApiHandler('classes.bulk.delete', async (req: Request) => {
  const auth = await resolveOwnerGym(req)
  if ('error' in auth) return auth.error
  const svc = serviceClient()
  const gym = auth.gym

  const now = new Date().toISOString()

  const { error, count } = await svc
    .from('classes')
    .delete({ count: 'exact' })
    .eq('gym_id', gym.id)
    .gte('starts_at', now)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: count ?? 0 })
})
