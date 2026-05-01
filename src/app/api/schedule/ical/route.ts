import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const gymId = searchParams.get('gymId')
  if (!gymId) return new Response('gymId fehlt', { status: 400 })

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
    return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('T', 'T')
  }

  const events = (classes ?? []).map((c: any) => [
    'BEGIN:VEVENT',
    `UID:${c.id}@osss.app`,
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
