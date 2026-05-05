import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAppUrl } from '@/lib/app-url'
import { sendWhatsApp } from '@/lib/whatsapp'
import { cronGuard } from '@/lib/cron-guard'

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return { ok: false, error: 'Resend not configured' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to, subject, html }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status}: ${body}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
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
  const amount   = (amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
  const ctaUrl   = checkoutUrl ?? portalUrl ?? ''
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
  const guard = cronGuard(req)
  if (guard) return guard

  const todayKey = new Date().toISOString().split('T')[0] // 'YYYY-MM-DD'
  const alreadyRanKey = `cron_payment_reminder_${todayKey}`
  if ((global as Record<string, unknown>)[alreadyRanKey]) {
    return NextResponse.json({ skipped: true, reason: 'already ran today' })
  }
  (global as Record<string, unknown>)[alreadyRanKey] = true

  const supabase = createServiceClient()
  const appUrl   = getAppUrl()

  const now        = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' }))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthLabel = now.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  const { data: gyms } = await supabase
    .from('gyms')
    .select('id, name, monthly_fee_cents, email')
    .in('plan', ['starter', 'grow', 'pro'])

  let emailsSent     = 0
  let emailsFailed   = 0
  let whatsappSent   = 0
  let whatsappFailed = 0
  const errors: string[] = []

  // Process gyms in parallel (each gym is independent)
  await Promise.all((gyms ?? []).map(async gym => {
    const [membersRes, paidRes, pendingRes] = await Promise.all([
      supabase
        .from('members')
        .select('id, first_name, last_name, email, phone, monthly_fee_override_cents, stripe_subscription_id, portal_token')
        .eq('gym_id', gym.id)
        .eq('is_active', true),
      supabase
        .from('payments')
        .select('member_id')
        .eq('gym_id', gym.id)
        .eq('status', 'paid')
        .gte('paid_at', monthStart),
      supabase
        .from('payments')
        .select('member_id, checkout_url')
        .eq('gym_id', gym.id)
        .eq('status', 'pending')
        .gte('created_at', monthStart)
        .not('checkout_url', 'is', null),
    ])

    const paidIds = new Set((paidRes.data ?? []).filter(p => p.member_id != null).map(p => p.member_id!))
    const pendingByMember = new Map(
      (pendingRes.data ?? [])
        .filter(p => p.checkout_url && p.member_id != null)
        .map(p => [p.member_id!, p.checkout_url!] as [string, string])
    )

    const needReminder = (membersRes.data ?? []).filter((m: {
      id: string; stripe_subscription_id: string | null; email: string | null
    }) => !paidIds.has(m.id) && !m.stripe_subscription_id && m.email) as {
      id: string; first_name: string; last_name: string
      email: string | null; phone: string | null
      monthly_fee_override_cents: number | null; portal_token: string | null
    }[]

    // Send reminders in parallel — up to 5 concurrent per gym to respect Resend rate limits
    const BATCH = 5
    for (let i = 0; i < needReminder.length; i += BATCH) {
      await Promise.all(needReminder.slice(i, i + BATCH).map(async member => {
        const amountCents = member.monthly_fee_override_cents ?? (gym as any).monthly_fee_cents ?? 0
        const portalUrl   = member.portal_token ? `${appUrl}/portal/${member.portal_token}` : null
        const checkoutUrl = pendingByMember.get(member.id) ?? null
        const amount      = (amountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
        const ctaUrl      = checkoutUrl ?? portalUrl ?? ''

        if (member.email) {
          const result = await sendEmail(
            member.email,
            `Erinnerung: Mitgliedsbeitrag ${monthLabel} — ${gym.name}`,
            reminderEmailHtml({ firstName: member.first_name, gymName: gym.name, amountCents, portalUrl, checkoutUrl })
          )
          if (result.ok) {
            emailsSent++
          } else {
            emailsFailed++
            const msg = `Email to ${member.email} (gym ${gym.id}): ${result.error}`
            errors.push(msg)
            console.error('[cron/payment-reminders]', msg)
          }
        }

        if (member.phone) {
          const waBody = checkoutUrl
            ? `Hallo ${member.first_name}! 👋 Dein Mitgliedsbeitrag bei *${gym.name}* für diesen Monat ist noch offen (${amount}).\n\nJetzt bezahlen: ${ctaUrl}\n\nOss! 🥋`
            : `Hallo ${member.first_name}! 👋 Dein Mitgliedsbeitrag bei *${gym.name}* für diesen Monat ist noch offen (${amount}).${ctaUrl ? `\n\nZum Portal: ${ctaUrl}` : ''}\n\nBei Fragen melde dich bei deinem Gym. Oss! 🥋`
          try {
            const ok = await sendWhatsApp({ to: member.phone, body: waBody })
            if (ok) {
              whatsappSent++
            } else {
              whatsappFailed++
              errors.push(`WhatsApp to ${member.phone} (gym ${gym.id}): sendWhatsApp returned false`)
            }
          } catch (err) {
            whatsappFailed++
            errors.push(`WhatsApp to ${member.phone} (gym ${gym.id}): ${String(err)}`)
          }
        }
      }))
    }
  }))

  return NextResponse.json({
    ok:             errors.length === 0,
    emailsSent,
    emailsFailed,
    whatsappSent,
    whatsappFailed,
    errorCount:     errors.length,
    errors:         errors.length > 0 ? errors : undefined,
    noResend:       !process.env.RESEND_API_KEY,
    ranAt:          now.toISOString(),
  })
}
