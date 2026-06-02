#!/usr/bin/env bash
# Vercel-Env-Vars → Coolify-Format Migration.
#
# Voraussetzung: vercel-CLI eingeloggt + Repo gelinked.
# Output: env-Datei zum 1:1-Import in Coolify-UI (Application → Environment Variables → Bulk).
#
# Usage:
#   ./scripts/migrate-env-from-vercel.sh > coolify-env.txt
#   # Dann den Inhalt in Coolify → Bulk Import einfuegen
#
# Sprint Hetzner (2026-05-30).

set -euo pipefail

if ! command -v vercel >/dev/null; then
  echo "FEHLER: vercel-CLI nicht installiert. npm i -g vercel@latest" >&2
  exit 1
fi

TOKEN="${VERCEL_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  echo "FEHLER: VERCEL_TOKEN env-var nicht gesetzt." >&2
  echo "Aus https://vercel.com/account/settings/tokens kopieren und exportieren:" >&2
  echo "  export VERCEL_TOKEN=vcp_..." >&2
  exit 1
fi

cd "$(dirname "$0")/.."

# Falls Repo noch nicht verlinkt
if [[ ! -f .vercel/project.json ]]; then
  vercel link --token="$TOKEN" --yes --project osss-pro >/dev/null
fi

# Production-Env nach Stdout
TMP=$(mktemp)
trap "rm -f $TMP" EXIT
vercel env pull "$TMP" --environment=production --token="$TOKEN" >&2

# Hetzner-spezifische Anpassungen + Filter
awk '
  BEGIN { print "# === Vercel → Coolify Migration ===" }
  BEGIN { print "# Generated: '"$(date -u +%FT%TZ)"'" }
  BEGIN { print "# Pruefe vor Import:" }
  BEGIN { print "#   - NEXT_PUBLIC_APP_URL muss auf neue Hetzner-Domain zeigen" }
  BEGIN { print "#   - VERCEL_*-Vars sind irrelevant, sind auskommentiert" }
  BEGIN { print "#   - Sensitive vars sind unmaskiert — Datei NICHT committen" }
  BEGIN { print "" }
  /^VERCEL_/ { print "# " $0; next }   # Vercel-internal vars ignorieren
  /^#/ { print; next }
  /^$/ { print; next }
  /^NEXT_PUBLIC_APP_URL=/ {
    # APP-URL muss auf neue Domain zeigen — TODO als Reminder
    print "# TODO: NEXT_PUBLIC_APP_URL anpassen auf https://www.osss.pro (Cutover)"
    print "# Vorher (Vercel): " $0
    print "NEXT_PUBLIC_APP_URL=https://staging.osss.pro"
    next
  }
  { print }
' "$TMP"

echo ""
echo "# === ENDE Migration ==="
echo "# Pruefliste vor Coolify-Import:"
echo "# [ ] ANALYTICS_SALT gesetzt (sonst DSGVO-Audit-Score -2)"
echo "# [ ] IBAN_ENCRYPTION_KEY gesetzt"
echo "# [ ] CRON_SECRET gesetzt"
echo "# [ ] INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY gesetzt"
echo "# [ ] HEALTH_DEBUG_TOKEN gesetzt (fuer health/debug)"
echo "# [ ] STRIPE_WEBHOOK_SECRET passt zur neuen Domain (Stripe Dashboard updaten!)"
