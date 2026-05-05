/**
 * Brevo Transactional SMS helper — sends an SMS to a phone number.
 * Requires: BREVO_API_KEY env var.
 * Brevo docs: https://developers.brevo.com/reference/sendtransacsms
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

interface SendSmsParams {
  to: string   // raw phone number (will be normalized to E.164)
  body: string // text content (max ~160 chars per SMS segment)
}

/**
 * Send an SMS via Brevo Transactional SMS API.
 * Returns true on success, false on any error (best-effort).
 */
export async function sendWhatsApp({ to, body }: SendSmsParams): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return false

  const phone = toE164(to)
  if (!phone) return false

  try {
    const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: 'OsssGym',      // max 11 alphanumeric chars
        recipient: phone,
        content: body,
        type: 'transactional',
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[sms] Brevo error:', err)
      return false
    }
    return true
  } catch (err) {
    console.error('[sms] fetch error:', err)
    return false
  }
}

// Legacy alias for callers that import sendSms directly
export { sendWhatsApp as sendSms }
