# Inngest Cutover-Playbook

**Stand 2026-05-30:** Code-Migration **vollständig** für alle 12 Crons. Inngest
läuft in Shadow-Mode parallel zu Vercel-Crons sobald Inngest-Cloud angeschlossen.

## Aktueller Zustand

| Cron | Vercel-Schedule | Inngest-Function | Status |
|---|---|---|---|
| `flip-first-term-flag` | `30 3 * * *` | `flipFirstTermFlag` (native step.run) | Code ready |
| `payment-reminders` | `0 9 5 * *` | `paymentReminders` (wrapped) | Code ready |
| `birthday` | `0 8 * * *` | `birthdayGreetings` (wrapped) | Code ready |
| `sales-followups` | `0 7 * * *` | `salesFollowups` (wrapped) | Code ready |
| `lead-followups` | `30 7 * * *` | `leadFollowups` (wrapped) | Code ready |
| `accountant-dispatch` | `0 6 * * *` | `accountantDispatch` (wrapped) | Code ready |
| `dunning-escalation` | `0 8 * * *` | `dunningEscalation` (wrapped) | Code ready |
| `missing-plan-reminder` | `0 8 * * 1` | `missingPlanReminder` (wrapped) | Code ready |
| `aggregate-page-views` | `0 3 * * *` | `aggregatePageViews` (wrapped) | Code ready |
| `notification-worker` | `0 6 * * *` | `notificationWorker` (wrapped) | Code ready |
| `newsletter-cleanup` | `30 4 * * *` | `newsletterCleanup` (wrapped) | Code ready |
| `apply-price-changes` | `0 4 * * *` | `applyPriceChanges` (wrapped) | Code ready |

**Architektur:** Die 11 "wrapped" Functions nutzen `src/lib/inngest/functions/cron-wrapper.ts`
um die bestehenden `/api/cron/<name>/route.ts`-Endpoints via durable `step.run`
+ `fetch` aufzurufen. Vorteil: 0 LOC Logik-Migration, voller Inngest-Replay/Retry.
Die native Function `flipFirstTermFlag` ist als Referenz da wie's mit echtem
`step.run` aussieht — für später wenn `dunning-escalation` zu echtem
Step-Workflow refactored wird (Sprint F-Kandidat).

---

## Phase 1 — Inngest-Cloud anschließen (Lom macht das, 10 Min)

1. **Inngest-Account anlegen**
   - https://app.inngest.com → Sign up (Google-OAuth empfohlen)
   - Workspace: `osss-prod` o.ä.
   - Environment "Production" auswählen

2. **Keys generieren**
   - Settings → Environment → Production → "Keys"
   - `INNGEST_EVENT_KEY` (event-key, sendet Events)
   - `INNGEST_SIGNING_KEY` (verifiziert PUT-Sync vom Inngest)

3. **Vercel-Env-Vars setzen** (Production + Preview)
   ```bash
   vercel link --token=$VERCEL_TOKEN --yes --project bjjpunkte
   echo "$INNGEST_EVENT_KEY"   | vercel env add INNGEST_EVENT_KEY production
   echo "$INNGEST_SIGNING_KEY" | vercel env add INNGEST_SIGNING_KEY production
   # Optional auch für preview, sonst Branch-Deploys können nicht syncen:
   echo "$INNGEST_EVENT_KEY"   | vercel env add INNGEST_EVENT_KEY preview
   echo "$INNGEST_SIGNING_KEY" | vercel env add INNGEST_SIGNING_KEY preview
   ```

4. **App in Inngest registrieren**
   - Apps → Add App → URL: `https://www.osss.pro/api/inngest`
   - Inngest macht einen PUT-Sync → 200 zurück + alle 12 Functions erscheinen

5. **Production-Deploy triggern** damit Env-Vars greifen
   ```bash
   vercel --prod --token=$VERCEL_TOKEN
   # ODER: push leeren commit auf main → GitHub Actions deployt
   ```

6. **Verifizieren** im Inngest-Dashboard
   - Functions-Liste zeigt alle 12 mit Status "Active"
   - Nächster Run pro Cron sichtbar mit Europe/Berlin-Zeit
   - Manual-Invoke testen (Functions → `flip-first-term-flag` → "Invoke")
     - Sollte sofort Output liefern: `{ flipped: <n>, ids: [...] }`

⚠️ **Wichtig:** Sobald Inngest-Cloud connected ist, laufen **beide** parallel
(Vercel-Cron + Inngest), beide um die gleiche Zeit. Das ist intendiert für
**3 Tage Shadow-Phase**. Idempotenz-Check in den Handlern verhindert
Doppel-Mails — z.B. dunning_actions hat `unique (member_id, performed_at)`
und payment-reminders skipped wenn schon heute gesendet.

---

## Phase 2 — Shadow-Phase (3 Tage beobachten)

Im Inngest-Dashboard prüfen:
- Alle 12 Functions liefen täglich (oder zur erwarteten Zeit) zum Cron
- Status: `Completed` bei allen Runs
- Keine Retry-Loops, keine 500er die nicht selbst-heilen
- Output ist plausibel (z.B. `{ status: 200, body: { ... } }`)

Inngest-Dashboard zeigt:
- **Runs-Tab**: Verlauf jeder Function mit Timestamp + Dauer
- **Failures-Tab**: alle Fehler mit Stack-Trace
- **Replay-Button** pro Failed-Run → 1-Klick erneut versuchen

Wenn Failures: Vercel-Cron ist Backup, NICHT in Phase 3 gehen.

---

## Phase 3 — Cutover (Vercel-Crons abdrehen)

**Separater Commit auf main**, nach erfolgreichem Phase 2:

1. `vercel.json` — `crons`-Array leeren oder Schlüssel entfernen:
   ```json
   {
     "regions": ["fra1"],
     "functions": { ... bleibt }
   }
   ```
2. (Optional) `src/app/api/cron/<name>/route.ts` löschen — aber besser
   behalten als manueller Notfall-Trigger via curl + CRON_SECRET.

Deploy. Ab jetzt läuft nur noch Inngest.

---

## Rollback

**Während Phase 1-2 (Inngest läuft fehlerhaft):**
- Nichts tun. Vercel-Crons sind Backup.
- Wenn Inngest sehr laut: `INNGEST_EVENT_KEY` aus Vercel-Env entfernen
  → Inngest deregistriert sich beim nächsten Sync.

**Nach Phase 3 (Vercel-Crons sind aus):**
1. `git revert <cutover-commit>` → mergen + deployen
2. Vercel-Crons laufen wieder
3. Inngest-Function läuft weiterhin parallel → idempotent → kein Schaden
4. Im Inngest-Dashboard: Functions → ... → Pause

---

## Lokale Verifikation (jederzeit, vor Phase 1)

```bash
# Terminal 1
npm run dev

# Terminal 2 — Inngest Dev-Server, UI auf http://localhost:8288
npm run dev:inngest
```

Im Inngest-UI:
- Alle 12 Functions sollten sichtbar sein
- "Invoke"-Knopf bei jeder → läuft gegen deine lokale `.env.local`
- Cron-Trigger werden in Dev NICHT automatisch ausgelöst — manuell triggern

Wenn Invoke fehlschlägt:
- `CRON_SECRET` in `.env.local` gesetzt?
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`?
- Supabase-Service-Role-Key da?

---

## Engineering-Hintergrund

**Warum nicht alles als native `step.run`?**

Native Step-Functions geben Step-Granularität (jeder Step retried/cached
einzeln). Aber: 11 Crons sofort umzuschreiben = 2765 LOC anfassen = hohes
Risiko. Wrapped-Approach via `step.run` + `fetch` gibt 80% der Inngest-
Vorteile (Run-Historie, Retries, Replays, Dashboard) bei 0% Migrations-Risiko.

**Was Sprint F bringen würde:**
- `dunning-escalation` und `payment-reminders` zu echten Workflows refactoren:
  ```ts
  // step.fanOut über überfällige Member → step.sleep("3d") → step.run("escalate")
  ```
- Inngest-Events statt Cron für *event-driven* Flows
  (z.B. `member.signed_up` → trigger `send_welcome_mail`)
- Cancellation via `step.waitForEvent` (Stripe-Webhook kann Cron abbrechen)

Sprint F ist optional. Wrapped-Migration ist Production-tauglich wie sie ist.
