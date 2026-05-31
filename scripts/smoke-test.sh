#!/usr/bin/env bash
# Post-Deploy Smoke-Test fuer osss.pro.
#
# Usage:
#   ./scripts/smoke-test.sh                                    # default: https://www.osss.pro
#   ./scripts/smoke-test.sh https://staging.osss.pro           # gegen staging
#   TIMEOUT=30 ./scripts/smoke-test.sh https://osss.pro       # custom timeout
#
# Exit-Codes:
#   0 = alle Tests ok
#   1 = mindestens ein Test failed
#
# Sprint Hetzner (2026-05-30) — wird in deploy-coolify.yml verwendet,
# laeuft aber auch lokal als Sanity-Check vor DNS-Cutover.

set -euo pipefail

URL="${1:-https://www.osss.pro}"
TIMEOUT="${TIMEOUT:-15}"

# Farben
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
  local name="$1"; local path="$2"; local expected="$3"; local severity="${4:-fatal}"
  local got
  got=$(curl -fsSL -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$URL$path" 2>/dev/null || echo "000")
  if [[ "$got" == "$expected" ]]; then
    echo -e "  ${GREEN}✓${NC} $name ($got)"
    PASS=$((PASS + 1))
  elif [[ "$severity" == "warn" ]]; then
    echo -e "  ${YELLOW}⚠${NC} $name (got $got, expected $expected)"
    WARN=$((WARN + 1))
  else
    echo -e "  ${RED}✖${NC} $name (got $got, expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

check_header() {
  local name="$1"; local path="$2"; local header="$3"; local pattern="$4"
  local got
  got=$(curl -fsSL -I --max-time "$TIMEOUT" "$URL$path" 2>/dev/null | grep -i "^$header:" | head -1 || echo "")
  if echo "$got" | grep -qi "$pattern"; then
    echo -e "  ${GREEN}✓${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✖${NC} $name (header missing or wrong: $got)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Smoke-Test: $URL"
echo "═══════════════════════════════════════════════════"

echo ""
echo "1. Health-Endpoints"
check "Health"                       "/api/health"                 200

echo ""
echo "2. Public Pages"
check "Landing"                      "/"                            200
check "Datenschutz"                  "/datenschutz"                 200
check "Impressum"                    "/impressum"                   200
check "AGB"                          "/agb"                         200
check "Pricing"                      "/pricing"                     200
check "Register"                     "/register"                    200
check "Login"                        "/login"                       200
check "robots.txt"                   "/robots.txt"                  200 warn
check "sitemap.xml"                  "/sitemap.xml"                 200 warn
check "favicon"                      "/favicon.ico"                 200 warn

echo ""
echo "3. Protected Routes (sollten 401/302 zurueck)"
check "Dashboard ohne Auth"          "/dashboard"                   307 warn
check "Members API ohne Auth"        "/api/leads"                   401

echo ""
echo "4. Security Headers"
check_header "CSP gesetzt"           "/"                            "Content-Security-Policy"        "default-src"
check_header "X-Frame-Options"       "/"                            "X-Frame-Options"                "DENY"
check_header "X-Content-Type-Options" "/"                           "X-Content-Type-Options"         "nosniff"
check_header "Strict-Transport-Security" "/"                        "Strict-Transport-Security"      "max-age"

echo ""
echo "5. Cron-Endpoints (sollten 401 ohne Bearer)"
check "Cron payment-reminders"       "/api/cron/payment-reminders"  401
check "Cron dunning-escalation"      "/api/cron/dunning-escalation" 401

echo ""
echo "6. Inngest-Endpoint"
check "Inngest serve"                "/api/inngest"                 200

echo ""
echo "═══════════════════════════════════════════════════"
echo -e "  ${GREEN}Passed: $PASS${NC}  ${YELLOW}Warn: $WARN${NC}  ${RED}Failed: $FAIL${NC}"
echo "═══════════════════════════════════════════════════"
echo ""

[[ $FAIL -eq 0 ]] || exit 1
