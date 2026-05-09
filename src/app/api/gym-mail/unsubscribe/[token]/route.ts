import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.osss.pro'

/**
 * GET + POST /api/gym-mail/unsubscribe/[token]?audience=member|lead
 *
 * 1-Klick-Abmeldung gem. RFC 8058 (List-Unsubscribe-Post).
 * Setzt marketing_email_consent = false auf der entsprechenden Tabelle.
 */
async function handle(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const url = new URL(req.url)
  const audience = url.searchParams.get('audience') === 'lead' ? 'leads' : 'members'

  // Token-Hardening (Audit 2026-05-09 / A2): 20 → 32 Zeichen + Char-Class.
  if (!token || token.length < 32 || token.length > 256 || !/^[a-zA-Z0-9_-]+$/.test(token)) {
    return NextResponse.redirect(`${APP_URL}/newsletter/unsubscribed?status=error`)
  }

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from(audience) as any)
    .update({
      marketing_email_consent: false,
    })
    .eq('marketing_unsubscribe_token', token)

  if (error) {
    console.error('[gym-mail unsubscribe]', error.message)
    return NextResponse.redirect(`${APP_URL}/newsletter/unsubscribed?status=error`)
  }
  return NextResponse.redirect(`${APP_URL}/newsletter/unsubscribed?status=ok`)
}

export const GET = handle
export const POST = handle
