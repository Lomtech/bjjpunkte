# Security-Audit: Service-Client-Routen

Stand: 2026-05-09 (Commit-Range vor "audit-hardening").

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

| Route | Tabelle / Filter | Token-Mindestlänge | Risk | Begründung |
|---|---|---|---|---|
| `src/app/api/portal/[token]/route.ts` | `members.portal_token` → `gym_id` propagiert | `>= 20` (zu schwach) | **HIGH** | Master-Endpoint des Mitglieder-Portals. Liefert Zahlungs­historie, Beitritts­datum, Adresse-äquivalente Daten. Token-Brute-Force möglich. **Härtung A1.** |
| `src/app/api/portal/[token]/manifest/route.ts` | dito | dito | HIGH | Liefert Gym-Name und accent_color — geringe Hebel, aber Token-Validation lax. |
| `src/app/api/portal/[token]/classes/route.ts` | `members.portal_token` → `classes.gym_id` | `>= 20` | HIGH | Liest fremde Mitgliedernamen über `class_bookings.members(...)`. Filter `eq('gym_id', member.gym_id)` korrekt. |
| `src/app/api/portal/[token]/checkin/route.ts` | dito | `>= 20` | HIGH | Schreibt `attendance`. |
| `src/app/api/portal/[token]/checkout/route.ts` | dito | `>= 20` | HIGH | Schreibt `attendance`. |
| `src/app/api/portal/[token]/gps-checkin/route.ts` | dito | `>= 20` | HIGH | GPS-Location wird gespeichert. |
| `src/app/api/portal/[token]/cancel/route.ts` | dito | (keine Length-Validation!) | HIGH | Setzt `cancellation_requested_at`. **Token-Length-Check fehlt komplett.** |
| `src/app/api/portal/[token]/subscribe/route.ts` | dito | `>= 20` | HIGH | Erstellt Stripe-Subscription. |
| `src/app/api/portal/[token]/training-log/route.ts` | dito | `>= 20` | HIGH | Trainings-Log GET/POST. |
| `src/app/api/portal/[token]/plan/route.ts` | dito | (in Portal-Context) | HIGH | Plan-Wechsel. |
| `src/app/api/portal/[token]/book/[classId]/route.ts` | `members.portal_token` + `classes.id` | (zu prüfen) | HIGH | Klassen-Buchung. Cross-Gym-Risk wenn classId/gym_id nicht abgeglichen werden. |
| `src/app/api/public/lead/[token]/route.ts` | `leads.portal_token` (Trial/Probe) | (zu prüfen) | HIGH | Lead-Self-Service. |
| `src/app/api/public/lead/[token]/{book,cancel,checkin,gps-checkin,manifest}/route.ts` | dito | (zu prüfen) | HIGH | Lead-Token-Operationen. |
| `src/app/api/newsletter/{confirm,unsubscribe}/[token]/route.ts` | `newsletter_subscribers.token` | (zu prüfen) | MEDIUM | Liest/aktualisiert nur eigenen Datensatz. |
| `src/app/api/gym-mail/unsubscribe/[token]/route.ts` | `gym_mail_unsub_tokens.token` | (zu prüfen) | MEDIUM | Unsubscribe-Token. |

**Härtung A1** (Top-Priorität dieses Audits): Token-Length-Check auf `>= 32` anheben (Brute-Force-Schutz, doppelte Entropie zu `>= 20`), `is_active=true`-Filter ergänzen, Rate-Limit pro Token (zusätzlich zum existierenden 30-req/min/IP über `src/proxy.ts`).

### B) Public Lead-Capture / Schedule — HIGH

| Route | Tabelle / Filter | Risk | Begründung |
|---|---|---|---|
| `src/app/api/public/gym/[slug]/lead/route.ts` | `gyms.slug` → `leads.gym_id` | HIGH | Anonymes Lead-Insert. Slug ist leakable (= URL), aber `gym_id` wird aus `gyms`-Lookup gezogen. |
| `src/app/api/public/gym/[slug]/wellpass/route.ts` | dito | HIGH | Wellpass-Anmeldung. Schreibt `members` mit Vorname/Nachname/Email. |
| `src/app/api/public/gym/[slug]/route.ts` | dito (READ-ONLY, nutzt anon-key fallback) | LOW | Public-Gym-Profil-Lookup. |
| `src/app/api/public/schedule/[gymId]/route.ts` | `classes.gym_id` (READ-ONLY) | LOW | Public Schedule, gymId direkt aus URL, ist selbst der Filter. |
| `src/app/api/schedule/ical/route.ts` | `classes.gym_id` | LOW | iCal-Feed (READ-ONLY). |
| `src/app/api/track/route.ts` | `page_views` (INSERT-ONLY, nur Hashes) | **HIGH** | DSGVO-anonym (Hashes), aber **bot-INSERTs werden gespeichert statt rejected**. Hard-Cap pro IP/min fehlt. **Härtung B1.** |
| `src/app/api/signup/route.ts` | `gyms.slug` → `members` | HIGH | Owner-Signup, schreibt `gyms` + `gym_owners`. CSRF-/Origin-geprüft. |

**Härtung B1**: Bot-Filter umstellen auf "silent reject" (200 OK ohne Insert), Hard-Cap pro IP via Upstash.

### C) Authenticated User-Routen — MEDIUM

Auth via Supabase-Bearer-Token (eingeloggter Owner/Coach/Admin). Filter `gym_id` aus User-Profile auf jede Query. RLS würde es härter machen, ist aber konsistent in der App-Layer enforced.

| Route | Auth | Filter-Strategie | Risk |
|---|---|---|---|
| `src/app/api/auth/delete-account/route.ts` | Bearer + DSGVO-Delete-RPC | gym_id aus user.id → gyms-Lookup | MEDIUM |
| `src/app/api/auth/register/route.ts` | None (signup) | — | MEDIUM (Owner-Signup) |
| `src/app/api/avv/{accept,status}/route.ts` | Bearer | gym_id aus URL-Param + Owner-Verify | MEDIUM |
| `src/app/api/classes/bulk/route.ts` | Bearer | gym_id aus User → classes.gym_id | MEDIUM |
| `src/app/api/datev/export/route.ts` | Bearer (Owner) | gym_id aus User | MEDIUM |
| `src/app/api/gym-mail/send/route.ts` | Bearer | gym_id aus User | MEDIUM |
| `src/app/api/gym/{excel-import,export,iban,import,media}/route.ts` | Bearer (Owner) | gym_id aus User | MEDIUM |
| `src/app/api/invoices/[paymentId]/route.ts` | Bearer | gym_id aus payments.member.gym → User-Match | MEDIUM |
| `src/app/api/members/[id]/{contract,dunning,mail,...}/route.ts` (5x) | Bearer | members.gym_id == user.gym_id | MEDIUM |
| `src/app/api/staff/{accept,link,route}.ts` | Bearer/Token | gym_id aus URL | MEDIUM |
| `src/app/api/attendance/{route,gps,[id]}/route.ts` | Bearer | gym_id aus User | MEDIUM |

### D) Admin-Only — MEDIUM

`requireAdmin()` whitelistet via `ADMIN_EMAILS` Env-Var. Service-Client wird genutzt für CRM-Reads/Writes über Tenant-Grenzen hinweg (das ist beabsichtigt — der Solo-Sales-CRM ist gym-übergreifend).

| Route | Filter |
|---|---|
| `src/app/api/admin/leads/route.ts` | (CRM, kein gym_id-Filter — beabsichtigt) |
| `src/app/api/admin/leads/[id]/route.ts` | leads.id |
| `src/app/api/admin/leads/[id]/activity/{,activityId}/route.ts` | leads.id |
| `src/app/api/admin/leads/places-search/route.ts` | (CRM, INSERT in sales_leads) — **siehe Härtung C1** |
| `src/app/api/admin/leads/places-quota/route.ts` | (CRM-Stats, READ-ONLY) |
| `src/app/api/admin/leads/stats/route.ts` | (CRM-Stats, READ-ONLY) |
| `src/app/api/admin/sales/leads/{,[id]}/route.ts` | (CRM) |
| `src/app/api/admin/analytics/route.ts` | (Owner-Site-Analytics) |

**Härtung C1**: `query`-Param-Length-Cap auf 200 Zeichen in `places-search` (Google API-Cost-Limit). Bestehende Whitelist der gespeicherten Felder ist OK (nur dokumentieren).

### E) Cron-Jobs — LOW

Geschützt via `cronGuard()` (Bearer `CRON_SECRET`). Niemals user-aufrufbar.

| Route |
|---|
| `src/app/api/cron/aggregate-page-views/route.ts` |
| `src/app/api/cron/birthday/route.ts` |
| `src/app/api/cron/dunning-escalation/route.ts` |
| `src/app/api/cron/missing-plan-reminder/route.ts` |
| `src/app/api/cron/payment-reminders/route.ts` |
| `src/app/api/cron/sales-followups/route.ts` |

### F) Stripe-Webhook — LOW

| Route | Schutz |
|---|---|
| `src/app/api/stripe/webhook/route.ts` | HMAC-Signatur über `stripe-signature` (kein normaler Cross-Site-Vector) |
| `src/app/api/stripe/connect/callback/route.ts` | OAuth-State-HMAC |
| `src/app/api/stripe/sync-payments/route.ts` | Bearer (Owner) |

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

## Tests

`tests/smoke/portal-hardening.test.ts` — drei Smoke-Tests gegen `TEST_API_BASE`:

1. `GET /api/portal/[token<32chars]` → 400 (vorher 200/404 je nach Token).
2. `GET /api/portal/[token]` mit Member `is_active=false` → 404 (vorher 200 mit Daten).
3. `GET /api/track` (statt POST, ohne Body) → 405 oder 400 (sanity).

## Offene To-Dos (nicht in diesem Audit)

- **A2**: Alle anderen Portal-/Lead-Token-Routen auf `>= 32` umstellen (siehe Tabelle A — 9 Routen). Identische Mechanik wie A1.
- **A3**: `src/app/api/portal/[token]/cancel/route.ts` hat keinen Token-Length-Check — nachrüsten.
- **A4**: Migration `members.portal_token` validieren — alle existierenden Tokens sind aktuell schon DB-generiert mit ~32 Zeichen, daher sollte A2 keine Bestands­mitglieder ausschliessen.
- **B2**: Per-Visitor-Hash-Cap (z. B. 200 page_views/visitor/day) auf `/api/track` — vermeidet, dass ein einzelner Browser die Stats verzerrt.
- **D1**: Weiterhin sukzessive auf RLS-policies migrieren (DB-enforced statt App-enforced), insbesondere für `members`, `payments`, `attendance`. Reduziert Service-Client-Footprint mittelfristig.
