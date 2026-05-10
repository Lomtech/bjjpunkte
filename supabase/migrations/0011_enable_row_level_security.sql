-- ─────────────────────────────────────────────────────────────────────────────
-- 0011_enable_row_level_security.sql
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Audit 2026-05-11: RLS-Migration für alle Multi-Tenant-Tabellen.
--
-- Vorher: RLS war auf KEINER Tabelle aktiv. Tenant-Isolation lag rein im
-- Application-Layer (App filtert `.eq('gym_id', ...)`). Risiko: Browser-Bundle
-- enthält NEXT_PUBLIC_SUPABASE_ANON_KEY — jeder Besucher konnte per direktem
-- PostgREST-Call jede Tabelle quer-lesen/schreiben.
--
-- Nachher: alle Multi-Tenant-Tabellen haben RLS aktiviert. Policies setzen den
-- gym_id-Filter durch (`gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid())`
-- für Owner-Routen, plus `gym_staff`-Lookups für künftige Trainer-Rolle).
-- Service-Role-Routen werden NICHT betroffen — die hat per Default `bypassrls`.
--
-- VOR APPLY:
--   1. `npm run schema:dump` (siehe scripts/dump-schema.ts) — Snapshot live nehmen.
--   2. Frontend-Anon-Key-Pfade prüfen (dashboard/members/PromoteButton etc.) ob
--      sie nach Aktivierung noch funktionieren. Wenn nicht: Routen auf Service-
--      Role-API umstellen.
--   3. Migration auf Staging-Branch via `supabase db push --linked` testen,
--      dann auf main.
--
-- ROLLBACK: siehe 0011_enable_row_level_security.rollback.sql (separat).
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: liefert alle gym_ids des aktuellen Users (Owner ODER Staff).
-- SECURITY DEFINER damit die Lookup-Tabelle nicht ihrerseits RLS-rekursiv ist.
CREATE OR REPLACE FUNCTION public.current_user_gym_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.gyms WHERE owner_id = auth.uid()
  UNION
  SELECT gym_id FROM public.gym_staff WHERE user_id = auth.uid() AND is_active = TRUE
$$;

REVOKE ALL ON FUNCTION public.current_user_gym_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_gym_ids() TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabellen, die RLS bekommen sollen
-- ─────────────────────────────────────────────────────────────────────────────
-- Pro Tabelle:
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE ... FORCE ROW LEVEL SECURITY;  (auch für Owner einschalten,
--     sonst greifen Policies nicht wenn Tabellen-Owner per Connection-Pool joinen)
--   CREATE POLICY ... FOR ALL TO authenticated USING (...) WITH CHECK (...);
--
-- Service-Role hat `bypassrls = TRUE` von Supabase Default — keine Policies nötig.

-- ────── gyms ────────────────────────────────────────────────────────────────
ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gyms FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gyms_owner_select ON public.gyms;
DROP POLICY IF EXISTS gyms_owner_modify ON public.gyms;
CREATE POLICY gyms_owner_select ON public.gyms FOR SELECT TO authenticated
  USING (id IN (SELECT public.current_user_gym_ids()));
CREATE POLICY gyms_owner_modify ON public.gyms FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());
-- INSERT/DELETE auf gyms läuft über Service-Role (Signup/Delete-Account-RPCs).

-- ────── members ─────────────────────────────────────────────────────────────
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_tenant_rw ON public.members;
CREATE POLICY members_tenant_rw ON public.members FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── attendance ──────────────────────────────────────────────────────────
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_tenant_rw ON public.attendance;
CREATE POLICY attendance_tenant_rw ON public.attendance FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── payments ────────────────────────────────────────────────────────────
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_tenant_select ON public.payments;
DROP POLICY IF EXISTS payments_tenant_modify ON public.payments;
CREATE POLICY payments_tenant_select ON public.payments FOR SELECT TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()));
-- payments-Mutations laufen aktuell durchweg über Service-Role (Webhook,
-- bulk-checkout, manual-mark-paid via API-Route). Keine direkte Owner-Write-Policy.

-- ────── classes ─────────────────────────────────────────────────────────────
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS classes_tenant_rw ON public.classes;
CREATE POLICY classes_tenant_rw ON public.classes FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── class_bookings ──────────────────────────────────────────────────────
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_bookings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS class_bookings_tenant_rw ON public.class_bookings;
CREATE POLICY class_bookings_tenant_rw ON public.class_bookings FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── membership_plans ────────────────────────────────────────────────────
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_tenant_rw ON public.membership_plans;
CREATE POLICY plans_tenant_rw ON public.membership_plans FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── belt_promotions ─────────────────────────────────────────────────────
ALTER TABLE public.belt_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.belt_promotions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS belt_promotions_tenant_rw ON public.belt_promotions;
CREATE POLICY belt_promotions_tenant_rw ON public.belt_promotions FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── training_logs ───────────────────────────────────────────────────────
ALTER TABLE public.training_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS training_logs_tenant_rw ON public.training_logs;
CREATE POLICY training_logs_tenant_rw ON public.training_logs FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── leads ───────────────────────────────────────────────────────────────
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leads_tenant_rw ON public.leads;
CREATE POLICY leads_tenant_rw ON public.leads FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── lead_bookings ───────────────────────────────────────────────────────
ALTER TABLE public.lead_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_bookings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_bookings_tenant_rw ON public.lead_bookings;
CREATE POLICY lead_bookings_tenant_rw ON public.lead_bookings FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── dunning_actions ─────────────────────────────────────────────────────
ALTER TABLE public.dunning_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dunning_actions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dunning_actions_tenant_select ON public.dunning_actions;
CREATE POLICY dunning_actions_tenant_select ON public.dunning_actions FOR SELECT TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()));
-- Inserts laufen durch Service-Role (Cron + Webhook + Manual-Action-API).

-- ────── posts ───────────────────────────────────────────────────────────────
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS posts_tenant_rw ON public.posts;
DROP POLICY IF EXISTS posts_anon_published ON public.posts;
CREATE POLICY posts_tenant_rw ON public.posts FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));
-- Anonyme dürfen publizierte Posts lesen (für public/gym/[slug]).
CREATE POLICY posts_anon_published ON public.posts FOR SELECT TO anon
  USING (is_published = TRUE);

-- ────── gym_announcements ──────────────────────────────────────────────────
ALTER TABLE public.gym_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_announcements FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS announcements_tenant_rw ON public.gym_announcements;
CREATE POLICY announcements_tenant_rw ON public.gym_announcements FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── gym_bulk_mails ──────────────────────────────────────────────────────
ALTER TABLE public.gym_bulk_mails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_bulk_mails FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bulk_mails_tenant_rw ON public.gym_bulk_mails;
CREATE POLICY bulk_mails_tenant_rw ON public.gym_bulk_mails FOR ALL TO authenticated
  USING (gym_id IN (SELECT public.current_user_gym_ids()))
  WITH CHECK (gym_id IN (SELECT public.current_user_gym_ids()));

-- ────── gym_staff ───────────────────────────────────────────────────────────
ALTER TABLE public.gym_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_staff FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_owner_rw ON public.gym_staff;
DROP POLICY IF EXISTS staff_self_select ON public.gym_staff;
-- Owner sieht/bearbeitet Staff seines Gyms.
CREATE POLICY staff_owner_rw ON public.gym_staff FOR ALL TO authenticated
  USING (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()))
  WITH CHECK (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()));
-- Staff-Member sieht sich selbst.
CREATE POLICY staff_self_select ON public.gym_staff FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ────── avv_acceptances ────────────────────────────────────────────────────
ALTER TABLE public.avv_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avv_acceptances FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avv_tenant_select ON public.avv_acceptances;
CREATE POLICY avv_tenant_select ON public.avv_acceptances FOR SELECT TO authenticated
  USING (gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid()));
-- Inserts laufen durch Service-Role.

-- ─────────────────────────────────────────────────────────────────────────────
-- Sales-CRM (admin-only, cross-tenant)
-- ─────────────────────────────────────────────────────────────────────────────
-- sales_leads / sales_activities / sales_search_history sind ausschließlich
-- via Service-Role + requireAdmin() zugänglich. Wir aktivieren RLS und lassen
-- KEINE Policies — d.h. authenticated-Anon sieht NICHTS. Admin-Routen nutzen
-- Service-Role-Client, der RLS bypassed.

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_leads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sales_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_activities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sales_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_search_history FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabellen, die NICHT umgestellt werden
-- ─────────────────────────────────────────────────────────────────────────────
-- newsletter_subscribers: anonyme Double-Opt-In + Unsubscribe via Token-Routen
--   → Service-Role-only Inserts/Updates, keine authenticated-Auswertung nötig.
--   RLS aktivieren + KEINE policies → komplett zu via PostgREST-Anon.
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers FORCE ROW LEVEL SECURITY;

-- stripe_events: webhook-only, Service-Role.
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events FORCE ROW LEVEL SECURITY;

-- cron_runs: cron-only, Service-Role.
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_runs FORCE ROW LEVEL SECURITY;

-- notification_queue: cron + worker, Service-Role.
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue FORCE ROW LEVEL SECURITY;

-- page_views + page_views_daily: track-Route via Service-Role + admin/analytics-Route.
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views FORCE ROW LEVEL SECURITY;
ALTER TABLE public.page_views_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views_daily FORCE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verifikation nach Apply
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'
--      ORDER BY tablename;
--    Erwartet: alle oben aufgelisteten Tabellen mit rowsecurity = true.
--
-- 2. Aus Browser-Console mit Anon-Key:
--      const { data, error } = await window.supabase.from('members').select('*').limit(1)
--    Erwartet (logged-out): { data: [], error: null } oder permission-denied.
--    Erwartet (eingeloggt als Owner): nur eigene Members.
--
-- 3. Nicht-Owner-Dashboard-Mutations (PromoteButton/DemoteButton in
--    src/app/dashboard/members/[id]/) müssen weiterhin funktionieren oder
--    auf Service-Role-API umgezogen werden.
