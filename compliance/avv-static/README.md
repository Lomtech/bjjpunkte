# AVV / DPA Static PDFs — Stand 2026-05-09

Static-Versionen der Auftragsverarbeitungsverträge (AVV / Data Processing Addendum)
aller 7 Sub-Auftragsverarbeiter, die Osss nutzt.

**Wichtig**: Diese Static-PDFs/HTMLs sind **nicht rechtsverbindlich unterschrieben** —
sie dokumentieren nur den Vertragstext, der jeweils auf der Anbieter-Webseite steht.
Sie dienen als Referenz und Best-Effort-Dokumentation für die ersten 0-5 zahlenden
Studios. Sobald MRR > 500 EUR: Plan-Upgrades + signed DPAs holen (siehe unten).

---

## Status pro Anbieter

| # | Anbieter | Static-Dokument | Signed-DPA-Pfad | Aktueller Stand |
|---|---|---|---|---|
| 1 | **Stripe** | `stripe-dpa.html` | Auto-akzeptiert beim Account-Setup | ✅ rechtsverbindlich (Stripe macht das beim Onboarding automatisch) — PDF im Stripe-Dashboard → Settings → Documents → DPA |
| 2 | **Sentry** | `sentry-dpa.html` (Version 5.1.0) | DocuSign-Link: https://sentry.zendesk.com/hc/en-us/articles/23856572755611 | 🟡 User-Aufgabe — Free Plan unterstützt DPA via DocuSign, dauert ~5 min |
| 3 | **Supabase** | `supabase-dpa.html` | PandaDoc — nur Pro-Plan | 🔴 Free-Plan-Limit — Upgrade nötig bei erstem zahlenden Studio |
| 4 | **Vercel** | `vercel-dpa.html` | Settings → Legal — nur Pro-Plan | 🔴 Hobby-Plan-Limit — Upgrade nötig bei erstem zahlenden Studio |
| 5 | **Resend** | `resend-dpa.html` | Email an `legal@resend.com` mit „Bitte signed AVV/DPA für Account [deine Email]" | 🟡 User-Aufgabe — Email senden, Signed-PDF zurück erwarten |
| 6 | **Upstash** | `upstash-dpa.pdf` (offizielle PDF) | PDF unterschreiben + an `support@upstash.com` mailen | 🟡 User-Aufgabe — PDF ist hier im Ordner, einfach signen + mailen |
| 7 | **Google Cloud** (Places API) | `google-cloud-dpa.html` | Google Cloud Console → IAM & Admin → Data Processing Addendum → Accept | 🟡 User-Aufgabe — Click-to-accept im Console |

---

## Reihenfolge (was der User selbst macht)

### Sofort (~30 Minuten)

1. **Sentry**: Öffne https://sentry.zendesk.com/hc/en-us/articles/23856572755611 → DocuSign-Link folgen → Felder ausfüllen → DocuSign-signen
2. **Resend**: Email an `legal@resend.com` mit Subject „DPA Request — Account [deine Email]" und Body „Bitte signed AVV/DPA für unseren Account schicken"
3. **Upstash**: `upstash-dpa.pdf` öffnen → ausdrucken oder digital signieren → an `support@upstash.com` mailen
4. **Google Cloud**: https://console.cloud.google.com → IAM & Admin → Data Processing Addendum → Akzeptieren

### Bei erstem zahlenden Studio (~50 EUR Plan-Upgrade-Cost gerechtfertigt)

5. **Supabase Pro Plan** ($25/Monat): https://supabase.com/dashboard/org/vzxfhidhzjgoctruymzq/billing → Change subscription plan → Pro → nach Upgrade: Settings → Legal Documents → DPA via PandaDoc anfordern
6. **Vercel Pro Plan** ($20/Monat): https://vercel.com/lomtechs-projects/~/settings/billing → Upgrade → nach Upgrade: Settings → Legal → DPA akzeptieren

---

## Speicher-Konvention

- `*.pdf` / `*.html` in diesem Ordner = unsigned static text (Referenz)
- Sobald signed: PDF mit Suffix `-signed.pdf` ablegen (z.B. `sentry-dpa-signed.pdf`)
- Im Verarbeitungsverzeichnis (`compliance/verarbeitungsverzeichnis.md`) Datum + Pfad zur signed-PDF eintragen

`.gitignore` hat `/compliance/avv/` drin — die signed PDFs sollten in diesem Pfad landen,
NICHT in `/compliance/avv-static/` (das ist Public-Vertragstext, der ist OK im Repo).

---

## Rechtliche Anmerkung

DSGVO Art. 28 verlangt einen schriftlichen oder elektronischen AVV. Bei einem Behörden-
Audit ohne signed DPA argumentierst du:
1. „Der Anbieter bietet signed DPA nur ab Plan-Upgrade"
2. „Der Vertragstext ist identisch zwischen allen Plans"
3. „Upgrade ist geplant sobald Customer-Volume es rechtfertigt"

Das mildert das Bußgeld erheblich, eliminiert es aber nicht. Bei MRR > 500 EUR ist
Pro-Upgrade die einzig saubere Lösung — kostet ~45 EUR/Mo bei Vercel + Supabase.
