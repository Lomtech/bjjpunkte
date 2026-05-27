-- ─────────────────────────────────────────────────────────────────────────────
-- 0013_punch_card_membership.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 10er-Karte (Punch-Card) als alternative Membership-Variante zu Subscription.
-- Bei GPS-Checkin wird atomar eine Einheit über consume_punch_unit() abgezogen.
-- Aufladen erfolgt initial manuell durch Gym-Admin (Stripe-Link kommt später).

-- ============================================================
-- 1. membership_plans: kind + punch_units
-- ============================================================
ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS punch_units integer NULL;

ALTER TABLE public.membership_plans
  DROP CONSTRAINT IF EXISTS membership_plans_kind_check;
ALTER TABLE public.membership_plans
  ADD CONSTRAINT membership_plans_kind_check
  CHECK (kind IN ('subscription', 'punch_card'));

ALTER TABLE public.membership_plans
  DROP CONSTRAINT IF EXISTS membership_plans_punch_units_positive;
ALTER TABLE public.membership_plans
  ADD CONSTRAINT membership_plans_punch_units_positive
  CHECK (punch_units IS NULL OR punch_units > 0);

ALTER TABLE public.membership_plans
  DROP CONSTRAINT IF EXISTS membership_plans_punch_card_units_required;
ALTER TABLE public.membership_plans
  ADD CONSTRAINT membership_plans_punch_card_units_required
  CHECK (
    (kind = 'subscription' AND punch_units IS NULL)
    OR (kind = 'punch_card' AND punch_units IS NOT NULL)
  );

-- ============================================================
-- 2. members: punch_units_remaining + total + purchased_at
-- ============================================================
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS punch_units_remaining integer NULL,
  ADD COLUMN IF NOT EXISTS punch_units_total integer NULL,
  ADD COLUMN IF NOT EXISTS punch_card_purchased_at timestamptz NULL;

ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_punch_units_remaining_nonneg;
ALTER TABLE public.members
  ADD CONSTRAINT members_punch_units_remaining_nonneg
  CHECK (punch_units_remaining IS NULL OR punch_units_remaining >= 0);

ALTER TABLE public.members
  DROP CONSTRAINT IF EXISTS members_punch_units_total_positive;
ALTER TABLE public.members
  ADD CONSTRAINT members_punch_units_total_positive
  CHECK (punch_units_total IS NULL OR punch_units_total > 0);

-- ============================================================
-- 3. punch_card_purchases (Audit-Trail jede Aufladung)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.punch_card_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_id uuid NULL REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  units_purchased integer NOT NULL CHECK (units_purchased > 0),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  stripe_payment_intent_id text NULL,
  note text NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punch_card_purchases_member_paid
  ON public.punch_card_purchases (member_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_punch_card_purchases_gym_paid
  ON public.punch_card_purchases (gym_id, paid_at DESC);

-- RLS analog zu anderen Tenant-Tabellen
ALTER TABLE public.punch_card_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS punch_card_purchases_owner_all ON public.punch_card_purchases;
CREATE POLICY punch_card_purchases_owner_all
  ON public.punch_card_purchases
  FOR ALL TO authenticated
  USING (gym_id IN (SELECT gyms.id FROM public.gyms WHERE gyms.owner_id = auth.uid()))
  WITH CHECK (gym_id IN (SELECT gyms.id FROM public.gyms WHERE gyms.owner_id = auth.uid()));

-- ============================================================
-- 4. consume_punch_unit RPC (atomar, SECURITY DEFINER)
-- ============================================================
-- Returns:
--   integer >= 0  : neue Restanzahl nach Decrement
--   NULL          : Member existiert nicht ODER ist Subscription-Member (kein Decrement nötig)
--   RAISE 'insufficient_punch_units' wenn Punch-Card-Member aber 0 Einheiten
CREATE OR REPLACE FUNCTION public.consume_punch_unit(
  p_member_id uuid,
  p_gym_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_remaining integer;
  v_current integer;
BEGIN
  UPDATE public.members
     SET punch_units_remaining = punch_units_remaining - 1
   WHERE id = p_member_id
     AND gym_id = p_gym_id
     AND punch_units_remaining IS NOT NULL
     AND punch_units_remaining > 0
  RETURNING punch_units_remaining INTO v_new_remaining;

  IF v_new_remaining IS NOT NULL THEN
    RETURN v_new_remaining;
  END IF;

  -- Update lief nicht durch — entscheiden ob 0 Einheiten (Fehler) oder Subscription-Member (NULL ok)
  SELECT punch_units_remaining INTO v_current
    FROM public.members
   WHERE id = p_member_id AND gym_id = p_gym_id;

  IF v_current IS NOT NULL AND v_current <= 0 THEN
    RAISE EXCEPTION 'insufficient_punch_units' USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_punch_unit(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_punch_unit(uuid, uuid) TO service_role, authenticated;
