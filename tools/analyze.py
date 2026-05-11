#!/usr/bin/env python3
"""
bjjpunkte Code-Analyzer — atomare Analyse pro Datei + Projekt-Aggregationen.

Liest alle .ts/.tsx/.js/.jsx-Dateien unter src/ und extrahiert:
  - Imports / Exports
  - 'use client' Direktive
  - Hydration-Risiken (toLocaleString, new Date(), Math.random in Render)
  - useEffect-Dep-Heuristik
  - Next.js-Routen (page.tsx, layout.tsx, route.ts unter src/app)
  - API-Endpoints (route.ts unter src/app/api)
  - Env-Var-Nutzung (process.env.X)
  - Supabase-Patterns (from('...').select / .insert / .update)
  - TODO / FIXME / XXX-Marker
  - Lines of code

Aggregiert zu:
  - Import-Graph (reverse: wer importiert mich?)
  - Orphan-Dateien (von niemandem importiert — Dead-Code-Verdacht)
  - Route-Map
  - API-Map
  - Env-Var-Index
  - Hydration-Hotspots

Ausgabe:
  - .analysis/report.json   — vollständig, maschinen-lesbar
  - .analysis/report.md     — kompakte Übersicht für Menschen
  - .analysis/orphans.txt   — Liste verwaister Dateien
  - .analysis/hotspots.txt  — Liste Dateien mit Hydration-Risiko

Stdlib-only. Keine externen Deps.

Nutzung:
  python3 tools/analyze.py                  # Volle Analyse
  python3 tools/analyze.py --json           # nur JSON, kein Markdown
  python3 tools/analyze.py --filter rechner # nur Dateien mit 'rechner' im Pfad
  python3 tools/analyze.py --route          # nur Routen + APIs auflisten
  python3 tools/analyze.py --hotspots       # nur Hydration-Risiken
  python3 tools/analyze.py --deps src/components/TopNav.tsx
                                            # Reverse-Deps: wer nutzt diese Datei
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = PROJECT_ROOT / "src"
OUT_DIR = PROJECT_ROOT / ".analysis"
SOURCE_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}

# Patterns — bewusst tolerant, regex statt echtem Parser.
RE_IMPORT_STMT  = re.compile(r"""^\s*import\s+(?:[^'"`]*?\bfrom\s+)?['"`]([^'"`]+)['"`]""", re.M)
RE_REQUIRE      = re.compile(r"""\brequire\(\s*['"`]([^'"`]+)['"`]\s*\)""")
RE_DYN_IMPORT   = re.compile(r"""\bimport\(\s*['"`]([^'"`]+)['"`]\s*\)""")
# Barrel re-exports: export { X } from '...'  /  export * from '...'
RE_REEXPORT     = re.compile(r"""^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['"`]([^'"`]+)['"`]""", re.M)
RE_EXPORT_DECL  = re.compile(r"""^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)""", re.M)
RE_EXPORT_NAMED = re.compile(r"""^\s*export\s*\{\s*([^}]+)\s*\}""", re.M)
RE_USE_CLIENT   = re.compile(r"""^\s*['"]use client['"]\s*;?""", re.M)
RE_USE_SERVER   = re.compile(r"""^\s*['"]use server['"]\s*;?""", re.M)
RE_TO_LOCALE    = re.compile(r"""\.toLocaleString\s*\(""")
RE_LOCALE_DATE  = re.compile(r"""\.toLocaleDateString\s*\(|\.toLocaleTimeString\s*\(""")
RE_NEW_DATE     = re.compile(r"""\bnew Date\s*\(\s*\)""")  # Date() ohne Argument = jetzt = hydration risk
RE_DATE_NOW     = re.compile(r"""\bDate\.now\s*\(\s*\)""")
RE_MATH_RANDOM  = re.compile(r"""\bMath\.random\s*\(""")
RE_USE_EFFECT   = re.compile(r"""\buseEffect\s*\(""")
RE_USE_STATE    = re.compile(r"""\buseState\s*\(""")
RE_HOOK_CALL    = re.compile(r"""\buse[A-Z]\w+\s*\(""")
RE_ENV_VAR      = re.compile(r"""\bprocess\.env\.([A-Z][A-Z0-9_]+)""")
RE_SUPA_TABLE   = re.compile(r"""\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)""")
RE_TODO         = re.compile(r"""//\s*(TODO|FIXME|XXX|HACK)\s*[:\-]?\s*(.*)""")
RE_DEFAULT_EXP  = re.compile(r"""^\s*export\s+default\b""", re.M)
RE_NEXT_RUNTIME = re.compile(r"""export\s+const\s+runtime\s*=\s*['"`](\w+)['"`]""")
RE_NEXT_DYN     = re.compile(r"""export\s+const\s+dynamic\s*=\s*['"`]([\w-]+)['"`]""")

# Pfade die übersprungen werden — node_modules ist klar, .next auch, ebenso Test-Snapshots
SKIP_DIRS = {"node_modules", ".next", "dist", "build", ".analysis", "coverage", "__snapshots__"}


@dataclass
class FileRecord:
    path: str                          # relativ zu PROJECT_ROOT
    ext: str
    lines: int
    bytes: int
    use_client: bool = False
    use_server: bool = False
    imports: list[str] = field(default_factory=list)          # raw module specifiers
    imports_resolved: list[str] = field(default_factory=list) # zu Projekt-Pfaden aufgelöst
    exports: list[str] = field(default_factory=list)
    has_default_export: bool = False
    hooks: list[str] = field(default_factory=list)            # unique hook names
    n_use_effect: int = 0
    n_use_state: int = 0
    env_vars: list[str] = field(default_factory=list)
    supabase_tables: list[str] = field(default_factory=list)
    hydration_risks: list[str] = field(default_factory=list)  # kurze Notizen
    todos: list[dict] = field(default_factory=list)            # {kind, line, text}
    is_route: Optional[str] = None       # 'page' | 'layout' | 'api' | None
    route_path: Optional[str] = None     # /pricing, /api/track usw.
    next_runtime: Optional[str] = None   # nodejs | edge
    next_dynamic: Optional[str] = None   # force-dynamic | force-static | ...


def list_source_files() -> list[Path]:
    files = []
    for root, dirs, fnames in os.walk(SRC_ROOT):
        # In-place filter — beschleunigt walk drastisch
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in fnames:
            p = Path(root) / fn
            if p.suffix in SOURCE_EXTS:
                files.append(p)
    return sorted(files)


def resolve_import(spec: str, importer: Path) -> Optional[str]:
    """
    Versucht eine Import-Specifier auf einen tatsächlichen Projekt-Pfad zu mappen.
    Unterstützt:
      - '@/foo/bar'        → src/foo/bar
      - './rel'            → relativ zum Importer
      - 'externes-pkg'     → None (kein Projekt-File)

    Liefert relativen Pfad ab PROJECT_ROOT zurück, oder None.
    Probiert .ts, .tsx, .js, .jsx und /index.* Suffixe.
    """
    if not spec:
        return None
    if spec.startswith("@/"):
        candidate = SRC_ROOT / spec[2:]
    elif spec.startswith(".") or spec.startswith("/"):
        candidate = (importer.parent / spec).resolve()
    else:
        return None  # node_modules-Paket

    # Direkt-Match
    if candidate.is_file():
        try:
            return str(candidate.relative_to(PROJECT_ROOT))
        except ValueError:
            return None

    # Mit Extension
    for ext in (".ts", ".tsx", ".js", ".jsx", ".mjs"):
        p = candidate.with_suffix(ext) if candidate.suffix else Path(str(candidate) + ext)
        if p.is_file():
            try:
                return str(p.relative_to(PROJECT_ROOT))
            except ValueError:
                return None

    # Index-File
    if candidate.is_dir():
        for ext in (".ts", ".tsx", ".js", ".jsx"):
            p = candidate / f"index{ext}"
            if p.is_file():
                try:
                    return str(p.relative_to(PROJECT_ROOT))
                except ValueError:
                    return None

    return None


def derive_route(rel_path: str) -> tuple[Optional[str], Optional[str]]:
    """
    Aus 'src/app/pricing/page.tsx' wird ('page', '/pricing').
    Aus 'src/app/api/track/route.ts' wird ('api', '/api/track').
    Aus 'src/app/(group)/about/page.tsx' wird ('page', '/about')  — Group entfernt.
    """
    if not rel_path.startswith("src/app/"):
        return None, None

    p = Path(rel_path)
    stem = p.stem
    if stem not in ("page", "layout", "route"):
        return None, None

    kind = "api" if stem == "route" else stem
    # /src/app/... → ...
    segments = list(p.parts[2:-1])  # ohne 'src','app', ohne Dateiname
    # Route Groups (klammern) entfernen
    cleaned = [s for s in segments if not (s.startswith("(") and s.endswith(")"))]
    if not cleaned:
        route = "/"
    else:
        route = "/" + "/".join(cleaned)
    return kind, route


def detect_hydration_risks(text: str) -> list[str]:
    """
    Heuristik: was kann SSR ≠ CSR machen?
    """
    risks = []
    if RE_TO_LOCALE.search(text):
        risks.append("toLocaleString — locale-abhängig, SSR/CSR-Mismatch möglich")
    if RE_LOCALE_DATE.search(text):
        risks.append("toLocaleDate/TimeString — locale-abhängig")
    if RE_NEW_DATE.search(text):
        risks.append("new Date() ohne Argument — Server- und Client-Zeit unterscheiden sich")
    if RE_DATE_NOW.search(text):
        risks.append("Date.now() — SSR/CSR-Drift")
    if RE_MATH_RANDOM.search(text):
        risks.append("Math.random() — SSR ≠ CSR")
    return risks


def analyze_file(path: Path) -> FileRecord:
    rel = str(path.relative_to(PROJECT_ROOT))
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.count("\n") + (0 if text.endswith("\n") or not text else 1)

    rec = FileRecord(
        path=rel,
        ext=path.suffix,
        lines=lines,
        bytes=len(text.encode("utf-8")),
    )

    rec.use_client = bool(RE_USE_CLIENT.search(text))
    rec.use_server = bool(RE_USE_SERVER.search(text))

    # Imports
    imports = []
    imports += RE_IMPORT_STMT.findall(text)
    imports += RE_REQUIRE.findall(text)
    imports += RE_DYN_IMPORT.findall(text)
    imports += RE_REEXPORT.findall(text)   # Barrel-Files zählen
    rec.imports = sorted(set(imports))

    resolved = []
    for spec in rec.imports:
        r = resolve_import(spec, path)
        if r:
            resolved.append(r)
    rec.imports_resolved = sorted(set(resolved))

    # Exports
    exports = set(RE_EXPORT_DECL.findall(text))
    for m in RE_EXPORT_NAMED.findall(text):
        for name in m.split(","):
            n = name.strip().split(" as ")[0].strip()
            if n and n != "default":
                exports.add(n)
    rec.exports = sorted(exports)
    rec.has_default_export = bool(RE_DEFAULT_EXP.search(text))

    # Hooks
    hooks = sorted(set(RE_HOOK_CALL.findall(text)))
    # RE_HOOK_CALL liefert nur die Hook-Namen inkl. "(" — strip
    rec.hooks = [h.rstrip("(").strip() for h in hooks]
    rec.n_use_effect = len(RE_USE_EFFECT.findall(text))
    rec.n_use_state = len(RE_USE_STATE.findall(text))

    # Env vars
    rec.env_vars = sorted(set(RE_ENV_VAR.findall(text)))

    # Supabase
    rec.supabase_tables = sorted(set(RE_SUPA_TABLE.findall(text)))

    # Hydration — nur in Client-Components relevant, aber wir markieren überall
    rec.hydration_risks = detect_hydration_risks(text)

    # TODOs
    for i, line in enumerate(text.splitlines(), 1):
        m = RE_TODO.search(line)
        if m:
            rec.todos.append({"kind": m.group(1), "line": i, "text": m.group(2).strip()})

    # Next.js Route Detection
    kind, route = derive_route(rel)
    if kind:
        rec.is_route = kind
        rec.route_path = route

    rt = RE_NEXT_RUNTIME.search(text)
    if rt:
        rec.next_runtime = rt.group(1)
    nd = RE_NEXT_DYN.search(text)
    if nd:
        rec.next_dynamic = nd.group(1)

    return rec


def build_reverse_graph(records: list[FileRecord]) -> dict[str, list[str]]:
    """Wer importiert wen → reverse Index."""
    rev: dict[str, set[str]] = defaultdict(set)
    for r in records:
        for target in r.imports_resolved:
            rev[target].add(r.path)
    return {k: sorted(v) for k, v in rev.items()}


def find_orphans(records: list[FileRecord], reverse: dict[str, list[str]]) -> list[str]:
    """
    Dateien die von niemandem importiert werden UND keine Route sind UND nicht
    'index.ts' oder Entry-Point. Achtung: Heuristik — kann False-Positives geben
    bei Dateien die per Next.js-Convention magisch geladen werden (z.B.
    middleware.ts, instrumentation.ts, app/error.tsx, etc.).
    """
    by_path = {r.path: r for r in records}
    magic_basenames = {
        "middleware.ts", "instrumentation.ts", "proxy.ts",
        "error.tsx", "not-found.tsx", "loading.tsx", "template.tsx",
        "global-error.tsx", "default.tsx", "globals.css",
        "robots.ts", "sitemap.ts", "manifest.ts", "opengraph-image.tsx",
        "twitter-image.tsx", "icon.tsx", "apple-icon.tsx",
    }
    orphans = []
    for r in records:
        if r.path in reverse:
            continue  # wird importiert
        if r.is_route:
            continue  # Next.js Route
        basename = Path(r.path).name
        if basename in magic_basenames:
            continue
        # Auch Dateien die ein Next.js-Setup-Pattern matchen überspringen
        if basename.startswith("middleware.") or basename.startswith("proxy."):
            continue
        orphans.append(r.path)
    return orphans


def write_outputs(records: list[FileRecord], reverse: dict[str, list[str]], orphans: list[str]) -> None:
    OUT_DIR.mkdir(exist_ok=True)

    # Aggregate
    env_index: dict[str, list[str]] = defaultdict(list)
    supa_index: dict[str, list[str]] = defaultdict(list)
    todo_count = 0
    hotspots: list[FileRecord] = []
    routes: list[FileRecord] = []
    apis:   list[FileRecord] = []
    client_components: list[FileRecord] = []

    for r in records:
        for e in r.env_vars:
            env_index[e].append(r.path)
        for t in r.supabase_tables:
            supa_index[t].append(r.path)
        todo_count += len(r.todos)
        if r.hydration_risks and r.use_client:
            hotspots.append(r)
        if r.is_route == "page":
            routes.append(r)
        elif r.is_route == "api":
            apis.append(r)
        if r.use_client:
            client_components.append(r)

    summary = {
        "project_root": str(PROJECT_ROOT),
        "total_files": len(records),
        "total_lines": sum(r.lines for r in records),
        "client_components": len(client_components),
        "routes": len(routes),
        "api_endpoints": len(apis),
        "orphan_files": len(orphans),
        "hydration_hotspots": len(hotspots),
        "todo_markers": todo_count,
        "supabase_tables_touched": sorted(supa_index.keys()),
        "env_vars_used": sorted(env_index.keys()),
    }

    full = {
        "summary": summary,
        "files": [asdict(r) for r in records],
        "reverse_imports": reverse,
        "orphans": orphans,
        "env_index": {k: sorted(set(v)) for k, v in env_index.items()},
        "supabase_index": {k: sorted(set(v)) for k, v in supa_index.items()},
    }
    (OUT_DIR / "report.json").write_text(json.dumps(full, indent=2, ensure_ascii=False))

    # Orphans + Hotspots als plain text
    (OUT_DIR / "orphans.txt").write_text("\n".join(orphans) + "\n")
    (OUT_DIR / "hotspots.txt").write_text(
        "\n".join(f"{r.path}\t{'; '.join(r.hydration_risks)}" for r in hotspots) + "\n"
    )

    # Markdown-Übersicht
    md = []
    md.append("# bjjpunkte Code-Analyse\n")
    md.append(f"_{summary['total_files']} Dateien · {summary['total_lines']:,} Zeilen · "
              f"{summary['client_components']} Client-Components · "
              f"{summary['routes']} Routen · {summary['api_endpoints']} APIs_\n")

    md.append("## Routen (App Router)\n")
    for r in sorted(routes, key=lambda x: x.route_path or ""):
        md.append(f"- `{r.route_path}` → `{r.path}`")
    md.append("")

    md.append("## API-Endpoints\n")
    for r in sorted(apis, key=lambda x: x.route_path or ""):
        runtime = f" _[{r.next_runtime}]_" if r.next_runtime else ""
        dyn = f" _[{r.next_dynamic}]_" if r.next_dynamic else ""
        md.append(f"- `{r.route_path}` → `{r.path}`{runtime}{dyn}")
    md.append("")

    md.append("## Supabase-Tabellen (Touchpoints)\n")
    for table, files in sorted(supa_index.items()):
        md.append(f"- **{table}** ({len(files)} Datei{'en' if len(files)!=1 else ''})")
        for f in sorted(set(files))[:5]:
            md.append(f"    - `{f}`")
        if len(set(files)) > 5:
            md.append(f"    - … +{len(set(files))-5} weitere")
    md.append("")

    md.append("## Env-Variablen (Nutzung)\n")
    for env, files in sorted(env_index.items()):
        md.append(f"- `{env}` — {len(set(files))} Datei{'en' if len(set(files))!=1 else ''}")
    md.append("")

    md.append("## Hydration-Hotspots (Client-Components mit SSR/CSR-Risiko)\n")
    if not hotspots:
        md.append("_Keine — alle bekannten Risiken sind in Server-Components._\n")
    else:
        for r in hotspots:
            md.append(f"- `{r.path}`")
            for risk in r.hydration_risks:
                md.append(f"    - ⚠ {risk}")
    md.append("")

    md.append("## Verwaiste Dateien (Dead-Code-Verdacht)\n")
    if not orphans:
        md.append("_Keine — alle Dateien werden referenziert oder sind Routes._\n")
    else:
        md.append(f"_{len(orphans)} Datei{'en' if len(orphans)!=1 else ''} ohne Importer — bitte manuell prüfen, "
                  "manche Next.js-Konventions-Dateien werden nicht erkannt._\n")
        for p in orphans:
            md.append(f"- `{p}`")
    md.append("")

    md.append("## TODOs / FIXMEs\n")
    todo_files = [r for r in records if r.todos]
    if not todo_files:
        md.append("_Keine offenen Marker._\n")
    else:
        for r in todo_files:
            for t in r.todos:
                md.append(f"- `{r.path}:{t['line']}` **{t['kind']}** — {t['text']}")
    md.append("")

    (OUT_DIR / "report.md").write_text("\n".join(md))


def cmd_full(args) -> None:
    files = list_source_files()
    records = [analyze_file(f) for f in files]
    if args.filter:
        records = [r for r in records if args.filter.lower() in r.path.lower()]
    reverse = build_reverse_graph(records)
    orphans = find_orphans(records, reverse)
    write_outputs(records, reverse, orphans)

    print(f"✓ {len(records)} Dateien analysiert")
    print(f"  Output: {OUT_DIR.relative_to(PROJECT_ROOT)}/")
    print(f"    - report.json   ({(OUT_DIR / 'report.json').stat().st_size // 1024} KB)")
    print(f"    - report.md")
    print(f"    - orphans.txt   ({len(orphans)} Einträge)")
    n_hot = sum(1 for r in records if r.hydration_risks and r.use_client)
    print(f"    - hotspots.txt  ({n_hot} Einträge)")


def cmd_routes(args) -> None:
    files = list_source_files()
    records = [analyze_file(f) for f in files]
    routes = [r for r in records if r.is_route == "page"]
    apis   = [r for r in records if r.is_route == "api"]

    print(f"\n=== ROUTEN ({len(routes)}) ===")
    for r in sorted(routes, key=lambda x: x.route_path or ""):
        print(f"  {r.route_path:<40} {r.path}")

    print(f"\n=== APIs ({len(apis)}) ===")
    for r in sorted(apis, key=lambda x: x.route_path or ""):
        extras = []
        if r.next_runtime: extras.append(r.next_runtime)
        if r.next_dynamic: extras.append(r.next_dynamic)
        suffix = f"  [{', '.join(extras)}]" if extras else ""
        print(f"  {r.route_path:<40} {r.path}{suffix}")


def cmd_hotspots(args) -> None:
    files = list_source_files()
    records = [analyze_file(f) for f in files]
    hot = [r for r in records if r.hydration_risks and r.use_client]
    if not hot:
        print("✓ Keine Hydration-Risiken in Client-Components gefunden.")
        return
    print(f"\n=== HYDRATION-HOTSPOTS ({len(hot)}) ===")
    for r in hot:
        print(f"\n  {r.path}")
        for risk in r.hydration_risks:
            print(f"    ⚠ {risk}")


def cmd_deps(args) -> None:
    target = args.deps
    files = list_source_files()
    records = [analyze_file(f) for f in files]
    reverse = build_reverse_graph(records)
    # Normalisierung
    target_rel = target
    if target.startswith(str(PROJECT_ROOT)):
        target_rel = str(Path(target).relative_to(PROJECT_ROOT))

    importers = reverse.get(target_rel, [])
    print(f"\n=== Importer von {target_rel} ({len(importers)}) ===")
    for imp in importers:
        print(f"  {imp}")
    if not importers:
        print("  (keine — möglicherweise Orphan, Route oder Next.js-Konventions-Datei)")


def main() -> int:
    parser = argparse.ArgumentParser(description="bjjpunkte Code-Analyzer")
    parser.add_argument("--filter", help="Nur Dateien mit Substring im Pfad")
    parser.add_argument("--routes", action="store_true", help="Nur Routen + APIs auflisten")
    parser.add_argument("--hotspots", action="store_true", help="Nur Hydration-Risiken auflisten")
    parser.add_argument("--deps", metavar="PATH", help="Reverse-Deps für eine Datei zeigen")
    parser.add_argument("--json", action="store_true", help="Nur JSON, kein Markdown")
    args = parser.parse_args()

    if not SRC_ROOT.is_dir():
        print(f"FEHLER: src-Verzeichnis nicht gefunden: {SRC_ROOT}", file=sys.stderr)
        return 1

    if args.routes:
        cmd_routes(args)
    elif args.hotspots:
        cmd_hotspots(args)
    elif args.deps:
        cmd_deps(args)
    else:
        cmd_full(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
