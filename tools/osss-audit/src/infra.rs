// infra.rs — NEW. Closes the "index is src/-only" gap for the one cross-cutting
// concern that's verifiable outside src/: stale self-referential GitHub URLs.
//
// It derives the TRUTH from `.git/config` (current owner/repo) instead of
// hardcoding a name, then scans the WHOLE repo (scripts/, docs/, .github/,
// root configs, src/) for github.com / raw.githubusercontent.com URLs whose
// owner == ours but repo != ours — i.e. a link to our own repo under its old
// name (e.g. Lomtech/bjjpunkte after the rename to Lomtech/osss.pro). Those
// 404 after a rename and would break the cutover / CI.
//
// Third-party repo links (different owner) are NOT flagged. Vercel project
// names and bare prose mentions are NOT flagged — they're not verifiable from
// here (a Vercel project keeps its name independent of the GitHub rename).

use crate::finding::{Finding, Severity};
use crate::util::{line_of, read_file, rel, snippet, SKIP_DIRS};
use anyhow::Result;
use regex::Regex;
use std::path::Path;
use walkdir::WalkDir;

const TEXT_EXTS: [&str; 11] = [
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "md", "yml", "yaml", "json", "sh",
];

pub fn run(root: &Path) -> Result<Vec<Finding>> {
    let mut findings = Vec::new();

    let Some((owner, repo)) = current_repo_slug(root) else {
        findings.push(
            Finding::new(
                Severity::Info,
                "Could not read the git remote — repo-URL drift not checked",
                "No origin URL found in .git/config.",
                "Run from a checkout with a github origin, or ignore if intentional.",
            )
            .with_category("INFRA"),
        );
        return Ok(findings);
    };

    let url_re = Regex::new(
        r"(?:github\.com|raw\.githubusercontent\.com)[:/]([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)",
    )?;

    for entry in WalkDir::new(root)
        .into_iter()
        .filter_entry(|e| {
            let n = e.file_name().to_string_lossy();
            !(e.file_type().is_dir()
                && (SKIP_DIRS.contains(&n.as_ref()) || n == ".git" || n == "target"))
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let p = entry.path();
        let is_text = p
            .extension()
            .and_then(|s| s.to_str())
            .map(|e| TEXT_EXTS.contains(&e))
            .unwrap_or(false)
            || p.file_name().and_then(|s| s.to_str()) == Some("Dockerfile");
        if !is_text {
            continue;
        }
        let Ok(content) = read_file(p) else { continue };
        let rel_path = rel(p, root);

        for cap in url_re.captures_iter(&content) {
            let u_owner = &cap[1];
            let u_repo = cap[2].trim_end_matches(".git");
            // only our own repo under a different name → stale self-reference
            if u_owner.eq_ignore_ascii_case(&owner) && !u_repo.eq_ignore_ascii_case(&repo) {
                let m = cap.get(0).unwrap();
                let line = line_of(&content, m.start());
                let ctx = snippet(&content, m.start(), 30, 60);
                // CI/deploy + shell scripts break hard; docs are cosmetic
                let sev = if rel_path.starts_with(".github/") || rel_path.ends_with(".sh") {
                    Severity::High
                } else {
                    Severity::Medium
                };
                findings.push(
                    Finding::new(
                        sev,
                        format!("Stale self-repo URL: {}/{} (now {}/{})", u_owner, u_repo, owner, repo),
                        format!("{}:{} — {}", rel_path, line, ctx),
                        format!("Update to {}/{} — the old slug 404s after the GitHub rename.", owner, repo),
                    )
                    .with_category("INFRA")
                    .with_loc(rel_path.clone(), line),
                );
            }
        }
    }

    Ok(findings)
}

/// Parse `owner/repo` from the origin URL in `<root>/.git/config`.
/// Handles both `https://github.com/owner/repo.git` and `git@github.com:owner/repo.git`.
fn current_repo_slug(root: &Path) -> Option<(String, String)> {
    let cfg = read_file(&root.join(".git/config")).ok()?;
    let re = Regex::new(r"github\.com[:/]([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?\s*$").ok()?;
    for line in cfg.lines() {
        let line = line.trim();
        if let Some(c) = re.captures(line) {
            return Some((c[1].to_string(), c[2].to_string()));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn slug_from(line: &str) -> Option<(String, String)> {
        let re = Regex::new(r"github\.com[:/]([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?\s*$").unwrap();
        re.captures(line.trim()).map(|c| (c[1].to_string(), c[2].to_string()))
    }

    #[test]
    fn parses_https_remote() {
        assert_eq!(
            slug_from("url = https://github.com/Lomtech/osss.pro.git"),
            Some(("Lomtech".into(), "osss.pro".into()))
        );
    }

    #[test]
    fn parses_ssh_remote() {
        assert_eq!(
            slug_from("url = git@github.com:Lomtech/osss.pro.git"),
            Some(("Lomtech".into(), "osss.pro".into()))
        );
    }

    #[test]
    fn url_regex_catches_raw_githubusercontent() {
        let re = Regex::new(
            r"(?:github\.com|raw\.githubusercontent\.com)[:/]([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)",
        )
        .unwrap();
        let c = re
            .captures("curl https://raw.githubusercontent.com/Lomtech/bjjpunkte/main/x.sh")
            .unwrap();
        assert_eq!(&c[1], "Lomtech");
        assert_eq!(c[2].trim_end_matches(".git"), "bjjpunkte");
    }
}
