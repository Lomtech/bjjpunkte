import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface NotifyPayload {
  gymId: string
  subject: string
  html: string
  whatsappText: string
}

export async function notifyGym({ gymId, subject, html, whatsappText }: NotifyPayload) {
  const supabase = serviceClient()
  const { data: gym } = await supabase
    .from('gyms')
    .select('name, email, whatsapp_number, callmebot_api_key')
    .eq('id', gymId)
    .single()

  if (!gym) return

  // ── Email via Resend ─────────────────────────────────────────────
  if (gym.email && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to:   gym.email,
        subject,
        html: wrapEmail(gym.name, html),
      }),
    }).catch(() => {/* best-effort */})
  }

  // ── WhatsApp via CallMeBot ───────────────────────────────────────
  if (gym.whatsapp_number && (gym as Record<string, unknown>).callmebot_api_key) {
    const phone  = String(gym.whatsapp_number).replace(/\D/g, '')
    const apikey = (gym as Record<string, unknown>).callmebot_api_key as string
    const text   = encodeURIComponent(whatsappText)
    await fetch(
      `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${text}&apikey=${apikey}`,
    ).catch(() => {/* best-effort */})
  }
}

function wrapEmail(gymName: string, body: string) {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px">
        <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:24px 32px;text-align:center">
          <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">${gymName}</p>
        </td></tr>
        <tr><td style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px">
          ${body}
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Diese Nachricht wurde automatisch von osss.pro gesendet.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
