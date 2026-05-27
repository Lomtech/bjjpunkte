-- ─────────────────────────────────────────────────────────────────────────────
-- 0016_plan_price_changes.sql
-- Epic 1 Sub 0014e: Beitragserhöhungs-Workflow.
-- Owner meldet Erhöhung an mit Wirksamkeits-Datum + Widerspruchsfrist.
-- Cron /api/cron/apply-price-changes apply Stripe-Subscription-Updates am Stichtag.
-- Spec: docs/epic-1-contract-management.md
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_price_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE CASCADE,
  old_price_cents integer NOT NULL CHECK (old_price_cents >= 0),
  new_price_cents integer NOT NULL CHECK (new_price_cents > 0),
  pct_change numeric(6,2) GENERATED ALWAYS AS (
    CASE
      WHEN old_price_cents = 0 THEN NULL
      ELSE ((new_price_cents - old_price_cents) * 100.0 / old_price_cents)
    END
  ) STORED,
  -- Wann
  announced_at timestamptz NOT NULL DEFAULT now(),
  effective_date date NOT NULL,
  -- Widerspruch-Frist (BGB-konform — Member muss ggf. Sonderkündigung anstoßen können)
  objection_deadline date NOT NULL,
  -- Communication
  notification_sent_at timestamptz NULL,
  notification_count integer NOT NULL DEFAULT 0,
  -- Apply-Status
  applied_at timestamptz NULL,
  stripe_price_id_new text NULL,
  apply_error text NULL,
  apply_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_date >= objection_deadline)
);

CREATE INDEX IF NOT EXISTS idx_plan_price_changes_plan
  ON public.plan_price_changes(plan_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_plan_price_changes_pending
  ON public.plan_price_changes(gym_id)
  WHERE applied_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_plan_price_changes_due_today
  ON public.plan_price_changes(effective_date)
  WHERE applied_at IS NULL;

ALTER TABLE public.plan_price_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_price_changes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_price_changes_tenant_rw ON public.plan_price_changes;
CREATE POLICY plan_price_changes_tenant_rw
  ON public.plan_price_changes
  FOR ALL TO authenticated
  USING (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()))
  WITH CHECK (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()));

-- Auf membership_plans: auto_renew Flag (für Sub 0014d auto-extend-contracts)
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT true;
