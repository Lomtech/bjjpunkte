/**
 * Twilio WhatsApp helper — sends a message to a member's phone number.
 * Requires: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 */

/** Normalize any German phone number to E.164 (e.g. +4915123456789) */
export function toE164(raw: string): string | null {
  let p = raw.replace(/[\s\-().]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('0')) p = '+49' + p.slice(1)
  if (!p.startsWith('+')) p = '+49' + p
  // Basic sanity check: at least 10 digits after +
  if (!/^\+\d{10,15}$/.test(p)) return null
  return p
}

interface SendWhatsAppParams {
  to: string        // raw phone number (will be normalized to E.164)
  body: string      // text body
}

/**
 * Send a WhatsApp message via Twilio.
 * Returns true on success, false on any error (best-effort).
 */
export async function sendWhatsApp({ to, body }: SendWhatsAppParams): Promise<boolean> {
  const sid   = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from  = process.env.TWILIO_WHATSAPP_FROM // e.g. whatsapp:+14155238886

  if (!sid || !token || !from) return false

  const phone = toE164(to)
  if (!phone) return false

  try {
    const url  = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
    const body64 = Buffer.from(`${sid}:${token}`).toString('base64')
    const params = new URLSearchParams({
      From: from,
      To:   `whatsapp:${phone}`,
      Body: body,
    })

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${body64}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[whatsapp] Twilio error:', err)
      return false
    }
    return true
  } catch (err) {
    console.error('[whatsapp] fetch error:', err)
    return false
  }
}
