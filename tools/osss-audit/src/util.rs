use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub const SOURCE_EXTS: [&str; 6] = ["ts", "tsx", "js", "jsx", "mjs", "cjs"];
pub const SKIP_DIRS: [&str; 7] = [
    "node_modules",
    ".next",
    "dist",
    "build",
    ".analysis",
    "coverage",
    "__snapshots__",
];

pub fn read_file(path: &Path) -> Result<String> {
    fs::read_to_string(path).with_context(|| format!("read {}", path.display()))
}

/// Lossy read — never fails, replaces invalid UTF-8. Used by the index walk
/// so one weird file can't abort the whole scan.
pub fn read_lossy(path: &Path) -> String {
    match fs::read(path) {
        Ok(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
        Err(_) => String::new(),
    }
}

pub fn walk_code(root: &Path) -> impl Iterator<Item = PathBuf> {
    let src = root.join("src");
    WalkDir::new(src)
        .into_iter()
        .filter_entry(|e| {
            // skip noisy dirs and dotdirs (but allow the root entry itself)
            let name = e.file_name().to_string_lossy();
            if e.file_type().is_dir() {
                !(SKIP_DIRS.contains(&name.as_ref()) || (name.starts_with('.') && name != "."))
            } else {
                true
            }
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            matches!(
                e.path().extension().and_then(|s| s.to_str()),
                Some(ext) if SOURCE_EXTS.contains(&ext)
            )
        })
        .map(|e| e.into_path())
}

pub fn rel(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .map(|p| p.display().to_string())
        .unwrap_or_else(|_| path.display().to_string())
}

pub fn line_of(content: &str, byte_offset: usize) -> usize {
    let cap = byte_offset.min(content.len());
    content.as_bytes()[..cap]
        .iter()
        .filter(|&&b| b == b'\n')
        .count()
        + 1
}

/// Clamp a byte offset to the nearest char boundary at-or-below `offset`.
pub fn clamp_lo(s: &str, offset: usize) -> usize {
    let mut i = offset.min(s.len());
    while i > 0 && !s.is_char_boundary(i) {
        i -= 1;
    }
    i
}

/// Clamp a byte offset to the nearest char boundary at-or-above `offset`.
pub fn clamp_hi(s: &str, offset: usize) -> usize {
    let mut i = offset.min(s.len());
    while i < s.len() && !s.is_char_boundary(i) {
        i += 1;
    }
    i
}

/// Build a short single-line context snippet from `content` around `offset`.
pub fn snippet(content: &str, offset: usize, before: usize, after: usize) -> String {
    let start = clamp_lo(content, offset.saturating_sub(before));
    let end = clamp_hi(content, offset.saturating_add(after));
    content[start..end]
        .chars()
        .map(|c| if c == '\n' { ' ' } else { c })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Count lines the same way analyze.py does: `\n` count + 1 unless the file
/// ends in a newline or is empty.
pub fn count_lines(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    let nl = text.bytes().filter(|&b| b == b'\n').count();
    if text.ends_with('\n') {
        nl
    } else {
        nl + 1
    }
}

/// Resolve an import specifier to a project-relative path (mirrors analyze.py
/// resolve_import). Returns None for node_modules packages.
pub fn resolve_import(spec: &str, importer: &Path, root: &Path) -> Option<String> {
    if spec.is_empty() {
        return None;
    }
    let src_root = root.join("src");
    let candidate: PathBuf = if let Some(rest) = spec.strip_prefix("@/") {
        src_root.join(rest)
    } else if spec.starts_with('.') || spec.starts_with('/') {
        normalize(&importer.parent()?.join(spec))
    } else {
        return None; // bare package
    };

    // direct file
    if candidate.is_file() {
        return candidate.strip_prefix(root).ok().map(disp);
    }
    // with extension
    for ext in SOURCE_EXTS {
        let p = append_ext(&candidate, ext);
        if p.is_file() {
            return p.strip_prefix(root).ok().map(disp);
        }
    }
    // index file
    if candidate.is_dir() {
        for ext in ["ts", "tsx", "js", "jsx"] {
            let p = candidate.join(format!("index.{}", ext));
            if p.is_file() {
                return p.strip_prefix(root).ok().map(disp);
            }
        }
    }
    None
}

fn disp(p: &Path) -> String {
    p.display().to_string()
}

fn append_ext(p: &Path, ext: &str) -> PathBuf {
    let mut s = p.as_os_str().to_owned();
    s.push(".");
    s.push(ext);
    PathBuf::from(s)
}

/// Lexical normalization (resolve `.` and `..`) without touching the FS —
/// `Path::canonicalize` would fail on not-yet-suffixed candidates.
fn normalize(p: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for comp in p.components() {
        use std::path::Component::*;
        match comp {
            ParentDir => {
                out.pop();
            }
            CurDir => {}
            other => out.push(other),
        }
    }
    out
}

/// Derive (kind, route) from a project-relative path under src/app.
/// `src/app/pricing/page.tsx` → (Some("page"), Some("/pricing"))
/// `src/app/api/track/route.ts` → (Some("api"), Some("/api/track"))
/// Route groups `(group)` are stripped.
pub fn derive_route(rel_path: &str) -> (Option<String>, Option<String>) {
    let norm = rel_path.replace('\\', "/");
    if !norm.starts_with("src/app/") {
        return (None, None);
    }
    let p = Path::new(&norm);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("");
    if !matches!(stem, "page" | "layout" | "route") {
        return (None, None);
    }
    let kind = if stem == "route" { "api" } else { stem };

    let parts: Vec<&str> = norm.split('/').collect();
    // drop "src","app", and the filename
    let mid = &parts[2..parts.len().saturating_sub(1)];
    let cleaned: Vec<&str> = mid
        .iter()
        .copied()
        .filter(|s| !(s.starts_with('(') && s.ends_with(')')))
        .collect();
    let route = if cleaned.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", cleaned.join("/"))
    };
    (Some(kind.to_string()), Some(route))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_page() {
        assert_eq!(
            derive_route("src/app/pricing/page.tsx"),
            (Some("page".into()), Some("/pricing".into()))
        );
    }

    #[test]
    fn route_api_nested() {
        assert_eq!(
            derive_route("src/app/api/members/[id]/route.ts"),
            (Some("api".into()), Some("/api/members/[id]".into()))
        );
    }

    #[test]
    fn route_group_stripped() {
        assert_eq!(
            derive_route("src/app/(marketing)/about/page.tsx"),
            (Some("page".into()), Some("/about".into()))
        );
    }

    #[test]
    fn route_root_page() {
        assert_eq!(
            derive_route("src/app/page.tsx"),
            (Some("page".into()), Some("/".into()))
        );
    }

    #[test]
    fn non_route_file() {
        assert_eq!(derive_route("src/lib/pricing.ts"), (None, None));
    }

    #[test]
    fn line_counting_matches_python() {
        assert_eq!(count_lines(""), 0);
        assert_eq!(count_lines("a"), 1);
        assert_eq!(count_lines("a\nb"), 2);
        assert_eq!(count_lines("a\nb\n"), 2); // trailing newline doesn't add a line
    }

    #[test]
    fn line_of_finds_correct_line() {
        let s = "aa\nbb\ncc";
        let idx = s.find("cc").unwrap();
        assert_eq!(line_of(s, idx), 3);
    }

    #[test]
    fn snippet_is_multibyte_safe() {
        // € is 3 bytes — slicing mid-char would panic; clamps must prevent that
        let s = "Preis: 49 € pro Monat — günstig für Café-Besitzer";
        let idx = s.find('€').unwrap();
        let _ = snippet(s, idx, 5, 5); // must not panic
        let _ = snippet(s, idx + 1, 100, 100); // offset mid-€, wide window
    }

    #[test]
    fn clamp_boundaries_never_split_char() {
        let s = "a€b";
        // byte 2 is in the middle of € (bytes 1..4)
        assert!(s.is_char_boundary(clamp_lo(s, 2)));
        assert!(s.is_char_boundary(clamp_hi(s, 2)));
    }
}
