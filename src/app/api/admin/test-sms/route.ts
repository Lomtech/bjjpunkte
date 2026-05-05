import { NextResponse } from 'next/server'
import { toE164 } from '@/lib/whatsapp'

// GET /api/admin/test-sms?phone=015127600077
// Sends a test SMS via Brevo and returns the raw response.
// Delete this route after debugging.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawPhone = searchParams.get('phone') ?? ''

  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'BREVO_API_KEY not set' }, { status: 500 })

  const phone = toE164(rawPhone)
  if (!phone) return NextResponse.json({ error: `Cannot normalize phone: "${rawPhone}"` }, { status: 400 })

  const payload = {
    sender: 'OsssGym',
    recipient: phone,
    content: 'Osss! Test-SMS von osss.pro ✓',
    type: 'transactional',
  }

  const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const body = await res.json().catch(() => ({}))

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    phone_normalized: phone,
    brevo_response: body,
    payload,
  })
}
