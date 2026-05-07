import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { ARTICLES_SORTED } from '@/lib/blog'

const BASE_URL = 'https://www.osss.pro'

/**
 * Sitemap für Suchmaschinen.
 * Wird zur Build-Zeit + ISR alle 24h regeneriert (Next.js 16 Default-Caching).
 *
 * Strategie:
 * 1. Statische Marketing-Pages (höchste Priorität)
 * 2. Public Gym-Pages (niedrigere Priorität, aber breiter Long-Tail)
 *
 * Auth-pflichtige Pages (Dashboard, Portal etc.) werden NICHT indexiert.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Statische Pages — manuell gepflegt, hohe Priorität
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`,                          lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/pricing`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/blog`,                      lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/register`,                  lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/ressourcen`,                lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/ressourcen/dsgvo-checkliste`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/rechner`,                   lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/datenschutz`,               lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/impressum`,                 lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE_URL}/agb`,                       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]

  // Blog-Artikel — jeder Artikel ist eine SEO-Chance
  const blogPages: MetadataRoute.Sitemap = ARTICLES_SORTED.map(a => ({
    url: `${BASE_URL}/blog/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Public Gym-Pages — alle Gyms mit abgeschlossenem Onboarding
  // Jedes Gym ist eine Long-Tail SEO-Chance ("BJJ in Hamburg", "Karate Köln", etc.)
  let gymPages: MetadataRoute.Sitemap = []
  try {
    const supabase = createServiceClient()
    const { data: gyms } = await supabase
      .from('gyms')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('slug, created_at, onboarding_completed_at') as any
    if (Array.isArray(gyms)) {
      gymPages = (gyms as Array<{ slug: string | null; created_at: string; onboarding_completed_at: string | null }>)
        .filter(g => g.slug && g.onboarding_completed_at)
        .map(g => ({
          url: `${BASE_URL}/gym/${g.slug}`,
          lastModified: new Date(g.onboarding_completed_at || g.created_at),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }))
    }
  } catch {
    // Bei DB-Fehler trotzdem statische Sitemap ausliefern — besser als 500
  }

  return [...staticPages, ...blogPages, ...gymPages]
}
