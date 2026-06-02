// maintainability.rs — large-file warnings (deep_audit.py audit_large_files)
// plus client-component direct-write detection (audit_client_components).

use crate::finding::{Finding, Severity};
use crate::model::CodebaseIndex;
use crate::util::line_of;
use regex::Regex;
use std::sync::LazyLock;

static RE_DIRECT_WRITE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"\.from\(['"][a-z_]+['"]\)\s*(?:\.[a-z]+\([^)]*\))*\s*\.(update|delete|insert)\s*\("#)
        .unwrap()
});

pub fn run(idx: &CodebaseIndex) -> Vec<Finding> {
    let mut findings = Vec::new();

    for f in &idx.files {
        // large files
        if f.lines > 500 {
            findings.push(
                Finding::new(
                    Severity::Info,
                    format!("Large file — {} lines", f.lines),
                    "Hard to review and test as one unit.",
                    "Split into smaller modules; move API logic into /lib.",
                )
                .with_category("MAINTAINABILITY")
                .with_loc(f.path.clone(), 0),
            );
        } else if f.lines > 350 && f.path.ends_with("route.ts") {
            findings.push(
                Finding::new(
                    Severity::Low,
                    format!("API route with {} lines", f.lines),
                    "Route complexity is creeping up.",
                    "Extract handler logic into /lib/handlers or /lib/services.",
                )
                .with_category("MAINTAINABILITY")
                .with_loc(f.path.clone(), 0),
            );
        }

        // direct supabase writes in client components → CORS-fragile, bypasses server validation
        if f.use_client && !f.path.contains("route.ts") {
            let mentions_client =
                f.content.contains("createClient") || f.content.contains("@/lib/supabase/client");
            if mentions_client
                && let Some(m) = RE_DIRECT_WRITE.find(&f.content) {
                    let mut ops: Vec<&str> = RE_DIRECT_WRITE
                        .captures_iter(&f.content)
                        .filter_map(|c| c.get(1).map(|x| x.as_str()))
                        .collect();
                    ops.sort();
                    ops.dedup();
                    findings.push(
                        Finding::new(
                            Severity::Medium,
                            "Client component writes directly to Supabase",
                            format!(
                                "Direct .{}() from a 'use client' component — CORS-fragile and bypasses server-side validation.",
                                ops.join("/.")
                            ),
                            "Proxy all writes through an API route (server-side validation + whitelist).",
                        )
                        .with_category("CLIENT_WRITE")
                        .with_loc(f.path.clone(), line_of(&f.content, m.start())),
                    );
                }
        }
    }
    findings
}
