# Go-Live-Checkliste — Vor dem ersten zahlenden Studio

Stand: 2026-05-09 nach Sprint-Finalize (Commit `d315d6a`).

---

## ✅ Bereits erledigt (durch Claude in dieser Session)

- ✅ **Migration 0001** (`stripe_events_processed_at_outbox`) → applied
- ✅ **Migration 0001-Backfill** → `UPDATE stripe_events SET processed_at = created_at` (0 rows betroffen, frische Tabelle — safe)
- ✅ **Migration 0002** (`page_views_aggregation_v2`) → applied (mit unique-index statt PK-mit-functions)
- ✅ **Migration 0003** (`notification_queue`) → applied
- ✅ **Migration 0010-Pre-Flight** → 0 unmigrated klartext-IBANs (safe)
- ✅ **Migration 0010** (`drop_legacy_bank_iban`) → applied (Spalte `bank_iban` entfernt)
- ✅ **Vercel-Env** `NOTIFICATION_QUEUE_ENABLED=true` für Production + Preview gesetzt
- ✅ **Vercel-Redeploy** getriggert

---

## 🔴 Was du noch manuell machen musst

### 1. Stripe Tax aktivieren (5 Minuten, im Stripe-Dashboard)

**Warum**: Ohne Stripe Tax verkaufst du an alle Studios mit 19% DE-MwSt. Erstes AT-Studio mit USt-ID will eine korrekte Reverse-Charge-Rechnung — die kannst du nur ausstellen wenn Stripe Tax aktiv ist. Dein Code (`src/app/api/stripe/owner-checkout/route.ts`) hat bereits `automatic_tax: { enabled: true }` und `tax_id_collection: { enabled: true }`, aber ohne Stripe-Dashboard-Aktivierung greift das nicht.

**Schritte**:
1. https://dashboard.stripe.com/settings/tax öffnen
2. Falls dort steht „Get started with Stripe Tax" — Click drauf
3. Origin Address eintragen (deine Geschäftsadresse — Kreuzstraße 1, 82276 Adelshofen)
4. Tax Categories: für SaaS-Subscriptions wähle `txcd_10000000` (Software as a Service – cloud-based business solution) oder ähnliches
5. Settings → Tax Registrations → Add Registration
   - Country: Germany, Type: Standard VAT, Status: Not registered (weil Kleinunternehmer §19 UStG)
   - Wenn du irgendwann USt-IdNr. bekommst (>22k€/Jahr), hier eintragen
6. Test-Checkout machen: https://www.osss.pro/pricing → Klick Plan → bei Address-Eingabe testen ob Tax automatisch berechnet wird

**Hinweis Kleinunternehmer**: Solange du §19 UStG bist, bleibt Stripe Tax effektiv 0% — aber das System erkennt korrekt EU-B2B-Cases und verhindert Fehler beim Wachstum.

---

### 2. AVVs der 7 Sub-Auftragsverarbeiter unterzeichnen (~2 Stunden)

**Warum**: DSGVO Art. 28 verlangt einen unterzeichneten Auftragsverarbeitungsvertrag mit jedem Dienstleister, der personenbezogene Daten in deinem Auftrag verarbeitet. Bei einer Beschwerde eines Studio-Owners ohne unterzeichnete AVVs: Bußgeld-Risiko 4-stelliger bis 5-stelliger Bereich.

**Direktlinks zu den AVV-Dokumenten**:

| # | Anbieter | AVV/DPA-Link | Was zu tun |
|---|---|---|---|
| 1 | **Supabase** | https://supabase.com/legal/dpa | „Sign DPA" Button → Account-bezogen automatisch unterzeichnet, PDF herunterladen |
| 2 | **Stripe** | https://stripe.com/legal/dpa | Wird beim Stripe-Account-Setup automatisch akzeptiert. PDF unter: Dashboard → Settings → Documents → Data Processing Agreement |
| 3 | **Vercel** | https://vercel.com/legal/dpa | Im Dashboard: Settings → Legal → Data Processing Addendum → „Accept DPA" |
| 4 | **Resend** | https://resend.com/legal/dpa | Per E-Mail anfordern: legal@resend.com mit „Bitte signed AVV/DPA für Account [deine Email]" |
| 5 | **Sentry** | https://sentry.io/legal/dpa/ | Im Dashboard: Settings → Legal & Compliance → Sign DPA |
| 6 | **Upstash** | https://upstash.com/trust/dpa.pdf | PDF herunterladen, ausdrucken, unterschreiben, an support@upstash.com mailen |
| 7 | **Google (Places API)** | https://cloud.google.com/terms/data-processing-addendum | Im Google Cloud Console: IAM & Admin → Data Processing Addendum → Accept |

**Speicher-Ort**: Lege alle PDFs in `/compliance/avv-signed/` (gitignored — `.gitignore` hat `/compliance/avv/` schon drin, falls nicht: ergänzen).

**Im Verarbeitungsverzeichnis dokumentieren**: 
- Datei: `/compliance/verarbeitungsverzeichnis.md`
- Pro Anbieter: Datum der Unterzeichnung + Pfad zur PDF eintragen (☐ → ✅)

---

### 3. Test-Checkout durchspielen (10 Minuten)

**Warum**: Verifiziert dass Standard-Tarif (49 €/Mo bzw. 39 €/Mo jährlich) greift, Stripe-Tax richtig läuft, Webhook das Event verarbeitet.

**Schritte**:
1. https://www.osss.pro/pricing in einem Inkognito-Fenster öffnen
2. Klick „Jetzt starten" → Stripe-Checkout
3. Adresse eingeben (echte oder fake-Adresse) → Tax sollte 0% (Kleinunternehmer) zeigen
4. Test-Karte `4242 4242 4242 4242`, beliebiges Datum + CVC
5. Subscription wird angelegt → bei Erfolg im Stripe-Dashboard sehen
6. Im Supabase: `SELECT plan, plan_member_limit FROM gyms WHERE owner_id = '<deine UUID>'` → muss `pro` mit korrektem Limit zeigen
7. Test-Subscription wieder kündigen + Customer löschen

---

## 📋 Nice-to-have (vor 50 Studios)

### 4. Focus-Trap-Library installieren

Aktuell sind 15 Modals mit `role="dialog"` markiert, aber ohne Focus-Trap. Tab-Navigation springt aus dem Modal raus. Für BFSG-Compliance:

```bash
npm install focus-trap-react
```

Dann an die 15 TODO(a11y)-Markierungen `<FocusTrap>...</FocusTrap>` wrappen.

### 5. AVV-Aufschluss in der App selbst

Du hast eine eigene AVV-In-App-Signatur-Funktion (`/dashboard/settings/avv`). Studios unterschreiben dort den AVV mit DIR (Lom-Ali Imadaev) als Auftragsverarbeiter. Das ist deine Beziehung zum Studio.

Was du jetzt machst (#2 oben): AVVs zwischen DIR und deinen Sub-Auftragsverarbeitern (Supabase, Stripe, …). Das ist die andere Seite. Beide sind nötig für DSGVO Art. 28.

### 6. NOTIFICATION_QUEUE_ENABLED-Rollout-Beobachtung

Nach dem Vercel-Redeploy:
1. Warte den nächsten payment-reminders-Cron-Lauf ab (aktuell 1×/Monat am 5. um 09:00 UTC)
2. Im Supabase SQL-Editor: `SELECT status, count(*) FROM notification_queue GROUP BY status`
3. Wenn `pending` > 0: Worker läuft alle 5 Min — solte schnell auf `sent` runtergehen
4. Wenn `failed` > 0: Last_error-Spalte checken

Falls Probleme: Feature-Flag in Vercel auf `false` setzen → fällt zurück auf direct-mail-Pfad (alter Code).

---

## 🧠 Pro-Tipps für die ersten 10 zahlenden Studios

**Sales-Schiene** (dein eigener Funnel):
1. Test-Checkout in deinem Account selbst → bezahle dich (Stripe-Test-Mode oder echte 49€)
2. Onboarding-Flow durchklicken → Pain-Points selbst spüren
3. Mit echten Studios Demo-Calls machen → 14-Tage-Trial + persönliches Onboarding als Knappheits-Hebel (3 Pilot-Slots, kein Discount nötig)

**Wenn der erste echte Studio kommt**:
- Sei dabei beim Onboarding (Bildschirm-Sharing-Call)
- Notiere alle Friction-Punkte → fix sie sofort
- Bitte aktiv um Testimonial nach 30 Tagen
- Frage: „Würdest du 3 andere Studios anrufen für mich?" — Network-Effect-Hebel

**Bei Bug**:
- Sentry-Dashboard offen halten → siehst Errors in Echtzeit
- 24h-Response-Zeit kommunizieren („Schreib mir auf WhatsApp, ich bin dran")
- Bei kritischen Bugs: Coupon `BUG_SORRY_50` mit 50% off 1 Monat als Wiedergutmachung anbieten

---

## 🔍 Verifikations-Queries für Supabase SQL-Editor

```sql
-- Sicherstellen dass 30k-MRR-Hardening greift:

-- 1. stripe_events Outbox aktiv?
SELECT count(*) AS total,
       count(*) FILTER (WHERE processed_at IS NOT NULL) AS processed,
       count(*) FILTER (WHERE processed_at IS NULL AND created_at < now() - interval '5 minutes') AS stuck
FROM stripe_events;
-- stuck > 0 = Webhook-Crash, nachschauen

-- 2. notification_queue läuft?
SELECT status, count(*) FROM notification_queue GROUP BY status;
-- pending sollte unter 100 bleiben, processing < 50, failed < 5%

-- 3. page_views noch nicht zu groß?
SELECT count(*) AS rows, max(created_at) AS latest, min(created_at) AS oldest FROM page_views;
-- > 1M rows = aggregate-page-views Cron läuft nicht; Vercel-Cron-Logs checken

-- 4. bank_iban Klartext wirklich weg?
SELECT column_name FROM information_schema.columns 
WHERE table_schema='public' AND table_name='gyms' AND column_name LIKE '%iban%';
-- Erwartet: nur bank_iban_enc

-- 5. Aktive Studios pro Tier?
SELECT plan, count(*) FROM gyms WHERE plan != 'free' GROUP BY plan;
```

---

**Letzter Hinweis**: Die Migrations sind bereits in `supabase/migrations/` getrackt. Wenn du auf einer Dev-Maschine `supabase db pull` oder `supabase db diff` machst, sollten keine Diffs entstehen — die Live-DB ist synchronisiert.

---

## Vercel-Deploy-Status (2026-05-09 abends)

Vercel-GitHub-App hatte einen Permission-Update-Pending-Status, der seit
~9-12h alle Auto-Deploys verschluckt hat. User hat Permission über
https://github.com/settings/installations/54354138/permissions/update
approved. Erste Auto-Deploys nach Approval triggern wieder.
