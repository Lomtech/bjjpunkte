// env-consistency: .env.example declarations ↔ process.env.* usage.
// Uses the prebuilt index (no second walk). Also ports deep_audit's
// NEXTAUTH_SECRET / STRIPE_CLIENT_ID dead-key INFO notes.

use crate::finding::{Finding, Severity};
use crate::model::CodebaseIndex;
use crate::util::read_file;
use anyhow::Result;
use regex::Regex;
use std::collections::BTreeSet;

pub fn run(idx: &CodebaseIndex) -> Result<Vec<Finding>> {
    let mut findings = Vec::new();

    let env_src = read_file(&idx.root.join(".env.example"))?;
    let declared = parse_declared_vars(&env_src);
    // also treat commented-out `# FOO=` lines as "documented" to avoid noise
    let documented = parse_commented_vars(&env_src);

    let env_index = idx.env_index();
    let used: BTreeSet<String> = env_index.keys().cloned().collect();

    // declared but unused
    for var in declared.difference(&used) {
        if PUBLIC_OR_WRAPPED.contains(&var.as_str()) {
            continue;
        }
        findings.push(
            Finding::new(
                Severity::Low,
                format!("`{}` declared in .env.example but unused in src/", var),
                "No process.env reference found.",
                "Verify it's read via a wrapper (instrumentation/sentry config) or remove it.",
            )
            .with_category("ENV")
            .with_loc(".env.example".to_string(), 0),
        );
    }

    // used but not declared
    for var in used.difference(&declared) {
        if SYSTEM_VARS.contains(&var.as_str()) {
            continue;
        }
        if documented.contains(var) {
            continue; // present as a commented example — acceptable
        }
        let files = env_index.get(var).cloned().unwrap_or_default();
        let sample = files.iter().take(3).cloned().collect::<Vec<_>>().join(", ");
        findings.push(
            Finding::new(
                Severity::Medium,
                format!("`process.env.{}` used but not declared in .env.example", var),
                format!("Used in {} file(s): {}", files.len(), sample),
                "Add it to .env.example with a comment — onboarding/CI need it.",
            )
            .with_category("ENV")
            .with_loc(".env.example".to_string(), 0),
        );
    }

    // dead-key notes (deep_audit.py)
    if used.contains("NEXTAUTH_SECRET") {
        findings.push(
            Finding::new(
                Severity::Info,
                "NEXTAUTH_SECRET referenced but NextAuth is not the auth system",
                "osss uses Supabase Auth; NEXTAUTH_SECRET may be a leftover.",
                "Find the referencing file and remove the key if unused.",
            )
            .with_category("ENV")
            .with_loc("src/".to_string(), 0),
        );
    }
    if used.contains("STRIPE_CLIENT_ID") {
        findings.push(
            Finding::new(
                Severity::Info,
                "STRIPE_CLIENT_ID referenced (legacy OAuth Connect)",
                "Only used by the legacy OAuth callback; the programmatic Express flow doesn't need it.",
                "Remove if the programmatic account-create flow is the only path.",
            )
            .with_category("ENV")
            .with_loc("src/".to_string(), 0),
        );
    }

    Ok(findings)
}

// NEXT_PUBLIC_* and vars read through wrappers — don't flag as "unused".
const PUBLIC_OR_WRAPPED: [&str; 5] = [
    "NEXT_PUBLIC_APP_URL",
    "RESEND_FROM_EMAIL",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "NEXT_PUBLIC_GROWTHBOOK_SDK_KEY",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
];

const SYSTEM_VARS: [&str; 6] = [
    "NODE_ENV",
    "VERCEL_ENV",
    "VERCEL_URL",
    "NEXT_PHASE",
    "NEXT_RUNTIME",
    "PORT",
];

fn parse_declared_vars(env_src: &str) -> BTreeSet<String> {
    let re = Regex::new(r"^([A-Z][A-Z0-9_]+)=").unwrap();
    env_src
        .lines()
        .filter_map(|line| {
            let l = line.trim_start();
            if l.starts_with('#') || l.is_empty() {
                return None;
            }
            re.captures(l).map(|c| c[1].to_string())
        })
        .collect()
}

fn parse_commented_vars(env_src: &str) -> BTreeSet<String> {
    let re = Regex::new(r"^#\s*([A-Z][A-Z0-9_]+)=").unwrap();
    env_src
        .lines()
        .filter_map(|line| re.captures(line.trim_start()).map(|c| c[1].to_string()))
        .collect()
}
