import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cronGuard } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/cron/missing-plan-reminder
 *
 * Erinnert aktive Mitglieder OHNE Tarif (kein plan_id, kein
 * monthly_fee_override_cents) wöchentlich per Mail, dass sie einen
 * Tarif wählen sollen. Schickt zusätzlich ein Sammel-Update an den
 * Owner mit Liste aller offenen Fälle.
 *
 * Idempotenz:
 *  - Pro Mitglied: max 1× pro 7 Tage (members.plan_reminder_sent_at)
 *  - Pro Owner: nur wenn ≥1 Mitglied tatsächlich angeschrieben wurde
 *  - Pro Cron-Run: cron_runs(job_name, executed_at) UNIQUE-Constraint
 *    blockt Doppel-Trigger am selben Tag
 *
 * Vercel-Cron: 1× pro Woche (Montag 8:00 UTC) — siehe vercel.json.
 * Auth: cronGuard via CRON_SECRET (Bearer-Token im Header).
 */
export async function GET(req: Request) {
  const guard = cronGuard(req)
  if (guard) return guard

  const supabase = createServiceClient()
  const now = new Date()
  const day7Ago = new Date(now.getTime() - 7 * 86400000).toISOString()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.osss.pro'
  const fromEmail = process.env.RESEND_FROM_EMAIL
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey || !fromEmail) {
    return NextResponse.json({ error: 'Resend nicht konfiguriert' }, { status: 503 })
  }

  // Cron-Idempotenz auf Tag-Ebene
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: lockErr } = await (supabase.from('cron_runs') as any).insert({
      job_name: 'missing-plan-reminder',
      executed_at: now.toISOString().slice(0, 10),  // YYYY-MM-DD = Tagesgranularität
    })
    if (lockErr && (lockErr as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'already ran today' })
    }
  } catch { /* cron_runs evtl. nicht da, weiter */ }

  // Aktive Mitglieder ohne Tarif (kein Override, kein plan_id) UND
  // länger als 7 Tage seit letztem Reminder (oder noch nie reminderiert)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members, error: memErr } = await (supabase.from('members') as any)
    .select('id, gym_id, first_name, last_name, email, portal_token, created_at, plan_reminder_sent_at')
    .is('plan_id', null)
    .is('monthly_fee_override_cents', null)
    .eq('is_active', true)
    .not('email', 'is', null)
    .or(`plan_reminder_sent_at.is.null,plan_reminder_sent_at.lt.${day7Ago}`)
    .limit(500)

  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })
  if (!members || members.length === 0) {
    return NextResponse.json({ ok: true, members_notified: 0, owners_notified: 0 })
  }

  // Pro Gym gruppieren — Owner soll EINE Sammel-Mail bekommen mit Liste,
  // nicht 1× pro Mitglied.
  type Member = {
    id: string; gym_id: string;
    first_name: string; last_name: string;
    email: string | null;
    portal_token: string | null;
    created_at: string;
    plan_reminder_sent_at: string | null;
  }
  const byGym = new Map<string, Member[]>()
  for (const m of (members ?? []) as Member[]) {
    if (!byGym.has(m.gym_id)) byGym.set(m.gym_id, [])
    byGym.get(m.gym_id)!.push(m)
  }

  // Gym-Stammdaten laden (nur für die relevanten Gyms)
  const gymIds = Array.from(byGym.keys())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gyms } = await (supabase.from('gyms') as any)
    .select('id, name, email, slug, signup_token')
    .in('id', gymIds)
  const gymMap = new Map<string, { id: string; name: string; email: string | null; slug: string | null; signup_token: string | null }>()
  for (const g of (gyms ?? []) as Array<{ id: string; name: string; email: string | null; slug: string | null; signup_token: string | null }>) {
    gymMap.set(g.id, g)
  }

  let memberMailsSent = 0
  let memberMailsFailed = 0
  let ownerMailsSent = 0
  const errors: string[] = []

  // ── HTML-Helper ────────────────────────────────────────────────────────────
  const esc = (s: string | null | undefined) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

  function memberMailHtml(memberFirstName: string, gymName: string, portalUrl: string | null): string {
    const ctaUrl = portalUrl ?? `${appUrl}/login`
    return `<!DOCTYPE html><html lang="de"><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px"><tr><td align="center">
  <table width="100%" style="max-width:560px;background:#fff;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden">
    <tr><td style="padding:24px 36px 12px;border-bottom:1px solid #f4f4f5">
      <p style="margin:0;color:#18181b;font-size:18px;font-weight:800">${esc(gymName)}</p>
    </td></tr>
    <tr><td style="padding:24px 36px;font-size:15px;line-height:1.6;color:#3f3f46">
      <p style="margin:0 0 14px">Hallo ${esc(memberFirstName)},</p>
      <p style="margin:0 0 14px">deine Mitgliedschaft bei <strong>${esc(gymName)}</strong> ist aktiviert,
        aber es wurde noch <strong>kein Tarif ausgewählt</strong>.</p>
      <p style="margin:0 0 18px">Bitte wähle in deinem persönlichen Mitglieder-Portal einen passenden Tarif aus,
        damit dein Trainings-Beitrag korrekt abgerechnet werden kann:</p>
      <p style="margin:0 0 22px;text-align:center">
        <a href="${esc(ctaUrl)}" style="display:inline-block;padding:13px 28px;background:#fbbf24;color:#18181b;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">
          Tarif jetzt auswählen →
        </a>
      </p>
      <p style="margin:0 0 8px;color:#71717a;font-size:13px">Falls du dazu Fragen hast, antworte einfach auf diese Mail —
        sie geht direkt an dein Studio.</p>
    </td></tr>
    <tr><td style="padding:14px 36px;background:#fafafa;border-top:1px solid #f4f4f5">
      <p style="margin:0;color:#a1a1aa;font-size:11px;line-height:1.5">
        Diese automatische Erinnerung kommt 1× pro Woche, bis ein Tarif gewählt wurde.
        Vertragsbezogene Mitteilung nach Art. 6 Abs. 1 lit. b DSGVO.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
  }

  function ownerMailHtml(ownerFirstHint: string, gymName: string, missing: Array<{ first_name: string; last_name: string; email: string | null; days: number }>): string {
    const rows = missing.map(m => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f4f4f5">
          <strong>${esc(m.first_name)} ${esc(m.last_name)}</strong>
          ${m.email ? `<br/><span style="color:#71717a;font-size:12px">${esc(m.email)}</span>` : ''}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;text-align:right;color:#a1a1aa;font-size:12px;font-variant-numeric:tabular-nums">
          seit ${m.days} ${m.days === 1 ? 'Tag' : 'Tagen'}
        </td>
      </tr>`).join('')

    return `<!DOCTYPE html><html lang="de"><body style="margin:0;padding:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px"><tr><td align="center">
  <table width="100%" style="max-width:560px;background:#fff;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden">
    <tr><td style="padding:24px 36px 12px;border-bottom:1px solid #f4f4f5">
      <p style="margin:0;color:#fbbf24;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase">Tarif fehlt</p>
      <p style="margin:6px 0 0;color:#18181b;font-size:18px;font-weight:800">${missing.length} ${missing.length === 1 ? 'Mitglied' : 'Mitglieder'} ohne Tarif</p>
    </td></tr>
    <tr><td style="padding:20px 36px;font-size:14px;line-height:1.6;color:#3f3f46">
      <p style="margin:0 0 12px">${ownerFirstHint}, in deinem Studio <strong>${esc(gymName)}</strong> haben aktuell folgende Mitglieder
        keinen Tarif ausgewählt:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#3f3f46">${rows}</table>
      <p style="margin:14px 0 0;color:#52525b;font-size:13px">Wir haben jeden direkt per E-Mail an die Wahl eines Tarifs erinnert.
        Du kannst den Mitgliedern auch direkt aus dem Dashboard einen Tarif zuweisen
        oder einen Override-Beitrag setzen.</p>
      <p style="margin:14px 0 0;text-align:center">
        <a href="${esc(appUrl)}/dashboard/members" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">
          Mitglieder verwalten →
        </a>
      </p>
    </td></tr>
    <tr><td style="padding:14px 36px;background:#fafafa;border-top:1px solid #f4f4f5">
      <p style="margin:0;color:#a1a1aa;font-size:11px;line-height:1.5">
        Diese Sammel-Übersicht kommt automatisch 1× pro Woche solange Mitglieder ohne Tarif aktiv sind.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
  }

  async function sendResendMail(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to,
          subject,
          html,
          ...(replyTo ? { replyTo } : {}),
        }),
      })
      return res.ok
    } catch {
      return false
    }
  }

  // ── Pro Gym: Mitglieder-Mails + Owner-Sammel-Mail ──────────────────────────
  for (const [gymId, gymMembers] of byGym.entries()) {
    const gym = gymMap.get(gymId)
    if (!gym) continue
    const gymName = gym.name ?? 'dein Studio'

    const reportRows: Array<{ first_name: string; last_name: string; email: string | null; days: number }> = []
    const successfullyNotifiedIds: string[] = []

    for (const m of gymMembers) {
      if (!m.email) continue

      const portalUrl = m.portal_token ? `${appUrl}/portal/${m.portal_token}` : null
      const subject = `Tarif auswählen – deine Mitgliedschaft bei ${gymName}`
      const html = memberMailHtml(m.first_name, gymName, portalUrl)
      // Reply-To: Studio-Adresse → Mitglied antwortet direkt an Studio, nicht an Osss
      const replyTo = gym.email ?? undefined

      const ok = await sendResendMail(m.email, subject, html, replyTo)
      if (ok) {
        memberMailsSent++
        successfullyNotifiedIds.push(m.id)
        const days = Math.floor((now.getTime() - new Date(m.created_at).getTime()) / 86400000)
        reportRows.push({
          first_name: m.first_name,
          last_name: m.last_name,
          email: m.email,
          days,
        })
      } else {
        memberMailsFailed++
        errors.push(`member ${m.id} (gym ${gymId})`)
      }
    }

    // Bulk-Update: alle erfolgreich-benachrichtigten Mitglieder bekommen plan_reminder_sent_at
    if (successfullyNotifiedIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('members') as any)
        .update({ plan_reminder_sent_at: now.toISOString() })
        .in('id', successfullyNotifiedIds)
    }

    // Owner-Sammel-Mail nur senden wenn ≥1 Mitglied erfolgreich benachrichtigt
    if (reportRows.length > 0 && gym.email) {
      const subject = `${reportRows.length} ${reportRows.length === 1 ? 'Mitglied' : 'Mitglieder'} ohne Tarif – ${gymName}`
      const html = ownerMailHtml('Hallo', gymName, reportRows)
      const ok = await sendResendMail(gym.email, subject, html)
      if (ok) ownerMailsSent++
    }
  }

  return NextResponse.json({
    ok: true,
    members_notified: memberMailsSent,
    members_failed: memberMailsFailed,
    owners_notified: ownerMailsSent,
    errors: errors.slice(0, 10),
  })
}
