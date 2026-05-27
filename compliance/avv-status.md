# AVV-Status (Auftragsverarbeitungsverträge nach Art. 28 DSGVO)

**Stand 2026-05-27.** Interner Status-Tracker. Bei BayLDA-Anfrage Art. 28 DSGVO-Konformität vorzulegen.

## Verantwortlicher

- **Firma:** Lom Limadaev / Osss (osss.pro)
- **Adresse:** [zu ergänzen]
- **Tätigkeit:** SaaS für Kampfsport-Gyms — Mitgliederverwaltung, Abrechnung, Buchung

## Acceptance-Status pro Auftragsverarbeiter

Jeder Anbieter hat ein Standard-DPA das per Account-Acceptance unterzeichnet wird. Wir dokumentieren hier den Acceptance-Zustand + die Vertrags-Version.

| # | Anbieter | DPA-Status | Vertragsversion / Datum | Datenkategorien | Aktion |
|---|---|---|---|---|---|
| 1 | **Stripe** | ✅ signed | Standard-DPA Stripe-Account-Acceptance (Stripe Services Agreement Sec. 5) | Stripe-Customer-ID, Subscription, Payment-Method (Last-4) — keine vollständige Karten-IBAN bei uns gespeichert | — |
| 2 | **Supabase** | 🟡 standard-DPA verfügbar, Acceptance-Bestätigung dokumentieren | https://supabase.com/legal/dpa | Member-PII (Name, Adresse, Telefon, IBAN-encrypted), auth.users | DPA-PDF in `avv-static/supabase-dpa.html` archivieren + Acceptance-Email/Snapshot beilegen |
| 3 | **Vercel** | 🟡 standard-DPA verfügbar, Acceptance-Bestätigung dokumentieren | https://vercel.com/legal/data-processing-addendum | Server-Logs, Function-Logs (PII können in Logs erscheinen, durch Sentry-Scrubbing teilweise gemildert) | DPA-Acceptance über Vercel-Dashboard → Settings → Privacy, Email-Snapshot speichern |
| 4 | **Resend** | 🟡 zu klären | https://resend.com/legal/dpa | Empfänger-Email + Mail-Body (kann PII enthalten) | DPA prüfen, ggf. Pro-Plan-Voraussetzung |
| 5 | **Sentry** | 🟡 standard-DPA verfügbar | https://sentry.io/legal/dpa/ | Error-Stacktraces — durch `beforeSend`-Scrubbing (Email/IBAN/Phone) entschärft | DPA-Acceptance über Org-Settings dokumentieren |
| 6 | **Upstash** | 🟡 standard-DPA als PDF unterzeichnen | siehe `avv-static/upstash-dpa.pdf` | Rate-Limit-Counter pro IP, kein direkter PII | PDF signieren + zurücksenden |
| 7 | **Google Cloud (Places API)** | 🟡 Standard-DPA enthalten in Google Cloud Terms | https://cloud.google.com/terms/data-processing-terms | Adress-Lookups (Gym-Standort, kein Member-PII) | Acceptance über Google Cloud Console → IAM & Admin → DPA-Status verifizieren |

## Datenkategorien pro Provider

| Provider | Member-PII | Payment-Data | Server-Logs | Email-Inhalt | Behavioral-Analytics |
|---|---|---|---|---|---|
| Supabase | ✅ (Hauptspeicher) | ✅ | ❌ | ❌ | ❌ |
| Vercel | ❌ | ❌ | ✅ | ❌ | ❌ |
| Stripe | ✅ (Subset) | ✅ (Hauptverarbeitung) | ❌ | ✅ (Receipt-Mails) | ❌ |
| Resend | ❌ | ❌ | ❌ | ✅ (Empfänger + Body) | ❌ |
| Sentry | 🟡 (durch Scrubbing reduziert) | ❌ | ✅ (Stack-Traces) | ❌ | ❌ |
| Upstash | ❌ (nur IP) | ❌ | 🟡 (Rate-Limit-Hits) | ❌ | ❌ |
| Google Cloud | ❌ | ❌ | ❌ | ❌ | 🟡 (Geo-Lookups, kein User-Kontext) |

## Sub-Prozessor-Listen (Approved)

Jeder unserer Anbieter nutzt seinerseits Sub-Prozessoren (z.B. AWS, Cloudflare). Per DSGVO Art. 28 Abs. 2 müssen wir über Änderungen informiert werden + können widersprechen.

| Provider | Sub-Prozessor-Liste | Notification-Channel | Last Reviewed |
|---|---|---|---|
| Supabase | https://supabase.com/legal/subprocessors | RSS oder Email-Subscription | 2026-05-27 |
| Vercel | https://vercel.com/legal/subprocessors | Email-Notification | 2026-05-27 |
| Stripe | https://stripe.com/legal/subprocessors | Email-Notification | 2026-05-27 |
| Sentry | https://sentry.io/legal/subprocessors/ | Email-Notification | 2026-05-27 |
| Resend | https://resend.com/legal/subprocessors | Manual Check | 2026-05-27 |

## TODOs vor erstem zahlenden Kunden

- [ ] Supabase-DPA-Acceptance über Dashboard verifizieren (Settings → Privacy/Legal), Screenshot in `avv-static/supabase-acceptance-2026-05-XX.png` archivieren
- [ ] Vercel-DPA-Acceptance über Team-Settings → Privacy verifizieren, Screenshot archivieren
- [ ] Resend Pro-Plan prüfen ob DPA-Auto-Acceptance enthalten, ansonsten Standard-DPA per Email signed-und-counter-signed
- [ ] Sentry Org-Settings → Legal → DPA-Status verifizieren
- [ ] Upstash DPA-PDF unterzeichnen + an Upstash-Legal zurücksenden
- [ ] Google Cloud DPA-Status in Console verifizieren

## Hinweis

Diese Doku ersetzt **keine Rechtsberatung**. Vor erstem zahlenden Kunden: Datenschutz-Anwalt einmalig (1-2h) prüfen lassen, ob die Acceptance-Snapshots als Art. 28-Vereinbarung ausreichen oder ob ein separater unterzeichneter Auftragsverarbeitungs-Vertrag erforderlich ist (DSGVO erlaubt elektronische Form, aber bei Audit ist papierne Vorlage praktischer).
