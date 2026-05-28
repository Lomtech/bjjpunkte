# Migration bestehender Mitglieder nach osss.pro

**Stand 2026-05-27.** Sprint-Doku — Decision-Tree für Gym-Owner die ihre bestehenden Mitglieder + Verträge in osss.pro überführen wollen.

## Die Kernfrage

Müssen alle Mitglieder einen **neuen Vertrag in osss.pro** unterzeichnen oder darf der **bestehende Vertrag weiter gelten**?

DSGVO + BGB sagen: bestehende Verträge bleiben rechtsgültig. Du musst **niemanden** zum Neuabschluss zwingen. Aber: für die eIDAS-konforme digitale Beweisführung im osss.pro-Portal ist es **nice-to-have**.

## Drei Optionen

### Option A — Hard Reset: alle Mitglieder neu unterzeichnen

**Wie:** Alle aktuellen Verträge werden gekündigt (idealerweise zum nächst-möglichen Termin), Members bekommen einen Signup-Link, unterzeichnen Vertrag im osss.pro Portal.

**Pro:**
- Saubere Compliance-Baseline (alle Verträge eIDAS-konform digital signiert)
- Einheitliches Vertragsdatum + AGB-Version für alle
- Owner kann gleich neue Konditionen setzen (z.B. Preiserhöhung)

**Con:**
- ~30-50% der Members reagieren nicht innerhalb 4 Wochen (Erfahrungswerte aus Pilot)
- Beziehungs-Risiko ("plötzlich muss ich was tun")
- Member kann das als Anlass nutzen zu kündigen → Abwanderungs-Risiko

**Geeignet wenn:** du sowieso eine größere Änderung machst (Preisanpassung, neues Mitgliedschaftsmodell, AGB-Update mit substantieller Änderung).

### Option B — Legacy-Import (Hybrid, empfohlen)

**Wie:** Bestehende Verträge werden via Excel-Import als `member_contracts.is_legacy=true` angelegt. Original-Vertragsdokument bleibt **rechtsgültig**, aber Member kann **freiwillig** im Portal neu unterzeichnen (z.B. wenn sich Konditionen ändern oder beim nächsten DSGVO-Consent-Refresh).

**Pro:**
- Kein Migrations-Schock für Members
- Owner sieht im Dashboard welche Verträge noch "legacy" sind und kann gezielt einladen
- Original-Verträge bleiben Beweismittel (auch ohne osss.pro-Sig gerichtsverwertbar)
- DSGVO/Marketing-Consent kann separat über Portal eingeholt werden

**Con:**
- Owner muss Original-Vertrags-PDFs als Backup archivieren (kein osss.pro-Storage)
- "Doppelter Bestand": legacy-Verträge + neue über Portal — Dashboard zeigt beide

**Geeignet wenn:** Übernahme eines bestehenden Studios oder Tool-Wechsel ohne Vertragsänderung.

### Option C — Lazy Migration: nur neue Members unterzeichnen, alte bleiben offline

**Wie:** Bestehende Verträge bleiben papierform-only. Nur neue Members nach osss.pro-Launch durchlaufen den Portal-Signup-Workflow. Alt-Members werden NICHT in osss.pro angelegt (keine member_contracts row).

**Pro:**
- Null-Aufwand für Migration
- Schnellster Start

**Con:**
- Keine osss.pro-Features (Portal-Login, automatisches Mahnwesen, DATEV-Export) für Alt-Members
- Zwei parallele Systeme = doppelter Pflege-Aufwand
- Keine Übersicht über alle Mitgliedschaften in einem Tool

**Geeignet wenn:** Pilot-Phase ohne Echtbetrieb für Bestandsmember.

## Empfehlung für CSC FFB (oder ähnlich kleines Gym, 50-150 Mitglieder)

**→ Option B (Hybrid-Import)**

**Konkrete Schritte:**
1. Excel-Export aus altem System (Mitgliederliste mit Mindest-Spalten: Vorname, Nachname, Email, Telefon, Vertragsbeginn, Vertragsende, Belt, Beitrag, IBAN)
2. Spalten in osss.pro-Excel-Vorlage übertragen
3. Upload via `dashboard/settings → Mitglieder-Import`
4. Import-Route erzeugt automatisch `member_contracts` mit `is_legacy=true` (Sprint 2026-05-27)
5. Original-Vertrags-PDFs aus altem System als ZIP archivieren (nicht in osss.pro hochladen — DSGVO-Datenminimierung)
6. Members erhalten Email mit Portal-Link für DSGVO-Consent-Refresh (Marketing-Opt-In, AGB-Akzept der osss.pro-Plattform-Bedingungen)
7. Bei nächster Vertrags-Iteration (neuer Plan, Preisänderung, Ende der Erstlaufzeit): freiwillige Neusignatur im Portal

**Was Lom konkret tun muss:**
- Excel-Template aus `dashboard/settings → Excel-Vorlage runterladen`
- Excel pro Member ausfüllen
- Upload → Import läuft automatisch
- Im Dashboard `Mitglieder → Filter: is_legacy` sieht er welche Verträge migrated sind
- Manuell nach 2-3 Wochen prüfen: wer hat im Portal noch nicht reagiert? → erinnern

## Was wird konkret migriert?

| Excel-Spalte | osss.pro-Ziel | Pflicht? |
|---|---|---|
| first_name | members.first_name | ja |
| last_name | members.last_name | ja |
| email | members.email | ja (sonst kein Portal-Login möglich) |
| phone | members.phone | nein |
| belt | members.belt (white/blue/purple/brown/black) | nein, default 'white' |
| date_of_birth | members.date_of_birth | nein, aber wichtig für Eltern-Co-Sign-Workflow bei Minderjährigen |
| address | members.address | nein |
| join_date | members.join_date | nein, default heute |
| contract_signed_at | members.contract_signed_at + member_contracts.start_date + member_contracts.contract_signed_at | nein |
| contract_end_date | members.contract_end_date + member_contracts.effective_end_date | nein |
| monthly_fee_override_cents | members.monthly_fee_override_cents + member_contracts.monthly_fee_cents | nein |
| signature_data (data: URL) | wird zu private Storage upload | nein |

**Plus automatisch generiert:**
- `members.portal_token` (UUID, ermöglicht Member-Portal-Login)
- `member_contracts` Row mit `is_legacy=true`, `imported_at=now()`, `legacy_source='excel-import-YYYY-MM-DD'`
- `member_contracts.notice_period_days=30` und `notice_period_days_after_first_term=90` (Standard, gym-konfigurierbar)

## Was NICHT automatisch migriert wird

- **Offene Forderungen** — Excel-Spalte für `outstanding_balance_cents` müsste erweitert werden, plus manueller Eintrag in `dunning_actions`. Aktuell: nicht im Import-Code.
- **Stripe-Subscriptions** — wenn Members im alten System ein SEPA-Mandat hatten, muss das **neu eingerichtet** werden (Stripe / SEPA-Mandate sind nicht zwischen Tools übertragbar). Member klickt im Portal → Stripe-Checkout.
- **Vergangene Mahnungen** — `dunning_actions` History wird nicht migriert, beginnt bei null.
- **Trainingshistorie** — `attendance` Rows werden nicht migriert (Datenschutz: Datenminimierung). Nur ab osss.pro-Launch getrackt.

## Buchhaltung in Verbindung mit Migration

**Wichtig:** wenn du im Januar mit osss.pro startest, aber Mitglieder seit z.B. 2024 bestehende Verträge haben:

- **Alte Buchungen 2024-2025**: bleiben in deinem alten System (DATEV-Export von dort).
- **Stichtag der Migration**: ab wann werden Beiträge über osss.pro abgerechnet?
- **Rechnungs-Nummern-Kreis**: starte in osss.pro mit einem **frischen Counter** (vermutlich `2026-0001` ab Migration). Alt-Rechnungen behalten ihre alten Nummern.
- **DATEV-Mandantennummer**: dieselbe wie im alten System (Steuerberater-Sicht), aber **separater Buchungsstapel** ab osss.pro-Start.

**Konkret im Gespräch mit dem Steuerberater klären:**
1. Stichtag der Umstellung (z.B. 1.1.2026)
2. Werden Stripe-Auszahlungen einzeln verbucht oder als monatlicher Sammel-Eintrag?
3. Wie werden Stripe-Gebühren verbucht? (Konto 4960 "Bankgebühren" oder direkt vom Erlös abgezogen)
4. Wie werden Storno-Rechnungen über osss.pro (Gutschrift kind=credit_note) im DATEV-Export gehandhabt? — aktuell exportiert nur `status='paid'` mit positiver Summe; Gutschriften müssten als negative Buchung mit anderem Beleg-Datum exportiert werden.

## Roadmap

**Was schon geht (Sprint 2026-05-27):**
- Excel-Import erzeugt `member_contracts` Row automatisch mit `is_legacy=true`
- Migration-Quelle wird getrackt (`legacy_source`-Spalte)
- Privattraining-Rechnungen via API (`POST /api/members/[id]/manual-invoice`)
- Gutschriften via API (`POST /api/payments/[id]/credit`)

**Was noch fehlt (separate Sprints):**
- Dashboard-UI: Banner für legacy-Verträge mit "An Member-Portal einladen"-Button
- Excel-Spalte für `outstanding_balance_cents` (offene Forderungen)
- DATEV-Export berücksichtigt `credit_note`-Buchungen (negative Summen)
- Multi-Position-Rechnungen (1 Rechnung mit mehreren Posten + unterschiedlichen USt-Sätzen)
- Angebote (Quotes) — sevdesk-feature, später
