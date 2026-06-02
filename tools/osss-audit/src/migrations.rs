// migrations-types-drift: scan supabase/migrations/*.sql for SECURITY DEFINER
// functions / RLS policies that reference table.column patterns. Then verify
// each (table, column) against src/types/database.ts. This is what caught the
// CRITICAL 2026-06-01 find: migration 0011 filters gym_staff.is_active but
// that column does not exist in the Database type.

use crate::finding::{Finding, Severity};
use crate::util::{line_of, read_file, rel, snippet};
use anyhow::Result;
use regex::Regex;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use walkdir::WalkDir;

pub fn run(root: &Path) -> Result<Vec<Finding>> {
    let mut findings = Vec::new();

    let types_path = root.join("src/types/database.ts");
    let types_src = read_file(&types_path)?;
    let table_columns = parse_database_types(&types_src);

    let mut migrations: Vec<std::path::PathBuf> = WalkDir::new(root.join("supabase/migrations"))
        .into_iter()
        .filter_map(|e| e.ok())
        .map(|e| e.into_path())
        .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("sql"))
        .collect();
    migrations.sort();

    let dotted_re = Regex::new(r"(?P<table>\b[a-z][a-z0-9_]*)\.(?P<col>[a-z][a-z0-9_]*)\b")?;
    let mut seen: BTreeSet<(String, String, String)> = BTreeSet::new();

    for mig_path in &migrations {
        let Ok(raw) = read_file(mig_path) else { continue };
        let rel_path = rel(mig_path, root);

        // strip comments and string literals — they're not column references
        let stripped = strip_sql_noise(&raw);

        let scan_ranges = extract_runtime_ranges(&stripped);
        let ranges: Vec<(usize, usize)> = if scan_ranges.is_empty() {
            vec![(0, stripped.len())]
        } else {
            scan_ranges
        };

        for (start, end) in ranges {
            let slice = &stripped[start..end];

            // (1) dotted refs — table.column
            for cap in dotted_re.captures_iter(slice) {
                let table = cap.name("table").unwrap().as_str().to_string();
                let col = cap.name("col").unwrap().as_str().to_string();
                let global_offset = start + cap.get(0).unwrap().start();

                let key = (rel_path.clone(), table.clone(), col.clone());
                if !seen.insert(key) {
                    continue;
                }

                check_reference(&table, &col, global_offset, &stripped, &rel_path, &table_columns, &mut findings);
            }

            // (2) bare column refs scoped via FROM {table} clauses
            scan_from_where(slice, start, &stripped, &rel_path, &table_columns, &mut seen, &mut findings);
        }
    }

    Ok(findings)
}

fn check_reference(
    table: &str,
    col: &str,
    offset: usize,
    stripped: &str,
    rel_path: &str,
    table_columns: &BTreeMap<String, BTreeSet<String>>,
    findings: &mut Vec<Finding>,
) {
    // skip SQL namespaces / schemas / well-known aliases
    if matches!(
        table,
        "auth"
            | "public"
            | "pg_catalog"
            | "information_schema"
            | "extensions"
            | "storage"
            | "realtime"
            | "vault"
            | "supabase_functions"
            // PL/pgSQL record types and OLD/NEW aliases in triggers
            | "old"
            | "new"
            | "record"
            // common loop variables
            | "r"
            | "row"
    ) {
        return;
    }

    let Some(cols) = table_columns.get(table) else {
        return; // unknown table — could be temp, view, or schema we don't track
    };
    if cols.contains(col) {
        return;
    }

    let line = line_of(stripped, offset);
    let ctx = snippet(stripped, offset, 60, 100);

    findings.push(Finding::new(
        Severity::Critical,
        format!("Migration references {}.{} but column not in src/types/database.ts", table, col),
        format!("{}:{} — …{}…", rel_path, line, ctx),
        format!(
            "Either add `{}` to the {} Row type in database.ts (if it exists in the live DB), or fix the migration. Verify via `supabase db dump --schema-only --linked`.",
            col, table
        ),
    ));
}

/// Removes line comments (-- …), block comments (/* … */), and replaces the
/// content of single-quoted string literals with spaces (preserves offsets).
fn strip_sql_noise(src: &str) -> String {
    let bytes = src.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let n = bytes.len();
    while i < n {
        // line comment
        if i + 1 < n && bytes[i] == b'-' && bytes[i + 1] == b'-' {
            out.push(b' ');
            out.push(b' ');
            i += 2;
            while i < n && bytes[i] != b'\n' {
                out.push(b' ');
                i += 1;
            }
            continue;
        }
        // block comment
        if i + 1 < n && bytes[i] == b'/' && bytes[i + 1] == b'*' {
            out.push(b' ');
            out.push(b' ');
            i += 2;
            while i + 1 < n && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                out.push(if bytes[i] == b'\n' { b'\n' } else { b' ' });
                i += 1;
            }
            if i + 1 < n {
                out.push(b' ');
                out.push(b' ');
                i += 2;
            }
            continue;
        }
        // single-quoted string literal — SQL uses '' for escape
        if bytes[i] == b'\'' {
            out.push(b'\'');
            i += 1;
            while i < n {
                if bytes[i] == b'\'' {
                    if i + 1 < n && bytes[i + 1] == b'\'' {
                        out.push(b' ');
                        out.push(b' ');
                        i += 2;
                        continue;
                    } else {
                        out.push(b'\'');
                        i += 1;
                        break;
                    }
                }
                out.push(if bytes[i] == b'\n' { b'\n' } else { b' ' });
                i += 1;
            }
            continue;
        }
        // dollar-quoted body $$ … $$ — keep contents (they ARE code)
        out.push(bytes[i]);
        i += 1;
    }
    // Safe: we only ever replaced ASCII with ASCII or kept the original byte.
    String::from_utf8(out).expect("byte-for-byte ASCII substitution stays valid UTF-8")
}

fn extract_runtime_ranges(content: &str) -> Vec<(usize, usize)> {
    let mut ranges = Vec::new();

    // function bodies: AS $$ ... $$ or AS $name$ ... $name$
    let body_re = Regex::new(r"AS\s+\$(?P<tag>[a-zA-Z_]*)\$").unwrap();
    for m in body_re.captures_iter(content) {
        let mat = m.get(0).unwrap();
        let after = mat.end();
        let tag = m.name("tag").unwrap().as_str();
        let close = format!("${}$", tag);
        if let Some(close_idx) = content[after..].find(&close) {
            ranges.push((after, after + close_idx));
        }
    }

    // policy USING(...) / WITH CHECK(...) — paren-depth match
    let kw_re = Regex::new(r"(?i)\b(USING|WITH\s+CHECK)\s*\(").unwrap();
    let bytes = content.as_bytes();
    for m in kw_re.find_iter(content) {
        let start = m.end();
        let mut depth = 1usize;
        let mut i = start;
        while i < bytes.len() && depth > 0 {
            match bytes[i] {
                b'(' => depth += 1,
                b')' => depth -= 1,
                _ => {}
            }
            i += 1;
        }
        if depth == 0 {
            ranges.push((start, i - 1));
        }
    }

    ranges
}

/// Public entry for the RLS check: only the `Tables:` section. Views can't take
/// `ALTER TABLE … ENABLE ROW LEVEL SECURITY`, so flagging them would be a FP.
pub fn base_tables(root: &Path) -> Result<BTreeMap<String, BTreeSet<String>>> {
    let types_src = read_file(&root.join("src/types/database.ts"))?;
    let scoped = scope_to_section(&types_src, "Tables").unwrap_or(&types_src);
    Ok(parse_database_types(scoped))
}

/// Narrow `src` to the brace-matched body of `{section}: {` (e.g. "Tables").
fn scope_to_section<'a>(src: &'a str, section: &str) -> Option<&'a str> {
    let re = Regex::new(&format!(r"\b{}\s*:\s*\{{", section)).unwrap();
    let m = re.find(src)?;
    let body_start = m.end();
    let end = match_brace(&src.as_bytes()[body_start..]) + body_start;
    Some(&src[body_start..end])
}

/// Parses the Database type file. Recognises the Supabase-generated style where
/// each table is `tablename: { Row: { col: type; col2: type; ... } ... }` and
/// the Row body might be on a single line OR multi-line.
fn parse_database_types(src: &str) -> BTreeMap<String, BTreeSet<String>> {
    let mut out: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();

    // find each table block. Indentation in the Supabase-generated file is 6
    // spaces for table names, so anchor on that to avoid catching nested fields.
    let table_re = Regex::new(r"(?m)^\s{6}([a-z_][a-z0-9_]*):\s*\{").unwrap();
    let row_re = Regex::new(r"Row:\s*\{").unwrap();
    let bytes = src.as_bytes();

    for cap in table_re.captures_iter(src) {
        let name = cap.get(1).unwrap().as_str().to_string();
        let after = cap.get(0).unwrap().end();

        // search for Row: { inside the table block — but cap at ~6000 chars
        // ahead so we don't bleed into a subsequent table
        let window_end = (after + 6000).min(src.len());
        let window = &src[after..window_end];
        let Some(rm) = row_re.find(window) else { continue };

        let body_start = after + rm.end();
        let body_end = match_brace(&bytes[body_start..]) + body_start;
        let body = &src[body_start..body_end];

        for col in parse_columns(body) {
            out.entry(name.clone()).or_default().insert(col);
        }
    }

    out
}

fn match_brace(bytes: &[u8]) -> usize {
    let mut depth = 1i32;
    let mut i = 0;
    while i < bytes.len() && depth > 0 {
        match bytes[i] {
            b'{' => depth += 1,
            b'}' => depth -= 1,
            _ => {}
        }
        if depth == 0 {
            return i;
        }
        i += 1;
    }
    bytes.len()
}

/// For each `FROM (public.)?{table}` clause inside a slice, extract bare
/// identifier references in the surrounding statement and verify them against
/// the table's columns. Catches cases like `FROM x WHERE col = TRUE` where
/// `col` isn't qualified with `x.`.
fn scan_from_where(
    slice: &str,
    slice_offset: usize,
    stripped: &str,
    rel_path: &str,
    table_columns: &BTreeMap<String, BTreeSet<String>>,
    seen: &mut BTreeSet<(String, String, String)>,
    findings: &mut Vec<Finding>,
) {
    let from_re = Regex::new(r"(?i)\bFROM\s+(?:public\.)?(?P<table>[a-z_][a-z0-9_]*)\b").unwrap();
    let ident_re = Regex::new(r"\b([a-z_][a-z0-9_]*)\b").unwrap();

    for from_cap in from_re.captures_iter(slice) {
        let table = from_cap.name("table").unwrap().as_str().to_string();
        let from_end = from_cap.get(0).unwrap().end();

        // skip if we don't know this table
        let Some(cols) = table_columns.get(&table) else { continue };

        // statement ends at next ; or unbalanced ) or UNION/INTERSECT keyword
        let stmt_end = find_statement_end(&slice[from_end..]);
        let stmt = &slice[from_end..from_end + stmt_end];

        for cap in ident_re.captures_iter(stmt) {
            let ident = cap.get(1).unwrap().as_str();
            // skip SQL reserved words and built-ins
            if is_sql_reserved(ident) {
                continue;
            }
            // skip numbers/booleans (shouldn't trigger the regex anyway)
            if ident.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                continue;
            }
            let after_pos = cap.get(0).unwrap().end();
            let trailing_raw = &stmt[after_pos..];
            let trailing = trailing_raw.trim_start();

            // skip if followed by `(` — function call
            if trailing.starts_with('(') {
                continue;
            }
            // skip if followed by `.` — this is a schema/namespace ref (auth.uid, public.gyms)
            if trailing.starts_with('.') {
                continue;
            }
            // skip PL/pgSQL convention: parameters with `p_` prefix, locals with `v_`
            if ident.starts_with("p_") || ident.starts_with("v_") {
                continue;
            }
            // skip if column belongs to the table — that's correct, not a finding
            if cols.contains(ident) {
                continue;
            }
            // skip if ident is a known table or alias name (e.g. another table joined)
            if table_columns.contains_key(ident) {
                continue;
            }
            // skip if preceded by `.` — already handled by dotted-pattern check
            let preceding = &stmt[..cap.get(0).unwrap().start()];
            if preceding.ends_with('.') {
                continue;
            }

            let key = (rel_path.to_string(), table.clone(), ident.to_string());
            if !seen.insert(key) {
                continue;
            }

            let global_offset = slice_offset + from_end + cap.get(0).unwrap().start();
            check_reference(&table, ident, global_offset, stripped, rel_path, table_columns, findings);
        }
    }
}

fn find_statement_end(s: &str) -> usize {
    // We're scanning a slice that starts right after `FROM tablename`. The
    // scope of bare column refs is this single SELECT — it ends at:
    //   - `;`
    //   - an unbalanced `)`
    //   - a set-op keyword that starts a new query (UNION / INTERSECT / EXCEPT)
    //   - a FROM that introduces another table (rare in WHERE clauses but
    //     possible in subqueries — handled via paren depth)
    let bytes = s.as_bytes();
    let mut depth = 0i32;
    let mut i = 0;

    // Pre-compile lazily — set-op detection done via a simple manual match
    while i < bytes.len() {
        match bytes[i] {
            b'(' => depth += 1,
            b')' => {
                if depth == 0 {
                    return i;
                }
                depth -= 1;
            }
            b';' => return i,
            _ => {}
        }
        // Check for set-op keywords at depth 0, with both word boundaries
        if depth == 0 && is_at_word_start(bytes, i) {
            if starts_with_ci(&bytes[i..], b"UNION") && is_at_word_end(bytes, i + 5) {
                return i;
            }
            if starts_with_ci(&bytes[i..], b"INTERSECT") && is_at_word_end(bytes, i + 9) {
                return i;
            }
            if starts_with_ci(&bytes[i..], b"EXCEPT") && is_at_word_end(bytes, i + 6) {
                return i;
            }
        }
        i += 1;
    }
    bytes.len()
}

fn is_at_word_start(bytes: &[u8], pos: usize) -> bool {
    if pos == 0 {
        return true;
    }
    let prev = bytes[pos - 1];
    !(prev.is_ascii_alphanumeric() || prev == b'_')
}

fn is_at_word_end(bytes: &[u8], pos: usize) -> bool {
    if pos >= bytes.len() {
        return true;
    }
    let next = bytes[pos];
    !(next.is_ascii_alphanumeric() || next == b'_')
}

fn starts_with_ci(haystack: &[u8], needle: &[u8]) -> bool {
    if haystack.len() < needle.len() {
        return false;
    }
    haystack
        .iter()
        .zip(needle.iter())
        .all(|(h, n)| h.eq_ignore_ascii_case(n))
}

fn is_sql_reserved(s: &str) -> bool {
    matches!(
        s.to_ascii_uppercase().as_str(),
        "SELECT" | "FROM" | "WHERE" | "AND" | "OR" | "NOT" | "NULL" | "TRUE" | "FALSE"
        | "IS" | "IN" | "EXISTS" | "ANY" | "ALL" | "LIKE" | "ILIKE" | "BETWEEN"
        | "JOIN" | "LEFT" | "RIGHT" | "INNER" | "OUTER" | "CROSS" | "ON" | "USING"
        | "GROUP" | "BY" | "ORDER" | "HAVING" | "LIMIT" | "OFFSET" | "UNION" | "INTERSECT" | "EXCEPT"
        | "AS" | "WITH" | "RECURSIVE" | "DISTINCT" | "CASE" | "WHEN" | "THEN" | "ELSE" | "END"
        | "INSERT" | "UPDATE" | "DELETE" | "INTO" | "VALUES" | "SET" | "RETURNING"
        | "CREATE" | "ALTER" | "DROP" | "TABLE" | "VIEW" | "INDEX" | "TRIGGER" | "FUNCTION" | "POLICY"
        | "ENABLE" | "DISABLE" | "FORCE" | "PUBLIC" | "PRIVATE" | "GRANT" | "REVOKE" | "EXECUTE"
        | "RETURNS" | "SETOF" | "RECORD" | "VOID" | "LANGUAGE" | "STABLE" | "VOLATILE" | "IMMUTABLE"
        | "STRICT" | "SECURITY" | "DEFINER" | "INVOKER" | "BEGIN" | "RAISE" | "EXCEPTION" | "NOTICE"
        | "PERFORM" | "DECLARE" | "RETURN" | "IF" | "ELSIF" | "LOOP" | "FOR" | "FOREACH" | "WHILE"
        | "ASC" | "DESC" | "NULLS" | "FIRST" | "LAST" | "UNIQUE" | "PRIMARY" | "KEY" | "FOREIGN"
        | "REFERENCES" | "CASCADE" | "RESTRICT" | "DEFAULT" | "CHECK" | "CONSTRAINT"
        | "TIMESTAMP" | "TIMESTAMPTZ" | "DATE" | "TIME" | "INTERVAL" | "INT" | "INT4" | "INT8"
        | "BIGINT" | "INTEGER" | "SMALLINT" | "NUMERIC" | "DECIMAL" | "REAL" | "DOUBLE" | "PRECISION"
        | "TEXT" | "VARCHAR" | "CHAR" | "BOOLEAN" | "BOOL" | "UUID" | "JSON" | "JSONB" | "BYTEA"
        | "ROW" | "ROWS" | "ONLY" | "TO" | "OF" | "BEFORE" | "AFTER" | "EACH" | "STATEMENT"
        | "REPLACE" | "TEMP" | "TEMPORARY" | "GLOBAL" | "LOCAL" | "DEFERRABLE" | "INITIALLY"
        | "DEFERRED" | "IMMEDIATE" | "MATCH" | "FULL" | "PARTIAL" | "SIMPLE" | "OWNER"
        | "OWNED" | "GENERATED" | "ALWAYS" | "IDENTITY" | "COLUMN" | "COLUMNS" | "INHERITS"
        | "SEQUENCE" | "TYPE" | "DOMAIN" | "COLLATE" | "COLLATION" | "SCHEMA"
    )
}

fn parse_columns(body: &str) -> Vec<String> {
    // Splits on `;` and `\n`, then takes each entry's identifier part before `:`.
    // Handles `col?: type`, `col: type | null`, etc.
    let mut out = Vec::new();
    for piece in body.split([';', '\n']) {
        let piece = piece.trim();
        if piece.is_empty() {
            continue;
        }
        let Some(colon) = piece.find(':') else { continue };
        let lhs = piece[..colon].trim().trim_end_matches('?').trim();
        if lhs.is_empty() {
            continue;
        }
        if !lhs
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
        {
            continue;
        }
        if lhs.starts_with(|c: char| c.is_ascii_digit()) {
            continue;
        }
        out.push(lhs.to_string());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const TYPES: &str = r#"
export type Database = {
  public: {
    Tables: {
      gyms: {
        Row: {
          id: string
          owner_id: string
          onboarding_completed_at: string | null
        }
      }
      gym_staff: {
        Row: {
          id: string
          gym_id: string
          user_id: string
          accepted_at: string | null
        }
      }
    }
    Views: {
      members_with_age: {
        Row: {
          id: string
          gym_id: string
          age: number
        }
      }
    }
  }
}
"#;

    #[test]
    fn parses_table_columns() {
        let cols = parse_database_types(TYPES);
        assert!(cols.contains_key("gyms"));
        assert!(cols["gyms"].contains("owner_id"));
        assert!(cols["gyms"].contains("onboarding_completed_at"));
        assert!(cols["gym_staff"].contains("accepted_at"));
        // is_active deliberately absent — this is the CRITICAL drift the tool catches
        assert!(!cols["gym_staff"].contains("is_active"));
    }

    #[test]
    fn scope_to_tables_excludes_views() {
        let scoped = scope_to_section(TYPES, "Tables").unwrap();
        let cols = parse_database_types(scoped);
        assert!(cols.contains_key("gyms"));
        assert!(cols.contains_key("gym_staff"));
        // the View must NOT appear — views can't take ENABLE RLS, flagging is a FP
        assert!(!cols.contains_key("members_with_age"));
    }

    #[test]
    fn full_parse_includes_views() {
        // table_columns() (drift check) sees everything incl. views
        let cols = parse_database_types(TYPES);
        assert!(cols.contains_key("members_with_age"));
    }

    #[test]
    fn sql_reserved_words() {
        assert!(is_sql_reserved("SELECT"));
        assert!(is_sql_reserved("where"));
        assert!(is_sql_reserved("ENABLE"));
        assert!(!is_sql_reserved("gym_id"));
        assert!(!is_sql_reserved("onboarding_completed_at"));
    }

    #[test]
    fn parse_columns_handles_optional_and_union() {
        let body = "id: string\n  name?: string\n  count: number | null\n  Insert: never";
        let cols = parse_columns(body);
        assert!(cols.contains(&"id".to_string()));
        assert!(cols.contains(&"name".to_string()));
        assert!(cols.contains(&"count".to_string()));
    }
}
