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
 * POST /api/admin/sales/leads/bulk-send-mail
 *
 * Bulk-Auto-Send für Cold-Outreach-Mails. Sendet bis zu BULK_MAX_PER_RUN
 * Mails an Leads, die noch nie kontaktiert wurden, in einem Schwung.
 *
 * Use-Case: Backup für „heute keine Zeit für 20× hand-personalisierte Mails".
 * Konvertiert deutlich schlechter als manuelle Mails (5-10× weniger Replies),
 * deshalb die Hard-Cap auf 10/Run.
 *
 * UWG-§7-Risiko-Mitigation:
 *  - Hard-Cap 10 Mails pro Bulk-Run (statt 20). Restliche 10 sollen
 *    hand-personalisiert über den Single-Endpoint laufen.
 *  - hook_observation und hook_pain werden aus Lead-Daten generiert
 *    (Notes / Stadt / Variant). Subject + Body enthalten IMMER Studio-
 *    Name und Stadt → minimale Personalisierung erfüllt.
 *  - validateRendered() filtert Leads raus, deren generierte Hooks zu
 *    kurz sind. Diese werden geskippt, nicht gesendet.
 *  - Daily-Quota (MAX_MAILS_PER_DAY) bleibt aus dem Single-Endpoint
 *    erhalten — bulk-Runs zählen voll.
 *  - List-Unsubscribe-Header (RFC 8058) auf jeder Mail.
 *
 * Body: kein Body nötig (POST trigger). Optional: { dryRun: true }
 *   für Test-Lauf ohne Resend-Versand.
 *
 * Response:
 *   {
 *     ok: true,
 *     sent: number,
 *     skipped: number,
 *     skipReasons: string[],
 *     remainingDailyQuota: number,
 *     leadsContacted: { id, name, email, variant }[]
 *   }
 */

/** Hard-Cap pro Bulk-Run — bewusst niedriger als MAX_MAILS_PER_DAY (20),
 *  um Spam-Risiko bei nicht-individualisierten Mails zu reduzieren. */
const BULK_MAX_PER_RUN = 10

/** Tage bis zum nächsten Follow-up (gleich wie Single-Endpoint) */
const FOLLOWUP_DAYS = 5

interface LeadRow {
  id: string
  name: string
  email: string | null
  city: string | null
  formatted_address: string | null
  notes: string | null
  sports: string[] | null
  status: string
  contact_count: number | null
  user_ratings_total: number | null
}

interface ContactedSummary {
  id: string
  name: string
  email: string
  variant: ColdOutreachVariant
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req)
  if ('error' in auth) return auth.error

  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !fromEmail) {
    return NextResponse.json(
      { error: 'Resend nicht konfiguriert (RESEND_API_KEY/RESEND_FROM_EMAIL fehlen)' },
      { status: 500 },
    )
  }

  // Optional dry-run flag (no Resend-call, just validation + slot calculation).
  let dryRun = false
  try {
    const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean }
    dryRun = body?.dryRun === true
  } catch {
    // empty body is fine
  }

  const supabase = createServiceClient()

  // Daily-Quota: how many mails went out in the last 24h via this admin?
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: sentToday, error: countErr } = await (supabase.from('sales_activities') as any)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
    .eq('kind', 'email')
    .gte('occurred_at', sinceIso)
  if (countErr) {
    console.error('[bulk-send-mail] rate-limit count failed:', countErr.message)
    return NextResponse.json({ error: 'Rate-Limit-Check fehlgeschlagen' }, { status: 500 })
  }

  const sentSoFar = sentToday ?? 0
  const dailyRemaining = Math.max(0, MAX_MAILS_PER_DAY - sentSoFar)
  // The bulk-run cap is the lower of: per-run cap, daily remaining
  const slots = Math.min(BULK_MAX_PER_RUN, dailyRemaining)

  if (slots <= 0) {
    return NextResponse.json(
      {
        error: `Daily-Limit erreicht (${sentSoFar}/${MAX_MAILS_PER_DAY}). Schutz vor Spam-Filter-Blacklisting. Morgen wieder.`,
        sentToday: sentSoFar,
        limit: MAX_MAILS_PER_DAY,
        remainingDailyQuota: 0,
      },
      { status: 429 },
    )
  }

  // Pick eligible leads. Filter:
  //   - email vorhanden + enthält "@"
  //   - status ∈ {new, researching}
  //   - last_contacted_at IS NULL (noch nie kontaktiert)
  //   - is_martial_arts = true
  //   - ORDER BY priority DESC, created_at ASC (heißeste zuerst)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leadsRaw, error: leadErr } = await (supabase.from('sales_leads') as any)
    .select('id, name, email, city, formatted_address, notes, sports, status, contact_count, user_ratings_total')
    .in('status', ['new', 'researching'])
    .is('last_contacted_at', null)
    .eq('is_martial_arts', true)
    .not('email', 'is', null)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(slots * 3) // Overfetch: some will be skipped (no @, hook too short)

  if (leadErr) {
    console.error('[bulk-send-mail] lead fetch failed:', leadErr.message)
    return NextResponse.json({ error: leadErr.message }, { status: 500 })
  }

  const leads: LeadRow[] = (leadsRaw ?? []) as LeadRow[]

  // Iterate, send, log. Stop when slots are filled.
  const sent: ContactedSummary[] = []
  const skipReasons: string[] = []
  const nowIso = new Date().toISOString()

  for (const lead of leads) {
    if (sent.length >= slots) break

    // Email-shape check (the .not('email', 'is', null) filter still allows
    // empty strings or values without '@').
    if (!lead.email || typeof lead.email !== 'string' || !lead.email.includes('@')) {
      skipReasons.push(`${lead.id}: keine gültige E-Mail`)
      continue
    }

    const variant = pickVariant(lead.user_ratings_total)
    const template = TEMPLATES.find(t => t.variant === variant)!

    // Auto-build vars: studio/stadt/sportart aus Lead, hooks aus Lead-Daten
    // generieren. Bei kürzerem Notes-Inhalt auf Studio-spezifische Fallbacks.
    const auto = extractVars(lead)
    const hookObservation = buildHookObservation(lead, auto.studio, auto.stadt)
    const hookPain = buildHookPain(variant)

    const vars: TemplateVars = {
      studio: auto.studio,
      stadt: auto.stadt,
      sportart: auto.sportart,
      vorname: '',
      nachname: '',
      hook_observation: hookObservation,
      hook_pain: hookPain,
      hook_custom: '',
    }

    // Subject auswählen — wir nehmen den Subject mit allen Vars befüllt.
    // Variant 'small' subject 0 verlangt {{vorname}} → bei leerem vorname
    // springt applyVars auf studio.split(' ')[0]. Ist OK, aber explizit:
    // Wir wählen für 'small' subjectIndex=2 (BJJ-Trainee, kein {{vorname}}).
    const subjectIndex = pickSubjectIndex(variant)

    const rendered = renderTemplate(template, vars, subjectIndex)
    const check = validateRendered(rendered, vars)
    if (!check.ok) {
      skipReasons.push(`${lead.id} (${lead.name}): ${check.reason}`)
      continue
    }

    // Belt-and-suspenders: Subject MUSS Studio-Name enthalten oder Stadt
    // (minimale Personalisierung im UWG-§7-Sinne). Beide in {{}}-Slots
    // schon im Template, aber wenn ein Subject keinen Slot enthält,
    // ergänzen wir keinen — sondern skippen.
    if (!subjectMentionsStudioOrCity(rendered.subject, auto.studio, auto.stadt)) {
      skipReasons.push(`${lead.id} (${lead.name}): Subject ohne Studio/Stadt`)
      continue
    }

    if (dryRun) {
      sent.push({ id: lead.id, name: lead.name, email: lead.email, variant })
      continue
    }

    // List-Unsubscribe header (RFC 8058)
    const unsubscribeMail = `mailto:${fromEmail}?subject=Unsubscribe%20${encodeURIComponent(lead.id)}`
    const html = textToHtml(rendered.body)

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
          { name: 'mode', value: 'bulk' },
        ],
      }),
    })

    if (!sendRes.ok) {
      const errText = await sendRes.text().catch(() => '')
      console.error(`[bulk-send-mail] Resend failed for ${lead.id}:`, sendRes.status, errText.slice(0, 300))
      skipReasons.push(`${lead.id} (${lead.name}): Resend-Fehler ${sendRes.status}`)
      continue
    }

    // Activity-log + Lead-Update — best-effort, surface errors but keep going.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actRes = await (supabase.from('sales_activities') as any).insert({
      lead_id: lead.id,
      user_id: auth.user.id,
      kind: 'email',
      subject: rendered.subject,
      body: rendered.body.slice(0, 5000),
      occurred_at: nowIso,
    })
    if (actRes.error) {
      console.error(`[bulk-send-mail] activity insert failed for ${lead.id}:`, actRes.error.message)
    }

    const followup = new Date()
    followup.setDate(followup.getDate() + FOLLOWUP_DAYS)
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
      .eq('id', lead.id)
    if (updRes.error) {
      console.error(`[bulk-send-mail] lead update failed for ${lead.id}:`, updRes.error.message)
    }

    sent.push({ id: lead.id, name: lead.name, email: lead.email, variant })
  }

  const remainingDailyQuota = Math.max(0, MAX_MAILS_PER_DAY - sentSoFar - sent.length)

  return NextResponse.json({
    ok: true,
    sent: sent.length,
    skipped: skipReasons.length,
    skipReasons,
    remainingDailyQuota,
    leadsContacted: sent,
    bulkMaxPerRun: BULK_MAX_PER_RUN,
    dryRun,
  })
}

/**
 * Variant nach Studio-Größe (gleiche Logik wie ColdMailComposeModal).
 * > 300 Reviews → groß, > 100 → mittel, sonst klein.
 */
function pickVariant(userRatingsTotal: number | null): ColdOutreachVariant {
  const n = userRatingsTotal ?? 0
  if (n > 300) return 'large'
  if (n > 100) return 'medium'
  return 'small'
}

/**
 * Subject-Auswahl: bei „small" nehmen wir den Subject ohne {{vorname}}-Slot
 * (wir haben keinen Vornamen aus der Auto-Pipeline → würde auf studio[0]
 * fallen, was unschön ist). Subject 2 für small ist der „BJJ-Trainee"-Subject,
 * der auch ohne Vorname funktioniert.
 *
 * Bei medium/large gibt es Subjects mit {{studio}} (immer befüllt) oder
 * {{stadt}} — die sind alle bulk-tauglich. Wir nehmen Index 0 (Default).
 */
function pickSubjectIndex(variant: ColdOutreachVariant): number {
  if (variant === 'small') return 2
  return 0
}

/**
 * Generiere `hook_observation` aus Lead-Daten:
 *   - Notes (erste 100 Zeichen) wenn substanzieller Inhalt
 *   - Sonst Fallback: „ich habe euer Studio in {stadt} gesehen…"
 *
 * Mindestens 10 Zeichen, sonst skippt validateRendered() den Lead.
 */
function buildHookObservation(lead: LeadRow, studio: string, stadt: string): string {
  const notes = (lead.notes ?? '').trim()
  if (notes.length >= 20) {
    // Cut sauber bei Wortgrenze unter 100 chars
    if (notes.length <= 100) return notes
    const cut = notes.slice(0, 100)
    const lastSpace = cut.lastIndexOf(' ')
    return (lastSpace > 50 ? cut.slice(0, lastSpace) : cut) + '…'
  }
  // Fallback — referenziert IMMER Studio + Stadt (UWG-§7-Mindest-
  // Personalisierung erfüllt).
  if (stadt && stadt !== '[Stadt]') {
    return `ich bin auf ${studio} in ${stadt} gestoßen und habe mir die Webseite angeschaut.`
  }
  return `ich bin auf ${studio} gestoßen und habe mir die Webseite kurz angeschaut.`
}

/**
 * Generiere `hook_pain` basierend auf Variant.
 * Mindestens 10 Zeichen, sonst skippt validateRendered() den Lead.
 */
function buildHookPain(variant: ColdOutreachVariant): string {
  switch (variant) {
    case 'small':
      return 'manueller Verwaltung in Excel/Tabellen und Beitragseinzug per Überweisung'
    case 'medium':
      return 'mehrere Vertragsarten parallel und manuelle Inkasso-Prozesse mit DATEV-Export'
    case 'large':
      return 'Branchen-spezifische Features wie Belt-System mit Stripes oder GPS-Check-in fehlen oft in generischen Tools'
  }
}

/** Stellt sicher, dass das Subject Studio-Name oder Stadt mindestens einmal enthält. */
function subjectMentionsStudioOrCity(subject: string, studio: string, stadt: string): boolean {
  const s = subject.toLowerCase()
  if (studio && s.includes(studio.toLowerCase())) return true
  if (stadt && stadt !== '[Stadt]' && s.includes(stadt.toLowerCase())) return true
  // Subjects mit {{vorname}} → applyVars setzt studio.split(' ')[0]. Prüfen,
  // ob mindestens das erste Wort drin ist.
  const studioFirst = studio.split(' ')[0]?.toLowerCase()
  if (studioFirst && s.includes(studioFirst)) return true
  return false
}

/** Plaintext → minimal HTML (paragraphs + bullet lists). 1:1 wie single-send. */
function textToHtml(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const blocks = esc.split(/\n\s*\n/)
  const rendered = blocks
    .map(block => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      const lines = trimmed.split('\n')
      const isList = lines.every(l => /^\s*[-*]\s+/.test(l))
      if (isList) {
        const items = lines.map(l => `<li>${l.replace(/^\s*[-*]\s+/, '')}</li>`).join('')
        return `<ul>${items}</ul>`
      }
      const withBold = trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      return `<p>${withBold.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')

  return `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.55;color:#1f2937">${rendered}</div>`
}
