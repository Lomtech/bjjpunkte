// pricing-drift: extract the canonical prices from src/lib/pricing.ts, then scan
// the codebase for stale hardcoded literals (the old 4-tier 29/49/89/99/149 €
// model). vs-maat is known to hardcode prices by design — flagged separately.

use crate::finding::{Finding, Severity};
use crate::util::{line_of, read_file, rel, snippet};
use anyhow::{anyhow, Result};
use regex::Regex;
use std::collections::BTreeSet;
use std::path::Path;
use walkdir::WalkDir;

pub fn run(root: &Path) -> Result<Vec<Finding>> {
    let mut findings = Vec::new();

    let pricing_ts = root.join("src/lib/pricing.ts");
    let pricing_src = read_file(&pricing_ts)?;
    let (monthly_eur, annual_eur) = extract_canonical(&pricing_src)?;

    let stale_4tier: BTreeSet<u32> = [29, 89, 99, 149].into_iter().collect();

    // PILOT10 remnants — must be gone after commit 50cd531
    let pilot_re = Regex::new(r"(?i)PILOT10")?;
    let lifetime_re = Regex::new(r"(?i)LIFETIME[_-]?PILOT")?;
    // Hardcoded EUR amounts: "49 €" | "49€" | "49 EUR" | "49,00 €" (with decimal/cents we don't need here)
    let price_re = Regex::new(r"(?P<amount>\d{1,3})\s?(?:€|EUR\b)")?;

    let scan_files = list_scan_targets(root);

    for path in scan_files {
        let Ok(content) = read_file(&path) else { continue };
        let rel_path = rel(&path, root);

        // pricing.ts itself is the source-of-truth — don't flag its own literals
        let is_pricing_src = rel_path == "src/lib/pricing.ts";
        // vs-maat hardcodes by design (Battle-Page) but is a known drift risk
        let is_vs_maat = rel_path.contains("/vs-maat/");
        // pricing-rationale.md is an internal history doc — the old 29/49/89/149
        // numbers are deliberately recorded there; flagging them is noise.
        let is_rationale_doc = rel_path.ends_with("pricing-rationale.md");

        // PILOT10 references — should be 0 outside a deletion comment
        for m in pilot_re.find_iter(&content) {
            let ctx = snippet(&content, m.start(), 60, 60);
            let lc = ctx.to_lowercase();
            if lc.contains("entfernt") || lc.contains("removed") || lc.contains("retired") {
                continue;
            }
            findings.push(Finding::new(
                Severity::High,
                "PILOT10 reference outside a deletion comment",
                format!("{}:{} — {}", rel_path, line_of(&content, m.start()), ctx),
                "Remove the PILOT10/Lifetime-Pilot mention or wrap it in a clear `// entfernt`-style comment.",
            ));
        }
        for m in lifetime_re.find_iter(&content) {
            let ctx = snippet(&content, m.start(), 60, 60);
            let lc = ctx.to_lowercase();
            if lc.contains("entfernt") || lc.contains("removed") || lc.contains("retired") {
                continue;
            }
            findings.push(Finding::new(
                Severity::Medium,
                "LIFETIME_PILOT reference outside a deletion comment",
                format!("{}:{} — {}", rel_path, line_of(&content, m.start()), ctx),
                "Verify the reference is intentional (e.g. historical-doc) or remove.",
            ));
        }

        if is_pricing_src || is_rationale_doc {
            continue;
        }

        // Hardcoded EUR amounts — only the stale OLD osss tiers (29/89/149).
        // The "non-canonical amount" INFO bucket was removed: ROI copy
        // ("~80 €/month"), hourly rates ("40 €/h"), Stripe fees ("0,25 €") and
        // competitor prices are all legitimate and drowned the signal.
        for cap in price_re.captures_iter(&content) {
            let m = cap.get(0).unwrap();
            let prev = content[..m.start()].chars().next_back();
            let amount: u32 = match cap.name("amount").and_then(|m| m.as_str().parse().ok()) {
                Some(n) => n,
                None => continue,
            };
            let ctx = snippet(&content, m.start(), 50, 70);

            let Some(sev) = classify_stale_price(amount, prev, &ctx, is_vs_maat, &stale_4tier)
            else {
                continue;
            };

            let line = line_of(&content, m.start());
            findings.push(Finding::new(
                sev,
                format!("Stale 4-tier price {}€ found", amount),
                format!("{}:{} — context: {}", rel_path, line, ctx),
                format!(
                    "Replace with STANDARD_TIER ({} € monthly / {} € annual) from src/lib/pricing.ts — Single-Tier model since cdd7f1a.",
                    monthly_eur, annual_eur
                ),
            ));
        }
    }

    Ok(findings)
}

/// Pure decision for one EUR match. Returns the severity to report, or None to
/// skip. Encodes the three FP guards: separator-adjacency, stale-tier
/// membership, and competitor/comparison context.
fn classify_stale_price(
    amount: u32,
    prev_char: Option<char>,
    ctx: &str,
    is_vs_maat: bool,
    stale_4tier: &BTreeSet<u32>,
) -> Option<Severity> {
    // reject separator-adjacent matches: "1.188 €"→188, "1.234,56 €"→56, "4,50 €"→50
    if let Some(p) = prev_char
        && (p.is_ascii_digit() || p == '.' || p == ',')
    {
        return None;
    }
    if !stale_4tier.contains(&amount) {
        return None;
    }
    let lc = ctx.to_lowercase();
    // competitor/comparison context → someone else's price, not a stale osss tier
    let is_competitor = [
        "magicline", "eversports", "aidoo", "gymdesk", "maat", "evs:", "1.5%", "1,5%", "1.5 %",
        "1,5 %",
    ]
    .iter()
    .any(|k| lc.contains(k));
    if is_competitor {
        return None;
    }
    let is_clear_tier = lc.contains("plan")
        || lc.contains("tier")
        || lc.contains("tarif")
        || lc.contains("starter")
        || lc.contains("grow")
        || lc.contains("/mo")
        || lc.contains("/monat");
    Some(if is_vs_maat {
        Severity::Low
    } else if is_clear_tier {
        Severity::High
    } else {
        Severity::Medium
    })
}

fn extract_canonical(src: &str) -> Result<(u32, u32)> {
    // monthlyCents: 4900
    let monthly_re = Regex::new(r"monthlyCents:\s*(\d+)")?;
    let annual_re = Regex::new(r"annualMonthlyCents:\s*(\d+)")?;
    let monthly_cents: u32 = monthly_re
        .captures(src)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse().ok())
        .ok_or_else(|| anyhow!("could not find monthlyCents in pricing.ts"))?;
    let annual_cents: u32 = annual_re
        .captures(src)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse().ok())
        .ok_or_else(|| anyhow!("could not find annualMonthlyCents in pricing.ts"))?;
    Ok((monthly_cents / 100, annual_cents / 100))
}

fn list_scan_targets(root: &Path) -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    // src/ — code
    for entry in WalkDir::new(root.join("src"))
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        if p.is_file()
            && matches!(
                p.extension().and_then(|s| s.to_str()),
                Some("ts" | "tsx" | "js" | "jsx" | "md")
            )
        {
            out.push(p.to_path_buf());
        }
    }
    // compliance/sales/*.md — Cold-Outreach Templates
    for entry in WalkDir::new(root.join("compliance/sales"))
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        if p.is_file()
            && matches!(
                p.extension().and_then(|s| s.to_str()),
                Some("md" | "csv")
            )
        {
            out.push(p.to_path_buf());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tiers() -> BTreeSet<u32> {
        [29, 89, 99, 149].into_iter().collect()
    }

    #[test]
    fn thousands_separator_rejected() {
        // "1.188 €" → matched "188" with prev char '.', must be skipped
        assert_eq!(classify_stale_price(188, Some('.'), "1.188 €", false, &tiers()), None);
        // "1.234,56 €" → "56" with prev ','
        assert_eq!(classify_stale_price(56, Some(','), "1.234,56 €", false, &tiers()), None);
    }

    #[test]
    fn stale_tier_in_plan_context_is_high() {
        assert_eq!(
            classify_stale_price(149, Some(' '), "Pro tier 149 €/Monat", false, &tiers()),
            Some(Severity::High)
        );
    }

    #[test]
    fn competitor_price_is_skipped() {
        // "Magicline ~99 €" — competitor, not an osss tier
        assert_eq!(
            classify_stale_price(99, Some(' '), "Magicline entry ~99 €", false, &tiers()),
            None
        );
        // Eversports comparison range
        assert_eq!(
            classify_stale_price(149, Some(' '), "Eversports ~49–149 €", false, &tiers()),
            None
        );
    }

    #[test]
    fn current_price_not_flagged() {
        // 49 is the canonical price, not in stale_4tier
        assert_eq!(classify_stale_price(49, Some(' '), "49 €/Monat plan", false, &tiers()), None);
    }

    #[test]
    fn vs_maat_downgraded_to_low() {
        assert_eq!(
            classify_stale_price(149, Some(' '), "149 € tier", true, &tiers()),
            Some(Severity::Low)
        );
    }

    #[test]
    fn stale_tier_without_context_is_medium() {
        assert_eq!(
            classify_stale_price(89, Some(' '), "kostet 89 € im Jahr", false, &tiers()),
            Some(Severity::Medium)
        );
    }

    #[test]
    fn extract_canonical_reads_cents() {
        let src = "monthlyCents: 4900,\n  annualMonthlyCents: 3900,";
        assert_eq!(extract_canonical(src).unwrap(), (49, 39));
    }
}
