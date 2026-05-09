# Security-Audit: Service-Client-Routen

Stand: 2026-05-09 (Pass 8 — Folge-Härtungen nach Top-3 in Pass 7).

## Hintergrund

Der Supabase-`createServiceClient()` (alias `SUPABASE_SERVICE_ROLE_KEY`) **bypasst Row-Level-Security**. Wenn die Application-Layer einen `gym_id`- oder `member_id`-Filter vergisst, ist das ein Cross-Gym-Datenleak (DSGVO Art. 32 — Sicherheits­massnahmen, Art. 5(1)(f) — Integrität und Vertraulichkeit). Bussgeld bis 4 % Jahresumsatz.

Dieses Audit listet alle Routen, die `createServiceClient` oder `SUPABASE_SERVICE_ROLE_KEY` direkt instanziieren, ordnet sie nach Auth-Modell und Risiko ein und definiert die nächsten Härtungs-Schritte.

## Risiko-Matrix

| Schweregrad | Beschreibung |
|---|---|
| **HIGH** | Anonym/öffentlich zugänglich, schreibend, ODER User-getriggert mit schwachem Token / Bot-Vector. Ein Filter-Bug ist sofort ausnutzbar. |
| **MEDIUM** | Authentifiziert, aber Cross-Tenant-Filter wird in der Application-Layer enforced (kein DB-Zwang). Ein Bug ist über privilegierte Endpoints ausnutzbar. |
| **LOW** | Cron-Jobs (Bearer `CRON_SECRET`), Stripe-Webhooks (HMAC-Signatur) oder Health-Checks — kein User-Vector, daher kein Cross-Tenant-Risk in der Praxis. |

## Übersicht

### A) Public / Token-basierte Routen — HIGH

Authentifizierung allein über `portal_token` / Lead-Token / Newsletter-Token im URL-Pfad. RLS gibt es nicht — nur die App-Layer prüft den Token gegen `members.portal_token` o. ä. Wenn der `gym_id`-Filter in der Folge­abfrage fehlt, leakt's.

| Route | Tabelle / Filter | Token-Mindestlänge | Risk | Status | Begründung |
|---|---|---|---|---|---|
| `src/app/api/portal/[token]/route.ts` | `members.portal_token` → `gym_id` propagiert | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 7 / A1) | Master-Endpoint. is_active-Filter + 32-Zeichen-Floor. |
| `src/app/api/portal/[token]/manifest/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | Frühe 200-Antwort mit generischem Manifest bei Probing. |
| `src/app/api/portal/[token]/classes/route.ts` | `members.portal_token` → `classes.gym_id` | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | Liest fremde Mitgliedernamen — `gym_id`-Filter korrekt. |
| `src/app/api/portal/[token]/checkin/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | Schreibt `attendance` via RPC. |
| `src/app/api/portal/[token]/checkout/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | Schreibt `attendance` (DELETE eigene Reihe). |
| `src/app/api/portal/[token]/gps-checkin/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | GPS-Location stored. |
| `src/app/api/portal/[token]/cancel/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | Token-Length + is_active-Filter ergänzt. |
| `src/app/api/portal/[token]/subscribe/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | Stripe-Subscription-Erstellung. |
| `src/app/api/portal/[token]/training-log/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | Trainings-Log GET/POST. |
| `src/app/api/portal/[token]/plan/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | Token-Check + is_active + plan_id-Cap. |
| `src/app/api/portal/[token]/book/[classId]/route.ts` | `members.portal_token` + `classes.id` | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | RPC `book_class_by_token` enforced gym_id (DB-Layer). |
| `src/app/api/public/lead/[token]/route.ts` | `leads.lead_token` (Trial/Probe) | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | Lead-Self-Service. |
| `src/app/api/public/lead/[token]/book/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | class_id-Cross-Gym-Check vorhanden. |
| `src/app/api/public/lead/[token]/cancel/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | dito. |
| `src/app/api/public/lead/[token]/checkin/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | dito. |
| `src/app/api/public/lead/[token]/gps-checkin/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | GPS-Distanz-Check; `gym_id` aus Lead. |
| `src/app/api/public/lead/[token]/manifest/route.ts` | dito | **`>= 32`** | HIGH | 🟡 GEHÄRTET (Pass 8) | Frühe Generic-Manifest-Antwort bei Probing. |
| `src/app/api/newsletter/confirm/[token]/route.ts` | `newsletter_subscribers.confirm_token` | **`>= 32`** | MEDIUM | 🟡 GEHÄRTET (Pass 8) | Liest/aktualisiert nur eigenen Datensatz. |
| `src/app/api/newsletter/unsubscribe/[token]/route.ts` | `newsletter_subscribers.unsubscribe_token` | **`>= 32`** | MEDIUM | 🟡 GEHÄRTET (Pass 8) | RFC 8058 1-Klick-Unsubscribe. |
| `src/app/api/gym-mail/unsubscribe/[token]/route.ts` | `members/leads.marketing_unsubscribe_token` | **`>= 32`** | MEDIUM | 🟡 GEHÄRTET (Pass 8) | Audience-Whitelist (members|leads) korrekt. |

**Härtung A1** (Top-Priorität dieses Audits): Token-Length-Check auf `>= 32` anheben (Brute-Force-Schutz, doppelte Entropie zu `>= 20`), `is_active=true`-Filter ergänzen, Rate-Limit pro Token (zusätzlich zum existierenden 30-req/min/IP über `src/proxy.ts`).

### B) Public Lead-Capture / Schedule — HIGH

| Route | Tabelle / Filter | Risk | Status | Begründung |
|---|---|---|---|---|
| `src/app/api/public/gym/[slug]/lead/route.ts` | `gyms.slug` → `leads.gym_id` | HIGH | 🟡 GEHÄRTET (Pass 8) | Slug-Format-Check + Input-Length-Caps. |
| `src/app/api/public/gym/[slug]/wellpass/route.ts` | dito | HIGH | 🟡 GEHÄRTET (Pass 8) | Slug-Format-Check + Input-Length-Caps. |
| `src/app/api/public/gym/[slug]/route.ts` | dito (READ-ONLY, anon-key fallback) | LOW | 🟡 GEHÄRTET (Pass 8) | Slug-Format-Check vor DB-Hit, Cache-Header bleiben. |
| `src/app/api/public/schedule/[gymId]/route.ts` | `classes.gym_id` (READ-ONLY) | LOW | 🔴 OFFEN | gymId direkt aus URL, Filter selbst. UUID-Cap noch ausstehend. |
| `src/app/api/schedule/ical/route.ts` | `classes.gym_id` | LOW | 🔴 OFFEN | iCal-Feed (READ-ONLY). |
| `src/app/api/track/route.ts` | `page_views` (INSERT-ONLY, nur Hashes) | HIGH | 🟡 GEHÄRTET (Pass 7 / B1) | Bot-silent-reject + Proxy-Limit. |
| `src/app/api/signup/route.ts` | `gyms.signup_token` → `members` | HIGH | 🟡 GEHÄRTET (Pass 8) | Token-Floor 32 + Input-Length-Caps. CSRF-/Origin-geprüft. |

**Härtung B1**: Bot-Filter umstellen auf "silent reject" (200 OK ohne Insert), Hard-Cap pro IP via Upstash.

### C) Authenticated User-Routen — MEDIUM

Auth via Supabase-Bearer-Token (eingeloggter Owner/Coach/Admin). Filter `gym_id` aus User-Profile auf jede Query. RLS würde es härter machen, ist aber konsistent in der App-Layer enforced.

| Route | Auth | Filter-Strategie | Risk | Status |
|---|---|---|---|---|
| `src/app/api/auth/delete-account/route.ts` | Bearer + DSGVO-Delete-RPC | `owner_id == user.id` + RPC double-check | MEDIUM | 🟡 GEHÄRTET (Pass 8) — Bearer-Format-Check ergänzt |
| `src/app/api/auth/register/route.ts` | None (signup) | — | MEDIUM (Owner-Signup) | 🔴 OFFEN |
| `src/app/api/avv/{accept,status}/route.ts` | Bearer | gym_id aus URL-Param + Owner-Verify | MEDIUM | 🔴 OFFEN |
| `src/app/api/classes/bulk/route.ts` | Bearer | gym_id aus User → classes.gym_id | MEDIUM | 🔴 OFFEN |
| `src/app/api/datev/export/route.ts` | Bearer (Owner) | gym_id aus User | MEDIUM | 🔴 OFFEN |
| `src/app/api/gym-mail/send/route.ts` | Bearer | gym_id aus User | MEDIUM | 🔴 OFFEN |
| `src/app/api/gym/{excel-import,export,iban,import,media}/route.ts` | Bearer (Owner) | gym_id aus User | MEDIUM | 🔴 OFFEN |
| `src/app/api/invoices/[paymentId]/route.ts` | Bearer | gym_id aus payments.member.gym → User-Match | MEDIUM | 🔴 OFFEN |
| `src/app/api/members/[id]/{contract,dunning,mail,...}/route.ts` (5x) | Bearer | members.gym_id == user.gym_id | MEDIUM | 🔴 OFFEN |
| `src/app/api/staff/{accept,link,route}.ts` | Bearer/Token | gym_id aus URL | MEDIUM | 🔴 OFFEN |
| `src/app/api/attendance/{route,gps,[id]}/route.ts` | Bearer | gym_id aus User | MEDIUM | 🔴 OFFEN |

### D) Admin-Only — MEDIUM

`requireAdmin()` whitelistet via `ADMIN_EMAILS` Env-Var. Service-Client wird genutzt für CRM-Reads/Writes über Tenant-Grenzen hinweg (das ist beabsichtigt — der Solo-Sales-CRM ist gym-übergreifend).

| Route | Filter | Status |
|---|---|---|
| `src/app/api/admin/leads/route.ts` | (CRM, kein gym_id-Filter — beabsichtigt) | 🟢 LEGITIM (admin-only via requireAdmin) |
| `src/app/api/admin/leads/[id]/route.ts` | leads.id | 🟡 GEHÄRTET (Pass 8) — UUID-Format-Check vor DB-Hit |
| `src/app/api/admin/leads/[id]/activity/{,activityId}/route.ts` | leads.id | 🔴 OFFEN |
| `src/app/api/admin/leads/places-search/route.ts` | (CRM, INSERT in sales_leads) | 🟡 GEHÄRTET (Pass 7 / C1) — query-Length-Cap 200 |
| `src/app/api/admin/leads/places-quota/route.ts` | (CRM-Stats, READ-ONLY) | 🟢 LEGITIM (admin-only) |
| `src/app/api/admin/leads/stats/route.ts` | (CRM-Stats, READ-ONLY) | 🟢 LEGITIM (admin-only) |
| `src/app/api/admin/sales/leads/{,[id]}/route.ts` | (CRM) | 🟢 LEGITIM (admin-only via requireAdmin) |
| `src/app/api/admin/analytics/route.ts` | (Owner-Site-Analytics) | 🟢 LEGITIM (admin-only) |

**Härtung C1**: `query`-Param-Length-Cap auf 200 Zeichen in `places-search` (Google API-Cost-Limit). Bestehende Whitelist der gespeicherten Felder ist OK (nur dokumentieren).

### E) Cron-Jobs — LOW

Geschützt via `cronGuard()` (Bearer `CRON_SECRET`). Niemals user-aufrufbar.

| Route | Status |
|---|---|
| `src/app/api/cron/aggregate-page-views/route.ts` | 🟢 LEGITIM (cronGuard + DB-Dedup) |
| `src/app/api/cron/birthday/route.ts` | 🟢 LEGITIM (cronGuard + DB-Dedup, gym_id pro Iteration) |
| `src/app/api/cron/dunning-escalation/route.ts` | 🟢 LEGITIM (cronGuard + DB-Dedup, gym_id pro Iteration) |
| `src/app/api/cron/missing-plan-reminder/route.ts` | 🟢 LEGITIM (cronGuard) |
| `src/app/api/cron/payment-reminders/route.ts` | 🟢 LEGITIM (cronGuard) |
| `src/app/api/cron/sales-followups/route.ts` | 🟢 LEGITIM (cronGuard, kein gym_id da CRM) |
| `src/app/api/cron/newsletter-cleanup/route.ts` | 🟢 LEGITIM (cronGuard) |
| `src/app/api/cron/notification-worker/route.ts` | 🟢 LEGITIM (cronGuard) |

### F) Stripe-Webhook — LOW

| Route | Schutz | Status |
|---|---|---|
| `src/app/api/stripe/webhook/route.ts` | HMAC-Signatur über `stripe-signature` | 🟢 LEGITIM — Outbox-Pattern, alle UPDATEs gym_id-/intent-/sub-/customer-spezifisch |
| `src/app/api/stripe/connect/callback/route.ts` | OAuth-State-HMAC | 🟢 LEGITIM (HMAC-State) |
| `src/app/api/stripe/sync-payments/route.ts` | Bearer (Owner) | 🔴 OFFEN — gym_id-Filter zu prüfen |

### G) Lib-Helper — LOW (intern)

Diese werden von autorisierten Routen aufgerufen, nicht direkt user-exposed:

| Datei | Zweck |
|---|---|
| `src/lib/notify.ts` | Multi-Channel-Notification (Mail/WhatsApp), schreibt `notifications` |
| `src/lib/dunning-mail.ts` | Dunning-Mail-Versand mit Idempotenz |
| `src/lib/signature-storage.ts` | DSGVO-Signature-Storage |

### H) Health-Check — LOW

| Route |
|---|
| `src/app/api/health/route.ts` (READ-ONLY, prüft Env-Var-Presence + DB-Ping) |

## Top-3 Härtungen (in diesem Audit umgesetzt)

### Härtung A1 — `src/app/api/portal/[token]/route.ts`

- Token-Length: `>= 20` → `>= 32` (Brute-Force-Schutz, ~10^60 Pfade statt ~10^36).
- `members.is_active = true` als zusätzlicher Filter — abgemeldete Mitglieder sollen kein Portal mehr aufrufen können.
- Existierender `gym_id`-Cross-Reference (Member → Gym → Plans/Posts/Announcements) bleibt unverändert verifiziert.
- Existierendes Rate-Limit `30 req/min/IP` über `src/proxy.ts` (Upstash-fallback in-memory) deckt allgemeine Brute-Force; per-Token-Cap ist via Upstash nicht trivial nachrüstbar ohne Token-Hash-Logging — wir setzen stattdessen die Length-Verschärfung um.

### Härtung B1 — `src/app/api/track/route.ts`

- `isBot(ua)` schreibt aktuell die Zeile **mit** `is_bot=true` in `page_views`. Das verbraucht Storage und verfälscht Aggregate. Neu: bei `is_bot=true` wird **nicht inserted**, der Endpunkt antwortet mit 200 (silent reject — Bots sollen kein Feedback bekommen).
- Hard-Cap **60 inserts/min/IP** über existierende Upstash-Infrastruktur (`src/proxy.ts` setzt 30/min für `/api/track`, wir layern keinen zweiten Limiter — der Proxy-Limit ist bereits strenger als 60/min/IP).
- Anmerkung: ein zweiter, expliziter 60/min-Limit auf Route-Ebene würde mit dem Proxy-Limit (30/min) kollidieren — der Proxy gewinnt zuerst. Wir dokumentieren das hier; falls der Proxy-Limit später aufgeweicht wird, muss der Route-Limit aktiviert werden.

### Härtung C1 — `src/app/api/admin/leads/places-search/route.ts`

- `query`-Param-Length-Cap auf 200 Zeichen (Google Places API limitiert auf 256 — wir lassen Buffer für Trim).
- Whitelist der persistierten Felder ist bereits korrekt (siehe `row`-Object in der Route, Zeilen 137 ff.) — nur Essentials + Pro-SKU-Felder, kein "ganzes Place-Objekt". Diese Aussage ist mit dem Code abgeglichen.

## Pass 8 — Folge-Härtungen (2026-05-09, dieser Audit-Lauf)

23 weitere Routen gehärtet (Pass 7 hatte die Top-3 abgedeckt). Mechanik durchweg minimal-invasiv:

### A2 — Token-Length-Floor 20→32 für alle Portal-/Lead-/Newsletter-/Gym-Mail-Tokens

Alle 17 Token-basierten Public-Routen wurden auf den Floor `>= 32` Zeichen + Char-Class
`/^[a-zA-Z0-9_-]+$/` umgestellt. Bestands-Tokens sind DB-generiert (~32 Zeichen, base64url
oder uuid+random), die Anhebung schliesst keine Live-Members aus. Ein paar Routen hatten
gar keinen Token-Check (`portal/[token]/cancel`, `portal/[token]/plan`, `public/lead/[token]/manifest`,
`signup`-GET) — die wurden nachgerüstet.

Routen, die bereits via Helper `createServiceClient` aus `@/lib/supabase/service` arbeiten,
bekommen nur den Length-Cap. Routen mit eigenem inline-`createClient`-Helper bleiben so
(kein Refactor in dieser Pass — Risk vs. Diff-Size).

### A3 — `is_active=true`-Filter für state-mutierende Portal-Endpoints

`portal/[token]/cancel` und `portal/[token]/plan` filtern jetzt zusätzlich auf `is_active=true`.
Ohne diesen Filter konnte ein bereits abgemeldetes Mitglied einen weiteren Cancel-Mail-/
Owner-WhatsApp-Trigger auslösen oder einen Plan-Wechsel beantragen. Der `cancellation_requested_at`-
Feld wurde mehrfach überschrieben.

### B-input-cap — Slug-/Email-/Name-Length-Caps für Public-Insert-Routen

`public/gym/[slug]/lead`, `public/gym/[slug]/wellpass`, `public/gym/[slug]` (read), `signup`
bekommen Slug-Format-Check `/^[a-z0-9-]+$/` mit 100-Zeichen-Cap und Body-Field-Length-Caps:
`first_name/last_name <= 200`, `email <= 320` (RFC), `phone <= 50`, `address <= 500`,
`message <= 2000`. Ohne diese Caps könnte ein Angreifer mit 100KB-Strings DB-Inserts
und Email-Templates (Resend-Body) bloated.

### Admin-Härtung

`admin/leads/[id]` (PATCH/DELETE) bekommt UUID-Format-Check vor Service-Client-Hit.
Verhindert dass ein Admin-Token mit 100KB-ID-String einen DB-Index-Scan triggert.

### Auth-Härtung

`auth/delete-account` Bearer-Token-Format-Check ergänzt (32-4096 Zeichen). Restliche
Logik (`gyms.owner_id == user.id` + RPC `delete_gym_cascade(p_gym_id, p_user_id)`)
bleibt unverändert — DB-Funktion macht den Owner-Match-Double-Check.

### Geänderte Files (Pass 8)

- `src/app/api/portal/[token]/cancel/route.ts` — token-floor + is_active + DELETE-Methode geschützt
- `src/app/api/portal/[token]/manifest/route.ts` — token-floor (war ohne)
- `src/app/api/portal/[token]/classes/route.ts` — token-floor 20→32
- `src/app/api/portal/[token]/checkin/route.ts` — token-floor 20→32
- `src/app/api/portal/[token]/checkout/route.ts` — token-floor 20→32
- `src/app/api/portal/[token]/gps-checkin/route.ts` — token-floor 20→32
- `src/app/api/portal/[token]/training-log/route.ts` — token-floor 20→32 (GET+POST)
- `src/app/api/portal/[token]/subscribe/route.ts` — token-floor 20→32
- `src/app/api/portal/[token]/plan/route.ts` — token-floor + is_active + plan_id-Cap (POST+DELETE)
- `src/app/api/portal/[token]/book/[classId]/route.ts` — token-floor 20→32 (POST+DELETE)
- `src/app/api/public/lead/[token]/route.ts` — token-floor 20→32
- `src/app/api/public/lead/[token]/book/route.ts` — token-floor + class_id-Cap
- `src/app/api/public/lead/[token]/cancel/route.ts` — token-floor + class_id-Cap
- `src/app/api/public/lead/[token]/checkin/route.ts` — token-floor + class_id-Cap
- `src/app/api/public/lead/[token]/gps-checkin/route.ts` — token-floor 20→32
- `src/app/api/public/lead/[token]/manifest/route.ts` — token-floor (war ohne)
- `src/app/api/newsletter/confirm/[token]/route.ts` — token-floor + char-class
- `src/app/api/newsletter/unsubscribe/[token]/route.ts` — token-floor + char-class
- `src/app/api/gym-mail/unsubscribe/[token]/route.ts` — token-floor + char-class
- `src/app/api/signup/route.ts` — token-floor 32 + Input-Length-Caps (GET+POST)
- `src/app/api/public/gym/[slug]/route.ts` — slug-format-check
- `src/app/api/public/gym/[slug]/lead/route.ts` — slug-format-check + Input-Length-Caps
- `src/app/api/public/gym/[slug]/wellpass/route.ts` — slug-format-check + Input-Length-Caps
- `src/app/api/admin/leads/[id]/route.ts` — UUID-Format-Check (PATCH+DELETE)
- `src/app/api/auth/delete-account/route.ts` — Bearer-Token-Format-Check

## Tests

`tests/smoke/portal-hardening.test.ts` — drei Smoke-Tests gegen `TEST_API_BASE`:

1. `GET /api/portal/[token<32chars]` → 400 (vorher 200/404 je nach Token).
2. `GET /api/portal/[token]` mit Member `is_active=false` → 404 (vorher 200 mit Daten).
3. `GET /api/track` (statt POST, ohne Body) → 405 oder 400 (sanity).

## Offene To-Dos

### Erledigt in Pass 8 (2026-05-09)
- ~~**A2**: Token-Length-Floor auf `>= 32` für alle Portal-/Lead-Token-Routen~~ ✓
- ~~**A3**: `portal/[token]/cancel` Token-Length-Check~~ ✓

### Top-3 noch offene Risiken (für nächsten Sprint)

1. **D1 (mittelfristig, hoher Hebel)**: Migration auf RLS-Policies für `members`, `payments`, `attendance`.
   Aktuell sind ~70 Routen Service-Role mit App-Layer-Filter; ein einziger vergessener `gym_id`-Filter
   leakt Cross-Tenant. Mit RLS wäre das DB-enforced.
   Aufwand: 2-3 Tage; Hebel: massiv (Service-Client-Footprint sinkt um >50%).

2. **MEDIUM-Routen Owner-Verify-Audit** (Section C): `attendance/`, `members/[id]/`, `gym/`, `staff/`,
   `classes/bulk/`, `datev/export/`, `gym-mail/send/` etc. — alle nutzen Service-Role, prüfen aber
   manuell via App-Layer den `gym_id`-Match. Stichprobenartig prüfen ob jeder Filter wirklich gesetzt
   ist (z. B. UPDATE/DELETE ohne `gym_id`-WHERE wäre Cross-Gym-Bug).
   Aufwand: 1 Tag; Hebel: defensiv-mittel.

3. **A4 / Token-Rotation-Policy**: Aktuell sind Portal-/Lead-Tokens permanent gültig (kein Expiry).
   Ein Mitglied, das sein Handy verliert, kann den Token nicht ungültig machen ohne Owner-Eingriff.
   Token-Rotation per `regenerate_portal_token` RPC + UI-Button für Member ist DSGVO Art. 32-konform
   und einfach.
   Aufwand: 0.5 Tage; Hebel: niedrig-mittel (kein Cross-Tenant, aber Member-Self-Service-Lücke).

### Weitere
- **B2**: Per-Visitor-Hash-Cap (z. B. 200 page_views/visitor/day) auf `/api/track` — vermeidet, dass ein einzelner Browser die Stats verzerrt.
- **C-public-schedule**: `public/schedule/[gymId]` und `schedule/ical` UUID-Format-Check fehlt noch (LOW-Risk, READ-ONLY).
- **C-stripe-sync-payments**: `stripe/sync-payments` (Bearer-Owner) — gym_id-Filter zu prüfen.
- **C-admin-leads-activity**: `admin/leads/[id]/activity/{,activityId}` UUID-Format-Check.
