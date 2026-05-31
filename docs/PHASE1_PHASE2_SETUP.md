# Phase 1 + 2 Setup — was Lom selbst noch tun muss

**Code-Side ist komplett.** Diese Doku listet die externen Account-Setups
und Env-Var-Eintraege fuer die 5 neuen Features.

## 1. OpenTelemetry → Hyperdx (15 Min)

**Was es macht:** Distributed Tracing — jeder API-Call zeigt einen Span-Tree
mit Sup/Stripe/Resend als Child-Spans. Engineering-Gold.

```bash
# 1. https://app.hyperdx.io/sign-up — kostenlos, 10k Spans/Tag
# 2. Settings → API Keys → "Ingestion API Key" kopieren
# 3. In Vercel/Coolify-Env setzen:
vercel env add HYPERDX_API_KEY production
# Wert: <hyperdx-api-key>

# 4. Redeploy
vercel --prod
```

**Verifikation:** nach 2-3 Requests an osss.pro → in app.hyperdx.io
sollten Traces erscheinen. Klick auf Trace → zeigt jede DB-Query, jede
Stripe/Resend-API-Call als Span.

**Optional:** OTEL_EXPORTER_OTLP_ENDPOINT custom setzen wenn anderer
OTLP-Receiver (Grafana Tempo, Honeycomb, etc.) bevorzugt.

---

## 2. Cloudflare Turnstile (10 Min)

**Was es macht:** Unsichtbares CAPTCHA in Register-Form. 5. Bot-Defense-
Schicht nach Bot-Wave 28./29.05.

```bash
# 1. https://dash.cloudflare.com → Turnstile → Add Site
#    Domain: osss.pro
#    Widget Mode: Managed (default — unsichtbar fuer Menschen)
# 2. Site Key + Secret Key kopieren
# 3. In Vercel-Env setzen (BEIDE Werte):
vercel env add NEXT_PUBLIC_TURNSTILE_SITE_KEY production
# Wert: 0x4AAAAAAAB...

vercel env add TURNSTILE_SECRET_KEY production
# Wert: 0x4AAAAAAAB...

# 4. Redeploy
vercel --prod
```

**Verifikation:** /register → Turnstile-Widget sollte unten am Form
erscheinen. Submit ohne Widget = 400 Error "CAPTCHA-Verifizierung
fehlgeschlagen".

**Fallback:** wenn NEXT_PUBLIC_TURNSTILE_SITE_KEY nicht gesetzt, wird
das Widget nicht gerendert + Server skipt die Verifikation. Sicher fuer
Dev-Mode.

---

## 3. Playwright E2E-Tests (5 Min Setup, lokal sofort lauffaehig)

**Was es macht:** 15 Tests gegen Production oder Localhost. Fail = CI red.

```bash
# Lokal einmalig Browsers installieren
npx playwright install --with-deps chromium

# Tests gegen Production (default)
npm run test:e2e

# Tests gegen lokalen Dev-Server
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e

# UI-Mode (Debug)
npm run test:e2e:ui
```

**Optional fuer Login-Tests:**
```bash
# GitHub-Repo → Settings → Secrets:
PLAYWRIGHT_TEST_EMAIL=test+playwright@osss.pro
PLAYWRIGHT_TEST_PASSWORD=<password>

# Variables:
PLAYWRIGHT_GYM_ID=<gym-uuid-fuer-public-schedule-test>
```

CI laeuft auf jeden PR — `.github/workflows/playwright.yml`. Reports
werden als Artifact gespeichert.

---

## 4. Fast-Check Property Tests (sofort lauffaehig)

**Was es macht:** 19 Tests, 1000 random Inputs pro Property. Findet
Edge-Cases die Beispiel-Tests verpassen.

```bash
# Lokal
npm test -- tests/unit/dunning-interest.property.test.ts
npm test -- tests/unit/invoice-totals.property.test.ts
npm test -- tests/unit/pause-extension.property.test.ts

# Alle Unit-Tests
npm test
```

**Coverage:**
- Verzugszinsen § 247/288 BGB: 6 Properties (Non-Negativity, Integer-Cents,
  Monotonie mit Dauer/Forderung, Edge-Cases, BGB-Beispiel-Verifikation)
- Multi-Position-Invoice: 6 Properties (Gross = Net + Tax, Integer-Cents,
  Monotonie mit Items, leere Rechnung, MwSt-Beispiele, Steuerfrei)
- Pause-Vertragsverlaengerung: 7 Properties (Non-Negativity, Integer-Tage,
  same-day = 1, Symmetrie der Verlaengerung, Beispiele, Schaltjahr)

Falls Tests in CI failen: heisst eine Geld-Berechnung produziert für irgend-
ein zufaelliges Input ein falsches Ergebnis. **NICHT mergen** bevor gefixt.

---

## 5. GrowthBook Feature-Flags (15 Min)

**Was es macht:** Flag-Switches im Dashboard, kein Deploy noetig.
Beispiel: "punch_card_v2_enabled" → wenn Owner X aktiviert hat, zeigt
ihn das neue UI. Kein Re-Deploy fuer Rollouts.

```bash
# 1. https://app.growthbook.io/sign-up — kostenlos
# 2. SDK Connections → Create → Next.js
# 3. SDK Connection → Public Key kopieren
# 4. In Vercel-Env (BEIDE — server + client lesen die gleiche Var):
vercel env add GROWTHBOOK_SDK_KEY production
# Wert: sdk-...

vercel env add NEXT_PUBLIC_GROWTHBOOK_SDK_KEY production
# Wert: sdk-... (gleicher Wert)

# 5. Redeploy
vercel --prod
```

**Beispiel-Verwendung im Code:**
```typescript
import { isFlagOn } from '@/lib/feature-flags'

if (await isFlagOn('enable_punch_card_v2', { gym_id: gym.id })) {
  return <PunchCardV2 />
}
return <PunchCardV1 />
```

**Im GrowthBook-Dashboard:**
- Features → New Feature → `enable_punch_card_v2` → Boolean → default false
- Add Rule → Force-on fuer gym_id ∈ ["csc-ffb-uuid"] → Save
- Code-Pfade laufen ab sofort fuer dieses Gym
- Beobachten in Analytics → wenn gut: prozentualer Rollout

---

## Status nach allen 5 Setups

Wenn alle 5 Env-Vars gesetzt sind:

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY   = 0x4AAAAAAAB...
TURNSTILE_SECRET_KEY             = 0x4AAAAAAAB...
HYPERDX_API_KEY                  = <key>
GROWTHBOOK_SDK_KEY               = sdk-...
NEXT_PUBLIC_GROWTHBOOK_SDK_KEY   = sdk-...
```

→ 5 neue Production-Features aktiv:
- ✅ Bot-Defense Schicht 5 (Turnstile)
- ✅ Distributed Tracing (Hyperdx)
- ✅ 15 E2E-Tests in CI
- ✅ 19 Property-Tests vor jedem Build
- ✅ Feature-Flags fuer gradual Rollouts

**Engineering-Stack ist jetzt klar Production-grade.**
