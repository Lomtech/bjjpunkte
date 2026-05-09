-- 0003_notification_queue.sql
--
-- Worker-Queue für asynchrone Benachrichtigungen (E-Mail / WhatsApp).
--
-- Hintergrund: Cron-Endpoints wie /api/cron/payment-reminders sind aktuell
-- Producer + Consumer in einem Schritt — sie iterieren O(Gyms × Members) und
-- senden Resend-Mails inline. Bei 500 Studios × 50 aktive Members × ~200ms
-- Resend-Latenz reißt der Lauf den Vercel-300s-maxDuration-Timeout. Dazu
-- kommt ein Hard-Cap (.limit(1000) in der gyms-Query), der bei mehr Studios
-- still Daten abschneidet.
--
-- Lösung: Producer/Consumer-Trennung. Der Cron-Job wird zum reinen
-- Producer und schreibt Tasks in `notification_queue` (1 INSERT pro
-- Empfänger — sehr schnell, vollständig in 300s machbar). Ein separater
-- Worker-Endpoint (/api/cron/notification-worker) läuft alle 5 Minuten,
-- pollt jeweils 50 pending Tasks per FOR UPDATE SKIP LOCKED, sendet sie
-- ab und markiert sie als 'sent' / 'failed' / re-queued.
--
-- Status-Maschine:
--   pending   → vom Worker per FOR UPDATE SKIP LOCKED geclaimt → processing
--   processing → nach erfolgreichem Versand → sent
--   processing → nach Fehler & attempts < max → pending (Retry)
--   processing → nach Fehler & attempts >= max → failed
--
-- Der Index ist partial (WHERE status='pending') damit der Worker-Poll
-- sauber skaliert: bei Millionen historischer 'sent'-Rows bleibt das
-- pending-Set klein und der Index winzig.

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'payment_reminder' | 'birthday' | 'dunning' | …
  kind TEXT NOT NULL,
  -- Channel: 'email' | 'whatsapp'. Worker dispatched darauf basierend.
  channel TEXT NOT NULL DEFAULT 'email',
  -- Payload enthält alles, was der Worker zum Versand braucht (schon vor-
  -- gerendert): { gym_id, member_id, to, subject, html, list_unsubscribe, … }
  payload JSONB NOT NULL,
  -- 'pending' | 'processing' | 'sent' | 'failed'
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  -- locked_at / locked_by sind redundant zu FOR UPDATE SKIP LOCKED, aber
  -- helfen bei Observability ("welcher Worker hängt seit wann?") und
  -- erlauben Recovery falls ein Worker mid-process crasht (Cron-Timeout).
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index — nur pending Rows. Hauptarbeitspfad des Workers.
CREATE INDEX IF NOT EXISTS idx_notification_queue_pending
  ON notification_queue (scheduled_for)
  WHERE status = 'pending';

-- Stuck-detection: Rows die seit >10min processing sind = Worker-Crash.
-- Recovery-Job kann sie zurück auf pending setzen.
CREATE INDEX IF NOT EXISTS idx_notification_queue_processing
  ON notification_queue (locked_at)
  WHERE status = 'processing';

-- Beobachtung / Debugging: alle Tasks pro Gym über Zeit.
CREATE INDEX IF NOT EXISTS idx_notification_queue_gym
  ON notification_queue ((payload->>'gym_id'), created_at DESC);
