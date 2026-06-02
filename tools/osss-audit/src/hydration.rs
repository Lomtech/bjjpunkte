// hydration.rs — SSR/CSR mismatch risks in client components (analyze.py
// hotspots). Only client components matter: a Server Component rendering
// new Date() is fine, a 'use client' one can hydrate-mismatch.

use crate::finding::{Finding, Severity};
use crate::model::CodebaseIndex;

pub fn run(idx: &CodebaseIndex) -> Vec<Finding> {
    let mut findings = Vec::new();
    for f in idx.client_components() {
        if f.hydration_risks.is_empty() {
            continue;
        }
        for risk in &f.hydration_risks {
            findings.push(
                Finding::new(
                    Severity::Low,
                    "Hydration risk in client component",
                    risk.clone(),
                    "Gate behind a useEffect/mounted flag, or pass the value as a server prop.",
                )
                .with_category("HYDRATION")
                .with_loc(f.path.clone(), 0),
            );
        }
    }
    findings
}
