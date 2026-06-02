# osss-audit

The single audit tool for osss.pro. One Rust binary, one walk over the codebase,
every check run against a shared in-memory model. Replaces the former
`tools/analyze.py` + `tools/deep_audit.py` (deleted 2026-06-01) and adds drift
checks neither of them had.

**~0.5 s for the full scan. 0 tokens. Deterministic. CI-ready.**

## Checks

### Security (route-level)
| Category | What it flags |
|---|---|
| `AUTH` | Service-role client used without an auth check (getUser / resolveOwnerGym / getCachedUser / requireAdmin). Excludes public, cron, webhook, token-authed (`[token]` segment or token-column lookup) and intentionally-public entry points. Also emits a route auth-coverage stat. |
| `CRON_AUTH` | Cron route without `cronGuard` / `CRON_SECRET`. |
| `RATE_LIMIT` | Public **mutating** route without `applyRateLimit`. |
| `INPUT` | Mutating route that parses a body but never validates it. |
| `ERROR_LEAK` | Raw `error.message` returned **inside an HTTP response** (not logged) — response-context only, so console.error is not flagged. |
| `MULTI_TENANT` | Service-role reading 3+ tables with **no** gym_id/owner_id scoping anywhere in the route. Admin routes (cross-tenant by design) excluded. |
| `RLS` | Tenant table (gym_id/member_id column) in `database.ts` with no `ENABLE ROW LEVEL SECURITY` in any migration. Views excluded. |
| `WEBHOOK` | Critical Stripe events not handled by the webhook route + a live handled-event count. |

### Quality / maintainability
| Category | What it flags |
|---|---|
| `PERF` | `await` inside a brace-matched loop body (not wrapped in `Promise.all`) + oversized `.limit()` values. |
| `MAINTAINABILITY` | Files > 500 lines, API routes > 350 lines. |
| `CLIENT_WRITE` | `'use client'` component writing directly to Supabase (`.update`/`.delete`/`.insert`) — bypasses server validation. |
| `TESTING` | Money-flow routes (stripe, payments, quote-convert, payment-reminders) with no `*.test.ts`/`*.spec.ts`. |
| `HYDRATION` | SSR/CSR mismatch risks (`toLocaleString`, bare `new Date()`, `Date.now()`, `Math.random()`) in client components. |
| `DEAD_CODE` | Orphan files: imported by nobody, not a route, not a Next.js convention file. |
| `TODO` | TODO/FIXME/XXX/HACK inventory (FIXME/XXX → LOW, TODO/HACK → INFO). |

### Drift (cross-subsystem consistency)
| Category | What it flags |
|---|---|
| `pricing-drift` | Hardcoded EUR prices that don't match `STANDARD_TIER` in `src/lib/pricing.ts`; stale 4-tier prices (29/89/99/149); `PILOT10`/`LIFETIME_PILOT` ghosts. Scans `src/` **and** `compliance/sales/`. |
| `migrations-types-drift` | `table.column` and `FROM table WHERE col` references in migrations that don't exist in `src/types/database.ts` (caught `gym_staff.is_active`, `gyms.onboarding_completed_at`). |
| `crons-drift` | `vercel.json` crons ↔ Inngest functions: missing counterparts + schedule mismatches. |
| `env-consistency` | `.env.example` ↔ `process.env.*` usage (both directions) + NEXTAUTH_SECRET / STRIPE_CLIENT_ID dead-key notes. |
| `infra-drift` | Stale self-repo GitHub URLs across the **whole repo** (scripts/, docs/, .github/, root configs — not just src/). Derives the correct owner/repo from `.git/config`, flags links to our own repo under an old name (404 after a rename). `.sh`/`.github` → HIGH, docs → MEDIUM. Third-party links and Vercel project names are not flagged. |

## Usage

Build once:

```bash
cd tools/osss-audit && cargo build --release
```

The repo root is **auto-detected**: first by walking up from the current
directory (looks for `src/lib/pricing.ts` + `supabase/migrations`), then by
falling back to `~/Developer/osss.pro`. So it works from **anywhere** — inside
the repo, from `~`, even from `/tmp` — with no `--root`:

```bash
BIN=tools/osss-audit/target/release/osss-audit

$BIN all                       # every finding-check, markdown
$BIN --json all                # machine-readable
$BIN --min-severity high all   # only CRITICAL + HIGH (the actionable head)
$BIN security                  # one check
$BIN routes                    # route/supabase/env inventory (report)
$BIN deps src/components/TopNav.tsx   # reverse-dependency lookup
```

`--root <path>` overrides auto-detection (e.g. running against another checkout).

Subcommands: `security perf maintainability testing hydration orphans todos rls
webhook pricing-drift migrations-types-drift crons-drift env-consistency
infra-drift routes deps doctor all`.

### Convenience alias

Add to `~/.zshrc`:

```bash
alias osss-audit="$HOME/Developer/osss.pro/tools/osss-audit/target/release/osss-audit"
```

Then from anywhere in the repo: `osss-audit --min-severity high all`.

## Exit code

`1` if any CRITICAL or HIGH finding exists, else `0`. Use `--min-severity` to
gate CI on a threshold.

```yaml
- name: osss-audit
  run: cd tools/osss-audit && cargo run --release -- --json all > audit.json
  continue-on-error: true
- uses: actions/upload-artifact@v4
  with: { name: osss-audit, path: tools/osss-audit/audit.json }
```

## Trust — how to be sure it reads everything correctly

A regex heuristic can't *prove* correctness like a real parser. Three concrete
ways to verify it instead of trusting it:

**1. Coverage transparency (`doctor`).** Shows exactly what was read — discovered
vs indexed count, read failures (never silent), files by extension and by dir,
and the scan rules. Cross-check against the filesystem:

```bash
osss-audit doctor
# then compare "Discovered" to:
find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) \
  -not -path '*/node_modules/*' | wc -l
```

If a file can't be read (permissions, etc.) it's listed under **Read errors** and
excluded — it is never silently treated as empty.

**2. Test suite (`cargo test`).** 40 unit tests lock every tricky heuristic against
known fixtures — including the exact false-positive cases that were fixed
(separator-adjacent prices like `1.188 €`, `await Promise.all` in a loop, loops
with no await, competitor prices, Views excluded from RLS, `console.error` not
counted as a leak). A future edit that breaks a heuristic fails CI.

```bash
cd tools/osss-audit && cargo test
```

**3. Every finding cites `file:line`.** Open the citation and read the code. The
tool is deterministic — same input, same output, every run.

### Known limitations (documented, not hidden)
- Braceless single-statement loops (`for (x of xs) await f(x)`) are not scanned
  for await-in-loop (locked by a test so it's visible, not accidental).
- Column-drift uses a SQL heuristic, not a real parser — it strips comments and
  string literals but can't resolve dynamic SQL.
- It reads `src/` for code checks; drift checks read specific extra files
  (migrations, vercel.json, .env.example, compliance/sales, src/lib/inngest).
  Anything outside those is out of scope by design — `doctor` states the rules.

## Design notes — honesty over noise

The tool errs toward **not crying wolf**. Concretely:
- AUTH/MULTI_TENANT recognise the real osss helpers (`resolveOwnerGym`,
  `getCachedUser`, `requireAdmin`, `applyRateLimit`, `createServiceClient`) and
  ownership scoping (`owner_id`), so the wrapper-modernised routes aren't false
  positives.
- `await`-in-loop uses real brace matching and excludes `await Promise.all(...)`.
- `ERROR_LEAK` only fires on a message embedded in a response body, never on
  `console.error`.
- RLS excludes Views (they can't take `ALTER TABLE … ENABLE RLS`).
- The migration SQL parser strips comments + string literals and scopes column
  refs to `FROM`/policy clauses.

Every finding cites a `file:line`. If a heuristic still mis-fires, tighten the
relevant regex/exclusion in the matching `src/*.rs` module rather than muting
the whole check.

## Architecture

```
src/
  main.rs            CLI + dispatch + min-severity filter
  finding.rs         Severity, Finding, Report (markdown + JSON)
  model.rs           CodebaseIndex — one walk, every file parsed once
  util.rs            walk, import resolution, route derivation, snippets
  security.rs        AUTH/CRON/RATE_LIMIT/INPUT/ERROR_LEAK/MULTI_TENANT + route flags
  perf.rs            await-in-loop (brace-matched) + large limits
  maintainability.rs large files + client-component direct writes
  testing.rs         money-flow routes without tests
  hydration.rs       client-component SSR/CSR risks
  orphans.rs         dead-code suspects via reverse import graph
  todos.rs           TODO/FIXME/XXX/HACK
  rls.rs             tenant tables without RLS (uses migrations::base_tables)
  webhook.rs         Stripe event coverage
  pricing.rs         price drift across code + sales docs
  migrations.rs      migration columns vs database.ts (+ shared DB-type parser)
  crons.rs           vercel.json ↔ Inngest
  env.rs             .env.example ↔ process.env.*
  routes.rs          inventory + deps printers (report, not findings)
```

Heuristic, not a real parser — deliberately small and replaceable. If the SQL
heuristics ever cost more than they save, swap in `sqlparser-rs` behind
`migrations.rs`.

## Adding a check

1. `src/<name>.rs` with `pub fn run(idx: &CodebaseIndex) -> Vec<Finding>` (or
   `run(root: &Path) -> Result<Vec<Finding>>` if it reads non-src files).
2. Wire into `main.rs`: add to `Cmd`, the dispatch `match`, and the `All` list.
3. Build, run, dogfood, verify findings are true positives.
