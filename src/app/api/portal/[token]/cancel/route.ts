import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import Stripe from 'stripe'
import { notifyGym } from '@/lib/notify'
import { sendWhatsApp } from '@/lib/whatsapp'
import { getAppUrl } from '@/lib/app-url'

export const runtime = 'nodejs'

/** Escape HTML special chars to prevent XSS in email templates. */
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { note: rawNote } = await req.json().catch(() => ({ note: '' }))
  // Sanitize note: HTML-escape + cap length to prevent email injection / XSS
  const note = typeof rawNote === 'string' ? rawNote.slice(0, 500) : ''
  const safeNote = escHtml(note)

  const supabase = serviceClient()

  const { data: member, error } = await supabase
    .from('members')
    .select('id, gym_id, first_name, last_name, email, phone, stripe_subscription_id, stripe_customer_id, portal_token, contract_end_date')
    .eq('portal_token', token)
    .single()

  if (error || !member) {
    return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })
  }

  const m = member as {
    id: string; gym_id: string; first_name: string; last_name: string
    email: string | null; phone: string | null
    stripe_subscription_id: string | null; stripe_customer_id: string | null
    portal_token: string | null; contract_end_date: string | null
  }

  // ── Contract check ─────────────────────────────────────────────────────────
  // If the member has a contract that hasn't ended yet, schedule cancellation
  // at contract end instead of cancelling immediately.
  const now = new Date()
  const contractEnd = m.contract_end_date ? new Date(m.contract_end_date) : null
  const hasActiveContract = contractEnd !== null && contractEnd > now
  const cancelAtTs = hasActiveContract ? Math.floor(contractEnd.getTime() / 1000) : null

  // ── 1. Cancel / schedule Stripe subscription ───────────────────────────────
  let stripeCancelledId: string | null = null   // immediately cancelled
  let stripeScheduledId: string | null = null   // scheduled to cancel at contract end

  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // Fetch connected account ID — subscriptions live on the connected account (direct charges)
    const { data: gymRow } = await supabase.from('gyms').select('stripe_account_id').eq('id', m.gym_id).single()
    const connectedAccountId = (gymRow as any)?.stripe_account_id as string | null
    const stripeOpts = connectedAccountId ? { stripeAccount: connectedAccountId } : undefined

    // Primary: use stored subscription ID
    if (m.stripe_subscription_id) {
      try {
        if (cancelAtTs) {
          // Contract still running → schedule cancel at contract end
          await stripe.subscriptions.update(
            m.stripe_subscription_id,
            { cancel_at: cancelAtTs },
            stripeOpts,
          )
          stripeScheduledId = m.stripe_subscription_id
        } else {
          // No contract / expired → cancel immediately
          await stripe.subscriptions.cancel(m.stripe_subscription_id, {}, stripeOpts)
          stripeCancelledId = m.stripe_subscription_id
        }
      } catch (err: any) {
        if (err?.code === 'resource_missing') {
          stripeCancelledId = m.stripe_subscription_id // already gone, that's fine
        } else {
          const stripeError = err?.message ?? 'Stripe-Fehler'
          console.error('Stripe cancel error:', stripeError)
          return NextResponse.json({
            error: `Stripe-Kündigung fehlgeschlagen: ${stripeError}. Bitte kontaktiere dein Gym.`
          }, { status: 500 })
        }
      }
    } else if (m.stripe_customer_id && !cancelAtTs) {
      // Fallback: look up active subscriptions via customer ID (only for immediate cancel)
      try {
        const subs = await stripe.subscriptions.list(
          { customer: m.stripe_customer_id, status: 'active', limit: 10 },
          stripeOpts,
        )
        for (const sub of subs.data) {
          await stripe.subscriptions.cancel(sub.id, {}, stripeOpts)
          stripeCancelledId = sub.id
        }
        const trialSubs = await stripe.subscriptions.list(
          { customer: m.stripe_customer_id, status: 'trialing', limit: 10 },
          stripeOpts,
        )
        for (const sub of trialSubs.data) {
          await stripe.subscriptions.cancel(sub.id, {}, stripeOpts)
          if (!stripeCancelledId) stripeCancelledId = sub.id
        }
      } catch (err: any) {
        console.error('Stripe customer subscription lookup error:', err?.message)
      }
    }
  }

  // ── 2. Update member in DB ─────────────────────────────────────────────────
  const nowIso = now.toISOString()

  if (hasActiveContract && (stripeScheduledId || !m.stripe_subscription_id)) {
    // Contract running → member stays active until contract end, just mark as cancelling
    await supabase.from('members').update({
      cancellation_requested_at: nowIso,
      cancellation_note:         note || null,
      // is_active stays true — member keeps access until contract_end_date
      // subscription_status stays 'active' — Stripe will fire customer.subscription.deleted at contract end
    }).eq('id', m.id)
  } else {
    // Immediate cancel
    await supabase.from('members').update({
      is_active:                 false,
      cancellation_requested_at: nowIso,
      cancellation_note:         note || null,
      stripe_subscription_id:    null,
      subscription_status:       stripeCancelledId ? 'cancelled' : 'none',
    }).eq('id', m.id)
  }

  const fullName  = `${m.first_name} ${m.last_name}`
  const appUrl    = getAppUrl()
  const portalUrl = m.portal_token ? `${appUrl}/portal/${m.portal_token}` : null
  const hadStripe = !!stripeCancelledId
  const isScheduled = !!stripeScheduledId
  const contractEndFormatted = contractEnd
    ? contractEnd.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  // ── 3. Email → Member ─────────────────────────────────────────────────────
  if (m.email && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    // Fetch gym name for email
    const { data: gym } = await supabase.from('gyms').select('name').eq('id', m.gym_id).single()
    const gymName = (gym as any)?.name ?? 'deinem Gym'

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    process.env.RESEND_FROM_EMAIL,
        to:      m.email,
        subject: `Kündigung bestätigt – ${gymName}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a">Kündigung bestätigt ✅</p>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
              Hallo ${m.first_name},<br><br>
              deine Kündigung bei <strong>${gymName}</strong> wurde registriert.
              ${isScheduled && contractEndFormatted
                ? `<br><br>Du hast einen laufenden Vertrag. Deine Mitgliedschaft bleibt aktiv bis zum <strong>${contractEndFormatted}</strong> — ab dann werden keine weiteren Zahlungen abgebucht.`
                : hadStripe
                  ? '<br><br>Dein Abonnement wurde sofort beendet — es werden <strong>keine weiteren Zahlungen</strong> abgebucht.'
                  : ''}
            </p>
            ${safeNote ? `<p style="margin:0 0 16px;font-size:14px;color:#374151;padding:12px 16px;background:#f8fafc;border-radius:8px;border-left:3px solid #e2e8f0"><strong>Deine Notiz:</strong> ${safeNote}</p>` : ''}
            <p style="margin:0 0 16px;font-size:14px;color:#374151">
              Wir hoffen, dich bald wieder auf der Matte zu sehen! 🥋
            </p>
            ${portalUrl ? `<p style="margin:0;font-size:12px;color:#94a3b8">Dein Mitglieder-Portal bleibt erreichbar unter: <a href="${portalUrl}" style="color:#f59e0b">${portalUrl}</a></p>` : ''}
          </div>
        `,
      }),
    }).catch(e => console.error('Member cancel email error:', e))
  }

  // ── 4. WhatsApp → Member ──────────────────────────────────────────────────
  if (m.phone) {
    await sendWhatsApp({
      to:   m.phone,
      body: [
        `Hallo ${m.first_name}! ✅ Deine Kündigung wurde bestätigt.`,
        isScheduled && contractEndFormatted
          ? `Dein Vertrag läuft bis ${contractEndFormatted} – ab dann keine weiteren Zahlungen.`
          : hadStripe ? 'Dein Abonnement wurde sofort beendet – keine weiteren Zahlungen.' : '',
        note ? `Notiz: ${safeNote}` : '',
        'Wir hoffen dich bald wieder zu sehen! Oss! 🥋',
        portalUrl ? `\nPortal: ${portalUrl}` : '',
      ].filter(Boolean).join('\n'),
    }).catch(e => console.error('Member cancel WhatsApp error:', e))
  }

  // ── 5. Email + WhatsApp → Gym Owner ──────────────────────────────────────
  await notifyGym({
    gymId:   m.gym_id,
    subject: `❌ Kündigung: ${fullName}`,
    html: `
      <p style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a">Mitgliedschaft gekündigt</p>
      <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6">
        <strong>${fullName}</strong> hat die Mitgliedschaft über das Mitglieder-Portal gekündigt.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280;width:140px">Name</td>
            <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600">${fullName}</td></tr>
        ${m.email ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">E-Mail</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${m.email}</td></tr>` : ''}
        ${m.phone ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Telefon</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9">${m.phone}</td></tr>` : ''}
        <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#6b7280">Stripe Abo</td>
            <td style="padding:8px 0;border-bottom:1px solid #f1f5f9">
              ${isScheduled && contractEndFormatted
                ? `🗓️ Läuft bis ${contractEndFormatted}, dann automatisch beendet (${stripeScheduledId})`
                : hadStripe
                  ? `✅ Sofort gekündigt (${stripeCancelledId})`
                  : '⚪ Kein aktives Stripe-Abonnement'}
            </td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Datum</td>
            <td style="padding:8px 0">${new Date(now).toLocaleString('de-DE')}</td></tr>
        ${safeNote ? `<tr><td colspan="2" style="padding:8px 0;margin-top:4px"><strong>Notiz des Mitglieds:</strong><br><span style="color:#374151">${safeNote}</span></td></tr>` : ''}
      </table>
    `,
    whatsappText: [
      `❌ Kündigung: ${fullName}`,
      m.email ?? '',
      m.phone ?? '',
      isScheduled && contractEndFormatted
        ? `🗓️ Abo läuft bis ${contractEndFormatted}`
        : hadStripe ? '✅ Stripe-Abo sofort beendet' : '⚪ Kein Stripe-Abo',
      note ? `Notiz: ${safeNote}` : '',
      `\nhttps://www.osss.pro/dashboard/members`,
    ].filter(Boolean).join('\n'),
  }).catch(e => console.error('notifyGym error:', e))

  return NextResponse.json({
    success: true,
    stripeCancelled: hadStripe,
    scheduled: isScheduled,
    contractEndDate: contractEndFormatted ?? null,
  })
}

// DELETE = withdraw cancellation (reactivate member)
export async function DELETE(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = serviceClient()

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('portal_token', token)
    .single()

  if (!member) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  await supabase.from('members').update({
    cancellation_requested_at: null,
    cancellation_note:         null,
    is_active:                 true,
  }).eq('id', member.id)

  return NextResponse.json({ success: true })
}
