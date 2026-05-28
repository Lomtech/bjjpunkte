import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cronGuard } from '@/lib/cron-guard'
import { withCronSentry } from '@/lib/cron/with-sentry'
import { renderDispatchInvoicePdf } from '@/lib/dispatch-invoice-pdf'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 Min — bei 100+ Rechnungen kann's dauern

// Sprint 2026-05-27: Monatlicher Buchhalter-Versand.
//
// Täglich 06:00 UTC. Pro Gym mit accountant_email + dispatch_enabled,
// dessen accountant_send_day dem heutigen Tag entspricht:
//   1. Hole alle paid payments des Vormonats
//   2. Rendere PDFs einzeln
//   3. Sende per Resend mit allen PDFs als Attachments an accountant_email
//   4. Update gym.accountant_last_dispatched_at
//
// Idempotent via accountant_last_dispatched_at check: wenn schon im aktuellen
// Monat versandt, skip.

interface PaymentRow {
  id: string
  invoice_number: string | null
  paid_at: string | null
  amount_cents: number
  kind: string
}

interface GymRow {
  id: string
  name: string | null
  accountant_email: string
  accountant_send_day: number
  accountant_last_dispatched_at: string | null
}

function firstDayOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}
function lastMonthRange(today: Date): { from: Date; to: Date; label: string } {
  const fromMonth = today.getUTCMonth() - 1
  const from = new Date(Date.UTC(today.getUTCFullYear(), fromMonth, 1))
  const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  return { from, to, label: `${monthNames[from.getUTCMonth()]} ${from.getUTCFullYear()}` }
}

export const GET = withCronSentry('accountant-dispatch', async (req: Request) => {
  const guard = cronGuard(req)
  if (guard) return guard

  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ ok: true, skipped: 'Resend not configured' })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createServiceClient()
  const today = new Date()
  const todayDay = today.getUTCDate()
  const currentMonthStart = firstDayOfMonth(today).toISOString()

  // Gyms die heute am Send-Day sind + noch nicht in diesem Monat dispatched
  const { data: gyms, error: gymErr } = await supabase
    .from('gyms')
    .select('id, name, accountant_email, accountant_send_day, accountant_last_dispatched_at')
    .eq('accountant_dispatch_enabled', true)
    .not('accountant_email', 'is', null)
    .eq('accountant_send_day', todayDay)
  if (gymErr) return NextResponse.json({ error: gymErr.message }, { status: 500 })

  if (!gyms || gyms.length === 0) {
    return NextResponse.json({ ok: true, gyms_due: 0, today_day: todayDay })
  }

  const { from, to, label } = lastMonthRange(today)
  const results: Array<{ gym_id: string; gym_name: string | null; status: string; payments?: number; mailed?: boolean; error?: string }> = []

  for (const gym of gyms as GymRow[]) {
    // Skip if already dispatched in current month (idempotenz)
    if (gym.accountant_last_dispatched_at && gym.accountant_last_dispatched_at >= currentMonthStart) {
      results.push({ gym_id: gym.id, gym_name: gym.name, status: 'already_dispatched_this_month' })
      continue
    }

    // Hole paid payments des Vormonats
    const { data: payments } = await supabase
      .from('payments')
      .select('id, invoice_number, paid_at, amount_cents, kind')
      .eq('gym_id', gym.id)
      .eq('status', 'paid')
      .gte('paid_at', from.toISOString())
      .lt('paid_at', to.toISOString())
      .order('paid_at', { ascending: true })

    const rows = (payments ?? []) as PaymentRow[]
    if (rows.length === 0) {
      results.push({ gym_id: gym.id, gym_name: gym.name, status: 'no_payments_in_period', payments: 0 })
      continue
    }

    // Rendere alle PDFs
    const attachments: Array<{ filename: string; content: string }> = []
    let renderFailed = 0
    for (const p of rows) {
      const buffer = await renderDispatchInvoicePdf(p.id)
      if (!buffer) {
        renderFailed++
        continue
      }
      const safeNumber = (p.invoice_number ?? p.id.slice(0, 8)).replace(/[/\\:*?"<>|]/g, '-')
      const prefix = p.kind === 'credit_note' ? 'Gutschrift' : 'Rechnung'
      attachments.push({
        filename: `${prefix}-${safeNumber}.pdf`,
        content: buffer.toString('base64'),
      })
    }

    if (attachments.length === 0) {
      results.push({ gym_id: gym.id, gym_name: gym.name, status: 'all_renders_failed', payments: rows.length })
      continue
    }

    // Totals für Email-Body
    const totalCents = rows.reduce((s, p) => s + p.amount_cents, 0)
    const totalEur = (totalCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
    const creditCount = rows.filter(p => p.kind === 'credit_note').length

    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:24px">
      <h2 style="color:#0f172a">Buchhalter-Versand · ${label}</h2>
      <p style="color:#475569">
        Hier die Rechnungen + Gutschriften aus <strong>${label}</strong> für ${gym.name ?? 'das Studio'}.
      </p>
      <table style="width:100%;margin-top:16px;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#64748b">Anzahl Rechnungen</td><td style="padding:6px 0;text-align:right;font-weight:600">${rows.length - creditCount}</td></tr>
        ${creditCount > 0 ? `<tr><td style="padding:6px 0;color:#64748b">Anzahl Gutschriften</td><td style="padding:6px 0;text-align:right;font-weight:600">${creditCount}</td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#64748b">Summe brutto</td><td style="padding:6px 0;text-align:right;font-weight:600">${totalEur}</td></tr>
        ${renderFailed > 0 ? `<tr><td style="padding:6px 0;color:#dc2626">Render-Fehler</td><td style="padding:6px 0;text-align:right;color:#dc2626">${renderFailed} (manuell prüfen)</td></tr>` : ''}
      </table>
      <p style="color:#94a3b8;font-size:11px;margin-top:24px;border-top:1px solid #f1f5f9;padding-top:12px">
        Automatisch verschickt durch osss.pro. Bei Fragen wende dich an dein Studio.
      </p>
    </body></html>`

    try {
      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: gym.accountant_email,
          subject: `[${label}] Rechnungen ${gym.name ?? ''} (${rows.length} Belege, ${totalEur})`,
          html,
          attachments,
        }),
      })
      if (!sendRes.ok) {
        const errBody = await sendRes.text().catch(() => '')
        results.push({
          gym_id: gym.id, gym_name: gym.name, status: 'send_failed',
          payments: rows.length, mailed: false,
          error: `HTTP ${sendRes.status}: ${errBody.slice(0, 200)}`,
        })
        continue
      }
      // Erfolg → update last_dispatched_at
      await supabase.from('gyms')
        .update({ accountant_last_dispatched_at: today.toISOString() })
        .eq('id', gym.id)
      results.push({
        gym_id: gym.id, gym_name: gym.name, status: 'sent',
        payments: rows.length, mailed: true,
      })
    } catch (err) {
      results.push({
        gym_id: gym.id, gym_name: gym.name, status: 'exception',
        payments: rows.length, mailed: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    ok: true,
    period: label,
    today_day: todayDay,
    gyms_processed: gyms.length,
    results,
  })
})
