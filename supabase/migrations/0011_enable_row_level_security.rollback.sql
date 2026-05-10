-- Rollback für 0011_enable_row_level_security.sql
-- Deaktiviert RLS auf allen oben aktivierten Tabellen und löscht alle in 0011
-- erstellten Policies + die Helper-Function.
--
-- VORSICHT: Rollback öffnet die Cross-Tenant-Lücke wieder. Nur als Notfall-
-- Werkzeug bei kaputten Frontend-Pfaden. Korrekte Reaktion bei Problemen ist
-- normalerweise eine zusätzliche Policy, nicht Rollback.

DROP POLICY IF EXISTS gyms_owner_select ON public.gyms;
DROP POLICY IF EXISTS gyms_owner_modify ON public.gyms;
ALTER TABLE public.gyms DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS members_tenant_rw ON public.members;
ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_tenant_rw ON public.attendance;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_tenant_select ON public.payments;
DROP POLICY IF EXISTS payments_tenant_modify ON public.payments;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classes_tenant_rw ON public.classes;
ALTER TABLE public.classes DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS class_bookings_tenant_rw ON public.class_bookings;
ALTER TABLE public.class_bookings DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_tenant_rw ON public.membership_plans;
ALTER TABLE public.membership_plans DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS belt_promotions_tenant_rw ON public.belt_promotions;
ALTER TABLE public.belt_promotions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_logs_tenant_rw ON public.training_logs;
ALTER TABLE public.training_logs DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_tenant_rw ON public.leads;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_bookings_tenant_rw ON public.lead_bookings;
ALTER TABLE public.lead_bookings DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dunning_actions_tenant_select ON public.dunning_actions;
ALTER TABLE public.dunning_actions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS posts_tenant_rw ON public.posts;
DROP POLICY IF EXISTS posts_anon_published ON public.posts;
ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_tenant_rw ON public.gym_announcements;
ALTER TABLE public.gym_announcements DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bulk_mails_tenant_rw ON public.gym_bulk_mails;
ALTER TABLE public.gym_bulk_mails DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_owner_rw ON public.gym_staff;
DROP POLICY IF EXISTS staff_self_select ON public.gym_staff;
ALTER TABLE public.gym_staff DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS avv_tenant_select ON public.avv_acceptances;
ALTER TABLE public.avv_acceptances DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.sales_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_search_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views_daily DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.current_user_gym_ids();
