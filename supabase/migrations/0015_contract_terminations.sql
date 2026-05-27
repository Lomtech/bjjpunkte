-- ─────────────────────────────────────────────────────────────────────────────
-- 0015_contract_terminations.sql
-- Epic 1 Sub 0014c: Beidseitige Kündigung mit Workflow (requested → accepted/rejected/withdrawn).
-- Sonderkündigung von Owner und Member; Begründungs-Pflicht; Email-Hook später.
-- Spec: docs/epic-1-contract-management.md
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================
-- 1. contract_terminations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_terminations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.member_contracts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  -- Wer kündigt
  requested_by_role text NOT NULL
    CHECK (requested_by_role IN ('member','owner')),
  requested_by_user_id uuid NULL,
  -- Art der Kündigung
  termination_kind text NOT NULL
    CHECK (termination_kind IN ('regular','special_right')),
  reason_category text NULL
    CHECK (reason_category IN ('moved','injury','financial','dissatisfaction','medical','contract_breach','other')),
  reason_text text NOT NULL CHECK (length(trim(reason_text)) >= 3),
  effective_date date NOT NULL,
  -- Workflow
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','accepted','rejected','withdrawn')),
  accepted_by_user_id uuid NULL,
  accepted_at timestamptz NULL,
  rejected_reason text NULL,
  -- Kommunikation
  communicated_at timestamptz NULL,
  communication_method text NULL CHECK (communication_method IN ('email','portal','manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_terminations_contract
  ON public.contract_terminations(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_terminations_pending
  ON public.contract_terminations(gym_id)
  WHERE status = 'requested';

-- Max 1 pending-Termination pro Vertrag
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_terminations_one_pending
  ON public.contract_terminations(contract_id)
  WHERE status = 'requested';

ALTER TABLE public.contract_terminations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_terminations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_terminations_tenant_rw ON public.contract_terminations;
CREATE POLICY contract_terminations_tenant_rw
  ON public.contract_terminations
  FOR ALL TO authenticated
  USING (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()))
  WITH CHECK (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()));

-- ============================================================
-- 2. RPC request_contract_termination
-- ============================================================
-- Wird von Owner-API + Portal-Service-Role-API aufgerufen.
-- Validiert + insert. Setzt contract.status='cancelled_pending'.
CREATE OR REPLACE FUNCTION public.request_contract_termination(
  p_contract_id uuid,
  p_requested_by_role text,
  p_termination_kind text,
  p_reason_text text,
  p_effective_date date,
  p_reason_category text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract record;
  v_termination_id uuid;
BEGIN
  SELECT id, gym_id, member_id, status
    INTO v_contract
    FROM public.member_contracts
   WHERE id = p_contract_id
   LIMIT 1;

  IF v_contract.id IS NULL THEN
    RAISE EXCEPTION 'contract_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_contract.status NOT IN ('active','paused') THEN
    RAISE EXCEPTION 'contract_not_terminable' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.contract_terminations (
      gym_id, contract_id, member_id,
      requested_by_role, requested_by_user_id,
      termination_kind, reason_category, reason_text,
      effective_date, status
    ) VALUES (
      v_contract.gym_id, p_contract_id, v_contract.member_id,
      p_requested_by_role, p_user_id,
      p_termination_kind, p_reason_category, p_reason_text,
      p_effective_date, 'requested'
    )
    RETURNING id INTO v_termination_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'termination_already_pending' USING ERRCODE = '23505';
  END;

  UPDATE public.member_contracts
     SET status = 'cancelled_pending'
   WHERE id = p_contract_id;

  RETURN v_termination_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_contract_termination(uuid, text, text, text, date, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_contract_termination(uuid, text, text, text, date, text, uuid)
  TO service_role, authenticated;

-- ============================================================
-- 3. RPC accept_contract_termination
-- ============================================================
-- Setzt contract.status='cancelled' + effective_end_date.
-- Wenn termination.effective_date später als effective_end_date: nimm das spätere (Stichtag respektieren).
CREATE OR REPLACE FUNCTION public.accept_contract_termination(
  p_termination_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_communication_method text DEFAULT 'portal'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_term record;
BEGIN
  SELECT id, contract_id, effective_date, status
    INTO v_term
    FROM public.contract_terminations
   WHERE id = p_termination_id
   LIMIT 1;

  IF v_term.id IS NULL THEN
    RAISE EXCEPTION 'termination_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_term.status != 'requested' THEN
    RAISE EXCEPTION 'termination_not_pending' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.contract_terminations
     SET status = 'accepted',
         accepted_by_user_id = p_user_id,
         accepted_at = now(),
         communicated_at = now(),
         communication_method = p_communication_method
   WHERE id = p_termination_id;

  UPDATE public.member_contracts
     SET status = 'cancelled',
         effective_end_date = CASE
           WHEN effective_end_date IS NULL THEN v_term.effective_date
           WHEN v_term.effective_date > effective_end_date THEN v_term.effective_date
           ELSE effective_end_date
         END
   WHERE id = v_term.contract_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_contract_termination(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_contract_termination(uuid, uuid, text)
  TO service_role, authenticated;

-- ============================================================
-- 4. RPC reject_contract_termination
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_contract_termination(
  p_termination_id uuid,
  p_rejected_reason text,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_term record;
BEGIN
  SELECT id, contract_id, status
    INTO v_term
    FROM public.contract_terminations
   WHERE id = p_termination_id
   LIMIT 1;

  IF v_term.id IS NULL THEN
    RAISE EXCEPTION 'termination_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_term.status != 'requested' THEN
    RAISE EXCEPTION 'termination_not_pending' USING ERRCODE = 'P0001';
  END IF;
  IF p_rejected_reason IS NULL OR length(trim(p_rejected_reason)) < 3 THEN
    RAISE EXCEPTION 'rejected_reason_required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.contract_terminations
     SET status = 'rejected',
         rejected_reason = p_rejected_reason,
         accepted_by_user_id = p_user_id,
         accepted_at = now()
   WHERE id = p_termination_id;

  -- Contract zurück auf den Status den er vor der pending-Kündigung hatte.
  -- Vereinfacht: zurück auf 'active' (Pause-Status kommt nicht zurück; falls
  -- offene Pause existiert, Owner muss separat reagieren).
  UPDATE public.member_contracts
     SET status = 'active'
   WHERE id = v_term.contract_id
     AND status = 'cancelled_pending';
END;
$$;

REVOKE ALL ON FUNCTION public.reject_contract_termination(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_contract_termination(uuid, text, uuid)
  TO service_role, authenticated;

-- ============================================================
-- 5. RPC withdraw_contract_termination
-- ============================================================
-- Vom Antragsteller selbst zurückgezogen, solange noch pending.
CREATE OR REPLACE FUNCTION public.withdraw_contract_termination(
  p_termination_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_term record;
BEGIN
  SELECT id, contract_id, status, requested_by_role, requested_by_user_id
    INTO v_term
    FROM public.contract_terminations
   WHERE id = p_termination_id
   LIMIT 1;

  IF v_term.id IS NULL THEN
    RAISE EXCEPTION 'termination_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_term.status != 'requested' THEN
    RAISE EXCEPTION 'termination_not_pending' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.contract_terminations
     SET status = 'withdrawn',
         accepted_at = now(),
         accepted_by_user_id = p_user_id
   WHERE id = p_termination_id;

  UPDATE public.member_contracts
     SET status = 'active'
   WHERE id = v_term.contract_id
     AND status = 'cancelled_pending';
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_contract_termination(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_contract_termination(uuid, uuid)
  TO service_role, authenticated;

-- ============================================================
-- 6. Backfill: bestehende members.cancellation_requested_at → contract_terminations
-- ============================================================
INSERT INTO public.contract_terminations (
  gym_id, contract_id, member_id,
  requested_by_role, termination_kind, reason_category, reason_text,
  effective_date, status, created_at
)
SELECT
  mc.gym_id, mc.id, mc.member_id,
  'member',
  'regular',
  'other',
  COALESCE(NULLIF(trim(m.cancellation_note), ''), 'Backfill 2026-05-25: Bestehende Kuendigungs-Anfrage migriert'),
  COALESCE(mc.effective_end_date, mc.original_end_date, CURRENT_DATE + INTERVAL '30 days'),
  'requested',
  m.cancellation_requested_at
FROM public.members m
JOIN public.member_contracts mc ON mc.member_id = m.id
WHERE m.cancellation_requested_at IS NOT NULL
  AND mc.status = 'cancelled_pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.contract_terminations ct
     WHERE ct.contract_id = mc.id AND ct.status = 'requested'
  );
