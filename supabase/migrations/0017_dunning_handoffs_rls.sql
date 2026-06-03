-- 0017_dunning_handoffs_rls.sql
--
-- Reconciliation: dunning_handoffs RLS was applied directly on the live DB
-- (out-of-repo) and is NOT represented in any migration. Verified live on
-- 2026-06-02 via Supabase MCP:
--   relrowsecurity = true
--   policy dunning_handoffs_tenant_rw:
--     gym_id IN (SELECT gyms.id FROM gyms WHERE gyms.owner_id = auth.uid())
--
-- This migration commits that state so supabase/migrations/ reflects reality and
-- a fresh rebuild protects the table. Idempotent (safe to re-run).
--
-- NOTE: the dunning_handoffs TABLE itself is still defined out-of-repo. A full
-- `supabase db pull` (needs CLI login + DB password) remains the proper way to
-- baseline the complete schema — tracked as a follow-up. We guard with
-- IF EXISTS so this is a no-op on environments where the table isn't present yet.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dunning_handoffs'
  ) THEN
    EXECUTE 'ALTER TABLE public.dunning_handoffs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.dunning_handoffs FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS dunning_handoffs_tenant_rw ON public.dunning_handoffs';
    EXECUTE $pol$
      CREATE POLICY dunning_handoffs_tenant_rw ON public.dunning_handoffs
        FOR ALL
        USING (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = (SELECT auth.uid())))
        WITH CHECK (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = (SELECT auth.uid())))
    $pol$;
  END IF;
END $$;
