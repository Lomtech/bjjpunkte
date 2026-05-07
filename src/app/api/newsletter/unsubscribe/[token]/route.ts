import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.osss.pro'

/**
 * GET + POST /api/newsletter/unsubscribe/[token]
 *
 * 1-Klick-Abmeldung gemäß RFC 8058 (List-Unsubscribe-Post-Header).
 * Beide Methoden funktionieren:
 *  - GET: User klickt Link in der Mail
 *  - POST: Email-Client (Gmail, Outlook) führt automatischen Unsubscribe aus
 */
async function handle(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!token || token.length < 20) {
    return NextResponse.redirect(`${APP_URL}/newsletter/unsubscribed?status=error`)
  }

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('newsletter_subscribers') as any)
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('unsubscribe_token', token)

  if (error) {
    console.error('[newsletter unsubscribe] update failed', error.message)
    return NextResponse.redirect(`${APP_URL}/newsletter/unsubscribed?status=error`)
  }

  return NextResponse.redirect(`${APP_URL}/newsletter/unsubscribed?status=ok`)
}

export const GET = handle
export const POST = handle
