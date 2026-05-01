import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date()
  const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Find members whose birthday is today (any year)
  const { data: members } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, phone, date_of_birth, gym_id')
    .eq('is_active', true)
    .not('date_of_birth', 'is', null)

  const birthdayMembers = (members ?? []).filter((m: { date_of_birth: string | null }) => {
    if (!m.date_of_birth) return false
    // Format: YYYY-MM-DD → get MM-DD
    const md = (m.date_of_birth as string).slice(5, 10)
    return md === todayMD
  })

  // Send birthday emails if Resend configured
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    for (const member of birthdayMembers as {
      first_name: string
      email: string | null
      date_of_birth: string
    }[]) {
      if (!member.email) continue
      const age = today.getFullYear() - parseInt(member.date_of_birth.slice(0, 4))
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to: member.email,
            subject: `Happy Birthday, ${member.first_name}! 🥋🎂`,
            html: `
              <h2>Alles Gute zum Geburtstag, ${member.first_name}! 🎉</h2>
              <p>Dein gesamtes Gym-Team wünscht dir alles Gute zum ${age}. Geburtstag!</p>
              <p>Wir freuen uns auf viele weitere Trainings mit dir auf der Matte.</p>
              <p>Oss! 🥋</p>
            `,
          }),
        })
      } catch { /* continue */ }
    }
  }

  return NextResponse.json({
    date: todayMD,
    count: birthdayMembers.length,
    members: (birthdayMembers as { first_name: string; last_name: string; email: string | null }[]).map(m => ({
      name: `${m.first_name} ${m.last_name}`,
      email: m.email,
    })),
  })
}
