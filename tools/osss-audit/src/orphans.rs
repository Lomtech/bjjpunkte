// orphans.rs — dead-code suspects: files imported by nobody, that aren't a
// Next.js route or a magic convention file. Ported from analyze.py find_orphans.

use crate::finding::{Finding, Severity};
use crate::model::CodebaseIndex;
use std::path::Path;

const MAGIC_BASENAMES: [&str; 18] = [
    "middleware.ts",
    "instrumentation.ts",
    "instrumentation-client.ts",
    "proxy.ts",
    "error.tsx",
    "not-found.tsx",
    "loading.tsx",
    "template.tsx",
    "global-error.tsx",
    "default.tsx",
    "robots.ts",
    "sitemap.ts",
    "manifest.ts",
    "opengraph-image.tsx",
    "twitter-image.tsx",
    "icon.tsx",
    "apple-icon.tsx",
    "route.ts",
];

pub fn run(idx: &CodebaseIndex) -> Vec<Finding> {
    let mut findings = Vec::new();
    for f in &idx.files {
        if idx.reverse.contains_key(&f.path) {
            continue; // imported by someone
        }
        if f.route_kind.is_some() {
            continue; // Next.js route
        }
        let base = Path::new(&f.path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        if MAGIC_BASENAMES.contains(&base)
            || base.starts_with("middleware.")
            || base.starts_with("proxy.")
        {
            continue;
        }
        // config files at project src root that Next/tooling load implicitly
        if base.ends_with(".config.ts") || base.ends_with(".d.ts") {
            continue;
        }
        findings.push(
            Finding::new(
                Severity::Info,
                "Orphan file — imported by nobody",
                "No resolved importer, not a route, not a Next.js convention file. Dead-code suspect (heuristic — verify before deleting).",
                "Confirm it's unused (grep dynamic imports / string paths) then remove, or document why it stays.",
            )
            .with_category("DEAD_CODE")
            .with_loc(f.path.clone(), 0),
        );
    }
    findings
}
