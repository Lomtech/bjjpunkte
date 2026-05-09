# Database Migrations

Schema-Tracking für die Supabase-Live-DB (`ktwgvuasjezokhsfpfqb`).
Bevor dieser Ordner existierte, lebte das Schema NUR in der Live-DB und in
`src/types/database.ts`. Kein Diff, kein Rollback, kein Staging-Test —
für ein Produkt mit echten Zahlungen ein existenzieller Risikofaktor.

Ab jetzt: **jede Schema-Änderung = neue numerierte SQL-Datei in diesem Ordner,
committen vor `apply`**. Punkt.

## Naming-Convention

```
NNNN_kurze_beschreibung.sql
```

- `NNNN` = 4-stellige Sequenz, beginnend bei `0001`. Lücken sind erlaubt
  (z.B. wenn mehrere Agenten parallel Migrations entwerfen).
- `0000_initial_schema.sql` = Baseline-Dump der Live-DB. Einmalig generieren,
  danach unverändert lassen.
- Kurze Beschreibung in `snake_case`. Englisch oder Deutsch ist beides ok,
  Hauptsache lesbar.

Beispiele:
- `0001_stripe_events_processed_at.sql`
- `0010_drop_legacy_bank_iban.sql`

## Aktueller Stand

```
0000_initial_schema.sql              ← Baseline (Platzhalter, siehe unten)
0001_stripe_events_processed_at.sql  ← outbox-pattern für Webhook-Idempotenz
0002_page_views_aggregation.sql      ← page_views_daily-Tabelle
0003_notification_queue.sql          ← async Worker-Queue für Mail/WhatsApp
0010_drop_legacy_bank_iban.sql       ← Klartext-IBAN-Spalte droppen
```

Liste mit `ls supabase/migrations/` regelmäßig auf den aktuellen Stand prüfen
— gleichzeitige Agenten-Sessions können neue Files dazwischenlegen.

Wenn du eine neue Migration anlegst: erst `ls supabase/migrations/` checken,
dann die nächste freie Nummer wählen. **Niemals** existierende Files umbenennen
oder Nummern wiederverwenden — das verfälscht jede Diff-Historie.

## Workflow

### 1. Baseline einmalig erzeugen

Die `0000_initial_schema.sql` ist absichtlich leer. Sie wird einmalig auf einer
Entwicklermaschine mit Supabase-CLI gefüllt:

```bash
# Einmalig:
supabase login
supabase link --project-ref ktwgvuasjezokhsfpfqb

# Schema dumpen (NUR Schema, keine Daten):
supabase db dump --schema-only --linked > supabase/migrations/0000_initial_schema.sql

# Committen.
git add supabase/migrations/0000_initial_schema.sql
git commit -m "chore(db): baseline schema dump"
```

Danach ist `0000_initial_schema.sql` der Snapshot der Live-DB zum Zeitpunkt der
Einführung dieses Migrations-Workflows. Alle weiteren Schema-Änderungen leben
in `0001+`.

### 2. Neue Migration entwerfen

```bash
# Nächste Nummer aus ls supabase/migrations/ ermitteln
# Datei anlegen, SQL schreiben, in PR committen.
```

Die SQL muss **idempotent** sein wo möglich (`IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS`, etc.). So überlebt sie versehentliches Re-Apply.

### 3. Migration applyen

Zwei Varianten:

**Variante A — Supabase CLI (bevorzugt):**

```bash
supabase db push --linked
```

Pusht alle Migrations aus dem Ordner, die in der DB noch nicht in der
`supabase_migrations.schema_migrations`-Tabelle stehen.

**Variante B — Manuell via SQL-Editor (Notfall / wenn CLI nicht verfügbar):**

1. Im Supabase-Dashboard → SQL Editor öffnen.
2. Inhalt der `.sql` reinkopieren.
3. Run.
4. **Wichtig**: bei manuellem Apply gibt es keinen automatischen Eintrag in
   `supabase_migrations.schema_migrations` → bei späterem `supabase db push`
   würde die Migration nochmal laufen. Idempotenz (`IF NOT EXISTS`) ist
   deshalb Pflicht.

### 4. Type-Regen

Nach jeder Schema-Änderung `src/types/database.ts` an die neue Realität
anpassen — entweder per Hand oder via:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

(Achtung: der Auto-Generator schreibt das ganze File neu und nutzt eine andere
Struktur als unsere handgepflegte Variante. Lieber per Hand pflegen, bis wir
auf den Generator umstellen.)

### 5. Was wann committen?

| Situation                                    | Was committen                                             |
|----------------------------------------------|-----------------------------------------------------------|
| Schema-Änderung ohne Code-Folgen             | nur `NNNN_*.sql`                                          |
| Schema-Änderung + neue Spalten im Code       | `NNNN_*.sql` + `database.ts`-Update + Code im selben PR   |
| Pre-flight-Check-Skript                      | `scripts/*.ts` separat oder mit der Migration zusammen    |
| Live-DB wurde manuell geändert ohne SQL-File | **Sofort** `NNNN_*.sql` nachreichen — sonst driftet Repo  |

Goldene Regel: **kein Schema-Drift zwischen Repo und Live-DB**. Wenn du auf
prod manuell DDL gemacht hast, gehört das in eine Migration mit Datum im
Kommentar — auch wenn es nur dokumentarisch ist.

## Rollback

Pro Migration optional eine `NNNN_rollback.sql` ablegen, falls die Forward-
Migration destruktiv ist (DROP COLUMN, etc.). Beispiel:

```
0010_drop_legacy_bank_iban.sql
0010_drop_legacy_bank_iban.rollback.sql  ← ALTER TABLE … ADD COLUMN bank_iban TEXT
```

Auch ohne Rollback-File gilt: in `git revert` ist die Migration im SQL-Editor
manuell rückwärts laufen lassen — solange das Schema im Repo lebt, weißt du,
was rückgängig gemacht werden muss.

## Achtung: Parallel-Arbeit mehrerer Agenten

Wenn mehrere Agenten gleichzeitig Migrations entwerfen, kommen Nummern-Kollisionen
vor. Workflow:

1. Vor jedem `Write` die `ls supabase/migrations/` ausführen.
2. Wenn der Slot besetzt ist: nächste freie Nummer nehmen, **niemals** über
   eine bestehende Datei drüber schreiben.
3. Lücken (z.B. 0001, 0002, 0010) sind ok — sie geben Platz für nachgereichte
   verwandte Migrations.
