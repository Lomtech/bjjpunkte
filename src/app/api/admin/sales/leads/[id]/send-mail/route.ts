import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/admin-auth'
import {
  TEMPLATES,
  renderTemplate,
  validateRendered,
  extractVars,
  MAX_MAILS_PER_DAY,
  type ColdOutreachVariant,
  type TemplateVars,
} from '@/lib/sales/cold-outreach-templates'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sales/leads/[id]/send-mail
 *
 * Sendet eine semi-automatische Cold-Outreach-Mail an einen Lead.
 *
 * Schutzmechanismen:
 *  - requireAdmin (Bearer + ADMIN_EMAILS-Allowlist)
 *  - DACH-§7-UWG: validateRendered rejected Mails ohne echte Personalisierung
 *    (mindestens 10 Zeichen pro Hook, keine ungefüllten {{…}}-Platzhalter)
 *  - Daily-Rate-Limit: MAX_MAILS_PER_DAY pro Owner. Verhindert Spam-Filter-
 *    Blacklisting bei Resend und Inbox-Providern.
 *  - List-Unsubscribe-Header — RFC 8058. Auch Cold-Outreach in DACH wird
 *    von einigen Inbox-Providern als "list-mail" eingestuft. Header rein,
 *    Risiko raus.
 *
 * Side-Effects bei Erfolg:
 *  - Resend-Mail-Versand
 *  - sales_activities-Insert (kind='email', subject, body)
 *  - sales_leads-Update (status='contacted', last_contacted_at=now,
 *    contact_count++, next_action='followup_mail_2', next_action_at=+5d)
 *
 * Body:
 *   { variant: 'small' | 'medium' | 'large',
 *     subjectIndex: 0|1|2,
 *     vars: TemplateVars }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const { id } = await params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Ungültige Lead-ID' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !fromEmail) {
    return NextResponse.json(
      { error: 'Resend nicht konfiguriert (RESEND_API_KEY/RESEND_FROM_EMAIL fehlen)' },
      { status: 500 },
    )
  }

  let body: {
    variant?: ColdOutreachVariant
    subjectIndex?: number
    vars?: Partial<TemplateVars>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const variant = body.variant
  if (variant !== 'small' && variant !== 'medium' && variant !== 'large') {
    return NextResponse.json({ error: 'variant muss small/medium/large sein' }, { status: 400 })
  }
  const template = TEMPLATES.find(t => t.variant === variant)!
  const subjectIndex = Math.max(0, Math.min(template.subjects.length - 1, body.subjectIndex ?? 0))

  const supabase = createServiceClient()

  // Load lead — fail loudly if not found, owner-mismatch, or no email.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead, error: leadErr } = await (supabase.from('sales_leads') as any)
    .select('id, name, email, city, formatted_address, notes, sports, status, contact_count')
    .eq('id', id)
    .maybeSingle()
  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 })
  if (!lead) return NextResponse.json({ error: 'Lead nicht gefunden' }, { status: 404 })
  if (!lead.email || typeof lead.email !== 'string' || !lead.email.includes('@')) {
    return NextResponse.json({ error: 'Lead hat keine gültige E-Mail-Adresse' }, { status: 400 })
  }

  // Daily rate-limit: count emails sent today by this admin via this endpoint.
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: sentToday, error: countErr } = await (supabase.from('sales_activities') as any)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
    .eq('kind', 'email')
    .gte('occurred_at', sinceIso)
  if (countErr) {
    console.error('[send-mail] rate-limit count failed:', countErr.message)
    // Fail closed — better to refuse than to over-send.
    return NextResponse.json({ error: 'Rate-Limit-Check fehlgeschlagen' }, { status: 500 })
  }
  if ((sentToday ?? 0) >= MAX_MAILS_PER_DAY) {
    return NextResponse.json(
      {
        error: `Daily-Limit erreicht (${MAX_MAILS_PER_DAY}/Tag). Schutz vor Spam-Filter-Blacklisting. Morgen wieder.`,
        sentToday,
        limit: MAX_MAILS_PER_DAY,
      },
      { status: 429 },
    )
  }

  // Build variables: auto-fill from lead, then merge owner overrides on top.
  const auto = extractVars(lead)
  const vars: TemplateVars = {
    studio: auto.studio,
    stadt: auto.stadt,
    sportart: auto.sportart,
    vorname: '',
    nachname: '',
    hook_observation: '',
    hook_pain: '',
    hook_custom: '',
    ...(body.vars ?? {}),
  }

  // Render + validate.
  const rendered = renderTemplate(template, vars, subjectIndex)
  const check = validateRendered(rendered, vars)
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 })
  }

  // List-Unsubscribe header (RFC 8058) — even for cold outreach, this is
  // a strong deliverability signal. mailto: provides a low-friction opt-out
  // that satisfies the "minimum effort" bar §7 UWG implicitly expects.
  const unsubscribeMail = `mailto:${fromEmail}?subject=Unsubscribe%20${encodeURIComponent(lead.id)}`

  // Convert plain-text body to a minimal HTML version: paragraph splits +
  // bullet lists. No inline styles — reach is more important than polish for
  // cold outreach (most clients render plaintext-ish anyway).
  const html = textToHtml(rendered.body)

  // Resend send.
  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: lead.email,
      reply_to: fromEmail,
      subject: rendered.subject,
      text: rendered.body,
      html,
      headers: {
        'List-Unsubscribe': `<${unsubscribeMail}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      tags: [
        { name: 'category', value: 'cold-outreach' },
        { name: 'variant', value: variant },
      ],
    }),
  })
  if (!sendRes.ok) {
    const errText = await sendRes.text().catch(() => '')
    console.error('[send-mail] Resend failed:', sendRes.status, errText.slice(0, 500))
    return NextResponse.json(
      { error: `Mail-Versand fehlgeschlagen (Resend ${sendRes.status})` },
      { status: 502 },
    )
  }
  const sendBody = (await sendRes.json().catch(() => ({}))) as { id?: string }

  // Activity log + lead status update — log even if status update fails.
  const nowIso = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actRes = await (supabase.from('sales_activities') as any).insert({
    lead_id: id,
    user_id: auth.user.id,
    kind: 'email',
    subject: rendered.subject,
    body: rendered.body.slice(0, 5000),
    occurred_at: nowIso,
  })
  if (actRes.error) {
    console.error('[send-mail] activity insert failed:', actRes.error.message)
  }

  // Schedule next-action: followup_mail_2 in 5 days, status → contacted.
  const followup = new Date()
  followup.setDate(followup.getDate() + 5)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updRes = await (supabase.from('sales_leads') as any)
    .update({
      status: 'contacted',
      last_contacted_at: nowIso,
      contact_count: (lead.contact_count ?? 0) + 1,
      next_action: 'followup_mail_2',
      next_action_at: followup.toISOString(),
      last_action_kind: 'email',
      updated_at: nowIso,
    })
    .eq('id', id)
  if (updRes.error) {
    console.error('[send-mail] lead status update failed:', updRes.error.message)
  }

  return NextResponse.json({
    ok: true,
    resend_id: sendBody.id ?? null,
    sent_today: (sentToday ?? 0) + 1,
    daily_limit: MAX_MAILS_PER_DAY,
    next_followup_at: followup.toISOString(),
  })
}

/**
 * Convert plaintext body (with double-newline paragraph breaks and `- `
 * bullet markers) to a minimal HTML representation. Keeps the mail
 * readable on HTML-only clients without inflating with framework styles.
 */
function textToHtml(text: string): string {
  // Escape HTML special chars first
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const blocks = esc.split(/\n\s*\n/)
  const rendered = blocks.map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''
    const lines = trimmed.split('\n')
    const isList = lines.every(l => /^\s*[-*]\s+/.test(l))
    if (isList) {
      const items = lines.map(l => `<li>${l.replace(/^\s*[-*]\s+/, '')}</li>`).join('')
      return `<ul>${items}</ul>`
    }
    // Inline bold for **…** segments
    const withBold = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    return `<p>${withBold.replace(/\n/g, '<br>')}</p>`
  }).join('\n')

  return `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.55;color:#1f2937">${rendered}</div>`
}
