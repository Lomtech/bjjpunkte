/**
 * SMS/WhatsApp stub — notifications run exclusively via Resend (email).
 * All calls here are no-ops so existing imports don't break.
 */

/** Normalize any German phone number to E.164 (e.g. +4915123456789) */
export function toE164(raw: string): string | null {
  let p = raw.replace(/[\s\-().]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('0')) p = '+49' + p.slice(1)
  if (!p.startsWith('+')) p = '+49' + p
  if (!/^\+\d{10,15}$/.test(p)) return null
  return p
}

/** No-op — always returns false. */
export async function sendWhatsApp(_params: { to: string; body: string }): Promise<boolean> {
  return false
}

export { sendWhatsApp as sendSms }
