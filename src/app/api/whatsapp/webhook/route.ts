import { NextResponse } from 'next/server'

/**
 * Twilio WhatsApp webhook — handles incoming messages.
 * Twilio sends a POST with form-encoded body (From, Body, etc.).
 * Must respond with TwiML XML (or empty 200) within 10 s.
 *
 * Set this URL in Twilio sandbox:
 *   https://osss.pro/api/whatsapp/webhook
 */
export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? ''
  let from = ''
  let body = ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text()
    const params = new URLSearchParams(text)
    from = params.get('From') ?? ''
    body = params.get('Body') ?? ''
  }

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
