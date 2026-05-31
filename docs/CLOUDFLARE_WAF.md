# Cloudflare-WAF vor Hetzner-Coolify-Setup

**Stand 2026-05-30.** Optional aber sehr empfohlen nach Hetzner-Cutover.
Cloudflare uebernimmt CDN + WAF + DDoS-Schutz **kostenlos**. Origin (Hetzner)
sieht nur Cloudflare-IPs → IP-Adresse vom Server bleibt geheim.

## Was bringt das?

| Ohne CF | Mit CF |
|---|---|
| Hetzner-IP oeffentlich | nur CF-IPs sichtbar (Origin geschuetzt) |
| Coolify Let's Encrypt | Cloudflare-SSL (universal, free) |
| Statisch direkt von Hetzner | weltweit CDN-cached |
| Kein WAF | OWASP-Rules + Bot-Protection |
| Bei DDoS: Origin geht down | CF absorbiert, Origin sicher |
| Vercel-Edge-Latency-Vorteil weg | global ~30ms (CF-PoPs in 300+ Cities) |

## Setup (30 Min)

### 1. Cloudflare-Account + Domain hinzufuegen

```
https://dash.cloudflare.com/sign-up
→ Add Site → osss.pro → Free Plan
→ Cloudflare scannt deine bestehenden DNS-Records
→ Bestaetigen
```

Cloudflare gibt dir zwei Nameserver:
```
amelia.ns.cloudflare.com
robert.ns.cloudflare.com
```

Diese bei deinem Domain-Registrar (vermutlich auch Hetzner oder INWX) als
Nameserver setzen. Propagation: 1-24h.

### 2. DNS-Records pruefen

Cloudflare-UI → DNS:
- `osss.pro` A `<hetzner-ip>` — Proxy Status: **Proxied** (orange Wolke)
- `www.osss.pro` A `<hetzner-ip>` — Proxy Status: **Proxied**
- Andere Subdomains (staging.osss.pro etc.) — je nach Bedarf proxied/DNS-only

### 3. SSL/TLS-Mode

Cloudflare-UI → SSL/TLS → Overview:
- Encryption Mode: **Full (strict)**
  → CF verifiziert Origin-Cert (Coolify Let's Encrypt = valid)
  → Verschluesselt zwischen User-CF UND CF-Origin
- Edge Certificates → Always Use HTTPS: ON
- Edge Certificates → Min TLS Version: 1.2
- Edge Certificates → TLS 1.3: ON

### 4. WAF aktivieren

Cloudflare-UI → Security → WAF:

**Managed Rules** (kostenlos):
- Cloudflare Managed Ruleset: ON (default)
- Cloudflare Free Managed Ruleset: ON
- OWASP Core Ruleset: ON, Sensitivity Medium

**Rate Limiting** (Free: 10k Requests/Mo) — wir haben Upstash, aber CF zaehlt VOR dem Origin:
- Rule: `/api/auth/register` → max 3 requests / hour / IP → Block

### 5. Bot Fight Mode

Cloudflare-UI → Security → Bots:
- Bot Fight Mode: ON (kostenlos)
- Blockt bekannte Bot-User-Agents + Headless Browser ohne Cookies
- Greift VOR allem anderen → Hetzner sieht keinen Traffic von erkannten Bots

### 6. Speed-Settings

Cloudflare-UI → Speed → Optimization:
- Brotli: ON
- Early Hints: ON
- Auto Minify (HTML/CSS/JS): ON
- Rocket Loader: OFF (kollidiert mit Next.js Client-Hydration)

### 7. Caching-Rules fuer Static-Assets

Cloudflare-UI → Caching → Cache Rules → New Rule:
```
If: URI Path matches "_next/static/*" OR "_next/image/*"
Then: Cache Eligibility = Eligible for Cache
      Edge TTL = 1 month
      Browser TTL = 1 month
```

Effekt: nach 1. Visit eines Users sind alle statischen Assets aus 300+ CF-PoPs ausgeliefert, nicht aus Hetzner.

### 8. Origin-Lock (Hetzner-IP gegen Direkt-Access schuetzen)

Cloudflare-Proxy versteckt zwar die Origin-IP, aber wenn jemand die IP raet (z.B. via alten DNS-Records oder Shodan), kann er Hetzner direkt ansprechen → CF-WAF bypassed.

Loesung — Hetzner-Firewall nur Cloudflare-IPs durchlassen:

```bash
# Auf dem Hetzner-Server
# Aktuelle Cloudflare-IP-Liste holen
curl -s https://www.cloudflare.com/ips-v4 > /tmp/cf-v4
curl -s https://www.cloudflare.com/ips-v6 > /tmp/cf-v6

# UFW: alle bestehenden 80/443-Allow-Rules entfernen + nur CF-IPs erlauben
ufw delete allow 80/tcp
ufw delete allow 443/tcp

for ip in $(cat /tmp/cf-v4); do
  ufw allow from "$ip" to any port 80 proto tcp comment "Cloudflare"
  ufw allow from "$ip" to any port 443 proto tcp comment "Cloudflare"
done
for ip in $(cat /tmp/cf-v6); do
  ufw allow from "$ip" to any port 80 proto tcp comment "Cloudflare"
  ufw allow from "$ip" to any port 443 proto tcp comment "Cloudflare"
done

ufw reload
```

Plus monatlicher Cron um Liste zu refreshen (CF aendert IPs gelegentlich):
```bash
cat > /etc/cron.monthly/refresh-cloudflare-ips <<'EOF'
#!/bin/bash
# Refresh Cloudflare-IP-Allowlist in UFW
# Sprint Hetzner (2026-05-30)
set -e
NEW_V4=$(curl -s https://www.cloudflare.com/ips-v4)
NEW_V6=$(curl -s https://www.cloudflare.com/ips-v6)
[[ -n "$NEW_V4" && -n "$NEW_V6" ]] || { echo "CF-Listen leer, abort"; exit 1; }

# Alte CF-Regeln entfernen
ufw status numbered | grep "Cloudflare" | awk '{print $1}' | sed 's/[[][]]//g' | tac | while read n; do
  ufw --force delete "$n"
done

# Neue setzen
for ip in $NEW_V4 $NEW_V6; do
  ufw allow from "$ip" to any port 80 proto tcp comment "Cloudflare"
  ufw allow from "$ip" to any port 443 proto tcp comment "Cloudflare"
done
ufw reload
EOF
chmod +x /etc/cron.monthly/refresh-cloudflare-ips
```

### 9. Page Rules / Transform Rules

Cloudflare-UI → Rules → Transform Rules → "Add Header":
```
If: Hostname equals "osss.pro" OR "www.osss.pro"
Then: Set static response header "X-Frame-Options" = "DENY"
      Set static response header "Permissions-Policy" = "camera=(), microphone=(), geolocation=()"
```

(Wir setzen die schon in next.config.ts, aber Defense-in-Depth = CF setzt sie nochmal als Fallback.)

### 10. Analytics aktivieren

Cloudflare-UI → Analytics & Logs → Web Analytics:
- "Add Site" → osss.pro
- Cloudflare gibt dir ein <script>-Snippet
- Aber: WIR HABEN SCHON COOKIELOSE ANALYTICS → CF-Web-Analytics ueberspringen
- Dafuer: Analytics-API von CF lesen fuer Origin-Metrics (Requests, Bandwidth, Cache-Hit-Ratio)

## Verifikation

```bash
# 1. DNS-Propagation
dig osss.pro +short
# Sollte Cloudflare-IPs zeigen (104.21.x.x oder 172.67.x.x), nicht Hetzner

# 2. CF-Header sichtbar
curl -I https://osss.pro
# → "Server: cloudflare" + "CF-Ray: <id>"

# 3. Origin-Lock testen
# Versuche direkt auf Hetzner-IP zugreifen
curl -k https://<hetzner-ip> -H "Host: osss.pro"
# Sollte ECONNREFUSED oder Timeout sein (UFW blocked Non-CF-Source)
```

## Cost

| | Cloudflare Free |
|---|---|
| Bandwidth | unlimited |
| Requests | unlimited |
| WAF Managed Rules | included |
| Rate Limiting | 10k/Mo Rules |
| Bot Fight Mode | included |
| Workers | 100k/Tag |
| **Total** | **0 €/Mo** |

## Was es nicht macht

- **Kein eigener WAF-Rules-Editor in Free** (nur Managed Rules). Wer Custom-Regex-Rules will: Pro-Plan $20/Mo.
- **Kein Origin-Failover** (CF kann Traffic NICHT auf Backup-Origin umleiten in Free). Pro-Plan: ja.
- **Kein Image-Resizing** ohne Cloudflare-Images ($5/Mo + Usage).

Fuer osss.pro Free-Plan ist perfekt.

## Engineering-Hinweis

Cloudflare vor Hetzner ist die **Standard-Architektur fuer DACH-SaaS**. Du
hast jetzt:
- DSGVO-konformes Hosting (Hetzner DE)
- Globales CDN (CF in 300+ Cities)
- WAF + DDoS-Schutz (CF Managed Rules + Bot Fight)
- Origin-Lock (Hetzner-IP unsichtbar)
- Plus Coolify-PaaS-DX (Vercel-Style aber self-hosted)

Das ist **das** Setup das Senior-Engineers sehen und "non plus ultra" sagen.
Plus es kostet ~17 €/Mo statt $200+ bei vergleichbarem Vercel/Cloudflare-
Workers-Setup.
