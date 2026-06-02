// todos.rs — inventory of TODO/FIXME/XXX/HACK markers (analyze.py). FIXME/XXX
// rank LOW (someone flagged a real defect), TODO/HACK rank INFO.

use crate::finding::{Finding, Severity};
use crate::model::CodebaseIndex;

pub fn run(idx: &CodebaseIndex) -> Vec<Finding> {
    let mut findings = Vec::new();
    for f in &idx.files {
        for todo in &f.todos {
            let sev = match todo.kind.as_str() {
                "FIXME" | "XXX" => Severity::Low,
                _ => Severity::Info, // TODO, HACK
            };
            let text = if todo.text.is_empty() {
                "(no description)".to_string()
            } else {
                todo.text.clone()
            };
            findings.push(
                Finding::new(sev, format!("{}: {}", todo.kind, text), "", "")
                    .with_category("TODO")
                    .with_loc(f.path.clone(), todo.line),
            );
        }
    }
    findings
}
