import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cronGuard } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/cron/newsletter-cleanup
 *
 * DSGVO Art. 5(1)(e) — Speicherbegrenzung. Unsere Datenschutzerklärung
 * verspricht: "30 Tage Sperre nach Abmeldung, danach Löschung". Ohne
 * automatische Löschung wäre das eine leere Versprechung und im Audit
 * sofort als Verstoß gegen das eigene Versprechen erkennbar.
 *
 * Was passiert hier:
 *  1. Lösche unbestätigte Anmeldungen älter als 30 Tage
 *     (Doppel-Opt-In-Token-Phantome — Datenschatten ohne Consent).
 *  2. Lösche abgemeldete Subscriber älter als 30 Tage
 *     (30d Sperrfrist gemäß DSE; danach kein Aufbewahrungsgrund mehr).
 *
 * Bestätigte aktive Subscriber: bleiben bis zur expliziten Abmeldung.
 *
 * Vercel-Cron: täglich.  Auth: Bearer ${CRON_SECRET} via cronGuard.
 *
 * Idempotenz: Operation ist idempotent (DELETE WHERE …; mehrfaches
 *             Triggern hat denselben Effekt). Kein cron_runs-Lock nötig.
 */
export async function GET(req: Request) {
  const guard = cronGuard(req)
  if (guard) return guard

  const supabase = createServiceClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffIso = cutoff.toISOString()

  let unconfirmedDeleted = 0
  let unsubscribedDeleted = 0

  // 1) Unconfirmed > 30 days — Phantome aus dem Doppel-Opt-In-Flow.
  // Status 'pending' ist nicht offiziell DSGVO-relevant (kein consent),
  // aber das Aufbewahren von verwaisten Tokens ist sinnloser Datenmüll.
  const { data: unconfirmed, error: unconfirmedErr } = await supabase
    .from('newsletter_subscribers')
    .delete()
    .eq('status', 'pending')
    .lt('subscribed_at', cutoffIso)
    .select('id')
  if (unconfirmedErr) {
    console.error('[newsletter-cleanup] failed to delete unconfirmed:', unconfirmedErr.message)
    return NextResponse.json({ error: unconfirmedErr.message }, { status: 500 })
  }
  unconfirmedDeleted = unconfirmed?.length ?? 0

  // 2) Unsubscribed > 30 days — die Sperrfrist ist abgelaufen,
  // weitere Aufbewahrung ist Art. 5(1)(e)-Verstoß.
  const { data: unsubscribed, error: unsubErr } = await supabase
    .from('newsletter_subscribers')
    .delete()
    .eq('status', 'unsubscribed')
    .lt('unsubscribed_at', cutoffIso)
    .select('id')
  if (unsubErr) {
    console.error('[newsletter-cleanup] failed to delete unsubscribed:', unsubErr.message)
    return NextResponse.json({ error: unsubErr.message }, { status: 500 })
  }
  unsubscribedDeleted = unsubscribed?.length ?? 0

  return NextResponse.json({
    ok: true,
    cutoff: cutoffIso,
    unconfirmedDeleted,
    unsubscribedDeleted,
  })
}
