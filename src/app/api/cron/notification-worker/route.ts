import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendWhatsApp } from '@/lib/whatsapp'
import { cronGuard } from '@/lib/cron-guard'

/**
 * Notification-Worker.
 *
 * Pollt pending Tasks aus `notification_queue` und versendet sie. Läuft
 * alle 5 Minuten (siehe vercel.json) und arbeitet pro Aufruf bis zu
 * BATCH_SIZE Tasks ab. Mehrere parallele Worker-Instanzen sind sicher,
 * weil das Claim-UPDATE atomar ist (filtered auf status='pending') und
 * nur den Task an einen einzigen Worker übergibt.
 *
 * Locking-Strategie: optimistic locking via UPDATE … RETURNING. Postgres
 * hätte FOR UPDATE SKIP LOCKED, das ist mit PostgREST aber nicht direkt
 * abbildbar — der UPDATE-Filter status='pending' liefert nur die Rows
 * die noch frei sind, was funktional gleichwertig ist. Concurrent-Worker
 * können also gleichzeitig laufen, ohne sich Tasks doppelt zu schnappen.
 *
 * Retry: bei Fehler wird attempts++ gesetzt. Wenn attempts < max_attempts,
 * wandert die Row zurück auf 'pending' (mit kleinem Delay, damit transient
 * errors Zeit zum Erholen haben). Sonst → 'failed' (manuelle Triage).
 */

const BATCH_SIZE = 50
const RETRY_DELAY_MINUTES = 5

interface EmailPayload {
  to: string
  subject: string
  html: string
  list_unsubscribe?: string
  gym_id?: string
}

interface WhatsappPayload {
  to: string
  body: string
  gym_id?: string
}

async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return { ok: false, error: 'Resend not configured' }
  }
  try {
    const fromDomain = process.env.RESEND_FROM_EMAIL.split('@')[1] ?? 'osss.pro'
    const headers: Record<string, string> = {
      'List-Unsubscribe': payload.list_unsubscribe ?? `<mailto:unsubscribe@${fromDomain}>`,
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        headers,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 500)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function GET(req: Request) {
  const guard = cronGuard(req)
  if (guard) return guard

  const supabase = createServiceClient()
  // Worker-ID für Observability (welcher invocation hat was bearbeitet?).
  const workerId = `worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // 1) Claim-Phase: schreibe BATCH_SIZE Rows mit status='pending' auf
  //    'processing' und hol sie zurück. Filter scheduled_for <= NOW
  //    sorgt dafür, dass Retries mit delay korrekt warten.
  //
  //    Hinweis zur Race-Condition: PostgREST kennt kein FOR UPDATE SKIP
  //    LOCKED, daher nutzen wir UPDATE-WHERE als atomaren Claim. Wenn
  //    zwei Worker gleichzeitig dieselben Rows treffen, schreibt der
  //    erste status='processing' und der zweite findet sie nicht mehr
  //    (WHERE status='pending' filtered sie raus). Das ist der gleiche
  //    Effekt wie SKIP LOCKED, nur via DB-Constraint statt Lock.
  const nowIso = new Date().toISOString()

  // Schritt 1a: IDs der nächsten Pending-Tasks holen.
  const { data: candidates, error: selErr } = await supabase
    .from('notification_queue')
    .select('id')
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_SIZE)

  if (selErr) {
    console.error('[cron/notification-worker] select pending failed', selErr.message)
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, claimed: 0, sent: 0, failed: 0, retried: 0 })
  }

  const candidateIds = candidates.map(c => c.id)

  // Schritt 1b: Claim per UPDATE. WHERE status='pending' macht es atomar
  // — andere Worker, die dieselben IDs greifen, bekommen 0 Rows zurück.
  const { data: claimed, error: claimErr } = await supabase
    .from('notification_queue')
    .update({
      status: 'processing',
      locked_at: nowIso,
      locked_by: workerId,
    })
    .in('id', candidateIds)
    .eq('status', 'pending')
    .select('id, kind, channel, payload, attempts, max_attempts')

  if (claimErr) {
    console.error('[cron/notification-worker] claim failed', claimErr.message)
    return NextResponse.json({ error: claimErr.message }, { status: 500 })
  }

  const tasks = claimed ?? []
  if (tasks.length === 0) {
    return NextResponse.json({ ok: true, claimed: 0, sent: 0, failed: 0, retried: 0 })
  }

  // 2) Process-Phase: Tasks parallel abarbeiten. 10 concurrent ist
  //    konservativ, schützt Resend-Rate-Limit (10 req/s default).
  let sent = 0
  let failed = 0
  let retried = 0
  const errors: string[] = []

  const PARALLEL = 10
  for (let i = 0; i < tasks.length; i += PARALLEL) {
    const slice = tasks.slice(i, i + PARALLEL)
    await Promise.all(slice.map(async task => {
      const payload = task.payload as Record<string, unknown>
      let result: { ok: boolean; error?: string }

      try {
        if (task.channel === 'whatsapp') {
          const wpl = payload as unknown as WhatsappPayload
          const ok = await sendWhatsApp({ to: wpl.to, body: wpl.body })
          result = ok ? { ok: true } : { ok: false, error: 'sendWhatsApp returned false' }
        } else {
          // default: email
          const epl = payload as unknown as EmailPayload
          result = await sendEmail(epl)
        }
      } catch (err) {
        result = { ok: false, error: String(err) }
      }

      if (result.ok) {
        const { error: upErr } = await supabase
          .from('notification_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', task.id)
        if (upErr) {
          // Versand war erfolgreich, aber DB-Update ist gescheitert.
          // Beim nächsten Worker-Lauf wird die Row ohne Filter wieder
          // gefunden, weil sie noch 'processing' ist — Stuck-Recovery
          // (siehe sonstige Recovery-Job-Vorlage unten) muss greifen.
          console.error('[cron/notification-worker] mark-sent failed', task.id, upErr.message)
          errors.push(`mark-sent ${task.id}: ${upErr.message}`)
        }
        sent++
        return
      }

      // Fehler-Pfad: Retry-Logik
      const newAttempts = task.attempts + 1
      const isFinalFailure = newAttempts >= task.max_attempts
      const nextScheduled = new Date(Date.now() + RETRY_DELAY_MINUTES * 60_000).toISOString()

      const { error: upErr } = await supabase
        .from('notification_queue')
        .update({
          status: isFinalFailure ? 'failed' : 'pending',
          attempts: newAttempts,
          last_error: result.error?.slice(0, 1000) ?? 'unknown',
          locked_at: null,
          locked_by: null,
          scheduled_for: isFinalFailure ? undefined : nextScheduled,
        })
        .eq('id', task.id)

      if (upErr) {
        console.error('[cron/notification-worker] mark-failed update failed', task.id, upErr.message)
        errors.push(`mark-failed ${task.id}: ${upErr.message}`)
      }

      if (isFinalFailure) {
        failed++
        console.error(
          '[cron/notification-worker] task FAILED after',
          newAttempts,
          'attempts:',
          task.id,
          result.error
        )
      } else {
        retried++
      }
    }))
  }

  return NextResponse.json({
    ok: errors.length === 0,
    workerId,
    claimed: tasks.length,
    sent,
    failed,
    retried,
    errorCount: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
