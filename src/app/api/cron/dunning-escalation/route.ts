import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cronGuard } from '@/lib/cron-guard'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/cron/dunning-escalation
 *
 * Auto-Eskaliert Mahnstufen nach Frist-Ablauf:
 *  - Level 1, last_action älter 14 Tage → Level 2 (second_reminder)
 *  - Level 2, started_at  älter 28 Tage → Level 3 (final_warning)
 *  - Level 3 wird NICHT auto-eskaliert (Inkasso-Übergabe ist manuell).
 *
 * Vercel-Cron: täglich 08:00 UTC (= 09:00 Berlin im Winter, 10:00 im Sommer).
 * Auth: Bearer ${CRON_SECRET} (Vercel-Standard, via cronGuard).
 *
 * Idempotenz:
 *  - DB-Level via cron_runs(job_name, executed_at) UNIQUE → 2× Aufruf am gleichen Tag = early-return.
 *  - Logik-Level: nach Update ist dunning_last_action_at = now → Filter `< day14` matcht nicht mehr.
 */
export async function GET(req: Request) {
  const guard = cronGuard(req)
  if (guard) return guard

  const todayKey = new Date().toISOString().split('T')[0]
  const supabase = createServiceClient()

  // ── DB-Level Dedup: ein Run pro Kalendertag (gegen Race-Conditions bei parallelen Cron-Triggern)
  const { error: dedupErr } = await supabase
    .from('cron_runs')
    .insert({ job_name: 'dunning_escalation', executed_at: todayKey })
  if (dedupErr) {
    if (dedupErr.code === '23505') {
      return NextResponse.json({ skipped: true, reason: 'already ran today' })
    }
    return NextResponse.json({ error: dedupErr.message }, { status: 500 })
  }

  const now = new Date()
  const day14 = new Date(now.getTime() - 14 * 86400000).toISOString()
  const day28 = new Date(now.getTime() - 28 * 86400000).toISOString()

  let escalatedToLevel2 = 0
  let escalatedToLevel3 = 0
  const errors: string[] = []

  // ── Level 1 → 2 (14 Tage seit letzter Aktion ohne Reaktion)
  // Defensiv: NULL last_action_at wird durch `.lt(...)` automatisch ausgeschlossen,
  // da NULL-Vergleiche in SQL false ergeben — kein zusätzlicher Filter nötig.
  const { data: level1Members, error: l1Err } = await supabase
    .from('members')
    .select('id, gym_id, dunning_amount_cents, dunning_last_action_at')
    .eq('dunning_level', 1)
    .lt('dunning_last_action_at', day14)
    .limit(500)

  if (l1Err) {
    errors.push(`L1 query: ${l1Err.message}`)
  }

  for (const m of (level1Members ?? []) as Array<{
    id: string
    gym_id: string
    dunning_amount_cents: number | null
    dunning_last_action_at: string
  }>) {
    try {
      const amount = m.dunning_amount_cents ?? 0
      const { error: insErr } = await supabase.from('dunning_actions').insert({
        member_id: m.id,
        gym_id: m.gym_id,
        action_type: 'second_reminder',
        amount_cents: amount,
        notes: 'Auto-Eskalation: 14 Tage seit 1. Mahnung ohne Reaktion',
        performed_by: null,
      })
      if (insErr) throw new Error(`insert dunning_action: ${insErr.message}`)

      const { error: updErr } = await supabase
        .from('members')
        .update({
          dunning_level: 2,
          dunning_last_action_at: now.toISOString(),
        })
        .eq('id', m.id)
      if (updErr) throw new Error(`update member: ${updErr.message}`)

      escalatedToLevel2++

      // Optional: Mail-Versand wenn Helper verfügbar (anderer Agent owns dunning-mail).
      // ts-ignore, weil das Modul evtl. noch nicht existiert — wenn ja, läuft import().catch() die graceful Bahn.
      try {
        const mod = await (
          // @ts-ignore — module may not exist yet, handled at runtime
          import('@/lib/dunning-mail') as Promise<{
            sendDunningMail?: (memberId: string, level: number, amount: number) => Promise<unknown>
          }>
        ).catch(() => null)
        if (mod?.sendDunningMail) {
          await mod.sendDunningMail(m.id, 2, amount).catch(err => {
            console.warn(`[cron/dunning-escalation] mail level=2 member=${m.id} failed:`, err)
          })
        }
      } catch {
        /* mail-helper nicht da, skip */
      }
    } catch (err) {
      errors.push(`L1→L2 ${m.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Level 2 → 3 (28 Tage seit Mahnungs-Beginn)
  const { data: level2Members, error: l2Err } = await supabase
    .from('members')
    .select('id, gym_id, dunning_amount_cents, dunning_started_at')
    .eq('dunning_level', 2)
    .lt('dunning_started_at', day28)
    .limit(500)

  if (l2Err) {
    errors.push(`L2 query: ${l2Err.message}`)
  }

  for (const m of (level2Members ?? []) as Array<{
    id: string
    gym_id: string
    dunning_amount_cents: number | null
    dunning_started_at: string
  }>) {
    try {
      const amount = m.dunning_amount_cents ?? 0
      const { error: insErr } = await supabase.from('dunning_actions').insert({
        member_id: m.id,
        gym_id: m.gym_id,
        action_type: 'final_warning',
        amount_cents: amount,
        notes: 'Auto-Eskalation: 28 Tage seit Mahn-Beginn — letzte Mahnung vor Inkasso',
        performed_by: null,
      })
      if (insErr) throw new Error(`insert dunning_action: ${insErr.message}`)

      const { error: updErr } = await supabase
        .from('members')
        .update({
          dunning_level: 3,
          dunning_last_action_at: now.toISOString(),
        })
        .eq('id', m.id)
      if (updErr) throw new Error(`update member: ${updErr.message}`)

      escalatedToLevel3++

      try {
        const mod = await (
          // @ts-ignore — module may not exist yet, handled at runtime
          import('@/lib/dunning-mail') as Promise<{
            sendDunningMail?: (memberId: string, level: number, amount: number) => Promise<unknown>
          }>
        ).catch(() => null)
        if (mod?.sendDunningMail) {
          await mod.sendDunningMail(m.id, 3, amount).catch(err => {
            console.warn(`[cron/dunning-escalation] mail level=3 member=${m.id} failed:`, err)
          })
        }
      } catch {
        /* skip */
      }
    } catch (err) {
      errors.push(`L2→L3 ${m.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    date: todayKey,
    escalated_to_level_2: escalatedToLevel2,
    escalated_to_level_3: escalatedToLevel3,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
  })
}
