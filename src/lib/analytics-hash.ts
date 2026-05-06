import { createHash } from 'crypto'

/**
 * DSGVO-anonyme Hashing-Helpers für Analytics.
 *
 * Wichtig: visitor_hash rotiert TÄGLICH (UTC), session_hash alle 30 Min.
 * Damit ist KEINE Person über Tage hinweg rekonstruierbar — die Tabelle gilt
 * als anonym im Sinne von Erwägungsgrund 26 DSGVO.
 *
 * Die Salts sollten als ANALYTICS_SALT in Vercel-Env hinterlegt werden, sonst
 * wird ein deterministischer (aber dennoch nutzbarer) Default verwendet.
 */

const BASE_SALT = process.env.ANALYTICS_SALT || 'osss-analytics-default-salt-change-in-prod'

/** Hash mit täglich rotierendem Salt — kein Cross-Day-Tracking möglich. */
export function visitorHash(ip: string, userAgent: string): string {
  const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
  const salt = `${BASE_SALT}-day-${day}`
  return createHash('sha256').update(`${ip}|${userAgent}|${salt}`).digest('hex').slice(0, 12)
}

/** Hash mit 30-Min-rotierendem Salt — Session-Erkennung ohne Cookie. */
export function sessionHash(ip: string, userAgent: string): string {
  const now = new Date()
  const slot = Math.floor(now.getUTCHours() * 2 + now.getUTCMinutes() / 30)
  const day = now.toISOString().slice(0, 10)
  const salt = `${BASE_SALT}-session-${day}-${slot}`
  return createHash('sha256').update(`${ip}|${userAgent}|${salt}`).digest('hex').slice(0, 12)
}

/** Klassifiziert User-Agent grob — keine eindeutige Identifikation. */
export function classifyDevice(userAgent: string): { device_type: string; browser: string } {
  const ua = userAgent.toLowerCase()

  let device_type: string = 'desktop'
  if (/ipad|tablet|playbook|silk/i.test(ua) || (/(android)/.test(ua) && !/(mobile)/.test(ua))) {
    device_type = 'tablet'
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    device_type = 'mobile'
  }

  let browser: string = 'other'
  if (/edg\//i.test(ua)) browser = 'edge'
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'chrome'
  else if (/firefox\//i.test(ua)) browser = 'firefox'
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'safari'

  return { device_type, browser }
}

/** Extrahiert nur Domain aus Referrer-URL — verhindert URL-Pfad-Tracking. */
export function extractReferrerDomain(referrer: string | null): string | null {
  if (!referrer) return null
  try {
    const u = new URL(referrer)
    if (u.hostname === 'www.osss.pro' || u.hostname === 'osss.pro') return null // own domain
    return u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
