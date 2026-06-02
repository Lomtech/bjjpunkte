// osss-audit — atomic, comprehensive scanner for osss.pro.
// Replaces tools/analyze.py + tools/deep_audit.py with one Rust binary.
//
// One walk over src/ builds a CodebaseIndex; every check runs against it.
// Drift checks (pricing/migrations/crons/env/rls/webhook/testing) additionally
// read non-src files (migrations, vercel.json, .env.example, compliance/).

use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::{Path, PathBuf};

mod finding;
mod model;
mod util;

mod crons;
mod env;
mod hydration;
mod infra;
mod maintainability;
mod migrations;
mod orphans;
mod perf;
mod pricing;
mod rls;
mod routes;
mod security;
mod testing;
mod todos;
mod webhook;

use finding::Report;
use model::CodebaseIndex;

#[derive(Parser)]
#[command(name = "osss-audit", about = "Atomic, comprehensive audit for osss.pro")]
struct Cli {
    #[arg(long, help = "Project root (default: auto-detected by walking up from CWD)")]
    root: Option<PathBuf>,

    #[arg(long, help = "Emit JSON instead of Markdown")]
    json: bool,

    #[arg(long, value_name = "SEV", help = "Only show findings at/above this severity: critical|high|medium|low|info")]
    min_severity: Option<String>,

    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Route security: AUTH, CRON_AUTH, RATE_LIMIT, INPUT, ERROR_LEAK, MULTI_TENANT
    Security,
    /// Performance: await-in-loop, oversized limits
    Perf,
    /// Maintainability: large files + client-component direct DB writes
    Maintainability,
    /// Money-flow routes without an automated test
    Testing,
    /// Hydration risks in client components
    Hydration,
    /// Dead-code suspects (orphan files)
    Orphans,
    /// TODO/FIXME/XXX/HACK inventory
    Todos,
    /// RLS coverage: tenant tables without ENABLE ROW LEVEL SECURITY
    Rls,
    /// Stripe webhook event coverage
    Webhook,
    /// Hardcoded/stale prices + PILOT10 ghosts
    PricingDrift,
    /// Migration column refs vs src/types/database.ts
    MigrationsTypesDrift,
    /// vercel.json crons ↔ Inngest functions
    CronsDrift,
    /// .env.example ↔ process.env.* usage
    EnvConsistency,
    /// Stale self-repo GitHub URLs across the whole repo (verified vs git remote)
    InfraDrift,
    /// Route + Supabase + env inventory (report, not findings)
    Routes,
    /// Reverse-dependency lookup for a file
    Deps { path: String },
    /// Coverage report: what was read, what failed, scan rules (trust check)
    Doctor,
    /// Run every finding-producing check
    All,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let root = match &cli.root {
        Some(r) => r.canonicalize()?,
        None => find_repo_root()?,
    };

    // Inventory commands print directly and exit 0.
    match &cli.cmd {
        Cmd::Routes => {
            let idx = CodebaseIndex::build(&root);
            print!("{}", routes::inventory(&idx));
            return Ok(());
        }
        Cmd::Deps { path } => {
            let idx = CodebaseIndex::build(&root);
            print!("{}", routes::deps(&idx, path));
            return Ok(());
        }
        Cmd::Doctor => {
            let idx = CodebaseIndex::build(&root);
            print!("{}", routes::doctor(&idx));
            return Ok(());
        }
        _ => {}
    }

    // Build the index once for index-based checks.
    let idx = CodebaseIndex::build(&root);

    let mut report = match &cli.cmd {
        Cmd::Security => Report::single("security", security::run(&idx)),
        Cmd::Perf => Report::single("perf", perf::run(&idx)),
        Cmd::Maintainability => Report::single("maintainability", maintainability::run(&idx)),
        Cmd::Testing => Report::single("testing", testing::run(&root)),
        Cmd::Hydration => Report::single("hydration", hydration::run(&idx)),
        Cmd::Orphans => Report::single("orphans", orphans::run(&idx)),
        Cmd::Todos => Report::single("todos", todos::run(&idx)),
        Cmd::Rls => Report::single("rls", rls::run(&root)?),
        Cmd::Webhook => Report::single("webhook", webhook::run(&root)?),
        Cmd::PricingDrift => Report::single("pricing-drift", pricing::run(&root)?),
        Cmd::MigrationsTypesDrift => {
            Report::single("migrations-types-drift", migrations::run(&root)?)
        }
        Cmd::CronsDrift => Report::single("crons-drift", crons::run(&root)?),
        Cmd::EnvConsistency => Report::single("env-consistency", env::run(&idx)?),
        Cmd::InfraDrift => Report::single("infra-drift", infra::run(&root)?),
        Cmd::All => Report::multi(vec![
            ("security", security::run(&idx)),
            ("multi-tenant-rls", rls::run(&root)?),
            ("webhook", webhook::run(&root)?),
            ("perf", perf::run(&idx)),
            ("testing", testing::run(&root)),
            ("maintainability", maintainability::run(&idx)),
            ("hydration", hydration::run(&idx)),
            ("orphans", orphans::run(&idx)),
            ("todos", todos::run(&idx)),
            ("pricing-drift", pricing::run(&root)?),
            ("migrations-types-drift", migrations::run(&root)?),
            ("crons-drift", crons::run(&root)?),
            ("env-consistency", env::run(&idx)?),
            ("infra-drift", infra::run(&root)?),
        ]),
        Cmd::Routes | Cmd::Deps { .. } | Cmd::Doctor => unreachable!(),
    };

    if let Some(min) = &cli.min_severity {
        filter_min_severity(&mut report, min);
    }

    if cli.json {
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        print!("{}", report.to_markdown());
    }

    std::process::exit(if report.has_critical_or_high() { 1 } else { 0 });
}

/// Locate the osss repo root. A dir qualifies if it has both
/// `src/lib/pricing.ts` and `supabase/migrations` (stable osss markers).
/// Strategy: (1) walk UP from CWD — works anywhere inside the repo;
/// (2) fall back to well-known checkout locations — works from ~, /tmp, etc.
fn find_repo_root() -> Result<PathBuf> {
    let is_root = |d: &Path| {
        d.join("src/lib/pricing.ts").is_file() && d.join("supabase/migrations").is_dir()
    };

    // (1) ascend from CWD
    let cwd = std::env::current_dir()?;
    let mut dir = cwd.clone();
    loop {
        if is_root(&dir) {
            return Ok(dir);
        }
        if !dir.pop() {
            break;
        }
    }

    // (2) well-known fallbacks (this is an osss-specific tool)
    if let Some(home) = std::env::var_os("HOME") {
        for cand in ["Developer/osss.pro", "osss.pro", "Developer/bjjpunkte"] {
            let p = Path::new(&home).join(cand);
            if is_root(&p) {
                return Ok(p);
            }
        }
    }

    anyhow::bail!(
        "could not locate the osss repo root from {:?} (walked up + checked ~/Developer/osss.pro). Pass --root <path>.",
        cwd
    );
}

fn filter_min_severity(report: &mut Report, min: &str) {
    use finding::Severity::*;
    let threshold = match min.to_lowercase().as_str() {
        "critical" => Critical,
        "high" => High,
        "medium" => Medium,
        "low" => Low,
        _ => Info,
    };
    for check in &mut report.checks {
        check.findings.retain(|f| f.severity <= threshold);
    }
}
