import { createClient } from '@supabase/supabase-js'
import { applyRateLimit } from '@/lib/rate-limit-handler'

// UUID v4-Format. Verhindert dass beliebige Strings als gymId in DB-Lookups
// landen — die Spalte ist UUID-typisiert, ungültiges Format würde sonst
// hunderte 4xx-Errors mit lautem Stack-Trace auslösen.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  // iCal-Abos pollen typischerweise alle 15 min — 30 Requests/min pro IP
  // ist großzügig genug für mehrere Family-Members hinter einer NAT.
  const rl = await applyRateLimit(req, { kind: 'ical', limit: 30, windowSec: 60 })
  if (rl) return rl

  const { searchParams } = new URL(req.url)
  const gymId = searchParams.get('gymId')
  if (!gymId || !UUID_RE.test(gymId)) {
    return new Response('Ungültige gymId', { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  const { data: classes } = await supabase
    .from('classes')
    .select('id, title, class_type, instructor, starts_at, ends_at, location')
    .eq('gym_id', gymId)
    .gte('starts_at', now.toISOString())
    .lte('starts_at', in60Days.toISOString())
    .order('starts_at', { ascending: true })

  const { data: gym } = await supabase.from('gyms').select('name').eq('id', gymId).single()

  function toIcalDate(iso: string) {
    // Parse via Date to handle Postgres format "2026-05-07 18:00:00+00" (space, no T)
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
    // Output: "20260507T180000Z" — valid iCal UTC format
  }

  const events = (classes ?? []).map((c: any) => [
    'BEGIN:VEVENT',
    `UID:${c.id}@osss.pro`,
    `DTSTAMP:${toIcalDate(new Date().toISOString())}`,
    `DTSTART:${toIcalDate(c.starts_at)}`,
    `DTEND:${toIcalDate(c.ends_at)}`,
    `SUMMARY:${c.title}`,
    c.instructor ? `DESCRIPTION:Trainer: ${c.instructor}` : '',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n')).join('\r\n')

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Osss//BJJ Gym Software//DE',
    `X-WR-CALNAME:${gym?.name ?? 'Training'} – Stundenplan`,
    'X-WR-TIMEZONE:Europe/Berlin',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="stundenplan.ics"',
    },
  })
}
