#!/usr/bin/env python3
"""
bjjpunkte Deep Security & Performance Audit
============================================
Ergänzt analyze.py mit sechs Prüfebenen:

  1. AUTH — API-Routen ohne erkennbare Auth-Prüfung
  2. SERVICE_ROLE — service-role-Client ohne vorherige Auth (direkte DB-Schreibrechte)
  3. RATE_LIMIT — öffentliche Routen ohne Rate-Limiting
  4. INPUT — fehlende Body-Validierung
  5. ERROR_LEAK — rohe Fehlermeldungen in JSON-Antworten
  6. MULTI_TENANT — DB-Queries ohne gym_id-Filter (Tenancy-Verletzung)
  7. PERF — await-in-Loop, fehlende Promise.all, unbegrenzte Queries
  8. CRON — Cron-Routen ohne CRON_SECRET-Prüfung
  9. PUBLIC — öffentliche Routen (kein Auth) — Inventar

Ausgabe:
  .analysis/security.md   — priorisierter Befundbericht
  .analysis/security.json — maschinenlesbar

Stdlib-only. Keine externen Deps.
"""

from __future__ import annotations
import json, os, re, sys
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT     = PROJECT_ROOT / "src"
OUT_DIR      = PROJECT_ROOT / ".analysis"
SKIP_DIRS    = {"node_modules", ".next", "dist", "build", ".analysis", "__snapshots__"}

# ─── Patterns ─────────────────────────────────────────────────────────────────

RE_AUTH_TOKEN     = re.compile(r"get(?:User|Session|User|User)\s*\(|Authorization|accessToken|bearer", re.I)
RE_SERVICE_CLIENT = re.compile(r"SUPABASE_SERVICE_ROLE_KEY|serviceClient\(\)|adminClient\(\)|createClient.*SERVICE_ROLE")
RE_AUTH_BEFORE_SC = re.compile(r"getUser|getSession|auth\.getUser", re.I)
RE_RATE_LIMIT     = re.compile(r"rateLimit|rateLimiter|upstash|CRON_SECRET|checkRateLimit|withRateLimit", re.I)
RE_CRON_SECRET    = re.compile(r"CRON_SECRET|cronGuard")
RE_BODY_PARSE     = re.compile(r"req\.json\(\)|formData\(\)|text\(\)")
RE_BODY_VALIDATE  = re.compile(r"z\.object|zod|yup|joi|if\s*\(!\w|typeof\s+\w+\s*!==|\.trim\(\)|\.length|parseInt|parseFloat|Number\(|isNaN|isFinite|schema\.parse")
RE_ERROR_LEAK     = re.compile(r"error\.message|err\.message|\.message\s*\}")
RE_GYM_FILTER     = re.compile(r"eq\(['\"]gym_id['\"]|\.eq\('gym_id'|\.eq\(\"gym_id\"|gym_id.*=|where.*gym_id")
RE_AWAIT_LOOP     = re.compile(r"for\s*[\(\[].*\).*\{[^}]*await", re.S)
RE_PROMISE_ALL    = re.compile(r"Promise\.all")
RE_LIMIT_CALL     = re.compile(r"\.limit\s*\(\s*(\d+)\s*\)")
RE_SELECT_ALL     = re.compile(r"\.select\(\s*['\"]?\*['\"]?\s*\)|\.select\(\s*['\"][^'\"]*\*[^'\"]*['\"]")
RE_EXPORT_HANDLER = re.compile(r"^export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)|^export\s+const\s+(GET|POST|PUT|PATCH|DELETE)", re.M)
RE_PUBLIC_API     = re.compile(r"src/app/api/public/")
RE_TOKEN_PARAM    = re.compile(r"params.*token|searchParams.*token|req\.url.*token", re.I)
RE_INPUT_UUID     = re.compile(r"UUID|uuid|[0-9a-f]{8}-[0-9a-f]{4}")
RE_NEXT_RUNTIME   = re.compile(r"export\s+const\s+runtime\s*=\s*['\"](\w+)['\"]")
RE_LARGE_LIMIT    = re.compile(r"\.limit\s*\(\s*([5-9]\d{2,}|\d{4,})\s*\)")
RE_NO_LIMIT       = re.compile(r"\.select\([^)]*\)(?![\s\S]{0,200}\.limit\()")
RE_CONSOLE_ERROR  = re.compile(r"console\.error")
RE_SENTRY_CAPTURE = re.compile(r"Sentry\.capture|captureException|captureMessage")
RE_TRY_CATCH      = re.compile(r"\btry\s*\{")
RE_DIRECT_SUPABASE = re.compile(r"createClient.*ANON_KEY.*direct|supabase\.from\(.*\)\.update\(|supabase\.from\(.*\)\.delete\(")

@dataclass
class Finding:
    severity: str          # CRITICAL | HIGH | MEDIUM | LOW | INFO
    category: str
    file: str
    line: int
    detail: str
    recommendation: str = ""

def list_api_routes() -> list[Path]:
    files = []
    api_dir = SRC_ROOT / "app" / "api"
    for root, dirs, fnames in os.walk(api_dir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fn in fnames:
            if fn == "route.ts" or fn == "route.tsx":
                files.append(Path(root) / fn)
    return sorted(files)

def list_all_source() -> list[Path]:
    files = []
    for root, dirs, fnames in os.walk(SRC_ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in fnames:
            p = Path(root) / fn
            if p.suffix in {".ts", ".tsx"}:
                files.append(p)
    return sorted(files)

def rel(p: Path) -> str:
    return str(p.relative_to(PROJECT_ROOT))

def find_line(text: str, pattern_match) -> int:
    if hasattr(pattern_match, "start"):
        return text[:pattern_match.start()].count("\n") + 1
    return 0

def audit_route(path: Path, findings: list[Finding]) -> dict:
    """Analysiert eine einzelne API-Route auf Security/Performance-Probleme."""
    text = path.read_text(encoding="utf-8", errors="replace")
    r = rel(path)
    is_public   = "/api/public/" in r or "/api/health" in r or "/api/auth/callback" in r
    is_cron     = "/api/cron/" in r
    is_webhook  = "webhook" in r
    is_portal   = "/api/portal/" in r

    # HTTP-Methoden die dieser Route hat
    methods = set(m for pair in RE_EXPORT_HANDLER.findall(text) for m in pair if m)
    has_mutation = bool(methods & {"POST", "PUT", "PATCH", "DELETE"})
    has_service_role = bool(RE_SERVICE_CLIENT.search(text))
    has_auth_check   = bool(RE_AUTH_BEFORE_SC.search(text))
    has_rate_limit   = bool(RE_RATE_LIMIT.search(text))
    has_body_parse   = bool(RE_BODY_PARSE.search(text))
    has_body_validate = bool(RE_BODY_VALIDATE.search(text))
    has_error_leak   = bool(RE_ERROR_LEAK.search(text))
    has_gym_filter   = bool(RE_GYM_FILTER.search(text))
    has_promise_all  = bool(RE_PROMISE_ALL.search(text))
    has_try_catch    = bool(RE_TRY_CATCH.search(text))
    has_sentry       = bool(RE_SENTRY_CAPTURE.search(text))

    result = {
        "file": r, "methods": sorted(methods), "is_public": is_public,
        "is_cron": is_cron, "is_webhook": is_webhook,
        "has_auth": has_auth_check, "has_service_role": has_service_role,
        "has_rate_limit": has_rate_limit, "has_body_validate": has_body_validate,
        "has_gym_filter": has_gym_filter,
    }

    # Routen die by-design ohne Auth laufen: Registrierung, OAuth-Callback,
    # Signup-Link, Staff-Accept-Link — alles sind "unauthenticated entry points".
    is_intentionally_public = any(x in r for x in [
        "/api/auth/register", "/api/signup", "/api/staff/accept",
        "/api/stripe/connect/callback", "/api/newsletter/",
        "/api/public/contact",
    ])

    # ── 1. AUTH ───────────────────────────────────────────────────────────────
    if has_service_role and not has_auth_check and not is_public and not is_cron \
            and not is_webhook and not is_intentionally_public:
        # Service-role ohne Auth ist ein potenzieller Bypass
        # Prüfe genauer: Portal-Routen authenticaten via token-lookup (das ist OK)
        if not is_portal:
            findings.append(Finding(
                severity="HIGH", category="AUTH",
                file=r, line=1,
                detail=f"Service-role-Client verwendet ohne erkennbare getUser()-Prüfung. Methoden: {sorted(methods)}",
                recommendation="Stelle sicher, dass vor jedem serviceClient()-Einsatz der JWT via getUser() verifiziert wurde.",
            ))

    # ── 2. CRON-AUTH ─────────────────────────────────────────────────────────
    # cronGuard() aus @/lib/cron-guard checks CRON_SECRET via timingSafeEqual
    has_cron_guard = bool(re.search(r"cronGuard|CRON_SECRET", text))
    if is_cron and not has_cron_guard:
        findings.append(Finding(
            severity="CRITICAL", category="CRON_AUTH",
            file=r, line=1,
            detail="Cron-Route ohne CRON_SECRET-Prüfung — jeder kann diesen Endpunkt aufrufen.",
            recommendation="Füge am Anfang des Handlers hinzu: if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) return 401",
        ))

    # ── 3. RATE-LIMIT ─────────────────────────────────────────────────────────
    if is_public and has_mutation and not has_rate_limit:
        findings.append(Finding(
            severity="HIGH", category="RATE_LIMIT",
            file=r, line=1,
            detail=f"Öffentliche Mutations-Route ({sorted(methods & {'POST','PUT','PATCH','DELETE'})}) ohne Rate-Limiting.",
            recommendation="Upstash-Rate-Limiter einbinden oder IP-basiertes Throttling in proxy.ts.",
        ))

    # ── 4. INPUT-VALIDATION ───────────────────────────────────────────────────
    if has_mutation and has_body_parse and not has_body_validate:
        findings.append(Finding(
            severity="MEDIUM", category="INPUT",
            file=r, line=1,
            detail="Request-Body wird geparst aber nicht validiert (kein typeof/zod/length-Check).",
            recommendation="Mindestens typeof-Checks + Längen-Limits auf alle Body-Felder.",
        ))

    # ── 5. ERROR-LEAK ─────────────────────────────────────────────────────────
    if has_error_leak:
        # Zähle wie oft raw error.message in JSON-Response geht
        leaks = re.findall(r"error\.message|err\.message", text)
        if len(leaks) > 3:
            findings.append(Finding(
                severity="MEDIUM", category="ERROR_LEAK",
                file=r, line=1,
                detail=f"Rohe DB/Stripe-Fehlermeldungen ({len(leaks)}×) werden direkt an den Client zurückgegeben.",
                recommendation="Generische Fehlermeldungen nach außen, Details nur in console.error/Sentry.",
            ))

    # ── 6. MULTI-TENANT ──────────────────────────────────────────────────────
    # Portal-Routen authenticaten via portal_token → member → gym_id (akzeptiert)
    # Intentionally-public Routen brauchen keinen gym_id-Filter
    if has_service_role and not is_public and not is_cron and not is_webhook \
            and not is_portal and not is_intentionally_public:
        # Service-role mit großem SELECT ohne gym_id-Filter ist ein Tenancy-Leck
        big_selects = [m for m in re.finditer(r"\.from\(['\"](\w+)['\"]\).*?\.select\(", text, re.S)
                       if not re.search(r"eq\(['\"]gym_id['\"]|portal_token|invite_token|gym\.id", text[m.start():m.start()+400])]
        if big_selects and len(big_selects) > 3:
            findings.append(Finding(
                severity="HIGH", category="MULTI_TENANT",
                file=r, line=1,
                detail=f"Service-role-Client liest {len(big_selects)} Tabellen ohne sichtbaren gym_id-Filter — mögliches Cross-Tenant-Datenleck.",
                recommendation="Alle serviceClient()-Queries müssen .eq('gym_id', verifiedGymId) haben.",
            ))

    # ── 7. PERFORMANCE — await-in-loop ───────────────────────────────────────
    # Heuristik: 'await' taucht nach einem 'for (' auf innerhalb von 500 Zeichen
    for_await_pattern = re.compile(r"\bfor\s*\(.*?\)\s*\{[^}]{0,500}\bawait\b", re.S)
    if for_await_pattern.search(text):
        findings.append(Finding(
            severity="MEDIUM", category="PERFORMANCE",
            file=r, line=1,
            detail="await-in-for-Schleife gefunden — sequentielle DB/API-Calls statt Promise.all.",
            recommendation="Sammle Promises in einem Array und nutze Promise.all() für parallele Ausführung.",
        ))

    # ── 8. PERFORMANCE — .limit() fehlt bei selects ──────────────────────────
    large_limits = RE_LARGE_LIMIT.findall(text)
    if large_limits:
        findings.append(Finding(
            severity="LOW", category="PERFORMANCE",
            file=r, line=1,
            detail=f"Große .limit()-Werte gefunden: {large_limits} — könnten Timeouts verursachen.",
            recommendation="Sinnvolle Obergrenzen je nach Use-Case (aktive Members: 500, Attendance: 3000).",
        ))

    # ── 9. PORTAL-TOKEN: fehlende Längenprüfung ──────────────────────────────
    if is_portal and not re.search(r"token\.length|token\.trim|if\s*\(!\s*token", text):
        findings.append(Finding(
            severity="LOW", category="INPUT",
            file=r, line=1,
            detail="Portal-Token wird nicht auf Mindestlänge geprüft.",
            recommendation="if (!token || token.length < 10) return 400",
        ))

    return result

def audit_client_components(findings: list[Finding]) -> None:
    """Prüft Client-Components auf direkten Supabase-Write ohne API-Proxy."""
    for path in list_all_source():
        text = path.read_text(encoding="utf-8", errors="replace")
        r = rel(path)
        if "route.ts" in r or "route.tsx" in r:
            continue
        if not re.search(r"['\"]use client['\"]", text):
            continue

        # Supabase createClient in Client-Component importiert (Grundvoraussetzung)
        if "createClient" not in text and "@/lib/supabase/client" not in text:
            continue

        # Direkte Supabase .update() / .delete() / .insert() in Client-Components
        # Regex: von('.tabellenname').operation( — einfache Kette
        direct_writes = re.findall(
            r"\.from\(['\"][a-z_]+['\"]\)\s*(?:\.[a-z]+\([^)]*\))*\s*\.(update|delete|insert)\s*\(",
            text
        )
        if direct_writes:
            findings.append(Finding(
                severity="MEDIUM", category="CORS/AUTH",
                file=r, line=1,
                detail=f"Client-Component schreibt direkt in Supabase ({', '.join(set(direct_writes))}) statt via API-Route — CORS-anfällig & umgeht Server-Validierung.",
                recommendation="Alle schreibenden DB-Operationen über API-Routes proxyen (wie ToggleActiveButton bereits fixed).",
            ))

def audit_env_vars(findings: list[Finding]) -> None:
    """Prüft ENV-Var-Konsistenz."""
    env_file = PROJECT_ROOT / ".env.local"
    env_example = PROJECT_ROOT / ".env.example"

    used_vars: set[str] = set()
    for path in list_all_source():
        text = path.read_text(encoding="utf-8", errors="replace")
        used_vars.update(re.findall(r"process\.env\.([A-Z][A-Z0-9_]+)", text))

    # NEXTAUTH_SECRET ist gesetzt aber NextAuth wird nicht verwendet
    if "NEXTAUTH_SECRET" in used_vars:
        findings.append(Finding(
            severity="INFO", category="ENV",
            file="src/ (global)", line=0,
            detail="NEXTAUTH_SECRET wird referenziert, aber NextAuth ist nicht installiert — toter ENV-Key.",
            recommendation="Prüfen welche Datei diesen Key nutzt und ob er entfernt werden kann.",
        ))

    # STRIPE_CLIENT_ID — Legacy-OAuth
    if "STRIPE_CLIENT_ID" in used_vars:
        findings.append(Finding(
            severity="INFO", category="ENV",
            file="src/ (global)", line=0,
            detail="STRIPE_CLIENT_ID ist gesetzt (OAuth-Flow), wird aber nur im Legacy-Callback verwendet.",
            recommendation="Kann entfernt werden wenn der programmatische Express-Account-Flow der einzige Weg ist.",
        ))

def audit_large_files(findings: list[Finding]) -> None:
    """Große Dateien über 400 Zeilen — Wartbarkeits-Warnung."""
    for path in list_all_source():
        lines = path.read_text(encoding="utf-8", errors="replace").count("\n")
        if lines > 500:
            findings.append(Finding(
                severity="INFO", category="MAINTAINABILITY",
                file=rel(path), line=0,
                detail=f"{lines} Zeilen — zu groß für einfache Code-Reviews und Testing.",
                recommendation="In kleinere Module aufteilen. API-Logik in /lib auslagern.",
            ))
        elif lines > 350 and "route.ts" in str(path):
            findings.append(Finding(
                severity="LOW", category="MAINTAINABILITY",
                file=rel(path), line=0,
                detail=f"API-Route mit {lines} Zeilen — Komplexität steigt Wartung.",
                recommendation="Handler-Logik in /lib/handlers/ oder /lib/services/ auslagern.",
            ))

def audit_missing_tests(findings: list[Finding]) -> None:
    """Prüft ob kritische Geldfluss-Routen Tests haben."""
    money_routes = [
        "src/app/api/stripe/webhook/route.ts",
        "src/app/api/stripe/sync-payments/route.ts",
        "src/app/api/stripe/create-checkout/route.ts",
        "src/app/api/stripe/subscribe/route.ts",
        "src/app/api/payments/[id]/route.ts",
        "src/app/api/cron/payment-reminders/route.ts",
    ]
    test_dir = PROJECT_ROOT / "src" / "__tests__"
    vitest_files: set[str] = set()
    for root, dirs, fnames in os.walk(PROJECT_ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fn in fnames:
            if fn.endswith(".test.ts") or fn.endswith(".spec.ts") or fn.endswith(".test.tsx"):
                vitest_files.add(fn)

    for route in money_routes:
        name = Path(route).parent.name
        has_test = any(name in f for f in vitest_files)
        if not has_test:
            findings.append(Finding(
                severity="HIGH", category="TESTING",
                file=route, line=0,
                detail=f"Geldfluss-Route ohne automatisierten Test — Regressions-Risiko bei jeder Änderung.",
                recommendation=f"Vitest-Test in src/__tests__/{name}.test.ts erstellen.",
            ))

def build_report(findings: list[Finding], route_info: list[dict]) -> None:
    OUT_DIR.mkdir(exist_ok=True)

    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
    findings.sort(key=lambda f: (severity_order.get(f.severity, 9), f.category, f.file))

    counts = defaultdict(int)
    by_cat: dict[str, list[Finding]] = defaultdict(list)
    for f in findings:
        counts[f.severity] += 1
        by_cat[f.category].append(f)

    # ── JSON ──────────────────────────────────────────────────────────────────
    data = {
        "summary": dict(counts),
        "total": len(findings),
        "route_inventory": route_info,
        "findings": [asdict(f) for f in findings],
    }
    (OUT_DIR / "security.json").write_text(json.dumps(data, indent=2, ensure_ascii=False))

    # ── Markdown ──────────────────────────────────────────────────────────────
    md = ["# bjjpunkte — Deep Security & Performance Audit\n"]
    md.append(f"_Geprüft: {len(route_info)} API-Routen + alle Client-Components_\n")

    md.append("## Zusammenfassung\n")
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        n = counts[sev]
        if n:
            icon = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🔵", "INFO": "⚪"}[sev]
            md.append(f"- {icon} **{sev}**: {n} Befunde")
    md.append("")

    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        cats = [c for c, flist in by_cat.items() if any(f.severity == sev for f in flist)]
        if not cats:
            continue
        md.append(f"## {sev}\n")
        for f in findings:
            if f.severity != sev:
                continue
            md.append(f"### [{f.category}] `{f.file}`")
            md.append(f"> {f.detail}")
            if f.recommendation:
                md.append(f"\n**Fix:** {f.recommendation}")
            md.append("")

    md.append("## Routen-Inventar (Auth/Rate-Limit Status)\n")
    md.append("| Route | Methoden | Auth | RateLimit | GymFilter |")
    md.append("|-------|----------|------|-----------|-----------|")
    for ri in route_info:
        r = ri["file"].replace("src/app/api", "").replace("/route.ts", "").replace("/route.tsx", "")
        methods = ",".join(ri["methods"])
        auth = "✅" if ri["has_auth"] else ("🌐 public" if ri["is_public"] or ri["is_cron"] else "❌")
        rl   = "✅" if ri["has_rate_limit"] else "—"
        gf   = "✅" if ri["has_gym_filter"] else "—"
        md.append(f"| `{r}` | {methods} | {auth} | {rl} | {gf} |")

    (OUT_DIR / "security.md").write_text("\n".join(md))

def main() -> int:
    print("bjjpunkte Deep Audit läuft...")
    findings: list[Finding] = []
    route_info: list[dict] = []

    routes = list_api_routes()
    print(f"  → {len(routes)} API-Routen")

    for path in routes:
        try:
            info = audit_route(path, findings)
            route_info.append(info)
        except Exception as e:
            print(f"  WARN: {rel(path)}: {e}", file=sys.stderr)

    print(f"  → Client-Component-Analyse...")
    audit_client_components(findings)

    print(f"  → ENV-Var-Prüfung...")
    audit_env_vars(findings)

    print(f"  → Große Dateien...")
    audit_large_files(findings)

    print(f"  → Test-Coverage-Prüfung...")
    audit_missing_tests(findings)

    build_report(findings, route_info)

    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
    counts = defaultdict(int)
    for f in findings:
        counts[f.severity] += 1

    print(f"\n✓ Audit abgeschlossen — {len(findings)} Befunde")
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
        if counts[sev]:
            print(f"  {sev}: {counts[sev]}")
    print(f"\n  Output: .analysis/security.md + security.json")
    return 0

if __name__ == "__main__":
    sys.exit(main())
