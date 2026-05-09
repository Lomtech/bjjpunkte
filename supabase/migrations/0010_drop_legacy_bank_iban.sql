-- Backfill safety net + drop legacy plaintext column.
--
-- Hintergrund:
-- IBAN-Encryption-Migration ist seit 2026-04-XX live, alle neuen Inputs gehen
-- nur in bank_iban_enc. Der Klartext-Fallback in getIbanFromGym() macht uns
-- bei einem Backup-Leak angreifbar — diese Migration räumt auf:
--
--   1. UPDATE: stellt sicher, dass kein Klartext-IBAN mehr existiert wo bereits
--      bank_iban_enc gesetzt ist (defensives Cleanup gegen alte Datensätze, die
--      womöglich noch beide Spalten gefüllt haben).
--   2. ALTER TABLE DROP COLUMN: entfernt die Klartext-Spalte komplett.
--
-- ACHTUNG — Pre-flight VOR dem Apply zwingend ausführen:
--
--   SELECT count(*) FROM gyms WHERE bank_iban IS NOT NULL AND bank_iban_enc IS NULL;
--
-- Wenn count > 0:
--   1. Diese Migration NICHT applyen.
--   2. Erst `npx tsx scripts/encrypt-existing-ibans.ts --dry` laufen lassen,
--      Output prüfen, dann ohne `--dry` ausführen.
--   3. Pre-flight wiederholen — muss 0 sein.
--   4. ODER: zur Bequemlichkeit `scripts/check-iban-migration.ts` nutzen,
--      das den gleichen Check fährt und mit Exit-Code 1 abbricht wenn
--      noch nicht migriert.
--
-- Wenn count = 0 → safe to apply.

-- Schritt 1: Defensives Cleanup. Falls ein Datensatz beide Spalten gesetzt hat
-- (sollte bei korrektem Backfill nicht passieren, aber wir verlieren kein
-- DSGVO-Schutzpolster), Klartext leeren bevor die Spalte verschwindet.
UPDATE gyms
SET bank_iban = NULL
WHERE bank_iban IS NOT NULL
  AND bank_iban_enc IS NOT NULL;

-- Schritt 2: Spalte droppen. IF EXISTS macht die Migration idempotent —
-- ein zweiter Run wirft keinen Fehler.
ALTER TABLE gyms DROP COLUMN IF EXISTS bank_iban;
