-- Transactional-outbox pattern for Stripe webhook deduplication.
--
-- Background: stripe_events.event_id has a UNIQUE index used for at-least-once
-- replay deduplication. Previously we INSERTed the event row BEFORE running any
-- side-effects (members.update, payments.insert, Resend mails, …). If those
-- side-effects then crashed, Stripe retried — but the dedup-insert returned
-- 23505 (unique_violation) and we skipped processing. Result: classic lost-
-- update, side-effects never ran.
--
-- New flow:
--   1. INSERT row with processed_at = NULL (claim the event).
--   2. Run side-effects.
--   3. UPDATE processed_at = NOW() once everything succeeded.
--   On retry: 23505 + processed_at IS NULL  → continue processing (recovery).
--             23505 + processed_at IS NOT NULL → real duplicate, skip.

ALTER TABLE stripe_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

-- Partial index for the recovery scanner / observability dashboards: lets us
-- quickly find events that were claimed but never finished processing
-- (typically because of a crash mid-handler).
CREATE INDEX IF NOT EXISTS idx_stripe_events_unprocessed
  ON stripe_events (created_at)
  WHERE processed_at IS NULL;
