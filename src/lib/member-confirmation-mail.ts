/**
 * Member-Email-Confirmation-Mail (Sprint 2026-05-27).
 *
 * Wird aus `api/signup/route.ts` nach Member-Insert aufgerufen. Sendet eine
 * Bestätigungs-Email mit Link auf `/api/members/confirm-email?token=...`.
 * Best-effort: Insert+Token-Generation bleiben auch wenn Resend fehlschlägt
 * (z.B. unkonfiguriert in der Dev-Umgebung).
 *
 * DSGVO-Rechtsgrundlage:
 *  Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) + Art. 6 Abs. 1 lit. f
 *  (berechtigtes Interesse an Identitätsbestätigung des Vertragspartners) —
 *  transactional, KEIN Marketing → kein gesonderter Consent nötig.
 */

import { getAppUrl } from '@/lib/app-url'

function escHtml(s: string | null | undefined): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface MemberConfirmationMailArgs {
  toEmail: string
  memberFirstName: string
  gymName: string
  gymEmail: string | null
  confirmationToken: string
}

export interface MemberConfirmationMailResult {
  sent: boolean
  reason?: 'resend_disabled' | 'http_error' | 'exception'
  error?: string
}

export async function sendMemberConfirmationMail(args: MemberConfirmationMailArgs): Promise<MemberConfirmationMailResult> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return { sent: false, reason: 'resend_disabled' }
  }

  const appUrl = getAppUrl()
  const confirmUrl = `${appUrl}/api/members/confirm-email?token=${encodeURIComponent(args.confirmationToken)}`

  const subject = `Bitte bestätige deine Anmeldung bei ${args.gymName}`
  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px">
        <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:20px 24px">
          <p style="margin:0;color:#fbbf24;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase">${escHtml(args.gymName)}</p>
          <h1 style="margin:6px 0 0;color:#fff;font-size:18px;font-weight:700">Anmeldung bestätigen</h1>
        </td></tr>
        <tr><td style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
          <p style="font-size:15px;color:#0f172a;margin:0 0 16px">Hallo ${escHtml(args.memberFirstName)},</p>
          <p style="font-size:14px;color:#475569;margin:0 0 16px">
            danke für deine Anmeldung bei <strong>${escHtml(args.gymName)}</strong>! Bitte bestätige deine Email-Adresse, damit wir sicher sein können, dass du erreichbar bist.
          </p>
          <div style="text-align:center;margin:24px 0">
            <a href="${escHtml(confirmUrl)}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">
              Email-Adresse bestätigen
            </a>
          </div>
          <p style="font-size:12px;color:#64748b;margin:16px 0 0">
            Der Link ist 7 Tage gültig. Falls der Button nicht klickbar ist, kopiere folgenden URL in deinen Browser:<br>
            <span style="word-break:break-all;color:#475569">${escHtml(confirmUrl)}</span>
          </p>
          <p style="font-size:11px;color:#94a3b8;margin:24px 0 0;border-top:1px solid #f1f5f9;padding-top:12px">
            Wenn du dich nicht angemeldet hast, ignoriere diese Email einfach. Bei Fragen wende dich an ${args.gymEmail ? `<a href="mailto:${escHtml(args.gymEmail)}" style="color:#0f172a">${escHtml(args.gymEmail)}</a>` : 'dein Studio direkt'}.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: args.toEmail,
        subject,
        html,
      }),
    })
    if (res.ok) return { sent: true }
    const body = await res.text().catch(() => '')
    return { sent: false, reason: 'http_error', error: `HTTP ${res.status}: ${body.slice(0, 200)}` }
  } catch (err) {
    return { sent: false, reason: 'exception', error: err instanceof Error ? err.message : String(err) }
  }
}
