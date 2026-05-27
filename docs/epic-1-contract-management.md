# Epic 1 — Vertragsmanagement (Spec)

**Erstellt:** 2026-05-25
**Status:** Spec, noch keine Implementation
**Pilot-Bezug:** Combat-Sports-Center FFB (höchster Pain laut Cold-Calls 2026-05-25)
**Backlog-Quelle:** [project_bjjpunkte_feature_requests_2026-05-25.md](../../.claude/projects/-Users-lom-ali-Developer/memory/project_bjjpunkte_feature_requests_2026-05-25.md), Epic 1

---

## Status Quo

Aktuell ist "Vertrag" im Schema ein flacher Zustand auf der `members`-Tabelle ohne Historie:

| Feld | Bedeutung | Lücke |
|---|---|---|
| `members.contract_end_date` | Ende erster Laufzeit | Wird nie automatisch verlängert. Pausen verändern es nicht. |
| `members.cancellation_requested_at` | Member hat gekündigt | Keine Begründung-Struktur, keine Sonderkündigungs-Markierung. |
| `members.cancellation_note` | Freitext bei Kündigung | Kein Workflow (akzeptiert/abgelehnt). |
| `members.contract_signed_at` | eIDAS-Beleg | OK. |
| `membership_plans.contract_months` | Laufzeit-Definition | OK. |
| `gyms.contract_*_days` | Default-Kündigungsfristen | Statisch pro Gym, keine Dynamik nach Erstlaufzeit. |
| `gyms.contract_template` | PDF-Template | OK. |

**Was komplett fehlt:**
- Pause-Mechanik (kein `paused_until` o.ä. in der Live-DB — Memory war veraltet)
- Vertrags-Verlängerung-Historie (Original-Ende vs. effektives Ende nach Pausen)
- Beidseitige Sonderkündigung (nur Member kann kündigen)
- Strukturierte Begründungs-Kategorien
- Beitragserhöhungs-Workflow (manuelle Stripe-Updates)

---

## Ziel-Datenmodell (4 neue Tabellen)

### 1. `member_contracts` (Source-of-Truth ab Phase 1)

```sql
CREATE TABLE member_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES membership_plans(id) ON DELETE SET NULL,
  -- Laufzeit
  start_date date NOT NULL,
  initial_term_months integer NOT NULL CHECK (initial_term_months >= 0),  -- 0 = unbefristet
  original_end_date date NULL,   -- start_date + initial_term_months (NULL bei unbefristet)
  effective_end_date date NULL,  -- = original_end_date + Summe(Pausen) (NULL bei unbefristet)
  -- Status
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','cancelled_pending','cancelled','ended')),
  is_first_term boolean NOT NULL DEFAULT true,
    -- nach 1. Vertragsperiode false → Kündigungsfrist greift Dynamik
  -- Konditionen-Snapshot (für historische Korrektheit auch wenn Plan sich ändert)
  monthly_fee_cents integer NULL,
  billing_interval text NULL,
  -- Kündigungsfrist (dynamisch, snapshot zur Vertragserstellung)
  notice_period_days integer NOT NULL DEFAULT 30,
  notice_period_days_after_first_term integer NOT NULL DEFAULT 30,
  -- Audit
  contract_signed_at timestamptz NULL,
  contract_template_version text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_contracts_member_active ON member_contracts(member_id) WHERE status IN ('active','paused','cancelled_pending');
CREATE INDEX idx_member_contracts_gym_end ON member_contracts(gym_id, effective_end_date);
```

**Warum diese Form:**
- `original_end_date` bleibt unverändert, `effective_end_date` wächst mit Pausen → 6 Monate Pause auf 18-Monats-Vertrag → effective_end = original_end + 6
- `is_first_term` ist das Schalt-Flag für Kündigungsfrist-Dynamik
- `monthly_fee_cents` als Snapshot: Plan kann sich ändern (Beitragserhöhung), Vertrag behält seinen Preis bis zur Anwendung der Erhöhung
- `cancelled_pending` ist der Owner-Reviewable-Zwischenzustand

### 2. `contract_pauses`

```sql
CREATE TABLE contract_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES member_contracts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  paused_from date NOT NULL,
  paused_until date NULL,  -- NULL = noch offen (open-ended Pause)
  reason text NOT NULL CHECK (reason IN ('injury','travel','financial','other')),
  reason_note text NULL,
  -- Verlängerung
  extends_contract boolean NOT NULL DEFAULT true,
    -- Default true; Owner kann Kulanz-Pause als nicht-verlängernd markieren
  days_added_to_contract integer NULL,
    -- berechnet beim Schließen der Pause: paused_until - paused_from
  -- Audit
  created_by_user_id uuid NULL,
  created_by_role text NOT NULL CHECK (created_by_role IN ('owner','member','admin')),
  closed_at timestamptz NULL,
  closed_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_pauses_contract ON contract_pauses(contract_id);
CREATE INDEX idx_contract_pauses_open ON contract_pauses(member_id) WHERE paused_until IS NULL OR paused_until > CURRENT_DATE;
```

**Wichtig:**
- Beim Schließen einer Pause (paused_until gesetzt + closed_at) wird `member_contracts.effective_end_date` automatisch via Trigger aktualisiert: `+= days_added_to_contract`
- `extends_contract = false` ist die Kulanz-Variante (Owner schenkt die Zeit)
- Mehrere Pausen pro Vertrag möglich, summieren sich

### 3. `contract_terminations`

```sql
CREATE TABLE contract_terminations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES member_contracts(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  -- Wer kündigt
  requested_by_role text NOT NULL CHECK (requested_by_role IN ('member','owner')),
  requested_by_user_id uuid NULL,
  -- Art der Kündigung
  termination_kind text NOT NULL
    CHECK (termination_kind IN ('regular','special_right')),
    -- regular = ordentlich zum Vertragsende, special_right = Sonderkündigung
  reason_category text NULL
    CHECK (reason_category IN ('moved','injury','financial','dissatisfaction','medical','contract_breach','other')),
  reason_text text NOT NULL,  -- begründungspflichtig
  effective_date date NOT NULL,
  -- Workflow
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','accepted','rejected','withdrawn')),
  accepted_by_user_id uuid NULL,
  accepted_at timestamptz NULL,
  rejected_reason text NULL,
  -- Kommunikation
  communicated_at timestamptz NULL,
    -- wann die Gegenseite informiert wurde (Email versandt)
  communication_method text NULL CHECK (communication_method IN ('email','portal','manual')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contract_terminations_contract ON contract_terminations(contract_id);
CREATE INDEX idx_contract_terminations_pending ON contract_terminations(gym_id) WHERE status = 'requested';
```

**Workflow:**
- Member kann `termination_kind='regular'` requesten → Owner muss akzeptieren (oder ablehnen wenn Frist verletzt)
- Owner kann `termination_kind='special_right'` requesten → muss begründen, Member wird informiert (Email + Portal-Banner)
- Member kann `special_right` requesten (Umzug, Krankheit, etc.) → Owner-Review
- Auf `accepted` → `member_contracts.status = 'cancelled'`, `effective_end_date = termination.effective_date`

### 4. `plan_price_changes` (Beitragserhöhung)

```sql
CREATE TABLE plan_price_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES membership_plans(id) ON DELETE CASCADE,
  old_price_cents integer NOT NULL,
  new_price_cents integer NOT NULL CHECK (new_price_cents > 0),
  pct_change numeric(5,2) GENERATED ALWAYS AS
    ((new_price_cents - old_price_cents) * 100.0 / NULLIF(old_price_cents, 0)) STORED,
  -- Wann
  announced_at timestamptz NOT NULL DEFAULT now(),
  effective_date date NOT NULL,
  -- Communication
  notification_sent_at timestamptz NULL,
  notification_count integer NOT NULL DEFAULT 0,  -- Anzahl betroffener Members
  -- Widerspruch-Frist (BGB-konform)
  objection_deadline date NOT NULL,
    -- typisch effective_date - 14 Tage; Members können bis dahin Sonderkündigung ausüben
  -- Apply-Status
  applied_at timestamptz NULL,
    -- wann Stripe-Subscriptions tatsächlich auf neuen Preis umgestellt wurden
  stripe_price_id_new text NULL,  -- neue Stripe-Price-Ressource
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_price_changes_plan ON plan_price_changes(plan_id, effective_date);
CREATE INDEX idx_plan_price_changes_pending ON plan_price_changes(gym_id) WHERE applied_at IS NULL;
```

**Cron-Trigger** `/api/cron/apply-price-changes` (daily):
1. Findet `plan_price_changes` mit `applied_at IS NULL AND effective_date <= today`
2. Für jeden Plan: alle aktiven Stripe-Subscriptions auf neuen `stripe_price_id_new` updaten (Stripe API `subscriptions.update` mit `proration_behavior: 'none'`)
3. `applied_at` setzen + `member_contracts.monthly_fee_cents` für betroffene Members aktualisieren

---

## RLS-Policies

Alle 4 Tabellen kriegen `gym_id`-Owner-Pattern analog `member_tournaments`:

```sql
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table} FORCE ROW LEVEL SECURITY;  -- defense in depth

CREATE POLICY {table}_tenant_rw ON {table} FOR ALL TO authenticated
  USING (gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid()))
  WITH CHECK (gym_id IN (SELECT id FROM gyms WHERE owner_id = auth.uid()));

-- Member-Self-Access (für Portal):
-- contract_terminations brauchen Member-Self-Insert via Portal-Token-Service-Role-Route
-- (kein direkter RLS-Pfad, weil Member kein auth.uid hat)
```

Member-Portal-Aktionen laufen via Service-Role-Routes mit Portal-Token-Validation — keine direkten Member-Inserts via RLS.

---

## Migrations-Reihenfolge (5 Sub-Migrationen)

| # | Migration | Inhalt | Aufwand |
|---|---|---|---|
| **0014a** | `member_contracts_skeleton` | `member_contracts`-Tabelle + RLS + Backfill-RPC für bestehende active Members (1 Vertrag pro Member aus aktuellen Feldern). Bestehende `members.contract_*` Felder bleiben deprecated. | ~1 Tag |
| **0014b** | `contract_pauses` | Tabelle + RLS + Trigger `update_effective_end_date()` + RPC `start_pause()` / `close_pause()` | ~2 Tage |
| **0014c** | `contract_terminations` | Tabelle + RLS + Status-Trigger + Email-Hook | ~2 Tage |
| **0014d** | `is_first_term_dynamic_notice` | Wenn `is_first_term=false`, gilt `notice_period_days_after_first_term`. Cron flippt das Flag bei Verlängerung. | ~½ Tag |
| **0014e** | `plan_price_changes` + cron | Tabelle + Cron + Stripe-Subscriptions-Update-Logik + Notification-Email-Template | ~3 Tage |

**Gesamt: ~8-9 Tage DB+Backend, plus ~5-6 Tage UI = ~3 Wochen Solo realistisch.**

---

## API-Routes (neu)

### Owner (Dashboard)
- `POST /api/contracts` — Vertrag anlegen (mit Plan, Start, Laufzeit)
- `GET /api/contracts?member_id=X` — Verträge eines Members
- `PATCH /api/contracts/[id]` — Vertrag editieren (Notes, Notice-Period-Override)
- `POST /api/contracts/[id]/pauses` — Pause starten
- `PATCH /api/contracts/[id]/pauses/[pauseId]` — Pause beenden
- `POST /api/contracts/[id]/terminate` — Sonderkündigung durch Owner
- `POST /api/contracts/[id]/terminations/[tid]/accept` — Kündigungsantrag akzeptieren
- `POST /api/contracts/[id]/terminations/[tid]/reject` — Kündigungsantrag ablehnen (mit Grund)
- `POST /api/plans/[id]/price-change` — Beitragserhöhung anmelden
- `GET /api/plans/[id]/price-changes` — History

### Member (Portal via Token-Service-Role)
- `POST /api/portal/[token]/contract/cancel` — Ordentliche Kündigung anmelden
- `POST /api/portal/[token]/contract/special-cancel` — Sonderkündigung mit Begründung
- `POST /api/portal/[token]/contract/pause-request` — Pause-Antrag (Owner muss approven oder selbst eintragen)

### Cron
- `0 1 * * *` `apply-price-changes` — täglich
- `0 2 * * *` `auto-extend-contracts` — täglich; verlängert befristete Verträge die ohne Kündigung auslaufen (oder beendet sie wenn Plan `auto_renew=false`)
- `0 3 * * *` `flip-first-term-flag` — täglich; setzt `is_first_term=false` für Verträge die ihre Initial-Laufzeit überschritten haben

---

## UI-Surfaces

### Gym-Admin (Dashboard)
- **`/dashboard/members/[id]` neue Section `ContractSection.tsx`**
  - Aktueller Vertrag: Status, Start, Effective-End, "noch X Tage", "is_first_term" Badge
  - History: alle vorigen Verträge
  - Aktionen: Pause starten, Pause beenden, Sonderkündigung anstoßen, Kündigungsantrag akzeptieren/ablehnen
- **`/dashboard/plans` (neu oder Erweiterung settings)**
  - Pro Plan: Beitragserhöhung anmelden mit Wirksamkeits-Datum + auto-generierte Widerspruchs-Frist
  - Preview "Diese N Mitglieder sind betroffen"
- **`/dashboard/contracts` (neu, Übersicht)**
  - Pending-Kündigungsanträge
  - Bald auslaufende Verträge (next 30 Tage)
  - Offene Pausen

### Member-Portal (`/portal/[token]`)
- **Neue Karte "Mein Vertrag"** im Verwaltung-Tab
  - Aktueller Stand, effektives Ende
  - Aktive Pause: "Seit X pausiert, läuft bis Y"
  - Button "Pause beantragen" → Modal (Grund + Dauer)
  - Button "Kündigen" → Wizard
    - Schritt 1: Ordentlich oder Sonderkündigung?
    - Schritt 2: Kategorie + Begründung
    - Schritt 3: Bestätigung mit Wirksamkeits-Datum
- **Banner bei laufender Beitragserhöhung**: "Deine Mitgliedschaft kostet ab DD.MM.YYYY X€. Widerspruchsfrist: DD.MM.YYYY. → Jetzt Sonderkündigung beantragen"

---

## Edge-Cases

1. **Vertrag wird während Pause gekündigt** → effective_end_date = max(termination.effective_date, original_end_date + pause_days). Pause läuft weiter bis manuell beendet oder zur termination.effective_date.
2. **Pause startet rückwirkend** → Owner kann `paused_from < CURRENT_DATE` setzen (Kulanz-Backdate). Vertragsverlängerung greift trotzdem.
3. **Zwei offene Pausen?** → DB-Constraint: max 1 Pause mit `paused_until IS NULL` pro Contract. Trigger erzwingt.
4. **Beitragserhöhung während laufender Pause** → effective_date wird auf nach Pause-Ende verschoben, oder Member muss bei pause-Ende neuen Preis akzeptieren.
5. **Mitglied wechselt Plan während laufender Pause** → alter Vertrag endet, neuer Vertrag startet erst nach Pause-Ende.
6. **Stripe-Subscription bei Pause**: `pause_collection` via Stripe API setzen, bei Pause-Ende `pause_collection: null`. Korrekte Wiederaufnahme.
7. **Sonderkündigung wegen Beitragserhöhung** vor Stichtag → muss vor `objection_deadline` eingehen, Owner kann nicht ablehnen.
8. **Vertragsende ohne Kündigung**: `auto-extend-contracts`-Cron prüft `plan.auto_renew` (neues Feld). True → +contract_months, False → status='ended'.

---

## Stripe-Integration

| Aktion | Stripe API |
|---|---|
| Pause starten | `subscriptions.update({ pause_collection: { behavior: 'void' }})` |
| Pause beenden | `subscriptions.update({ pause_collection: null })` |
| Beitragserhöhung apply | `subscriptions.update({ items: [{ id, price: new_price_id }], proration_behavior: 'none' })` |
| Kündigung accepted | `subscriptions.update({ cancel_at: effective_date_unix })` |
| Sofortige Sonderkündigung | `subscriptions.cancel({ id })` |

Für Plans neu ein `stripe_price_id` pro Preis-Stand (immutable history). Neuer Preis = neue Stripe-Price-Ressource.

---

## Test-Strategie

- **Unit:** Trigger `update_effective_end_date`, Constraint `max-1-open-pause`, RPC `start_pause`
- **Integration:** Pause-Verlängerung-Roundtrip (start → close → effective_end korrekt)
- **Integration:** Sonderkündigung-Member → Owner accept → contract.status='cancelled', Stripe `cancel_at` gesetzt
- **Integration:** Price-Change announced → cron läuft am effective_date → Stripe-Sub upgedatet → contract.monthly_fee_cents synced
- **E2E (manuell beim Pilot CSC-FFB):** alle 5 Sub-Stories einmal durch

---

## Empfohlene Implementations-Reihenfolge

1. **Sub 0014a: `member_contracts`-Skelett + Backfill** (Boden für alles)
2. **Sub 0014b: Pause-Mechanik** (höchster Pilot-Pain laut Cold-Calls)
3. **Sub 0014c: Sonderkündigung beidseitig** (zweithöchster Pain)
4. **Sub 0014d: Kündigungsfrist-Dynamik** (klein, dank Backfill leicht)
5. **Sub 0014e: Beitragserhöhung** (Stripe-aufwändigst, am Ende)

Jede Sub-Migration kann eigenständig deployed werden — das Repo bleibt nach jedem Schritt buildable.

---

## Was bewusst NICHT in Epic 1

- **Familien-/Haushalts-Bündel** (Epic separat)
- **Mehrere Verträge pro Member gleichzeitig** (z.B. Erwachsenen + Kids-Programm) — möglich, aber nicht im MVP
- **Vertrags-PDF-Regenerierung** bei Beitragserhöhung — nur eIDAS-Beleg im signature-bucket bleibt
- **Komplexe Pause-Regeln** wie "max 3 Monate pro Jahr" — Owner-Override reicht
