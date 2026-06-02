// routes.rs — inventory printer (replaces analyze.py --routes and the
// deep_audit.py route-inventory table). Pure report, not findings.

use crate::model::CodebaseIndex;
use crate::security::route_flags;
use crate::util::{SKIP_DIRS, SOURCE_EXTS};
use std::collections::BTreeMap;

/// Coverage transparency: shows exactly what the tool read, so you can eyeball
/// it against `find`. Surfaces read failures (never silent) and the skip list.
pub fn doctor(idx: &CodebaseIndex) -> String {
    let mut out = String::from("# osss-audit doctor — coverage report\n\n");

    out.push_str(&format!(
        "- **Discovered** (walk matched): {}\n- **Indexed** (read OK): {}\n- **Read errors**: {}\n\n",
        idx.discovered,
        idx.files.len(),
        idx.read_errors.len()
    ));

    if !idx.read_errors.is_empty() {
        out.push_str("## ⚠️ Read errors — these files were NOT analyzed\n\n");
        for (f, e) in &idx.read_errors {
            out.push_str(&format!("- `{}` — {}\n", f, e));
        }
        out.push('\n');
    } else {
        out.push_str("_No read errors — every discovered file was analyzed._\n\n");
    }

    // by extension
    let mut by_ext: BTreeMap<String, usize> = BTreeMap::new();
    for f in &idx.files {
        *by_ext.entry(f.ext.clone()).or_default() += 1;
    }
    out.push_str("## Files by extension\n\n");
    for (ext, n) in &by_ext {
        out.push_str(&format!("- `{}` — {}\n", ext, n));
    }
    out.push('\n');

    // by top-level dir under src/
    let mut by_dir: BTreeMap<String, usize> = BTreeMap::new();
    for f in &idx.files {
        let top = f
            .path
            .strip_prefix("src/")
            .unwrap_or(&f.path)
            .split('/')
            .next()
            .unwrap_or("(root)")
            .to_string();
        *by_dir.entry(top).or_default() += 1;
    }
    out.push_str("## Files by top-level src/ dir\n\n");
    for (dir, n) in &by_dir {
        out.push_str(&format!("- `src/{}` — {}\n", dir, n));
    }
    out.push('\n');

    // what's scanned vs skipped — be explicit so nothing is "secretly" excluded
    out.push_str("## Scan rules (so you can verify nothing is silently excluded)\n\n");
    out.push_str(&format!(
        "- **Extensions indexed:** {}\n",
        SOURCE_EXTS
            .iter()
            .map(|e| format!("`.{}`", e))
            .collect::<Vec<_>>()
            .join(", ")
    ));
    out.push_str(&format!(
        "- **Directories skipped:** {} (+ any dotfile dir)\n",
        SKIP_DIRS
            .iter()
            .map(|d| format!("`{}`", d))
            .collect::<Vec<_>>()
            .join(", ")
    ));
    out.push_str("- **Root scanned (index):** only `src/`. Drift checks additionally read: `supabase/migrations`, `vercel.json`, `.env.example`, `compliance/sales`, `src/lib/inngest`. **infra-drift scans the WHOLE repo** (scripts/, docs/, .github/, root configs) for stale self-repo URLs.\n\n");

    // ground-truth cross-check command
    out.push_str("## Verify against ground truth\n\n");
    out.push_str("Compare the indexed count to a raw filesystem count:\n\n");
    out.push_str("```bash\n");
    out.push_str("find src -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' \\) \\\n");
    out.push_str("  -not -path '*/node_modules/*' -not -path '*/.next/*' | wc -l\n");
    out.push_str("```\n\n");
    out.push_str(&format!(
        "Expected: **{}** (discovered). If `find` reports more, a skip rule or a non-UTF-8 read is hiding files — investigate.\n",
        idx.discovered
    ));

    out
}

pub fn inventory(idx: &CodebaseIndex) -> String {
    let mut out = String::new();

    let pages: Vec<_> = idx.pages().collect();
    let apis: Vec<_> = idx.api_routes().collect();
    let clients = idx.client_components().count();
    let total_lines: usize = idx.files.iter().map(|f| f.lines).sum();

    out.push_str(&format!(
        "# osss inventory\n\n_{} files · {} lines · {} client components · {} pages · {} API routes_\n\n",
        idx.files.len(),
        total_lines,
        clients,
        pages.len(),
        apis.len()
    ));

    // pages
    out.push_str("## Pages (App Router)\n\n");
    let mut prs: Vec<_> = pages.iter().collect();
    prs.sort_by_key(|r| r.route_path.clone());
    for r in prs {
        out.push_str(&format!(
            "- `{}` → `{}`\n",
            r.route_path.as_deref().unwrap_or("?"),
            r.path
        ));
    }
    out.push('\n');

    // API routes with security status
    out.push_str("## API routes (auth / rate-limit / gym-filter)\n\n");
    out.push_str("| Route | Methods | Auth | RateLimit | GymFilter | ServiceRole |\n");
    out.push_str("|---|---|:--:|:--:|:--:|:--:|\n");
    let mut ars: Vec<_> = apis.iter().collect();
    ars.sort_by_key(|r| r.route_path.clone());
    for r in ars {
        let fl = route_flags(r);
        let auth = if fl.has_auth {
            "✅"
        } else if fl.is_public || fl.is_cron {
            "🌐"
        } else {
            "❌"
        };
        let rl = if fl.has_rate_limit { "✅" } else { "—" };
        let gf = if fl.has_gym_filter { "✅" } else { "—" };
        let sr = if fl.has_service_role { "⚙️" } else { "—" };
        let route = r
            .route_path
            .as_deref()
            .unwrap_or("?")
            .replace("/api", "");
        out.push_str(&format!(
            "| `{}` | {} | {} | {} | {} | {} |\n",
            route,
            r.http_methods.join(","),
            auth,
            rl,
            gf,
            sr
        ));
    }
    out.push('\n');

    // supabase touchpoints
    out.push_str("## Supabase tables (touchpoints)\n\n");
    for (table, files) in idx.supabase_index() {
        out.push_str(&format!("- **{}** ({} files)\n", table, files.len()));
    }
    out.push('\n');

    // env vars
    out.push_str("## Env vars used\n\n");
    for (env, files) in idx.env_index() {
        out.push_str(&format!("- `{}` — {} file(s)\n", env, files.len()));
    }
    out.push('\n');

    out
}

/// Reverse-dependency lookup for a single file (replaces analyze.py --deps).
pub fn deps(idx: &CodebaseIndex, target: &str) -> String {
    // normalize: allow absolute paths or @/ specifiers
    let norm = target
        .strip_prefix(&format!("{}/", idx.root.display()))
        .unwrap_or(target)
        .to_string();

    let importers = idx
        .reverse
        .iter()
        .find(|(k, _)| **k == norm || k.ends_with(&norm))
        .map(|(_, v)| v.clone())
        .unwrap_or_default();

    let mut out = format!("# Importers of {} ({})\n\n", norm, importers.len());
    if importers.is_empty() {
        out.push_str("_none — orphan, route, or Next.js convention file_\n");
    } else {
        for imp in importers {
            out.push_str(&format!("- `{}`\n", imp));
        }
    }
    out
}
