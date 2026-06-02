// security.rs — full port of deep_audit.py's route-security checks, with the
// real osss helper names wired in so the auth/service-role/rate-limit detection
// doesn't false-positive on the resolveOwnerGym/getCachedUser/applyRateLimit
// wrappers the codebase actually uses.
//
// Checks: AUTH, CRON_AUTH, RATE_LIMIT, INPUT, ERROR_LEAK, MULTI_TENANT,
//         PORTAL_TOKEN_LEN, plus route-auth-coverage stat.

use crate::finding::{Finding, Severity};
use crate::model::{CodebaseIndex, FileRecord};
use regex::Regex;
use std::sync::LazyLock;

macro_rules! re {
    ($name:ident, $pat:expr) => {
        static $name: LazyLock<Regex> = LazyLock::new(|| Regex::new($pat).unwrap());
    };
}

// service-role usage — real helpers + raw env key
re!(RE_SERVICE_CLIENT, r"SUPABASE_SERVICE_ROLE_KEY|createServiceClient\(|serviceClient\(|supabaseAdmin\b|adminClient\(");
// auth verification — Supabase native + the project's wrapper helpers
re!(RE_AUTH_CHECK, r"(?i)getUser|getSession|auth\.getUser|resolveOwnerGym|getCachedUser|requireAdmin|requireOwner|requireAuth");
// rate-limit — the project uses applyRateLimit
re!(RE_RATE_LIMIT, r"(?i)applyRateLimit|rateLimit|rateLimiter|ratelimit|upstash|checkRateLimit|withRateLimit");
re!(RE_CRON_GUARD, r"cronGuard|CRON_SECRET");
re!(RE_BODY_PARSE, r"req\.json\(\)|\.json\(\)|formData\(\)|\.text\(\)");
re!(RE_BODY_VALIDATE, r"z\.object|zod|yup|joi|if\s*\(\s*!\w|typeof\s+\w+\s*!==|\.trim\(\)|\.length|parseInt|parseFloat|Number\(|isNaN|isFinite|schema\.parse|\.safeParse");
// real leak = raw message returned in an HTTP response, not logged to console.
re!(RE_ERROR_LEAK, r"(?s)(?:NextResponse\.json|new Response|Response\.json)\s*\(\s*\{[^}]{0,160}\b(?:error|err|e)\.message");
// tenant scoping: gym_id filters, ownership checks (owner_id), or token lookups
re!(RE_GYM_FILTER, r#"eq\(\s*['"]gym_id['"]|eq\(\s*['"]owner_id['"]|gym_id\s*[:=]|owner_id\s*[:=]|owner_id\s*!?===|\.owner_id|portal_token|invite_token|gym\.id"#);
re!(RE_FROM_SELECT, r#"\.from\(\s*['"](\w+)['"]\s*\)"#);
// token-based authentication: a `.eq('…token…', …)` lookup or an `…token…` column filter
re!(RE_TOKEN_AUTH, r#"\.eq\(\s*['"]\w*token\w*['"]|portal_token|invite_token|unsubscribe_token|confirm(?:ation)?_token"#);

pub fn run(idx: &CodebaseIndex) -> Vec<Finding> {
    let mut findings = Vec::new();
    for route in idx.api_routes() {
        audit_route(route, &mut findings);
    }

    // route-auth-coverage stat
    let routes: Vec<&FileRecord> = idx.api_routes().collect();
    let total = routes.len();
    let with_auth = routes.iter().filter(|r| facts(r).has_auth).count();
    if total > 0 {
        let pct = (with_auth * 100) / total;
        findings.push(
            Finding::new(
                Severity::Info,
                format!("Route auth-coverage: {}/{} ({}%) have an auth check", with_auth, total, pct),
                "Counts getUser/getSession/resolveOwnerGym/getCachedUser/requireAdmin. Public/cron/webhook routes legitimately lack one.",
                "",
            )
            .with_category("AUTH")
            .with_loc("src/app/api".to_string(), 0),
        );
    }
    findings
}

/// Lightweight per-route flags for the inventory table (routes.rs).
pub struct RouteFlags {
    pub has_auth: bool,
    pub has_rate_limit: bool,
    pub has_gym_filter: bool,
    pub has_service_role: bool,
    pub is_public: bool,
    pub is_cron: bool,
}

pub fn route_flags(r: &FileRecord) -> RouteFlags {
    let f = facts(r);
    RouteFlags {
        has_auth: f.has_auth,
        has_rate_limit: f.has_rate_limit,
        has_gym_filter: f.has_gym_filter,
        has_service_role: f.has_service_role,
        is_public: f.is_public || f.is_intentionally_public,
        is_cron: f.is_cron,
    }
}

struct Facts {
    is_public: bool,
    is_cron: bool,
    is_webhook: bool,
    is_portal: bool,
    is_token_authed: bool,
    is_intentionally_public: bool,
    has_mutation: bool,
    has_service_role: bool,
    has_auth: bool,
    has_rate_limit: bool,
    has_body_parse: bool,
    has_body_validate: bool,
    has_gym_filter: bool,
}

fn facts(r: &FileRecord) -> Facts {
    let p = &r.path;
    let t = &r.content;
    let is_public = p.contains("/api/public/")
        || p.contains("/api/health")
        || p.contains("/api/auth/callback");
    // Entry points that are public or token-gated by design — auth via JWT is
    // not the mechanism here, so a missing getUser() is not a finding.
    let is_intentionally_public = [
        "/api/auth/register",
        "/api/signup",
        "/api/staff/accept",
        "/api/stripe/connect/callback",
        "/api/newsletter/",
        "/api/public/contact",
        "/api/inngest",
        "/api/stripe/webhook",
        "/api/track",                 // analytics beacon — bot-reject + rate-limit, no PII
        "/api/schedule/ical",         // public iCal feed, gym-token scoped
        "/api/members/confirm-email", // email-confirmation link, token in body
        "/api/gym-mail/",             // unsubscribe / open-tracking, token in path
    ]
    .iter()
    .any(|x| p.contains(x));
    // token-authenticated: dynamic [token] path segment OR a token-column lookup
    let is_token_authed = p.contains("[token]") || RE_TOKEN_AUTH.is_match(t);
    Facts {
        is_public,
        is_cron: p.contains("/api/cron/"),
        is_webhook: p.contains("webhook"),
        is_portal: p.contains("/api/portal/"),
        is_token_authed,
        is_intentionally_public,
        has_mutation: r
            .http_methods
            .iter()
            .any(|m| matches!(m.as_str(), "POST" | "PUT" | "PATCH" | "DELETE")),
        has_service_role: RE_SERVICE_CLIENT.is_match(t),
        has_auth: RE_AUTH_CHECK.is_match(t),
        has_rate_limit: RE_RATE_LIMIT.is_match(t),
        has_body_parse: RE_BODY_PARSE.is_match(t),
        has_body_validate: RE_BODY_VALIDATE.is_match(t),
        has_gym_filter: RE_GYM_FILTER.is_match(t),
    }
}

fn audit_route(r: &FileRecord, findings: &mut Vec<Finding>) {
    let f = facts(r);
    let methods = r.http_methods.join(",");

    // 1. AUTH — service-role without an auth check on a non-public, non-cron route
    if f.has_service_role
        && !f.has_auth
        && !f.is_public
        && !f.is_cron
        && !f.is_webhook
        && !f.is_intentionally_public
        && !f.is_portal
        && !f.is_token_authed
    {
        findings.push(
            Finding::new(
                Severity::High,
                "Service-role client used without an auth check",
                format!("Methods: [{}]. No getUser/resolveOwnerGym/getCachedUser/requireAdmin found before service-role usage.", methods),
                "Verify the JWT (resolveOwnerGym/getCachedUser/requireAdmin) before any createServiceClient() call.",
            )
            .with_category("AUTH")
            .with_loc(r.path.clone(), 1),
        );
    }

    // 2. CRON_AUTH — cron route without cronGuard/CRON_SECRET
    if f.is_cron && !RE_CRON_GUARD.is_match(&r.content) {
        findings.push(
            Finding::new(
                Severity::Critical,
                "Cron route without CRON_SECRET / cronGuard",
                "Anyone could trigger this endpoint over HTTP.",
                "Call cronGuard(req) (or check x-cron-secret against process.env.CRON_SECRET) at the top of the handler.",
            )
            .with_category("CRON_AUTH")
            .with_loc(r.path.clone(), 1),
        );
    }

    // 3. RATE_LIMIT — public mutating route without rate limiting
    if f.is_public && f.has_mutation && !f.has_rate_limit {
        findings.push(
            Finding::new(
                Severity::High,
                "Public mutating route without rate limiting",
                format!("Methods: [{}] on a public route, no applyRateLimit found.", methods),
                "Wrap with applyRateLimit() or add IP throttling in proxy.ts.",
            )
            .with_category("RATE_LIMIT")
            .with_loc(r.path.clone(), 1),
        );
    }

    // 4. INPUT — mutating route parses a body but never validates it
    if f.has_mutation && f.has_body_parse && !f.has_body_validate {
        findings.push(
            Finding::new(
                Severity::Medium,
                "Request body parsed but not validated",
                "No typeof/zod/length/Number guard found after the body parse.",
                "Add typeof checks + length limits (or zod .safeParse) on every body field.",
            )
            .with_category("INPUT")
            .with_loc(r.path.clone(), 1),
        );
    }

    // 5. ERROR_LEAK — raw error.message returned inside an HTTP response body
    let leaks = RE_ERROR_LEAK.find_iter(&r.content).count();
    if leaks > 0 {
        let m = RE_ERROR_LEAK.find(&r.content).unwrap();
        findings.push(
            Finding::new(
                Severity::Low,
                format!("Raw error message returned to client ({}×)", leaks),
                "A NextResponse.json/Response body embeds a raw error.message (DB/Stripe internals leak to the caller).",
                "Return a generic message; log the detail to console.error/Sentry only.",
            )
            .with_category("ERROR_LEAK")
            .with_loc(r.path.clone(), crate::util::line_of(&r.content, m.start())),
        );
    }

    // 6. MULTI_TENANT — service-role reading several tables with NO gym_id
    // scoping anywhere in the route. The `!has_gym_filter` gate is the honest
    // signal: a route that filters by gym_id *somewhere* is trusted; one that
    // never does, yet reads 3+ tables under service-role, is the real smell.
    // Admin routes are cross-tenant by design (requireAdmin-gated, leads are
    // platform-owned not gym-scoped) → excluded.
    let is_admin = r.path.contains("/api/admin/");
    if f.has_service_role
        && !f.has_gym_filter
        && !f.is_public
        && !f.is_cron
        && !f.is_webhook
        && !f.is_portal
        && !f.is_intentionally_public
        && !f.is_token_authed
        && !is_admin
    {
        let unscoped = count_unscoped_selects(&r.content);
        if unscoped > 2 {
            findings.push(
                Finding::new(
                    Severity::High,
                    format!("Service-role reads {} tables with no gym_id scoping anywhere in the route", unscoped),
                    "Possible cross-tenant data leak — no .eq('gym_id', …) filter found in the whole handler.",
                    "Scope every service-role query to the verified gym via .eq('gym_id', verifiedGymId).",
                )
                .with_category("MULTI_TENANT")
                .with_loc(r.path.clone(), 1),
            );
        }
    }

    // 7. PORTAL_TOKEN_LEN — portal route without a token-length guard
    if f.is_portal {
        let has_len_guard = Regex::new(r"token\.length|token\.trim|if\s*\(\s*!\s*token")
            .unwrap()
            .is_match(&r.content);
        if !has_len_guard {
            findings.push(
                Finding::new(
                    Severity::Low,
                    "Portal token not length-checked",
                    "No token.length / token.trim / !token guard before lookup.",
                    "Reject early: if (!token || token.length < 20) return 400.",
                )
                .with_category("INPUT")
                .with_loc(r.path.clone(), 1),
            );
        }
    }
}

/// Count `.from('table').select(` occurrences whose surrounding 400-char window
/// does not contain a gym_id / token scope. Mirrors deep_audit's heuristic.
fn count_unscoped_selects(text: &str) -> usize {
    let mut count = 0;
    for m in RE_FROM_SELECT.find_iter(text) {
        let start = m.start();
        let end = (start + 400).min(text.len());
        let end = {
            // clamp to char boundary
            let mut e = end;
            while e < text.len() && !text.is_char_boundary(e) {
                e += 1;
            }
            e
        };
        let window = &text[start..end];
        if window.contains(".select(") && !RE_GYM_FILTER.is_match(window) {
            count += 1;
        }
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::FileRecord;

    fn route(path: &str, methods: &[&str], content: &str) -> FileRecord {
        FileRecord {
            path: path.into(),
            content: content.into(),
            http_methods: methods.iter().map(|s| s.to_string()).collect(),
            ..Default::default()
        }
    }

    fn cats(r: &FileRecord) -> Vec<String> {
        let mut f = Vec::new();
        audit_route(r, &mut f);
        f.into_iter().map(|x| x.category).collect()
    }

    #[test]
    fn service_role_without_auth_is_flagged() {
        let r = route(
            "src/app/api/members/route.ts",
            &["GET"],
            "const db = createServiceClient(); const x = await db.from('members').select('*')",
        );
        assert!(cats(&r).contains(&"AUTH".to_string()));
    }

    #[test]
    fn service_role_with_resolveownergym_is_ok() {
        let r = route(
            "src/app/api/members/route.ts",
            &["GET"],
            "const gym = await resolveOwnerGym(req); const db = createServiceClient()",
        );
        assert!(!cats(&r).contains(&"AUTH".to_string()));
    }

    #[test]
    fn token_path_is_not_auth_flagged() {
        // [token] segment = token-authenticated by construction
        let r = route(
            "src/app/api/gym-mail/unsubscribe/[token]/route.ts",
            &["GET"],
            "const db = createServiceClient(); db.from('x').eq('unsubscribe_token', token)",
        );
        assert!(!cats(&r).contains(&"AUTH".to_string()));
    }

    #[test]
    fn cron_without_guard_is_critical() {
        let r = route(
            "src/app/api/cron/foo/route.ts",
            &["GET"],
            "export async function GET() { return Response.json({}) }",
        );
        let mut f = Vec::new();
        audit_route(&r, &mut f);
        assert!(f.iter().any(|x| x.category == "CRON_AUTH" && x.severity == Severity::Critical));
    }

    #[test]
    fn cron_with_guard_is_ok() {
        let r = route(
            "src/app/api/cron/foo/route.ts",
            &["GET"],
            "export async function GET(req) { cronGuard(req); return Response.json({}) }",
        );
        assert!(!cats(&r).contains(&"CRON_AUTH".to_string()));
    }

    #[test]
    fn public_post_without_ratelimit_is_flagged() {
        let r = route(
            "src/app/api/public/foo/route.ts",
            &["POST"],
            "export async function POST(req) { const b = await req.json(); return Response.json({}) }",
        );
        assert!(cats(&r).contains(&"RATE_LIMIT".to_string()));
    }

    #[test]
    fn public_post_with_ratelimit_is_ok() {
        let r = route(
            "src/app/api/public/foo/route.ts",
            &["POST"],
            "export async function POST(req) { await applyRateLimit(req); return Response.json({}) }",
        );
        assert!(!cats(&r).contains(&"RATE_LIMIT".to_string()));
    }

    #[test]
    fn error_message_in_response_is_leak() {
        let r = route(
            "src/app/api/x/route.ts",
            &["GET"],
            "if (error) return NextResponse.json({ error: error.message }, { status: 500 })",
        );
        assert!(cats(&r).contains(&"ERROR_LEAK".to_string()));
    }

    #[test]
    fn error_message_in_console_is_not_leak() {
        let r = route(
            "src/app/api/x/route.ts",
            &["GET"],
            "if (error) { console.error('failed', error.message); return NextResponse.json({ ok: false }) }",
        );
        assert!(!cats(&r).contains(&"ERROR_LEAK".to_string()));
    }
}
