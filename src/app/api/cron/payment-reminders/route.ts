import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  // Vercel Cron auth
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Get all gyms
  const { data: gyms } = await supabase.from('gyms').select('id, name, monthly_fee_cents')

  const results: {
    gymId: string
    reminders: { name: string; email: string | null; phone: string | null; amountCents: number }[]
  }[] = []

  for (const gym of gyms ?? []) {
    // Active members with email or phone
    const { data: members } = await supabase
      .from('members')
      .select('id, first_name, last_name, email, phone, monthly_fee_override_cents, stripe_subscription_id')
      .eq('gym_id', gym.id)
      .eq('is_active', true)

    // Members paid this month
    const { data: paid } = await supabase
      .from('payments')
      .select('member_id')
      .eq('gym_id', gym.id)
      .eq('status', 'paid')
      .gte('paid_at', monthStart)

    const paidIds = new Set((paid ?? []).map((p: { member_id: string }) => p.member_id))

    const needReminder = (members ?? [])
      .filter((m: {
        id: string
        stripe_subscription_id: string | null
        email: string | null
        phone: string | null
      }) =>
        !paidIds.has(m.id) &&
        !m.stripe_subscription_id && // skip auto-subscribers
        (m.email || m.phone)
      )
      .map((m: {
        first_name: string
        last_name: string
        email: string | null
        phone: string | null
        monthly_fee_override_cents: number | null
      }) => ({
        name: `${m.first_name} ${m.last_name}`,
        email: m.email,
        phone: m.phone,
        amountCents: m.monthly_fee_override_cents ?? gym.monthly_fee_cents ?? 0,
      }))

    if (needReminder.length > 0) {
      results.push({ gymId: gym.id, reminders: needReminder })

      // If Resend is configured, send emails
      if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
        for (const member of needReminder) {
          if (!member.email) continue
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
                subject: 'Erinnerung: Dein Mitgliedsbeitrag ist fällig',
                html: `
                  <h2>Hallo ${member.name.split(' ')[0]}!</h2>
                  <p>Dein monatlicher Mitgliedsbeitrag von <strong>${(member.amountCents / 100).toFixed(2).replace('.', ',')} €</strong> ist noch offen.</p>
                  <p>Bitte überweise ihn diese Woche oder nutze deinen Zahlungslink im Mitgliederportal.</p>
                  <p>Oss! 🥋</p>
                `,
              }),
            })
          } catch { /* continue on error */ }
        }
      }
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
