# Vercel → Hetzner + Coolify Cutover-Playbook

**Stand 2026-05-30.** Komplette Migration der osss.pro-Produktion von
Vercel Hobby auf Hetzner CCX13 mit Coolify als PaaS.

## Was bringt das?

| Vorher (Vercel Hobby) | Nachher (Hetzner + Coolify) |
|---|---|
| **Kein DPA** (Hobby exkludiert) | **AVV automatisch** im Hetzner-Vertrag |
| US-Build + EU-Edge | DE-Build + DE-Edge (Falkenstein/Nuernberg) |
| $0/Mo, bei Wachstum $20+ | ~14€/Mo fixed |
| Auto-Scaling | Fixed Ressourcen (2 vCPU / 8 GB / 80 GB) |
| Vendor-Lock-In | Plain Docker, portabel |
| DSGVO-Score 97/100 | DSGVO-Score 100/100 |

## Phasen-Overview

| Phase | Dauer | Risiko | Reversibel? |
|---|---|---|---|
| 1. Hetzner-Setup | 30 Min | Niedrig | Ja |
| 2. Coolify-App auf staging.osss.pro | 1 h | Niedrig | Ja |
| 3. Env-Migration + Verifikation | 30 Min | Mittel | Ja |
| 4. Smoke-Tests + UAT | 1-3 Tage | Niedrig | Ja |
| 5. DNS-Cutover production | 15 Min | Hoch | Ja (DNS-Rollback) |
| 6. Vercel-Backup-Phase | 48 h | Niedrig | Ja |
| 7. Vercel-Project archivieren | 5 Min | Niedrig | Nein |

---

## Phase 1 — Hetzner-Server (30 Min)

### 1.1 Account + Server bestellen

```
https://console.hetzner.cloud
→ Sign up (Firma: Lom-Ali Imadaev, oss@osss.pro)
  Wichtig: AGBs akzeptieren → automatischer AVV/DPA gilt
→ New Project: "osss-prod"
→ Add Server:
   Location: Falkenstein DE (FSN1) oder Nuernberg DE (NBG1)
   Image: Ubuntu 24.04 LTS
   Type: CCX13 (Shared CPU)
          → 2 vCPU AMD dedicated, 8 GB RAM, 80 GB NVMe, 20 TB Traffic
          → 14,28 €/Mo
   Networking: IPv4 + IPv6
   SSH Keys: ~/.ssh/id_ed25519.pub einfuegen
   Name: osss-prod-1
   Backups: AN (+ 20% = 2,86 €/Mo) — taegliche Snapshots
```

Notiere die **Server-IPv4** — die brauchst du fuer DNS + SSH.

### 1.2 Firewall in Hetzner-Console

Project → Firewalls → New Firewall: "osss-prod"

Inbound Rules:
| Protocol | Port | Source | Comment |
|---|---|---|---|
| TCP | 22 | `<deine Home-IP>/32` | SSH nur von dir |
| TCP | 80 | `0.0.0.0/0` + `::/0` | HTTP |
| TCP | 443 | `0.0.0.0/0` + `::/0` | HTTPS |
| TCP | 8000 | `<deine Home-IP>/32` | Coolify-UI (spaeter via Tailscale) |

→ Firewall an Server `osss-prod-1` zuweisen.

### 1.3 Server-Hardening

```bash
# SSH zum Server (Replace <SERVER-IP>)
ssh root@<SERVER-IP>

# Hardening-Script aus Repo (oder im Repo direkt auf scripts/hetzner-hardening.sh)
curl -fsSL https://raw.githubusercontent.com/Lomtech/osss.pro/main/scripts/hetzner-hardening.sh > hardening.sh
chmod +x hardening.sh
./hardening.sh
```

Was es macht:
- Updates + unattended-upgrades fuer Security-Patches
- UFW-Firewall (deny by default, allow SSH/HTTP/HTTPS/8000)
- fail2ban gegen SSH-Brute-Force
- 4 GB Swap
- sysctl-Production-Tuning
- Coolify-Installation (Docker + Web-UI)
- Tailscale-Installation (nicht auto-up)

Dauer: ~8 Min. Am Ende kommt eine Anleitung wie es weitergeht.

### 1.4 Tailscale aktivieren (Coolify-UI verstecken)

```bash
# Auf dem Server
tailscale up
# → Im Output erscheint eine URL — die im Browser oeffnen, Auth durchklicken

# Server bekommt eine 100.x.y.z Tailscale-IP
tailscale ip -4
# Notieren: das ist die "interne" IP fuer Coolify-UI

# Public-Port 8000 zumachen — UI nur noch ueber Tailscale erreichbar
ufw delete allow 8000

# Plus: Hetzner-Firewall-Regel fuer Port 8000 loeschen (Web-UI)
```

Auf deinem Mac:
```bash
brew install --cask tailscale
# Tailscale starten + im gleichen Tailnet anmelden
# Dann: http://<server-tailscale-ip>:8000 oeffnen → Coolify-UI
```

### 1.5 Coolify-Account anlegen

Im Browser: `http://<server-tailscale-ip>:8000`

- E-Mail + Passwort + 2FA aktivieren
- Admin-Settings → Profile → API Tokens → "deploy" anlegen (fuer GitHub Actions)

---

## Phase 2 — Coolify-App-Setup (1 h)

### 2.1 GitHub-Connect

Coolify-UI:
- Sources → New → "GitHub App"
- Coolify oeffnet GitHub-Tab → "Install on Lomtech/osss.pro" → Bestaetigen
- Nach Installation: Source erscheint in Coolify als "verfuegbar"

### 2.2 Project + Environment

```
Coolify → Projects → New
  Name: osss
  Environments → "production"
```

### 2.3 Application erstellen

```
Resources → New → Application → "Public Repository" (oder via GitHub-App)
  Source: github.com/Lomtech/osss.pro (Branch: main)
  Build Pack: Dockerfile (auto-erkannt)
  Domain: staging.osss.pro     ← ERST staging, nicht production!
  Port: 3000
  Health Check Path: /api/health
  Health Check Interval: 30s
  Build-Cache: enabled
```

Diese Konfiguration NICHT noch deployen — erst Env-Vars setzen (Schritt 3).

### 2.4 DNS-Eintrag fuer staging

Bei deinem DNS-Provider (Cloudflare empfohlen):
```
A    staging.osss.pro    <hetzner-server-ip>     TTL 300
```

Warte ~2 Min auf DNS-Propagation.

---

## Phase 3 — Env-Migration (30 Min)

### 3.1 Vercel-Env exportieren

```bash
cd ~/Developer/bjjpunkte
export VERCEL_TOKEN="<dein-vercel-token>"
./scripts/migrate-env-from-vercel.sh > coolify-env.txt

# Datei pruefen:
cat coolify-env.txt
# → enthaelt VERCEL_*-Vars auskommentiert
# → enthaelt TODO-Reminder fuer NEXT_PUBLIC_APP_URL
```

⚠️ `coolify-env.txt` enthaelt **Secrets im Klartext**. Nicht committen!
```bash
echo "coolify-env.txt" >> .gitignore
```

### 3.2 In Coolify importieren

Coolify-UI → Application → Environment Variables → "Import bulk":
- Inhalt von `coolify-env.txt` einfuegen
- "Save"
- Markiere alle `NEXT_PUBLIC_*` als "Build Time + Runtime"
- Alle anderen als "Runtime only" (so kommen sie nicht ins Docker-Image)

### 3.3 Domain-Variable korrigieren

Manuell anpassen:
```
NEXT_PUBLIC_APP_URL=https://staging.osss.pro
```

### 3.4 Erstes Deploy

Coolify-UI → Application → "Deploy"

Dauer: 3-5 Min (Docker-Build + Push).
Logs in Coolify-UI verfolgbar.

Bei Erfolg: Coolify zeigt grünen Status. Health-Check sollte nach ~30s OK sein.

---

## Phase 4 — Verifikation auf staging (1-3 Tage)

### 4.1 Smoke-Test laufen lassen

```bash
cd ~/Developer/bjjpunkte
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh https://staging.osss.pro
```

Erwartung: alle Checks gruen ausser ggf. einige Warnings (robots.txt etc.).

### 4.2 Manueller UAT

- Login mit deinem Account
- Member-Liste laden
- Lead-Pipeline checken
- Settings-Save (test, ob Caching greift)
- /api/avv/status: 200 mit deinem Gym
- Public-Schedule: `https://staging.osss.pro/schedule/<gym-id>`

### 4.3 Inngest re-sync (falls noch nicht verbunden)

Coolify-Deploy hat env-vars geaendert → Inngest-Endpoint koennte neu syncen muessen.

Inngest-Dashboard → Apps → Sync (Force) → URL: `https://staging.osss.pro/api/inngest`
→ alle 12 Functions sollten erscheinen.

### 4.4 Stripe-Webhook auf staging (NICHT noch tauschen!)

Wir behalten Stripe-Webhook noch auf Vercel-URL bis Phase 5.

### 4.5 Beobachten

Mindestens **24h** beobachten:
- Sentry-Errors auf staging
- Coolify-Logs (Server-Stats: RAM, CPU, Disk)
- Inngest-Cron-Runs sollten erfolgreich sein

---

## Phase 5 — Production-Cutover (15 Min)

### 5.1 Pre-Flight Check

- [ ] Hetzner-Server >= 24h ohne Issues
- [ ] Sentry-Error-Rate auf staging unveraendert
- [ ] Inngest-Crons laufen auf staging.osss.pro
- [ ] Smoke-Tests gruen
- [ ] Du hast NICHT noch parallel an Vercel deployed (sonst Race auf DNS-Wechsel)

### 5.2 DNS-TTL vorbereiten (12-24h vorher!)

Bei deinem DNS-Provider die TTL von `osss.pro` + `www.osss.pro` auf **300 Sekunden** absenken. So propagiert der Switch in 5 Min statt 4-24h.

### 5.3 Coolify-Domain auf Production umstellen

Coolify-UI → Application → Settings → Domains:
```
Alte Domain: staging.osss.pro       → entfernen
Neue Domains:
  osss.pro
  www.osss.pro
```

Coolify generiert neue Let's Encrypt-Certs automatisch (~2 Min).

### 5.4 NEXT_PUBLIC_APP_URL aktualisieren

Coolify-UI → Application → Environment Variables:
```
NEXT_PUBLIC_APP_URL=https://www.osss.pro
```

→ "Redeploy" (Re-Build mit neuer URL, ~3 Min).

### 5.5 DNS-Switch

DNS-Provider:
```
osss.pro          A      <hetzner-ip>     (vorher: 76.76.21.x — Vercel)
www.osss.pro      A      <hetzner-ip>     (vorher: cname-china.vercel-dns.com)
```

TTL 300s → Propagation in ~5 Min.

### 5.6 Stripe-Webhook-URL bestaetigen

Stripe-Dashboard → Developers → Webhooks → bjjpunkte:
- Endpoint URL bleibt `https://www.osss.pro/api/stripe/webhook`
- Nur DNS-Backend hat gewechselt — Webhook funktioniert weiter
- Test-Event senden zur Verifikation

### 5.7 Inngest re-sync

Inngest-Dashboard → Apps → osss → Sync:
- URL bleibt `https://www.osss.pro/api/inngest`
- Sync sollte 200 + alle 12 Functions zeigen

### 5.8 Live-Smoke-Test

```bash
./scripts/smoke-test.sh https://www.osss.pro
```

Bei Failure → siehe Rollback (Phase 7).

---

## Phase 6 — Vercel-Backup-Phase (48 h)

### 6.1 Vercel-Deployments pausieren — NICHT loeschen

Vercel-Dashboard → bjjpunkte → Settings → General → "Pause Deployments"

Effekt: laufendes Deployment bleibt erreichbar, aber kein neuer Build.

### 6.2 GitHub-Actions umkonfigurieren

```bash
# In GitHub-Repo:
# Settings → Secrets and variables → Actions → Variables
#   COOLIFY_ENABLED = "true"
#
# Settings → Secrets:
#   COOLIFY_API_TOKEN   = "<aus Coolify-UI>"
#   COOLIFY_BASE_URL    = "http://<server-tailscale-ip>:8000"  (oder eigene Subdomain)
#   COOLIFY_APP_UUID    = "<aus Coolify-Application-URL>"
```

Plus: alte `deploy.yml` umbenennen zu `deploy.yml.vercel-disabled` (KEIN delete — fuer Notfall-Rollback):
```bash
git mv .github/workflows/deploy.yml .github/workflows/deploy.yml.vercel-disabled
git commit -m "chore(deploy): Vercel-Workflow deaktiviert (Hetzner-Cutover)"
git push
```

Ab jetzt: `git push main` → triggert nur noch Coolify-Workflow.

### 6.3 Stripe-Test-Charge

Im Stripe-Dashboard manuell einen Test-Payment ausloesen.
→ Webhook sollte in Coolify-Logs ankommen + verarbeiten.

### 6.4 48h beobachten

Sentry, Coolify-Logs, Inngest-Dashboard.

---

## Phase 7 — Final (Vercel archivieren) — Nach 48h ohne Probleme

Vercel-Dashboard → bjjpunkte → Settings → Advanced → "Delete Project"
(ODER nur archivieren — Vercel hat keine Archiv-Funktion, aber du kannst es einfach pausiert lassen)

`coolify-env.txt` lokal loeschen:
```bash
shred -u ~/Developer/bjjpunkte/coolify-env.txt 2>/dev/null || rm ~/Developer/bjjpunkte/coolify-env.txt
```

---

## Rollback-Procedures

### Bei Problem in Phase 1-4 (staging)
- Coolify-App stoppen, Hetzner-Server kann laufen bleiben
- Vercel ist unbeeinflusst, Produktion laeuft weiter
- Kein Schaden

### Bei Problem in Phase 5 (kurz nach DNS-Switch)
```bash
# DNS-Rollback (sofort)
# DNS-Provider:
osss.pro          A     76.76.21.21              # Vercel
www.osss.pro      CNAME cname-china.vercel-dns.com

# TTL 300 → Propagation in ~5 Min
# Vercel-Deployments wieder aktivieren falls pausiert
```

### Bei Problem in Phase 6 (Vercel-Backup-Phase)
```bash
# GitHub-Action:
# Settings → Variables → COOLIFY_ENABLED = "false"

# Datei umbenennen zurueck:
git mv .github/workflows/deploy.yml.vercel-disabled .github/workflows/deploy.yml
git commit -m "revert: Vercel-Workflow reaktiviert (Hetzner-Issue)"
git push

# Vercel-Deployments unpause → naechster push deployt zu Vercel
# DNS-Rollback wie oben
```

---

## Monitoring nach Cutover

### Tagliche Checks (Woche 1)

- Coolify-Dashboard → Server-Metrics: CPU < 60%, RAM < 70%, Disk < 50%
- Sentry: keine neuen Error-Patterns
- Inngest: alle Crons "Completed" am erwarteten Zeitpunkt
- Stripe: Webhook-Delivery-Rate 100%

### Wochentliche Checks

```bash
# SSH zum Server
ssh root@<server>

# Server-Health
htop                          # CPU/RAM-Last
df -h                         # Disk-Usage (Coolify-Volumes wachsen mit Logs)
docker ps                     # Container-Status
docker system df              # Docker-Speicherverbrauch

# Coolify-Logs aufraeumen falls noetig
docker system prune -a -f --volumes  # ACHTUNG: nur wenn nichts wichtiges
```

### Backup-Verifikation

Hetzner-Backups laufen automatisch (wenn aktiviert). Einmal pro Quartal:
- Hetzner-Console → Backups → "Restore to new server" (test-restore in separate VM)
- Verify Coolify-Config + App-Data sind drin
- Test-VM danach loeschen

---

## DSGVO-Audit nach Cutover

```bash
cd ~/Developer/bjjpunkte
dsgvo-audit . --min low
```

Erwartung: **100/100 Grade A** (Vercel-Hobby-DPA-Problem ist weg, Provider-Region jetzt durchgaengig EU/DE).

Wenn nicht: was sagt der Audit? Vermutlich nur dass `compliance/avv-status.md` "Hetzner GmbH" als Anbieter listen muss.

```bash
# avv-status.md updaten:
# - Vercel-Eintrag entfernen
# - Hetzner Online GmbH ergaenzen (Gunzenhausen, DE — AVV via AGB)
```

---

## Cost-Calculator

| Item | Monatlich |
|---|---|
| Hetzner CCX13 | 14,28 € |
| Hetzner Backups | 2,86 € |
| Total Hetzner | **17,14 €** |
| Cloudflare (optional) | 0 € |
| Supabase Free | 0 € |
| Upstash Free | 0 € |
| Sentry Developer | 0 € |
| Inngest Free | 0 € |
| Resend Free | 0 € |
| Stripe (% pro Trans) | variabel |
| **Total fixed** | **~17 €/Mo** |

Vergleich Vercel Pro: $20 + Bandwidth ($40/TB after 1TB) → bei realem Traffic ~$25-40/Mo.

---

## Was diese Migration NICHT macht

- Kein Move auf eigene Postgres (Supabase bleibt)
- Kein K8s, kein Multi-Server (CCX13 reicht fuer 10-50k Aktive)
- Kein eigener Stripe-Connect (bleibt extern)
- Kein eigener Mail-Server (Resend bleibt)
- Kein eigenes Error-Tracking (Sentry-Cloud bleibt, .de.sentry.io ist EU)

Bewusste Reduktion: nur Hosting wechseln, alles andere ist schon optimal.
