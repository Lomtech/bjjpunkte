import type { MetadataRoute } from 'next'

const BASE_URL = 'https://www.osss.pro'

/**
 * robots.txt — sagt Crawlern was sie indexieren dürfen.
 *
 * Erlaubt: Marketing-Pages + Public Gym-Pages
 * Blockiert: Auth-Bereich, Admin (Sales-CRM), API, Mitglieder-Portale,
 *            Signup-Tokens (Privacy), Onboarding etc.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',       // Auth-Bereich
          '/dashboard/*',
          '/admin',           // Sales-CRM (intern)
          '/admin/*',
          '/api/',            // alle API-Endpoints
          '/portal/',         // Mitglieder-Portale (Token-basiert)
          '/portal/*',
          '/signup/',         // Signup-Tokens (privat)
          '/signup/*',
          '/lead/',           // Lead-Token-Pages
          '/lead/*',
          '/staff/',          // Staff-Accept-Tokens
          '/staff/*',
          '/auth/',           // Auth-Callbacks
          '/auth/*',
          '/trial/',          // Trial-Slugs (optional, eher privat)
          '/trial/*',
          '/monitoring',      // Sentry-Tunnel
          '/sentry-example-page',
        ],
      },
      // Stripe + andere Bots, die uns nicht crawlen müssen
      {
        userAgent: ['GPTBot', 'CCBot', 'anthropic-ai', 'ClaudeBot', 'Bytespider'],
        allow: ['/'],
        // Wir erlauben AI-Crawler bewusst — Brand-Mentions in LLMs sind 2026+ ein
        // wichtiger Distributions-Kanal (ChatGPT, Perplexity etc.).
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
