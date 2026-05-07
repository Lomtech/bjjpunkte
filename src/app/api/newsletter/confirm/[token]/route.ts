import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendNewsletterWelcomeEmail } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.osss.pro'

/**
 * GET /api/newsletter/confirm/[token]
 *
 * Bestätigt die DOI-Anmeldung. Redirect zu /newsletter/confirmed (oder /newsletter/error).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  if (!token || token.length < 20) {
    return NextResponse.redirect(`${APP_URL}/newsletter/confirmed?status=error`)
  }

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('newsletter_subscribers') as any)
    .select('id, email, status, unsubscribe_token')
    .eq('confirm_token', token)
    .maybeSingle()

  if (error) {
    console.error('[newsletter confirm] query failed', error.message)
    return NextResponse.redirect(`${APP_URL}/newsletter/confirmed?status=error`)
  }
  if (!data) {
    return NextResponse.redirect(`${APP_URL}/newsletter/confirmed?status=invalid`)
  }
  if (data.status === 'confirmed') {
    return NextResponse.redirect(`${APP_URL}/newsletter/confirmed?status=already`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase.from('newsletter_subscribers') as any)
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', data.id)

  if (updateErr) {
    console.error('[newsletter confirm] update failed', updateErr.message)
    return NextResponse.redirect(`${APP_URL}/newsletter/confirmed?status=error`)
  }

  // Welcome-Mail (silent fail)
  try {
    await sendNewsletterWelcomeEmail(data.email, data.unsubscribe_token)
  } catch (e) {
    console.error('[newsletter confirm] welcome mail failed', e)
  }

  return NextResponse.redirect(`${APP_URL}/newsletter/confirmed?status=ok`)
}
