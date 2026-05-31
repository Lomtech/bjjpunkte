# Inngest Cutover-Playbook

Aktueller Stand: **Schatten-Modus**. Inngest-Code ist im Repo, der Endpoint
`/api/inngest` antwortet, aber Inngest-Cloud ist nicht angeschlossen → es
läuft nichts produktiv. Vercel-Crons sind unverändert aktiv.

Dieses Dokument beschreibt den Cutover **einer Function** (Pilot:
`flip-first-term-flag`). Erst nach erfolgreichem Pilot weitere Crons migrieren.

---

## Phase 1 — Inngest-Cloud anschließen (read-only, keine Logik-Änderung)

1. **Inngest-Account anlegen**
   - https://app.inngest.com → Sign up
   - Workspace anlegen (z.B. `osss-prod`)
   - Environment "Production" auswählen

2. **Keys generieren**
   - Settings → Environment → Production
   - `INNGEST_EVENT_KEY` und `INNGEST_SIGNING_KEY` kopieren

3. **Vercel-Env-Vars setzen**
   ```bash
   vercel env add INNGEST_EVENT_KEY production
   vercel env add INNGEST_SIGNING_KEY production
   ```
   Auch für `preview` setzen, sonst funktionieren Preview-Deploys nicht.

4. **App in Inngest registrieren**
   - Apps → Add App → URL: `https://www.osss.pro/api/inngest`
   - Inngest macht einen PUT-Sync-Call → sollte 200 zurückkommen
   - Wenn 403: CSRF-Whitelist prüfen (`src/proxy.ts` muss `/api/inngest` enthalten)

5. **Deployment in Vercel triggern** (damit die Env-Vars greifen)

6. **Verifizieren**
   - Inngest-Dashboard → Functions → `flip-first-term-flag` sollte erscheinen
   - Status "Active" + nächste Cron-Ausführung um 03:30 Europe/Berlin

**Achtung**: Ab jetzt läuft die Function **zusätzlich** zum Vercel-Cron, beide um 03:30.
Das ist OK — sie ist idempotent. Wenn der erste Inngest-Run 0 Verträge findet,
weil der Vercel-Cron 10 Minuten vorher schon durch war, ist das das erwartete Verhalten.

---

## Phase 2 — Beobachten (mindestens 3 Tage)

Vor dem Cutover **3 aufeinanderfolgende Tage** in Inngest-Dashboard prüfen:

- Function-Run wurde um 03:30 ausgelöst (oder kurz danach)
- Status: `Completed`
- Output enthält `{ flipped: <number>, ids: [...] }`
- Keine Retries / Failures

Wenn ein Run fehlschlägt → Vercel-Cron bleibt als Sicherheitsnetz. NICHT in Phase 3 gehen.

---

## Phase 3 — Cutover (Vercel-Cron deaktivieren)

**Separate PR**, ein Commit. Änderungen:

1. `vercel.json` — Eintrag `/api/cron/flip-first-term-flag` aus `crons` entfernen + aus `functions` entfernen
2. `src/app/api/cron/flip-first-term-flag/route.ts` — Datei löschen
3. `src/lib/inngest/functions/flip-first-term.ts` — Header-Kommentar "SHADOW MODE" entfernen

Deploy. Ab jetzt läuft nur noch Inngest.

---

## Rollback

**Falls Inngest in Phase 1-2 nicht funktioniert:**
- Nichts tun. Vercel-Cron läuft weiter, kein Datenverlust.
- Wenn Inngest sehr laut Errors meldet: `INNGEST_EVENT_KEY` aus Vercel-Env entfernen → Function deregistriert sich beim nächsten Sync.

**Falls nach Phase 3 ein Problem auftritt:**
1. `git revert <cutover-commit>` → PR mergen + deployen → Vercel-Cron läuft wieder
2. Inngest-Function läuft dann zusätzlich → idempotent, kein Schaden
3. Im Inngest-Dashboard die Function pausieren (Functions → ... → Pause)

---

## Lokale Verifikation (jederzeit möglich, vor Phase 1)

```bash
# Terminal 1
npm run dev

# Terminal 2 — Inngest Dev-Server, UI auf http://localhost:8288
npm run dev:inngest
```

Im Inngest-UI auf `flip-first-term-flag` → **Invoke** → läuft gegen deine
lokale Supabase. In Dev werden Cron-Trigger nicht automatisch ausgelöst,
manuell triggern.

Wenn Invoke fehlschlägt: lokal sind die Supabase-Env-Vars in `.env.local`
nicht gesetzt oder Service-Role-Key fehlt.

---

## Was diese Migration NICHT ist

- **Kein Move** der gesamten 11 Crons auf einmal. Pilot `flip-first-term-flag`
  zuerst, weil er klein und stateless ist. Wenn Pilot 2 Wochen stabil →
  Reihenfolge der weiteren Migrations:
  1. `apply-price-changes` — Stripe-Calls mit Retry-Bedarf
  2. `dunning-escalation` + `payment-reminders` — gehören in einen
     durable Workflow mit `step.sleep()`
  3. `birthday`, `sales-followups`, `lead-followups` — pure Cron-Logik

- **Kein Replacement** des `cronGuard`-Helpers. Solange Vercel-Crons existieren,
  bleibt der.
