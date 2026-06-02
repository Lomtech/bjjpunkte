use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl Severity {
    pub fn label(self) -> &'static str {
        match self {
            Self::Critical => "🔴 CRITICAL",
            Self::High => "🟠 HIGH",
            Self::Medium => "🟡 MEDIUM",
            Self::Low => "🔵 LOW",
            Self::Info => "⚪ INFO",
        }
    }
    pub const ALL: [Severity; 5] = [
        Severity::Critical,
        Severity::High,
        Severity::Medium,
        Severity::Low,
        Severity::Info,
    ];
}

#[derive(Debug, Clone, Serialize)]
pub struct Finding {
    pub severity: Severity,
    pub category: String,
    pub title: String,
    pub file: String,
    pub line: usize,
    pub evidence: String,
    pub action: String,
}

impl Finding {
    /// Minimal constructor — keeps existing drift-check call sites working.
    pub fn new(
        severity: Severity,
        title: impl Into<String>,
        evidence: impl Into<String>,
        action: impl Into<String>,
    ) -> Self {
        Self {
            severity,
            category: String::new(),
            title: title.into(),
            file: String::new(),
            line: 0,
            evidence: evidence.into(),
            action: action.into(),
        }
    }

    pub fn with_category(mut self, cat: impl Into<String>) -> Self {
        self.category = cat.into();
        self
    }

    pub fn with_loc(mut self, file: impl Into<String>, line: usize) -> Self {
        self.file = file.into();
        self.line = line;
        self
    }
}

#[derive(Debug, Serialize)]
pub struct CheckResult {
    pub name: String,
    pub findings: Vec<Finding>,
}

#[derive(Debug, Serialize)]
pub struct Report {
    pub checks: Vec<CheckResult>,
}

impl Report {
    pub fn single(name: &str, mut findings: Vec<Finding>) -> Self {
        tag(name, &mut findings);
        Self {
            checks: vec![CheckResult {
                name: name.to_string(),
                findings,
            }],
        }
    }

    pub fn multi(items: Vec<(&str, Vec<Finding>)>) -> Self {
        Self {
            checks: items
                .into_iter()
                .map(|(name, mut findings)| {
                    tag(name, &mut findings);
                    CheckResult {
                        name: name.to_string(),
                        findings,
                    }
                })
                .collect(),
        }
    }

    pub fn has_critical_or_high(&self) -> bool {
        self.checks.iter().any(|c| {
            c.findings
                .iter()
                .any(|f| matches!(f.severity, Severity::Critical | Severity::High))
        })
    }

    fn all_findings(&self) -> Vec<&Finding> {
        self.checks.iter().flat_map(|c| c.findings.iter()).collect()
    }

    fn counts(&self) -> [usize; 5] {
        let mut c = [0usize; 5];
        for f in self.all_findings() {
            c[f.severity as usize] += 1;
        }
        c
    }

    pub fn to_markdown(&self) -> String {
        let mut out = String::from("# osss-audit\n\n");
        let counts = self.counts();
        let total: usize = counts.iter().sum();
        out.push_str(&format!("_{} findings total_\n\n", total));

        // Summary table
        out.push_str("## Summary\n\n");
        for sev in Severity::ALL {
            let n = counts[sev as usize];
            if n > 0 {
                out.push_str(&format!("- {} — {}\n", sev.label(), n));
            }
        }
        out.push('\n');

        // Per-check counts
        out.push_str("| Check | C | H | M | L | I |\n|---|--:|--:|--:|--:|--:|\n");
        for check in &self.checks {
            let mut c = [0usize; 5];
            for f in &check.findings {
                c[f.severity as usize] += 1;
            }
            out.push_str(&format!(
                "| {} | {} | {} | {} | {} | {} |\n",
                check.name, c[0], c[1], c[2], c[3], c[4]
            ));
        }
        out.push('\n');

        // Findings grouped by severity, sorted by (severity, category, file, line)
        let mut all = self.all_findings();
        all.sort_by(|a, b| {
            a.severity
                .cmp(&b.severity)
                .then(a.category.cmp(&b.category))
                .then(a.file.cmp(&b.file))
                .then(a.line.cmp(&b.line))
        });

        let mut current_sev: Option<Severity> = None;
        for f in all {
            if current_sev != Some(f.severity) {
                out.push_str(&format!("\n## {}\n\n", f.severity.label()));
                current_sev = Some(f.severity);
            }
            let loc = if f.file.is_empty() {
                String::new()
            } else if f.line > 0 {
                format!(" `{}:{}`", f.file, f.line)
            } else {
                format!(" `{}`", f.file)
            };
            let cat = if f.category.is_empty() {
                String::new()
            } else {
                format!("[{}] ", f.category)
            };
            out.push_str(&format!("### {}{}{}\n\n", cat, f.title, loc));
            if !f.evidence.is_empty() {
                out.push_str(&format!("{}\n\n", f.evidence));
            }
            if !f.action.is_empty() {
                out.push_str(&format!("**Fix:** {}\n\n", f.action));
            }
        }
        out
    }
}

/// Stamp a check name onto any finding that didn't set its own category.
fn tag(name: &str, findings: &mut [Finding]) {
    for f in findings.iter_mut() {
        if f.category.is_empty() {
            f.category = name.to_string();
        }
    }
}
