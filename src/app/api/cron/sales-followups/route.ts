import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cronGuard } from '@/lib/cron-guard'
import { getAppUrl } from '@/lib/app-url'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Cron: stündlich
// Findet alle sales_leads bei denen:
//   - next_followup_at <= jetzt + LOOKAHEAD_HOURS
//   - followup_reminded_at IS NULL
// Schickt eine zusammengefasste Erinnerungs-Email an alle ADMIN_EMAILS.
// Markiert die Leads als reminded.
const LOOKAHEAD_HOURS = 24 // remind 24h before — also today's + tomorrow's-morning

type LeadRow = {
  id: string
  name: string
  city: string | null
  phone: string | null
  email: string | null
  status: string
  priority: number
  notes: string | null
  next_followup_at: string
  contact_count: number
}

export async function GET(req: Request) {
  const guard = cronGuard(req)
  if (guard) return guard

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',').map(e => e.trim()).filter(Boolean)
  if (adminEmails.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'ADMIN_EMAILS not set' })
  }
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return NextResponse.json({ skipped: true, reason: 'Resend not configured' })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leads, error } = await (supabase.from('sales_leads') as any)
    .select('id, name, city, phone, email, status, priority, notes, next_followup_at, contact_count')
    .lte('next_followup_at', horizon.toISOString())
    .is('followup_reminded_at', null)
    .order('next_followup_at', { ascending: true })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const due = (leads ?? []) as LeadRow[]
  if (due.length === 0) {
    return NextResponse.json({ ok: true, due: 0 })
  }

  const appUrl = getAppUrl()
  const overdue = due.filter(l => new Date(l.next_followup_at) <= now)
  const today   = due.filter(l => {
    const d = new Date(l.next_followup_at)
    return d > now && d.toDateString() === now.toDateString()
  })
  const tomorrow = due.filter(l => {
    const d = new Date(l.next_followup_at)
    return d > now && d.toDateString() !== now.toDateString()
  })

  const html = renderEmail({ overdue, today, tomorrow, appUrl })
  const subject = overdue.length > 0
    ? `🔴 ${overdue.length} überfällige Follow-ups + ${today.length + tomorrow.length} kommende`
    : `📞 ${today.length} Follow-up${today.length !== 1 ? 's' : ''} heute · ${tomorrow.length} morgen`

  // Send to all admins
  let sent = 0
  const sendErrors: string[] = []
  for (const to of adminEmails) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to,
          subject,
          html,
        }),
      })
      if (res.ok) sent++
      else sendErrors.push(`${to}: HTTP ${res.status}`)
    } catch (err) {
      sendErrors.push(`${to}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Mark as reminded — even if some emails failed (Resend usually retries, and
  // we don't want to spam the user every cron run if one address bounces)
  if (sent > 0) {
    const ids = due.map(l => l.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('sales_leads') as any)
      .update({ followup_reminded_at: now.toISOString() })
      .in('id', ids)
  }

  return NextResponse.json({
    ok: sendErrors.length === 0,
    due: due.length,
    overdue: overdue.length,
    today: today.length,
    tomorrow: tomorrow.length,
    emailsSent: sent,
    errors: sendErrors.length > 0 ? sendErrors : undefined,
  })
}

function renderEmail({ overdue, today, tomorrow, appUrl }: {
  overdue: LeadRow[]; today: LeadRow[]; tomorrow: LeadRow[]; appUrl: string
}) {
  const fromDomain = (process.env.RESEND_FROM_EMAIL ?? 'noreply@osss.pro').split('@')[1] ?? 'osss.pro'

  const renderLead = (l: LeadRow, kind: 'overdue' | 'today' | 'tomorrow') => {
    const dt = new Date(l.next_followup_at)
    const time = dt.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    const tone = kind === 'overdue' ? '#dc2626' : kind === 'today' ? '#d97706' : '#475569'
    const cta = `${appUrl}/admin/leads`
    const phoneLine = l.phone ? `<div style="margin-top:4px;font-size:13px"><a href="tel:${l.phone}" style="color:#0f172a;text-decoration:none">📞 ${l.phone}</a></div>` : ''
    const emailLine = l.email ? `<div style="margin-top:2px;font-size:13px"><a href="mailto:${l.email}" style="color:#0f172a;text-decoration:none">✉ ${l.email}</a></div>` : ''
    const noteLine = l.notes ? `<div style="margin-top:6px;font-size:12px;color:#64748b;font-style:italic">"${escapeHtml(l.notes.slice(0, 200))}${l.notes.length > 200 ? '…' : ''}"</div>` : ''
    const stars = '★'.repeat(l.priority) + '☆'.repeat(5 - l.priority)

    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border-left:3px solid ${tone};background:#fafafa;border-radius:0 8px 8px 0">
        <tr><td style="padding:12px 16px">
          <div style="font-weight:700;font-size:15px;color:#0f172a">${escapeHtml(l.name)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">
            ${l.city ? escapeHtml(l.city) + ' · ' : ''}${time} · <span style="color:${tone}">${kind === 'overdue' ? 'überfällig' : kind === 'today' ? 'heute' : 'morgen'}</span> · ${stars} · ${l.contact_count}× kontaktiert
          </div>
          ${phoneLine}${emailLine}${noteLine}
          <div style="margin-top:10px"><a href="${cta}" style="display:inline-block;padding:6px 12px;background:#0f172a;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600">Im CRM öffnen →</a></div>
        </td></tr>
      </table>`
  }

  const section = (title: string, items: LeadRow[], kind: 'overdue' | 'today' | 'tomorrow') => {
    if (items.length === 0) return ''
    return `
      <div style="margin-top:24px">
        <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a">${title} (${items.length})</h2>
        ${items.map(l => renderLead(l, kind)).join('')}
      </div>`
  }

  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px">
        <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:20px 24px">
          <p style="margin:0;color:#fbbf24;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase">osss.pro · Sales-CRM</p>
          <h1 style="margin:6px 0 0;color:#fff;font-size:18px;font-weight:700">Follow-up Erinnerung</h1>
        </td></tr>
        <tr><td style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
          ${section('🔴 Überfällig', overdue, 'overdue')}
          ${section('📞 Heute', today, 'today')}
          ${section('📅 Morgen', tomorrow, 'tomorrow')}

          <p style="font-size:11px;color:#9ca3af;margin:24px 0 0;border-top:1px solid #f1f5f9;padding-top:12px">
            Diese Erinnerung wird stündlich verschickt für alle Leads mit "Nächster Follow-up" in den nächsten ${LOOKAHEAD_HOURS}h.
            Nach dem ersten Mal versendet wird ein Lead nicht mehr erinnert (außer du änderst das Datum).
            <br>Sender: ${fromDomain}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]!)
}
