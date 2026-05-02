import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to, subject, html }),
    })
    return res.ok
  } catch { return false }
}

function reminderEmailHtml({
  firstName, gymName, amountCents, portalUrl, checkoutUrl,
}: {
  firstName: string
  gymName: string
  amountCents: number
  portalUrl: string | null
  checkoutUrl: string | null
}) {
  const amount = (amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  const ctaUrl = checkoutUrl ?? portalUrl ?? ''
  const ctaLabel = checkoutUrl ? 'Jetzt bezahlen' : 'Zum Mitgliederportal'

  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

        <!-- Header -->
        <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center">
          <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">${gymName}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Hallo ${firstName},</p>
          <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6">
            dein Mitgliedsbeitrag für diesen Monat ist noch offen.
          </p>

          <!-- Amount box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;text-align:center">
              <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;font-weight:500">Offener Betrag</p>
              <p style="margin:0;font-size:32px;font-weight:900;color:#0f172a;letter-spacing:-0.02em">${amount}</p>
            </td></tr>
          </table>

          ${ctaUrl ? `
          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
            <tr><td align="center">
              <a href="${ctaUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none">
                ${ctaLabel} →
              </a>
            </td></tr>
          </table>
          ` : ''}

          <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6">
            Bei Fragen melde dich direkt bei deinem Gym. Wenn du eine Lastschrift eingerichtet hast, kannst du diese Nachricht ignorieren.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:16px 32px;text-align:center">
          <p style="margin:0;font-size:12px;color:#cbd5e1">Betrieben mit <strong style="color:#94a3b8">Osss</strong></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = serviceClient()
  const appUrl   = getAppUrl()

  const now        = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Only Starter+ gyms get automated payment reminders
  const { data: gyms } = await supabase
    .from('gyms')
    .select('id, name, monthly_fee_cents, email')
    .in('plan', ['starter', 'grow', 'pro'])

  let emailsSent = 0
  let emailsSkipped = 0

  for (const gym of gyms ?? []) {
    const { data: members } = await supabase
      .from('members')
      .select('id, first_name, last_name, email, monthly_fee_override_cents, stripe_subscription_id, portal_token')
      .eq('gym_id', gym.id)
      .eq('is_active', true)

    const { data: paid } = await supabase
      .from('payments')
      .select('member_id')
      .eq('gym_id', gym.id)
      .eq('status', 'paid')
      .gte('paid_at', monthStart)

    const paidIds = new Set((paid ?? []).map((p: { member_id: string }) => p.member_id))

    // Pending checkout links created this month (give members a direct pay URL)
    const { data: pendingPayments } = await supabase
      .from('payments')
      .select('member_id, checkout_url')
      .eq('gym_id', gym.id)
      .eq('status', 'pending')
      .gte('created_at', monthStart)
      .not('checkout_url', 'is', null)

    const pendingByMember = new Map(
      (pendingPayments ?? [])
        .filter((p: { checkout_url: string | null }) => p.checkout_url)
        .map((p: { member_id: string; checkout_url: string | null }) => [p.member_id, p.checkout_url!])
    )

    const needReminder = (members ?? []).filter((m: {
      id: string
      stripe_subscription_id: string | null
      email: string | null
    }) =>
      !paidIds.has(m.id) &&
      !m.stripe_subscription_id &&
      m.email
    )

    for (const member of needReminder as {
      id: string
      first_name: string
      last_name: string
      email: string | null
      monthly_fee_override_cents: number | null
      portal_token: string | null
    }[]) {
      if (!member.email) { emailsSkipped++; continue }

      const amountCents = member.monthly_fee_override_cents ?? gym.monthly_fee_cents ?? 0
      const portalUrl   = member.portal_token ? `${appUrl}/portal/${member.portal_token}` : null
      const checkoutUrl = pendingByMember.get(member.id) ?? null

      const sent = await sendEmail(
        member.email,
        `Erinnerung: Mitgliedsbeitrag ${now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })} — ${gym.name}`,
        reminderEmailHtml({
          firstName:   member.first_name,
          gymName:     gym.name,
          amountCents,
          portalUrl,
          checkoutUrl,
        })
      )
      sent ? emailsSent++ : emailsSkipped++
    }
  }

  return NextResponse.json({
    ok:           true,
    emailsSent,
    emailsSkipped,
    noResend:     !process.env.RESEND_API_KEY,
    ranAt:        now.toISOString(),
  })
}
