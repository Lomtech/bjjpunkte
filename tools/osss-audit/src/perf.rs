// perf.rs — performance heuristics. await-in-loop detection uses real brace
// matching (not a fuzzy regex) so it doesn't false-positive on loops whose
// body has no await. Also: oversized .limit() values.

use crate::finding::{Finding, Severity};
use crate::model::CodebaseIndex;
use crate::util::line_of;
use regex::Regex;
use std::sync::LazyLock;

static RE_LARGE_LIMIT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\.limit\s*\(\s*([5-9]\d{2,}|\d{4,})\s*\)").unwrap());
// loop headers we care about: `for (` / `for await (` / `while (`
static RE_LOOP_HEAD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b(for\s+await|for|while)\s*\(").unwrap());

pub fn run(idx: &CodebaseIndex) -> Vec<Finding> {
    let mut findings = Vec::new();
    for f in &idx.files {
        let t = &f.content;

        // await-in-loop — brace-matched body, report once per file
        if let Some(off) = first_await_loop(t) {
            findings.push(
                Finding::new(
                    Severity::Medium,
                    "await inside a loop body — sequential DB/API calls",
                    "The loop awaits per iteration (not wrapped in Promise.all).",
                    "Collect promises and await Promise.all() for parallel execution.",
                )
                .with_category("PERF")
                .with_loc(f.path.clone(), line_of(t, off)),
            );
        }

        // oversized limits
        for c in RE_LARGE_LIMIT.captures_iter(t) {
            let m = c.get(0).unwrap();
            findings.push(
                Finding::new(
                    Severity::Low,
                    format!("Large .limit({}) — possible timeout / memory pressure", &c[1]),
                    "Oversized fetch ceiling.",
                    "Pick a use-case bound (active members ~500, attendance ~3000) or paginate.",
                )
                .with_category("PERF")
                .with_loc(f.path.clone(), line_of(t, m.start())),
            );
        }
    }
    findings
}

/// Returns the byte offset of the first loop whose *brace-matched* body contains
/// a bare `await` that is not inside a `Promise.all(...)`. None if no such loop.
fn first_await_loop(text: &str) -> Option<usize> {
    let bytes = text.as_bytes();
    for m in RE_LOOP_HEAD.find_iter(text) {
        let loop_start = m.start();
        // position of the '(' that the regex matched at its end
        let paren_open = m.end() - 1;
        let Some(paren_close) = match_paren(bytes, paren_open) else { continue };
        // after the ')' expect optional whitespace then '{'
        let mut i = paren_close + 1;
        while i < bytes.len() && (bytes[i] as char).is_whitespace() {
            i += 1;
        }
        if i >= bytes.len() || bytes[i] != b'{' {
            continue; // single-statement loop body — no block, ignore
        }
        let Some(body_end) = match_brace(bytes, i) else { continue };
        let body = &text[i + 1..body_end];
        if body_contains_unbatched_await(body) {
            return Some(loop_start);
        }
    }
    None
}

/// Given index of an opening `(`, return index of its matching `)`.
fn match_paren(bytes: &[u8], open: usize) -> Option<usize> {
    debug_assert_eq!(bytes[open], b'(');
    let mut depth = 0i32;
    let mut i = open;
    while i < bytes.len() {
        match bytes[i] {
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

/// Given index of an opening `{`, return index of its matching `}`.
fn match_brace(bytes: &[u8], open: usize) -> Option<usize> {
    debug_assert_eq!(bytes[open], b'{');
    let mut depth = 0i32;
    let mut i = open;
    while i < bytes.len() {
        match bytes[i] {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

/// True if the body has an `await` that is neither inside a `Promise.all(...)`
/// span nor the `await` that drives a `Promise.all(...)` itself. A loop that
/// only does `await Promise.all([...])` is correctly batched and not flagged.
fn body_contains_unbatched_await(body: &str) -> bool {
    let awaits: Vec<usize> = body
        .match_indices("await")
        .filter(|(i, _)| is_word(body, *i, "await".len()))
        .map(|(i, _)| i)
        .collect();
    if awaits.is_empty() {
        return false;
    }
    let spans = promise_all_spans(body);
    awaits.iter().any(|&a| {
        // inside a Promise.all callback → batched
        if spans.iter().any(|&(s, e)| a >= s && a < e) {
            return false;
        }
        // `await Promise.all(...)` → the await that drives the batch is fine
        let after = body[a + "await".len()..].trim_start();
        if after.starts_with("Promise.all") {
            return false;
        }
        true
    })
}

fn is_word(s: &str, start: usize, len: usize) -> bool {
    let b = s.as_bytes();
    let before_ok = start == 0 || !is_ident(b[start - 1]);
    let after = start + len;
    let after_ok = after >= b.len() || !is_ident(b[after]);
    before_ok && after_ok
}

fn is_ident(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b'_' || c == b'$'
}

fn promise_all_spans(body: &str) -> Vec<(usize, usize)> {
    let bytes = body.as_bytes();
    let mut spans = Vec::new();
    for (i, _) in body.match_indices("Promise.all") {
        // find the '(' after Promise.all
        let mut j = i + "Promise.all".len();
        while j < bytes.len() && (bytes[j] as char).is_whitespace() {
            j += 1;
        }
        if j < bytes.len() && bytes[j] == b'('
            && let Some(close) = match_paren(bytes, j) {
                spans.push((i, close + 1));
            }
    }
    spans
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loop_without_await_is_not_flagged() {
        // the FP that bit us: `for (const k of Object.keys(body))` with no await
        let src = "const u = {}\nfor (const k of Object.keys(body)) {\n  u[k] = body[k]\n}\nawait save(u)";
        assert_eq!(first_await_loop(src), None);
    }

    #[test]
    fn sequential_await_in_loop_is_flagged() {
        let src = "for (const b of rows) {\n  await fetch(url)\n}";
        assert!(first_await_loop(src).is_some());
    }

    #[test]
    fn while_loop_with_await_is_flagged() {
        let src = "while (hasNext) {\n  await tick()\n}";
        assert!(first_await_loop(src).is_some());
    }

    #[test]
    fn await_promise_all_in_loop_is_not_flagged() {
        // the second FP: batched via Promise.all is correct, not sequential
        let src = "for (let i=0;i<n;i+=B) {\n  const r = await Promise.all(chunk.map(async x => { await f(x) }))\n}";
        assert_eq!(first_await_loop(src), None);
    }

    #[test]
    fn braceless_loop_is_ignored_known_limitation() {
        // documented limitation: single-statement (no `{}`) loops are not scanned
        let src = "for (const x of xs) await f(x)";
        assert_eq!(first_await_loop(src), None);
    }

    #[test]
    fn unbatched_await_detected() {
        assert!(body_contains_unbatched_await(" await foo() "));
    }

    #[test]
    fn promise_all_only_is_batched() {
        assert!(!body_contains_unbatched_await(" const r = await Promise.all([f(), g()]) "));
    }

    #[test]
    fn await_after_promise_all_is_unbatched() {
        assert!(body_contains_unbatched_await(" await Promise.all([f()]); await g() "));
    }

    #[test]
    fn await_inside_promise_all_callback_is_batched() {
        assert!(!body_contains_unbatched_await(
            " await Promise.all(xs.map(async x => { const y = await g(x); return y }))"
        ));
    }

    #[test]
    fn word_boundary_no_false_await() {
        // `awaited` / `forward` must not trigger
        assert!(!body_contains_unbatched_await(" const awaited = forwardRef() "));
    }
}
