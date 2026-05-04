import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'

/**
 * Twilio WhatsApp webhook — handles incoming messages.
 * Twilio sends a POST with form-encoded body (From, Body, etc.).
 * Must respond with TwiML XML (or empty 200) within 10 s.
 *
 * Set this URL in Twilio sandbox:
 *   https://osss.pro/api/whatsapp/webhook
 */

/**
 * Verify the X-Twilio-Signature header.
 * Algorithm: HMAC-SHA1 over (url + sorted-param-values), base64-encoded.
 * See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function verifyTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  // Build the string to sign: URL + sorted key/value pairs
  const sortedKeys = Object.keys(params).sort()
  const toSign = url + sortedKeys.map(k => k + params[k]).join('')

  const expected = createHmac('sha1', authToken)
    .update(toSign, 'utf8')
    .digest('base64')

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN

  const contentType = req.headers.get('content-type') ?? ''
  let rawBody = ''
  let params: Record<string, string> = {}

  if (contentType.includes('application/x-www-form-urlencoded')) {
    rawBody = await req.text()
    const urlParams = new URLSearchParams(rawBody)
    urlParams.forEach((value, key) => { params[key] = value })
  }

  // ── Twilio signature verification ──────────────────────────────────────────
  if (authToken) {
    const signature = req.headers.get('x-twilio-signature') ?? ''
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL
      ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://osss.pro'}/api/whatsapp/webhook`

    if (!signature || !verifyTwilioSignature(authToken, signature, webhookUrl, params)) {
      console.warn('[whatsapp webhook] Invalid Twilio signature — request rejected')
      return new Response('Forbidden', { status: 403 })
    }
  } else {
    // In dev/unconfigured environments, skip signature check but log a warning
    console.warn('[whatsapp webhook] TWILIO_AUTH_TOKEN not set — skipping signature verification')
  }

  const from = params['From'] ?? ''
  const body = params['Body'] ?? ''

  console.log('[whatsapp webhook] from:', from, 'body:', body)

  // Auto-reply with help text
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Hallo! Für Fragen zu deiner Mitgliedschaft wende dich direkt an dein Gym. Oss! 🥋</Message>
</Response>`

  return new Response(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

// Twilio also sends GET requests to verify the webhook URL
export async function GET() {
  return NextResponse.json({ ok: true })
}
