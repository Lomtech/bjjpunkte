// crons-drift: vercel.json crons[] vs Inngest functions (cron triggers).
// Detects: (a) Vercel cron without an Inngest counterpart (or vice versa),
// (b) schedule mismatches between the two systems.

use crate::finding::{Finding, Severity};
use crate::util::{read_file, rel};
use anyhow::Result;
use regex::Regex;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Deserialize)]
struct VercelConfig {
    crons: Option<Vec<VercelCron>>,
}

#[derive(Deserialize)]
struct VercelCron {
    path: String,
    schedule: String,
}

pub fn run(root: &Path) -> Result<Vec<Finding>> {
    let mut findings = Vec::new();

    let vercel_path = root.join("vercel.json");
    let vercel_src = read_file(&vercel_path)?;
    let vercel: VercelConfig = serde_json::from_str(&vercel_src)?;
    let vercel_crons = vercel.crons.unwrap_or_default();

    // map vercel: cron-name (last path segment) -> schedule
    let mut vercel_map: BTreeMap<String, String> = BTreeMap::new();
    for c in &vercel_crons {
        let name = c.path.trim_end_matches('/').rsplit('/').next().unwrap_or("").to_string();
        vercel_map.insert(name, c.schedule.clone());
    }

    // scan src/lib/inngest/ for cron triggers
    let inngest_dir = root.join("src/lib/inngest");
    let cron_re = Regex::new(r#"cron:\s*['"]([^'"]+)['"]"#)?;
    let id_re = Regex::new(r#"id:\s*['"]([^'"]+)['"]"#)?;

    let mut inngest_map: BTreeMap<String, (String, String)> = BTreeMap::new(); // name -> (schedule, file)
    let mut inngest_files = Vec::new();

    for entry in WalkDir::new(&inngest_dir).into_iter().filter_map(|e| e.ok()) {
        let p = entry.path();
        if p.is_file()
            && matches!(p.extension().and_then(|s| s.to_str()), Some("ts" | "tsx"))
        {
            inngest_files.push(p.to_path_buf());
        }
    }

    for path in &inngest_files {
        let Ok(content) = read_file(path) else { continue };
        let rel_path = rel(path, root);
        // Find function blocks with both `id:` and `cron:`. We use a small window
        // approach: for each `cron:` match, search backward up to 400 bytes for `id:`.
        for cron_match in cron_re.captures_iter(&content) {
            let schedule = cron_match.get(1).unwrap().as_str().to_string();
            let pos = cron_match.get(0).unwrap().start();
            let window_start = pos.saturating_sub(400);
            let window = &content[window_start..pos];
            let id = id_re.captures_iter(window).last().map(|c| c.get(1).unwrap().as_str().to_string());
            if let Some(id) = id {
                // id is typically the same as the route segment, e.g. "payment-reminders"
                inngest_map.insert(id, (schedule, rel_path.clone()));
            }
        }
    }

    // (1) Vercel-cron without Inngest counterpart
    for (name, schedule) in &vercel_map {
        if !inngest_map.contains_key(name) {
            findings.push(Finding::new(
                Severity::Medium,
                format!("Vercel cron `{}` has no Inngest counterpart", name),
                format!("vercel.json schedule `{}` — Inngest function with id=`{}` not found in src/lib/inngest/", schedule, name),
                "Add a wrapped or native Inngest function so Shadow-Mode coverage is complete.",
            ));
        }
    }

    // (2) Inngest-cron without Vercel counterpart
    for (name, (schedule, file)) in &inngest_map {
        if !vercel_map.contains_key(name) {
            findings.push(Finding::new(
                Severity::Low,
                format!("Inngest cron `{}` has no Vercel counterpart", name),
                format!("{} declares cron `{}` for id `{}` — vercel.json has no matching path", file, schedule, name),
                "Either add a Vercel-cron entry (if intended) or remove the Inngest function.",
            ));
        }
    }

    // (3) schedule mismatch — TZ shift Berlin vs UTC is expected, so we flag only
    //     if the two schedules don't even agree on the cron-expression structure.
    for (name, vercel_schedule) in &vercel_map {
        if let Some((inngest_schedule, file)) = inngest_map.get(name)
            && vercel_schedule != inngest_schedule {
                // Check if it's a TZ-prefix difference (Inngest supports "TZ=Europe/Berlin <expr>")
                let inngest_stripped = strip_tz_prefix(inngest_schedule);
                if inngest_stripped != *vercel_schedule {
                    findings.push(Finding::new(
                        Severity::Medium,
                        format!("Cron `{}` schedule differs between Vercel and Inngest", name),
                        format!(
                            "Vercel: `{}` (UTC) | Inngest: `{}` ({}) — Source: {}",
                            vercel_schedule,
                            inngest_schedule,
                            if *inngest_schedule != inngest_stripped { "TZ-prefixed" } else { "no TZ prefix" },
                            file
                        ),
                        "Confirm whether the TZ-shift is intentional. Document in cron-wrapper.ts header if so; both will fire 1-2h apart and handler-idempotency must hold.",
                    ));
                }
            }
    }

    Ok(findings)
}

fn strip_tz_prefix(s: &str) -> String {
    let trimmed = s.trim();
    if let Some(rest) = trimmed.strip_prefix("TZ=") {
        // skip until first whitespace
        if let Some(idx) = rest.find(char::is_whitespace) {
            return rest[idx..].trim().to_string();
        }
    }
    trimmed.to_string()
}
