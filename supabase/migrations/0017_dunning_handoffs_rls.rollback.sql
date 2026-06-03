-- Rollback for 0017_dunning_handoffs_rls.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dunning_handoffs'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS dunning_handoffs_tenant_rw ON public.dunning_handoffs';
    EXECUTE 'ALTER TABLE public.dunning_handoffs NO FORCE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.dunning_handoffs DISABLE ROW LEVEL SECURITY';
  END IF;
END $$;
