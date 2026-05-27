-- ─────────────────────────────────────────────────────────────────────────────
-- 0014_contracts_and_pauses.sql
-- Epic 1 Sub 0014a + 0014b: member_contracts Skelett + Pause-Mechanik
-- Spec: docs/epic-1-contract-management.md
-- ─────────────────────────────────────────────────────────────────────────────
-- Source-of-Truth ab jetzt: member_contracts. Bestehende members.contract_*
-- Felder bleiben deprecated (dual-write durch Application-Layer in Phase 1).
-- Backfill am Ende generiert 1 Vertrag pro is_active=true Member.

-- ============================================================
-- 1. member_contracts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_id uuid NULL REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  initial_term_months integer NOT NULL DEFAULT 0
    CHECK (initial_term_months >= 0 AND initial_term_months <= 120),
  original_end_date date NULL,
  effective_end_date date NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','cancelled_pending','cancelled','ended')),
  is_first_term boolean NOT NULL DEFAULT true,
  monthly_fee_cents integer NULL CHECK (monthly_fee_cents IS NULL OR monthly_fee_cents >= 0),
  billing_interval text NULL,
  notice_period_days integer NOT NULL DEFAULT 30
    CHECK (notice_period_days >= 0 AND notice_period_days <= 365),
  notice_period_days_after_first_term integer NOT NULL DEFAULT 30
    CHECK (notice_period_days_after_first_term >= 0 AND notice_period_days_after_first_term <= 365),
  contract_signed_at timestamptz NULL,
  contract_template_version text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_contracts_member_active
  ON public.member_contracts(member_id)
  WHERE status IN ('active','paused','cancelled_pending');
CREATE INDEX IF NOT EXISTS idx_member_contracts_gym_end
  ON public.member_contracts(gym_id, effective_end_date);

ALTER TABLE public.member_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_contracts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_contracts_tenant_rw ON public.member_contracts;
CREATE POLICY member_contracts_tenant_rw
  ON public.member_contracts
  FOR ALL TO authenticated
  USING (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()))
  WITH CHECK (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()));

-- ============================================================
-- 2. contract_pauses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.member_contracts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  paused_from date NOT NULL,
  paused_until date NULL,
  reason text NOT NULL CHECK (reason IN ('injury','travel','financial','other')),
  reason_note text NULL,
  extends_contract boolean NOT NULL DEFAULT true,
  days_added_to_contract integer NULL CHECK (days_added_to_contract IS NULL OR days_added_to_contract >= 0),
  created_by_user_id uuid NULL,
  created_by_role text NOT NULL CHECK (created_by_role IN ('owner','member','admin')),
  closed_at timestamptz NULL,
  closed_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (paused_until IS NULL OR paused_until >= paused_from)
);

CREATE INDEX IF NOT EXISTS idx_contract_pauses_contract
  ON public.contract_pauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_pauses_open
  ON public.contract_pauses(member_id)
  WHERE paused_until IS NULL;

-- Max 1 offene Pause pro Vertrag
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_pauses_one_open_per_contract
  ON public.contract_pauses(contract_id)
  WHERE paused_until IS NULL;

ALTER TABLE public.contract_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_pauses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_pauses_tenant_rw ON public.contract_pauses;
CREATE POLICY contract_pauses_tenant_rw
  ON public.contract_pauses
  FOR ALL TO authenticated
  USING (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()))
  WITH CHECK (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()));

-- ============================================================
-- 3. updated_at-Trigger für member_contracts
-- ============================================================
CREATE OR REPLACE FUNCTION public.member_contracts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_contracts_set_updated_at ON public.member_contracts;
CREATE TRIGGER trg_member_contracts_set_updated_at
  BEFORE UPDATE ON public.member_contracts
  FOR EACH ROW EXECUTE FUNCTION public.member_contracts_set_updated_at();

-- ============================================================
-- 4. RPC start_contract_pause(p_contract_id, p_paused_from, p_reason, p_role)
-- ============================================================
-- Returns: pause-id (uuid)
-- Raises 'contract_not_found' / 'contract_not_active' / 'open_pause_exists'
CREATE OR REPLACE FUNCTION public.start_contract_pause(
  p_contract_id uuid,
  p_paused_from date,
  p_reason text,
  p_role text,
  p_reason_note text DEFAULT NULL,
  p_extends_contract boolean DEFAULT true,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract record;
  v_pause_id uuid;
BEGIN
  SELECT id, gym_id, member_id, status
    INTO v_contract
    FROM public.member_contracts
   WHERE id = p_contract_id
   LIMIT 1;

  IF v_contract.id IS NULL THEN
    RAISE EXCEPTION 'contract_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_contract.status NOT IN ('active') THEN
    RAISE EXCEPTION 'contract_not_active' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.contract_pauses (
    gym_id, contract_id, member_id, paused_from,
    reason, reason_note, extends_contract,
    created_by_user_id, created_by_role
  ) VALUES (
    v_contract.gym_id, p_contract_id, v_contract.member_id, p_paused_from,
    p_reason, p_reason_note, p_extends_contract,
    p_user_id, p_role
  )
  RETURNING id INTO v_pause_id;

  UPDATE public.member_contracts
     SET status = 'paused'
   WHERE id = p_contract_id;

  RETURN v_pause_id;
EXCEPTION
  WHEN unique_violation THEN
    -- Greift uq_contract_pauses_one_open_per_contract
    RAISE EXCEPTION 'open_pause_exists' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.start_contract_pause(uuid, date, text, text, text, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_contract_pause(uuid, date, text, text, text, boolean, uuid)
  TO service_role, authenticated;

-- ============================================================
-- 5. RPC close_contract_pause(p_pause_id, p_paused_until, p_user_id)
-- ============================================================
-- Returns: days_added_to_contract
-- Berechnet days_added, schiebt member_contracts.effective_end_date, setzt status='active' zurück
CREATE OR REPLACE FUNCTION public.close_contract_pause(
  p_pause_id uuid,
  p_paused_until date,
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pause record;
  v_days integer;
BEGIN
  SELECT id, contract_id, paused_from, paused_until, extends_contract
    INTO v_pause
    FROM public.contract_pauses
   WHERE id = p_pause_id
   LIMIT 1;

  IF v_pause.id IS NULL THEN
    RAISE EXCEPTION 'pause_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_pause.paused_until IS NOT NULL THEN
    RAISE EXCEPTION 'pause_already_closed' USING ERRCODE = 'P0001';
  END IF;
  IF p_paused_until < v_pause.paused_from THEN
    RAISE EXCEPTION 'invalid_paused_until' USING ERRCODE = '22023';
  END IF;

  v_days := p_paused_until - v_pause.paused_from;

  UPDATE public.contract_pauses
     SET paused_until = p_paused_until,
         days_added_to_contract = CASE WHEN v_pause.extends_contract THEN v_days ELSE 0 END,
         closed_at = now(),
         closed_by_user_id = p_user_id
   WHERE id = p_pause_id;

  IF v_pause.extends_contract THEN
    UPDATE public.member_contracts
       SET effective_end_date = CASE
             WHEN effective_end_date IS NULL THEN NULL  -- unbefristet bleibt unbefristet
             ELSE effective_end_date + v_days
           END,
           status = 'active'
     WHERE id = v_pause.contract_id;
  ELSE
    -- Kulanz-Pause ohne Verlängerung: nur Status zurück auf active
    UPDATE public.member_contracts
       SET status = 'active'
     WHERE id = v_pause.contract_id;
  END IF;

  RETURN v_days;
END;
$$;

REVOKE ALL ON FUNCTION public.close_contract_pause(uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_contract_pause(uuid, date, uuid)
  TO service_role, authenticated;

-- ============================================================
-- 6. Backfill: 1 Vertrag pro is_active=true Member, falls noch keiner existiert
-- ============================================================
INSERT INTO public.member_contracts (
  gym_id, member_id, plan_id, start_date,
  initial_term_months, original_end_date, effective_end_date,
  status, is_first_term,
  monthly_fee_cents, billing_interval,
  notice_period_days, notice_period_days_after_first_term,
  contract_signed_at, notes
)
SELECT
  m.gym_id,
  m.id,
  m.plan_id,
  COALESCE(m.join_date, CURRENT_DATE),
  CASE
    WHEN m.contract_end_date IS NULL THEN 0
    ELSE GREATEST(0,
      EXTRACT(YEAR FROM age(m.contract_end_date, COALESCE(m.join_date, m.contract_end_date)))::int * 12
      + EXTRACT(MONTH FROM age(m.contract_end_date, COALESCE(m.join_date, m.contract_end_date)))::int
    )
  END,
  m.contract_end_date,
  m.contract_end_date,
  CASE
    WHEN m.cancellation_requested_at IS NOT NULL THEN 'cancelled_pending'
    WHEN m.contract_end_date IS NOT NULL AND m.contract_end_date < CURRENT_DATE THEN 'ended'
    ELSE 'active'
  END,
  true,
  COALESCE(m.monthly_fee_override_cents, mp.price_cents),
  mp.billing_interval,
  30,
  30,
  m.contract_signed_at,
  CASE
    WHEN m.cancellation_note IS NOT NULL THEN 'Backfill 2026-05-25: Kündigungs-Notiz: ' || m.cancellation_note
    ELSE NULL
  END
FROM public.members m
LEFT JOIN public.membership_plans mp ON mp.id = m.plan_id
WHERE m.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.member_contracts mc
     WHERE mc.member_id = m.id AND mc.status IN ('active','paused','cancelled_pending')
  );
