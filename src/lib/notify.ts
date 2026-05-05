import { createServiceClient } from '@/lib/supabase/service'
import { toE164 } from '@/lib/whatsapp'

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, attempt * 1000)) // 1s, 2s backoff
      }
    }
  }
  throw lastError
}

interface NotifyPayload {
  gymId: string
  subject: string
  html: string
  whatsappText?: string
}

interface NotifyResult {
  emailSent: boolean
  whatsappSent: boolean
  emailError?: string
}

export async function notifyGym({ gymId, subject, html, whatsappText }: NotifyPayload): Promise<NotifyResult> {
  const supabase = createServiceClient()
  const { data: gym } = await supabase
    .from('gyms')
    .select('name, email, phone, callmebot_api_key')
    .eq('id', gymId)
    .single()

  const result: NotifyResult = { emailSent: false, whatsappSent: false }
  if (!gym) return result

  // ── Email via Resend ─────────────────────────────────────────────────────
  if (gym.email && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    try {
      const res = await withRetry(() => fetch('https://api.resend.com/emails', {
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
      }))
      if (res.ok) {
        result.emailSent = true
      } else {
        const body = await res.text().catch(() => '')
        result.emailError = `HTTP ${res.status}: ${body}`
        console.error('[notify] Email failed:', result.emailError)
      }
    } catch (err) {
      result.emailError = String(err)
      console.error('[notify] Email error:', err)
    }
  }

  // ── WhatsApp via CallMeBot ───────────────────────────────────────────────
  if (whatsappText && gym.callmebot_api_key && gym.phone) {
    const phone = toE164(gym.phone)
    if (phone) {
      try {
        const params = new URLSearchParams({
          phone,
          text: whatsappText,
          apikey: gym.callmebot_api_key,
        })
        const res = await fetch(`https://api.callmebot.com/whatsapp.php?${params}`)
        result.whatsappSent = res.ok
        if (!res.ok) console.error('[notify] CallMeBot failed:', res.status, await res.text().catch(() => ''))
      } catch (err) {
        console.error('[notify] CallMeBot error:', err)
      }
    }
  }

  return result
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
