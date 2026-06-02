// webhook.rs — NEW check. Parses the Stripe webhook route for handled
// event types (`event.type === '...'`) and flags critical events that aren't
// handled. Corrects the stale "13/16 events" memory claim with a live count.

use crate::finding::{Finding, Severity};
use crate::util::read_file;
use anyhow::Result;
use regex::Regex;
use std::collections::BTreeSet;
use std::path::Path;

// Events that should be handled for a Connect Way-1 subscription business.
// Missing one of these is a real gap, not a style nit.
const CRITICAL_EVENTS: [&str; 6] = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
    "account.application.deauthorized",
];

// Events worth handling but not fatal if absent — informational.
const RECOMMENDED_EVENTS: [&str; 3] = [
    "charge.refunded",
    "charge.dispute.created",
    "customer.subscription.trial_will_end",
];

pub fn run(root: &Path) -> Result<Vec<Finding>> {
    let mut findings = Vec::new();
    let webhook = root.join("src/app/api/stripe/webhook/route.ts");
    if !webhook.exists() {
        findings.push(
            Finding::new(
                Severity::Info,
                "No Stripe webhook route found",
                "src/app/api/stripe/webhook/route.ts does not exist.",
                "If Stripe is in use, a webhook handler should exist.",
            )
            .with_category("WEBHOOK"),
        );
        return Ok(findings);
    }

    let content = read_file(&webhook)?;
    let ev_re = Regex::new(r#"event\.type\s*===\s*['"]([a-z_]+\.[a-z_.]+)['"]"#)?;
    let handled: BTreeSet<String> = ev_re
        .captures_iter(&content)
        .map(|c| c[1].to_string())
        .collect();

    for ev in CRITICAL_EVENTS {
        if !handled.contains(ev) {
            findings.push(
                Finding::new(
                    Severity::High,
                    format!("Critical Stripe event `{}` not handled", ev),
                    format!("Webhook handles {} event types; `{}` is not among them.", handled.len(), ev),
                    format!("Add an `event.type === '{}'` branch to the webhook handler.", ev),
                )
                .with_category("WEBHOOK")
                .with_loc("src/app/api/stripe/webhook/route.ts".to_string(), 0),
            );
        }
    }
    for ev in RECOMMENDED_EVENTS {
        if !handled.contains(ev) {
            findings.push(
                Finding::new(
                    Severity::Info,
                    format!("Recommended Stripe event `{}` not handled", ev),
                    "Not fatal, but worth covering.",
                    format!("Consider handling `{}`.", ev),
                )
                .with_category("WEBHOOK")
                .with_loc("src/app/api/stripe/webhook/route.ts".to_string(), 0),
            );
        }
    }

    findings
        .push(Finding::new(
            Severity::Info,
            format!("Stripe webhook handles {} event types", handled.len()),
            format!("Handled: {}", handled.iter().cloned().collect::<Vec<_>>().join(", ")),
            "",
        )
        .with_category("WEBHOOK")
        .with_loc("src/app/api/stripe/webhook/route.ts".to_string(), 0));

    Ok(findings)
}
