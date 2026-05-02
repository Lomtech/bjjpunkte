import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PAID_PLANS = ['starter', 'grow', 'pro']

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ skipped: true, reason: 'Resend not configured' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today    = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
  const todayMD  = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Only Starter+ gyms get birthday emails
  const { data: eligibleGyms } = await supabase
    .from('gyms')
    .select('id, name')
    .in('plan', PAID_PLANS)

  if (!eligibleGyms?.length) {
    return NextResponse.json({ date: todayMD, count: 0, reason: 'no eligible gyms' })
  }

  const gymIds = eligibleGyms.map(g => g.id)

  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, date_of_birth, gym_id')
    .eq('is_active', true)
    .in('gym_id', gymIds)
    .not('date_of_birth', 'is', null)
    .not('email', 'is', null)

  const birthdayMembers = (members ?? []).filter((m: { date_of_birth: string | null }) => {
    if (!m.date_of_birth) return false
    return (m.date_of_birth as string).slice(5, 10) === todayMD
  })

  const gymMap = new Map(eligibleGyms.map(g => [g.id, g.name]))
  let sent = 0

  for (const member of birthdayMembers as {
    first_name: string; email: string | null; date_of_birth: string; gym_id: string
  }[]) {
    if (!member.email) continue
    const age     = today.getFullYear() - parseInt(member.date_of_birth.slice(0, 4))
    const gymName = gymMap.get(member.gym_id) ?? 'Dein Gym'

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to:   member.email,
          subject: `Alles Gute zum Geburtstag, ${member.first_name}!`,
          html: `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px">
        <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center">
          <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">${gymName}</p>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Alles Gute, ${member.first_name}!</p>
          <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
            Das gesamte Team von ${gymName} wünscht dir alles Gute zu deinem ${age}. Geburtstag.
            Wir freuen uns auf viele weitere Trainings mit dir auf der Matte.
          </p>
          <p style="margin:0;font-size:15px;color:#64748b">Oss! 🥋</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        }),
      })
      if (res.ok) sent++
    } catch { /* continue */ }
  }

  return NextResponse.json({ date: todayMD, found: birthdayMembers.length, sent })
}
