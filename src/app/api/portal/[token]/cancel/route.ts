import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { notifyGym } from '@/lib/notify'
import { sendWhatsApp } from '@/lib/whatsapp'
import { getAppUrl } from '@/lib/app-url'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { note } = await req.json().catch(() => ({ note: '' }))

  const supabase = serviceClient()

  const { data: member, error } = await supabase
    .from('members')
    .select('id, gym_id, first_name, last_name, email, phone, stripe_subscription_id, portal_token')
    .eq('portal_token', token)
    .single()

  if (error || !member) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // ── 1. Cancel Stripe subscription immediately ──────────────────────────────
  let stripeError: string | null = null
  const subId = (member as any).stripe_subscription_id as string | null
  if (subId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      await stripe.subscriptions.cancel(subId)
    } catch (err) {
      stripeError = err instanceof Error ? err.message : 'Stripe-Fehler'
      console.error('Stripe cancel error:', stripeError)
      // Non-fatal — continue with DB update and notifications
    }
  }

  // ── 2. Update member in DB ─────────────────────────────────────────────────
  await (supabase.from('members') as any).update({
    is_active:                 false,
    cancellation_requested_at: now,
    cancellation_note:         note || null,
    stripe_subscription_id:    null,
    subscription_status:       subId ? 'cancelled' : null,
  }).eq('id', member.id)

  const fullName  = `${member.first_name} ${member.last_name}`
  const appUrl    = getAppUrl()
  const portalUrl = member.portal_token ? `${appUrl}/portal/${member.portal_token}` : null

  // ── 3. Confirm cancellation to member via email ────────────────────────────
  if ((member as any).email && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    process.env.RESEND_FROM_EMAIL,
        to:      (member as any).email,
        subject: 'Deine Mitgliedschaft wurde gekündigt',
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Kündigung bestätigt</p>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
              Hallo ${member.first_name},<br><br>
              deine Mitgliedschaft wurde erfolgreich gekündigt.
              ${subId ? ' Dein Abonnement wurde sofort beendet und es werden keine weiteren Zahlungen abgebucht.' : ''}
            </p>
            ${note ? `<p style="margin:0 0 16px;font-size:14px;color:#374151"><strong>Deine Notiz:</strong> ${note}</p>` : ''}
            <p style="margin:0 0 16px;font-size:14px;color:#374151">
              Wir hoffen, dich bald wieder auf der Matte zu sehen! Oss! 🥋
            </p>
          </div>
        `,
      }),
    }).catch(() => {})
  }

  // ── 4. Confirm cancellation to member via WhatsApp ────────────────────────
  if ((member as any).phone) {
    await sendWhatsApp({
      to:   (member as any).phone,
      body: `Hallo ${member.first_name}! Deine Mitgliedschaft wurde erfolgreich gekündigt.${subId ? ' Dein Abonnement wurde sofort beendet.' : ''} Wir hoffen, dich bald wieder zu sehen! Oss! 🥋`,
    }).catch(() => {})
  }

  // ── 5. Notify gym owner ───────────────────────────────────────────────────
  await notifyGym({
    gymId:   member.gym_id,
    subject: `Kündigung: ${fullName}`,
    html: `
      <p style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a">Mitgliedschaft gekündigt</p>
      <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
        <strong>${fullName}</strong> hat die Mitgliedschaft über das Mitglieder-Portal gekündigt.
        ${subId ? 'Das Stripe-Abonnement wurde sofort beendet.' : ''}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280;width:120px">Name</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600">${fullName}</td></tr>
        ${(member as any).email ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">E-Mail</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${(member as any).email}</td></tr>` : ''}
        ${note ? `<tr><td style="padding:8px 0;color:#6b7280">Notiz</td><td style="padding:8px 0">${note}</td></tr>` : ''}
      </table>
    `,
    whatsappText: `❌ Kündigung!\n${fullName}${(member as any).email ? '\n' + (member as any).email : ''}${note ? '\nNotiz: ' + note : ''}\n\nhttps://www.osss.pro/dashboard`,
  }).catch(() => {})

  return NextResponse.json({ success: true })
}

// DELETE = withdraw cancellation request (reactivate)
export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = serviceClient()

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('portal_token', token)
    .single()

  if (!member) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await (supabase.from('members') as any).update({
    cancellation_requested_at: null,
    cancellation_note:         null,
    is_active:                 true,
  }).eq('id', member.id)

  return NextResponse.json({ success: true })
}
