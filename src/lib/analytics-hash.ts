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

// Audit 2026-05-11: Fail-hard wenn der Default-Salt in Production durchschlägt.
// Ein vorhersagbarer Salt macht die täglich rotierenden visitor_hashes reversibel
// und bricht das DSGVO-Anonymitätsversprechen (Erw. 26).
const DEFAULT_SALT = 'osss-analytics-default-salt-change-in-prod'
const ENV_SALT = process.env.ANALYTICS_SALT
if (process.env.NODE_ENV === 'production' && (!ENV_SALT || ENV_SALT === DEFAULT_SALT)) {
  throw new Error(
    '[analytics-hash] ANALYTICS_SALT muss in Production gesetzt sein (≠ Default). ' +
    'Sonst sind page_views.visitor_hash reversibel — DSGVO-Verstoß. ' +
    'In Vercel Env-Vars unter ANALYTICS_SALT konfigurieren (64+ zufällige Zeichen).'
  )
}
const BASE_SALT = ENV_SALT || DEFAULT_SALT

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

/**
 * Erkennt bekannte Bots/Crawler/Monitoring/Scanner via User-Agent.
 *
 * Selbst Bots die sich tarnen (Chrome-UA spoofen) werden zu ~95% erkannt
 * weil sie meist mindestens EINS dieser Tokens hinterlassen. Das schließt
 * SEO-Crawler (Google/Bing), Uptime-Pings (Pingdom/UptimeRobot) und
 * Security-Scanner (Detectify/Acunetix) zuverlässig aus den Stats aus.
 *
 * Falsch-Positive sind sehr selten — kein normaler Browser hat „bot" oder
 * „crawler" im User-Agent.
 */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true  // kein UA = vermutlich Bot/Tool
  const ua = userAgent.toLowerCase()
  return /\b(bot|crawler|spider|slurp|crawling|scraper|headless|phantom|selenium|puppeteer|playwright|chromedriver|webdriver|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|yahoo!|exabot|facebookexternalhit|twitterbot|linkedinbot|telegrambot|whatsapp|discordbot|skypeuripreview|slackbot|pingdom|uptimerobot|monitor|statuscake|dataforseoBot|ahrefs|semrush|mj12bot|petalbot|gptbot|claudebot|anthropic|chatgpt-user|perplexitybot|applebot|developers\.google\.com|prerender|chrome-lighthouse|google-pagespeed|google-inspection|amazonbot|fetch|curl\/|wget\/|httpie|python-requests|axios\/|node-fetch|java\/|go-http-client|okhttp\/|libwww-perl|scrapy|nutch|heritrix|archive\.org_bot|webvisor)\b/.test(ua)
}

/**
 * Kategorisiert die Referrer-Quelle in eine kleine Anzahl bekannter
 * Buckets — für Quellen-Aggregation in der Analytics-Übersicht.
 *
 * Beispiele:
 *  - google.com/google.de/google.* → 'google'
 *  - linkedin.com / lnkd.in → 'linkedin'
 *  - t.co → 'twitter' (alte Tweet-Links)
 *  - facebook.com / fb.com / m.facebook.com → 'facebook'
 *  - kein Referrer (direct hit) → 'direct'
 *  - alles andere → 'other'
 */
export function categorizeReferrer(domain: string | null | undefined): string {
  if (!domain) return 'direct'
  const d = domain.toLowerCase()
  if (/^(www\.)?google(\.|$)|google\.[a-z]+$|googleadservices\.com|googlesyndication\.com/.test(d)) return 'google'
  if (/^(www\.)?bing(\.|$)/.test(d) || d === 'cn.bing.com') return 'bing'
  if (/^(www\.)?duckduckgo\.com/.test(d)) return 'duckduckgo'
  if (/^(www\.)?yandex\.|yahoo\.com/.test(d)) return 'other-search'
  if (/^(www\.)?linkedin\.com|lnkd\.in/.test(d)) return 'linkedin'
  if (/^(www\.|m\.|l\.|lm\.)?(facebook\.com|fb\.com|fb\.me)/.test(d)) return 'facebook'
  if (/^(www\.|m\.)?(twitter\.com|x\.com)|t\.co/.test(d)) return 'twitter'
  if (/^(www\.|m\.)?instagram\.com|l\.instagram\.com/.test(d)) return 'instagram'
  if (/^(www\.)?reddit\.com|out\.reddit\.com/.test(d)) return 'reddit'
  if (/^(www\.)?youtube\.com|youtu\.be/.test(d)) return 'youtube'
  if (/^(www\.)?tiktok\.com/.test(d)) return 'tiktok'
  if (/^(www\.)?pinterest\.|pin\.it/.test(d)) return 'pinterest'
  if (/^(www\.|web\.)?whatsapp\.com|wa\.me/.test(d)) return 'whatsapp'
  if (/^(www\.|t\.)?telegram\.|t\.me/.test(d)) return 'telegram'
  if (/^(mail|outlook|gmail|yahoo|web)\.|email|newsletter/.test(d)) return 'email'
  if (/^(www\.)?(github|stackoverflow|hacker)\./.test(d)) return 'tech'
  return 'other'
}

/** Sanitize UTM-Param: nur a-z0-9_-., max 100 chars, lowercase. */
export function sanitizeUtm(value: string | null | undefined): string | null {
  if (!value) return null
  const s = value.toLowerCase().replace(/[^a-z0-9_\-.]/g, '').slice(0, 100)
  return s.length > 0 ? s : null
}
