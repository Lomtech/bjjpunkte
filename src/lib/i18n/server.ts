import 'server-only'
import { cookies, headers } from 'next/headers'
import type { Lang } from './translations'

/**
 * Server-side language detection for RSC.
 *
 * Order of precedence:
 *   1. `lang` cookie (set by LanguageSwitcher on the client → next request reads it server-side)
 *   2. `accept-language` header — first matching of `de` / `en`
 *   3. fallback to `'de'`
 *
 * Reading cookies/headers opts the route into dynamic rendering. The landing page
 * already has dynamic-time content (current date in DATEV mockup, `loggedIn` link)
 * so this is acceptable. For pure-static pages, prefer not calling this.
 */
export async function getServerLang(): Promise<Lang> {
  const cookieStore = await cookies()
  const fromCookie = cookieStore.get('lang')?.value
  if (fromCookie === 'en' || fromCookie === 'de') return fromCookie

  const hdrs = await headers()
  const accept = hdrs.get('accept-language') ?? ''
  // Very small parser — sufficient for de/en split, no q-value sorting
  if (/\ben(?:-[A-Z]{2})?\b/i.test(accept) && !/\bde(?:-[A-Z]{2})?\b/i.test(accept)) return 'en'
  return 'de'
}
