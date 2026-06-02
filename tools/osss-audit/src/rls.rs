// rls.rs — NEW check (not in the Python tools). Cross-references the tables
// declared in src/types/database.ts against `ENABLE ROW LEVEL SECURITY`
// statements in supabase/migrations. A tenant table (one with a gym_id or
// member_id column) that never gets RLS enabled is a cross-tenant leak.
//
// This is what surfaced dunning_handoffs + payments_extra_meta in the LLM audit.

use crate::finding::{Finding, Severity};
use crate::migrations;
use crate::util::read_file;
use anyhow::Result;
use regex::Regex;
use std::collections::BTreeSet;
use std::path::Path;
use walkdir::WalkDir;

// tables that legitimately run without RLS (service-role only, no tenant PII)
const RLS_EXEMPT: [&str; 3] = ["cron_runs", "stripe_events", "page_views"];

pub fn run(root: &Path) -> Result<Vec<Finding>> {
    let mut findings = Vec::new();

    let table_columns = migrations::base_tables(root)?;

    // gather ENABLE ROW LEVEL SECURITY targets across all migrations
    let enable_re =
        Regex::new(r"(?i)ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY")
            .unwrap();
    let mut rls_enabled: BTreeSet<String> = BTreeSet::new();

    for entry in WalkDir::new(root.join("supabase/migrations"))
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("sql"))
    {
        let Ok(content) = read_file(entry.path()) else { continue };
        for c in enable_re.captures_iter(&content) {
            rls_enabled.insert(c[1].to_string());
        }
    }

    for (table, cols) in &table_columns {
        if rls_enabled.contains(table) || RLS_EXEMPT.contains(&table.as_str()) {
            continue;
        }
        let is_tenant = cols.contains("gym_id") || cols.contains("member_id");
        if is_tenant {
            findings.push(
                Finding::new(
                    Severity::High,
                    format!("Tenant table `{}` has no RLS in any migration", table),
                    format!(
                        "`{}` has a {} column (tenant PII) but no `ENABLE ROW LEVEL SECURITY` statement was found in supabase/migrations.",
                        table,
                        if cols.contains("gym_id") { "gym_id" } else { "member_id" }
                    ),
                    format!(
                        "ALTER TABLE public.{} ENABLE ROW LEVEL SECURITY; + a tenant policy via current_user_gym_ids(). Confirm against the live DB — RLS may have been applied out-of-repo.",
                        table
                    ),
                )
                .with_category("RLS")
                .with_loc("supabase/migrations".to_string(), 0),
            );
        } else {
            findings.push(
                Finding::new(
                    Severity::Info,
                    format!("Table `{}` has no RLS (no tenant column detected)", table),
                    "No gym_id/member_id column found, so this may be intentional — but verify it isn't accessed by the anon key.",
                    "If anon/authenticated can reach it, add RLS; otherwise add to RLS_EXEMPT with a reason.",
                )
                .with_category("RLS")
                .with_loc("supabase/migrations".to_string(), 0),
            );
        }
    }

    Ok(findings)
}
