// CodebaseIndex — one walk over src/, every file parsed into a FileRecord.
// Every check operates on this shared model, so the FS is touched exactly once.

use crate::util::*;
use regex::Regex;
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use std::sync::LazyLock;

macro_rules! re {
    ($name:ident, $pat:expr) => {
        static $name: LazyLock<Regex> = LazyLock::new(|| Regex::new($pat).unwrap());
    };
}

re!(RE_IMPORT_STMT, r#"(?m)^\s*import\s+(?:[^'"`]*?\bfrom\s+)?['"`]([^'"`]+)['"`]"#);
re!(RE_REQUIRE, r#"\brequire\(\s*['"`]([^'"`]+)['"`]\s*\)"#);
re!(RE_DYN_IMPORT, r#"\bimport\(\s*['"`]([^'"`]+)['"`]\s*\)"#);
re!(RE_REEXPORT, r#"(?m)^\s*export\s+(?:\*|\{[^}]*\})\s+from\s+['"`]([^'"`]+)['"`]"#);
re!(RE_EXPORT_DECL, r"(?m)^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)");
re!(RE_EXPORT_NAMED, r"(?m)^\s*export\s*\{\s*([^}]+)\s*\}");
re!(RE_USE_CLIENT, r#"(?m)^\s*['"]use client['"]\s*;?"#);
re!(RE_USE_SERVER, r#"(?m)^\s*['"]use server['"]\s*;?"#);
re!(RE_DEFAULT_EXP, r"(?m)^\s*export\s+default\b");
re!(RE_USE_EFFECT, r"\buseEffect\s*\(");
re!(RE_USE_STATE, r"\buseState\s*\(");
re!(RE_HOOK_CALL, r"\b(use[A-Z]\w+)\s*\(");
re!(RE_ENV_VAR, r"\bprocess\.env\.([A-Z][A-Z0-9_]+)");
re!(RE_SUPA_TABLE, r#"\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)"#);
re!(RE_TODO, r"//\s*(TODO|FIXME|XXX|HACK)\b\s*[:\-]?\s*(.*)");
re!(RE_NEXT_RUNTIME, r#"export\s+const\s+runtime\s*=\s*['"`](\w+)['"`]"#);
re!(RE_NEXT_DYN, r#"export\s+const\s+dynamic\s*=\s*['"`]([\w-]+)['"`]"#);
re!(RE_EXPORT_HANDLER, r"(?m)^export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|^export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b");

// hydration risk patterns
re!(RE_TO_LOCALE, r"\.toLocaleString\s*\(");
re!(RE_LOCALE_DATE, r"\.toLocaleDateString\s*\(|\.toLocaleTimeString\s*\(");
re!(RE_NEW_DATE, r"\bnew Date\s*\(\s*\)");
re!(RE_DATE_NOW, r"\bDate\.now\s*\(\s*\)");
re!(RE_MATH_RANDOM, r"\bMath\.random\s*\(");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RouteKind {
    Page,
    Layout,
    Api,
}

#[derive(Debug, Default, Serialize)]
pub struct FileRecord {
    pub path: String,
    pub ext: String,
    pub lines: usize,
    pub bytes: usize,
    pub use_client: bool,
    pub use_server: bool,
    pub imports: Vec<String>,
    pub imports_resolved: Vec<String>,
    pub exports: Vec<String>,
    pub has_default_export: bool,
    pub hooks: Vec<String>,
    pub n_use_effect: usize,
    pub n_use_state: usize,
    pub env_vars: Vec<String>,
    pub supabase_tables: Vec<String>,
    pub hydration_risks: Vec<String>,
    pub todos: Vec<Todo>,
    pub route_kind: Option<RouteKind>,
    pub route_path: Option<String>,
    pub next_runtime: Option<String>,
    pub next_dynamic: Option<String>,
    pub http_methods: Vec<String>,
    #[serde(skip)]
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Todo {
    pub kind: String,
    pub line: usize,
    pub text: String,
}

pub struct CodebaseIndex {
    pub root: std::path::PathBuf,
    pub files: Vec<FileRecord>,
    /// reverse import graph: file -> who imports it
    pub reverse: BTreeMap<String, Vec<String>>,
    /// files the walk discovered but could NOT read (surfaced by `doctor`,
    /// never silently treated as empty)
    pub read_errors: Vec<(String, String)>,
    /// total paths the walk matched, before any read failures
    pub discovered: usize,
}

impl CodebaseIndex {
    pub fn build(root: &Path) -> Self {
        let mut paths: Vec<_> = walk_code(root).collect();
        paths.sort();
        let discovered = paths.len();

        let mut files = Vec::with_capacity(paths.len());
        let mut read_errors = Vec::new();
        for p in &paths {
            // read bytes (a true IO failure → recorded), then lossy-decode so a
            // stray non-UTF-8 byte degrades gracefully instead of being dropped.
            match std::fs::read(p) {
                Ok(bytes) => {
                    let content = String::from_utf8_lossy(&bytes).into_owned();
                    files.push(analyze_file(p, root, content));
                }
                Err(e) => read_errors.push((rel(p, root), e.to_string())),
            }
        }

        let reverse = build_reverse_graph(&files);

        Self {
            root: root.to_path_buf(),
            files,
            reverse,
            read_errors,
            discovered,
        }
    }

    pub fn api_routes(&self) -> impl Iterator<Item = &FileRecord> {
        self.files
            .iter()
            .filter(|f| f.route_kind == Some(RouteKind::Api))
    }

    pub fn pages(&self) -> impl Iterator<Item = &FileRecord> {
        self.files
            .iter()
            .filter(|f| f.route_kind == Some(RouteKind::Page))
    }

    pub fn client_components(&self) -> impl Iterator<Item = &FileRecord> {
        self.files.iter().filter(|f| f.use_client)
    }

    /// table -> files that touch it via .from('table')
    pub fn supabase_index(&self) -> BTreeMap<String, Vec<String>> {
        let mut idx: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for f in &self.files {
            for t in &f.supabase_tables {
                idx.entry(t.clone()).or_default().insert(f.path.clone());
            }
        }
        idx.into_iter()
            .map(|(k, v)| (k, v.into_iter().collect()))
            .collect()
    }

    /// env var -> files that reference it
    pub fn env_index(&self) -> BTreeMap<String, Vec<String>> {
        let mut idx: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
        for f in &self.files {
            for e in &f.env_vars {
                idx.entry(e.clone()).or_default().insert(f.path.clone());
            }
        }
        idx.into_iter()
            .map(|(k, v)| (k, v.into_iter().collect()))
            .collect()
    }
}

fn analyze_file(path: &Path, root: &Path, text: String) -> FileRecord {
    let rel_path = rel(path, root);
    let lines = count_lines(&text);

    let mut rec = FileRecord {
        path: rel_path.clone(),
        ext: path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| format!(".{}", s))
            .unwrap_or_default(),
        lines,
        bytes: text.len(),
        use_client: RE_USE_CLIENT.is_match(&text),
        use_server: RE_USE_SERVER.is_match(&text),
        has_default_export: RE_DEFAULT_EXP.is_match(&text),
        n_use_effect: RE_USE_EFFECT.find_iter(&text).count(),
        n_use_state: RE_USE_STATE.find_iter(&text).count(),
        ..Default::default()
    };

    // imports
    let mut imports = BTreeSet::new();
    for caps in [
        &*RE_IMPORT_STMT,
        &*RE_REQUIRE,
        &*RE_DYN_IMPORT,
        &*RE_REEXPORT,
    ] {
        for c in caps.captures_iter(&text) {
            imports.insert(c[1].to_string());
        }
    }
    rec.imports = imports.iter().cloned().collect();
    let mut resolved = BTreeSet::new();
    for spec in &rec.imports {
        if let Some(r) = resolve_import(spec, path, root) {
            resolved.insert(r);
        }
    }
    rec.imports_resolved = resolved.into_iter().collect();

    // exports
    let mut exports: BTreeSet<String> = BTreeSet::new();
    for c in RE_EXPORT_DECL.captures_iter(&text) {
        exports.insert(c[1].to_string());
    }
    for c in RE_EXPORT_NAMED.captures_iter(&text) {
        for part in c[1].split(',') {
            let n = part.trim().split(" as ").next().unwrap_or("").trim();
            if !n.is_empty() && n != "default" {
                exports.insert(n.to_string());
            }
        }
    }
    rec.exports = exports.into_iter().collect();

    // hooks
    let mut hooks: BTreeSet<String> = BTreeSet::new();
    for c in RE_HOOK_CALL.captures_iter(&text) {
        hooks.insert(c[1].to_string());
    }
    rec.hooks = hooks.into_iter().collect();

    // env vars
    let mut envs: BTreeSet<String> = BTreeSet::new();
    for c in RE_ENV_VAR.captures_iter(&text) {
        envs.insert(c[1].to_string());
    }
    rec.env_vars = envs.into_iter().collect();

    // supabase tables
    let mut tables: BTreeSet<String> = BTreeSet::new();
    for c in RE_SUPA_TABLE.captures_iter(&text) {
        tables.insert(c[1].to_string());
    }
    rec.supabase_tables = tables.into_iter().collect();

    // hydration risks
    rec.hydration_risks = detect_hydration_risks(&text);

    // todos
    for (i, line) in text.lines().enumerate() {
        if let Some(c) = RE_TODO.captures(line) {
            rec.todos.push(Todo {
                kind: c[1].to_string(),
                line: i + 1,
                text: c.get(2).map(|m| m.as_str().trim().to_string()).unwrap_or_default(),
            });
        }
    }

    // route detection
    let (kind, route) = derive_route(&rel_path);
    rec.route_kind = match kind.as_deref() {
        Some("page") => Some(RouteKind::Page),
        Some("layout") => Some(RouteKind::Layout),
        Some("api") => Some(RouteKind::Api),
        _ => None,
    };
    rec.route_path = route;

    if let Some(c) = RE_NEXT_RUNTIME.captures(&text) {
        rec.next_runtime = Some(c[1].to_string());
    }
    if let Some(c) = RE_NEXT_DYN.captures(&text) {
        rec.next_dynamic = Some(c[1].to_string());
    }

    // http methods (route handlers)
    let mut methods: BTreeSet<String> = BTreeSet::new();
    for c in RE_EXPORT_HANDLER.captures_iter(&text) {
        if let Some(m) = c.get(1).or_else(|| c.get(2)) {
            methods.insert(m.as_str().to_string());
        }
    }
    rec.http_methods = methods.into_iter().collect();

    rec.content = text;
    rec
}

fn detect_hydration_risks(text: &str) -> Vec<String> {
    let mut risks = Vec::new();
    if RE_TO_LOCALE.is_match(text) {
        risks.push("toLocaleString — locale-abhängig, SSR/CSR-Mismatch möglich".into());
    }
    if RE_LOCALE_DATE.is_match(text) {
        risks.push("toLocaleDate/TimeString — locale-abhängig".into());
    }
    if RE_NEW_DATE.is_match(text) {
        risks.push("new Date() ohne Argument — Server-/Client-Zeit unterscheiden sich".into());
    }
    if RE_DATE_NOW.is_match(text) {
        risks.push("Date.now() — SSR/CSR-Drift".into());
    }
    if RE_MATH_RANDOM.is_match(text) {
        risks.push("Math.random() — SSR ≠ CSR".into());
    }
    risks
}

fn build_reverse_graph(files: &[FileRecord]) -> BTreeMap<String, Vec<String>> {
    let mut rev: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for f in files {
        for target in &f.imports_resolved {
            rev.entry(target.clone()).or_default().insert(f.path.clone());
        }
    }
    rev.into_iter()
        .map(|(k, v)| (k, v.into_iter().collect()))
        .collect()
}
