/**
 * Cloudflare Turnstile — Server-Side Token-Verifizierung.
 *
 * Sprint Phase-1 (2026-05-31). 5. Bot-Defense-Schicht im Owner-Signup:
 *   1. Rate-Limit (3/h/IP)
 *   2. Honeypot 'website'-Field
 *   3. Random-Name-Heuristik
 *   4. Sup-Standard signUp() + Confirm-Mail
 *   5. NEU: Cloudflare Turnstile (CAPTCHA) vor allem davor
 *
 * Konfiguration:
 *   TURNSTILE_SITE_KEY   — public, in der Form als data-sitekey
 *   TURNSTILE_SECRET_KEY — server-only, an /siteverify
 *
 * Wenn beide Env-Vars NICHT gesetzt sind → Skip (Dev-Mode), Server akzeptiert
 * jeden Request. So bricht das Repo nicht in Local-Dev ohne CF-Account.
 *
 * In Production OHNE beide Vars: weniger Schutz, aber nicht broken.
 * Idealfall: beide gesetzt, Frontend zeigt Widget, Server prueft Token.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyResult {
  success: boolean
  /** Wenn skip: Server hat TURNSTILE_SECRET_KEY nicht gesetzt → Auth nicht enforced. */
  skipped?: boolean
  errors?: string[]
}

/**
 * Verifiziere einen Turnstile-Token gegen die Cloudflare-Siteverify-API.
 *
 * @param token   - cf-turnstile-response aus dem Form-Body
 * @param remoteIp - optional, IP des Aufrufers fuer extra Trust-Boost
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Skip — Dev-Mode oder Production ohne CF
    return { success: true, skipped: true }
  }
  if (!token) {
    return { success: false, errors: ["missing-token"] }
  }

  const body = new URLSearchParams()
  body.set("secret", secret)
  body.set("response", token)
  if (remoteIp) body.set("remoteip", remoteIp)

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      // Turnstile-API ist normalerweise <500ms — Timeout etwas grosszuegig
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      return { success: false, errors: [`http-${res.status}`] }
    }
    const json = await res.json() as { success: boolean; "error-codes"?: string[] }
    if (json.success) return { success: true }
    return { success: false, errors: json["error-codes"] ?? ["unknown"] }
  } catch (err) {
    console.error("[turnstile] verify exception:", err)
    return { success: false, errors: ["exception"] }
  }
}

/**
 * Public-Site-Key fuer das Frontend.
 * Wenn nicht gesetzt → Widget nicht rendern, Server skipt sowieso.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null
