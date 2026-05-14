-- ─────────────────────────────────────────────────────────────────────────────
-- 0012_member_tournaments.sql
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Tournament-Tracking pro Mitglied. User-Wunsch 2026-05-14: Owners + Trainer
-- sollen Turnier-Antritte + Ergebnisse pro Mitglied tracken, Member ihre
-- eigene Historie im Portal sehen, optional als Roll-of-Honor auf der
-- Public-Gym-Page.
--
-- Bewusst manuelles Eintragen (kein Smoothcomp-Auto-Sync) — Smoothcomp ist
-- hinter Cloudflare-Bot-Protection, automatischer Scrape nicht ohne
-- erheblichen Infra-Aufwand möglich (siehe Session 2026-05-14).
--
-- DESIGN-ENTSCHEIDUNGEN:
-- • Eigene Tabelle statt JSONB auf members — erlaubt Indexe, Queries pro
--   Disziplin/Ergebnis, Trigger für Stats-Aggregate.
-- • gym_id duplizziert für RLS-Performance (statt JOIN auf members.gym_id).
-- • result als TEXT mit CHECK statt enum — Werte können sich erweitern (z.B.
--   "5th-place" bei ADCC), ohne Migration.
-- • Optional smoothcomp_url + smoothcomp_event_id für künftige Sync-Variante.

CREATE TABLE IF NOT EXISTS public.member_tournaments (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id          uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  gym_id             uuid        NOT NULL REFERENCES public.gyms(id)    ON DELETE CASCADE,

  -- Turnier-Identifikation
  name               text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  event_date         date        NOT NULL,
  location           text                  CHECK (location IS NULL OR char_length(location) <= 200),

  -- Klassifikation
  discipline         text        NOT NULL CHECK (discipline IN (
    'bjj-gi', 'bjj-nogi', 'submission-grappling', 'judo', 'mma', 'mma-amateur',
    'kickboxen', 'muay-thai', 'boxen', 'karate', 'taekwondo', 'wrestling', 'other'
  )),
  weight_class       text                  CHECK (weight_class IS NULL OR char_length(weight_class) <= 100),
  age_division       text                  CHECK (age_division IS NULL OR char_length(age_division) <= 100),
  belt_at_event      text                  CHECK (belt_at_event IS NULL OR char_length(belt_at_event) <= 50),

  -- Ergebnis
  result             text        NOT NULL CHECK (result IN (
    'gold', 'silver', 'bronze',
    'finalist', 'semifinalist', 'quarterfinalist',
    'top-8', 'top-16', 'participation',
    'dnf', 'dq', 'withdrew'
  )),
  matches_won        int                   CHECK (matches_won  IS NULL OR matches_won  >= 0),
  matches_lost       int                   CHECK (matches_lost IS NULL OR matches_lost >= 0),

  -- Notes + externe Verlinkung (Smoothcomp optional — User füllt selbst aus)
  notes              text                  CHECK (notes IS NULL OR char_length(notes) <= 1000),
  smoothcomp_url     text                  CHECK (smoothcomp_url IS NULL OR smoothcomp_url ~* '^https?://(www\.)?smoothcomp\.com/'),

  -- Sichtbarkeit
  -- public_visible = darf auf Public Gym Page (osss.pro/gym/<slug>) angezeigt werden.
  -- Default false: Owner muss explizit aktivieren (DSGVO-konform — Member-Name
  -- öffentlich sichtbar nur mit aktiver Einwilligung).
  public_visible     boolean     NOT NULL DEFAULT false,

  -- Audit
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Indexe für die wichtigsten Query-Pfade:
CREATE INDEX IF NOT EXISTS idx_member_tournaments_member       ON public.member_tournaments (member_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_member_tournaments_gym_date     ON public.member_tournaments (gym_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_member_tournaments_gym_public   ON public.member_tournaments (gym_id, event_date DESC) WHERE public_visible = true;
CREATE INDEX IF NOT EXISTS idx_member_tournaments_gym_podium   ON public.member_tournaments (gym_id, event_date DESC) WHERE result IN ('gold','silver','bronze');

-- updated_at Auto-Trigger (Pattern wie restliche Tabellen, falls vorhanden — sonst skippt der DO-Block).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE TRIGGER trg_member_tournaments_updated_at
      BEFORE UPDATE ON public.member_tournaments
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — Multi-Tenancy + Public-Read für Roll-of-Honor
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.member_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_tournaments FORCE  ROW LEVEL SECURITY;

-- Owner/Staff des Gyms: voller R/W-Zugriff
DROP POLICY IF EXISTS tournaments_tenant_rw ON public.member_tournaments;
CREATE POLICY tournaments_tenant_rw ON public.member_tournaments FOR ALL TO authenticated
  USING (
    gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.gym_staff
      WHERE gym_staff.gym_id = member_tournaments.gym_id
        AND gym_staff.user_id = auth.uid()
        AND gym_staff.accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    gym_id IN (SELECT id FROM public.gyms WHERE owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.gym_staff
      WHERE gym_staff.gym_id = member_tournaments.gym_id
        AND gym_staff.user_id = auth.uid()
        AND gym_staff.accepted_at IS NOT NULL
    )
  );

-- Public Roll-of-Honor: anon + authenticated dürfen die als public_visible
-- markierten Einträge der onboarded Gyms lesen.
DROP POLICY IF EXISTS tournaments_public_read ON public.member_tournaments;
CREATE POLICY tournaments_public_read ON public.member_tournaments FOR SELECT
  TO anon, authenticated
  USING (
    public_visible = true
    AND gym_id IN (SELECT id FROM public.gyms WHERE onboarding_completed_at IS NOT NULL)
  );

COMMENT ON TABLE public.member_tournaments IS 'Tournament results per member. Created 2026-05-14 — see migration file for design rationale.';
