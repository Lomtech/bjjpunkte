// testing.rs — money-flow routes without an automated test (deep_audit.py
// audit_missing_tests). Discovers test files anywhere under the project (not
// just src/__tests__) so the tests/ directory layout is honoured.

use crate::finding::{Finding, Severity};
use crate::util::{rel, SKIP_DIRS};
use std::collections::BTreeSet;
use std::path::Path;
use walkdir::WalkDir;

const MONEY_ROUTES: [&str; 8] = [
    "src/app/api/stripe/webhook/route.ts",
    "src/app/api/stripe/sync-payments/route.ts",
    "src/app/api/stripe/create-checkout/route.ts",
    "src/app/api/stripe/subscribe/route.ts",
    "src/app/api/stripe/owner-checkout/route.ts",
    "src/app/api/payments/[id]/route.ts",
    "src/app/api/cron/payment-reminders/route.ts",
    "src/app/api/quotes/[id]/convert/route.ts",
];

pub fn run(root: &Path) -> Vec<Finding> {
    let mut findings = Vec::new();

    // collect every test filename (basename) in the repo
    let mut test_files: BTreeSet<String> = BTreeSet::new();
    for e in WalkDir::new(root)
        .into_iter()
        .filter_entry(|e| {
            let n = e.file_name().to_string_lossy();
            !(e.file_type().is_dir() && SKIP_DIRS.contains(&n.as_ref()))
        })
        .filter_map(|e| e.ok())
    {
        let n = e.file_name().to_string_lossy().to_string();
        if n.ends_with(".test.ts")
            || n.ends_with(".test.tsx")
            || n.ends_with(".spec.ts")
            || n.ends_with(".spec.tsx")
        {
            test_files.insert(n);
        }
    }
    // also read content of test files to match by route-name token
    let test_blob: String = {
        let mut s = String::new();
        for e in WalkDir::new(root.join("tests"))
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            s.push_str(&crate::util::read_lossy(e.path()));
            s.push('\n');
        }
        s
    };

    for route in MONEY_ROUTES {
        let abs = root.join(route);
        if !abs.exists() {
            continue; // route doesn't exist in this repo — don't demand a test for it
        }
        // route folder name, e.g. "payment-reminders", "create-checkout"
        let name = Path::new(route)
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .unwrap_or("");
        let covered = test_files.iter().any(|f| f.contains(name))
            || (!name.is_empty() && test_blob.contains(name));
        if !covered {
            findings.push(
                Finding::new(
                    Severity::High,
                    "Money-flow route without an automated test",
                    format!("No *.test.ts / *.spec.ts references `{}`.", name),
                    format!("Add a Vitest or smoke test covering {}.", route),
                )
                .with_category("TESTING")
                .with_loc(rel(&abs, root), 0),
            );
        }
    }
    findings
}
