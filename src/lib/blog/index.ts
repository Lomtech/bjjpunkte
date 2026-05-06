/**
 * Zentrale Liste aller Blog-Artikel.
 *
 * Neuen Artikel hinzufügen:
 * 1. Datei in src/lib/blog/posts/ erstellen (Pattern: meine-url.tsx)
 * 2. Default-Export ist BlogArticle-Objekt
 * 3. Hier in ALL_ARTICLES importieren + ans Array hängen
 */

import type { BlogArticle } from './types'
import { dsgvoKampfsportChecklisteArticle } from './posts/dsgvo-kampfsport-checkliste'

export const ALL_ARTICLES: BlogArticle[] = [
  dsgvoKampfsportChecklisteArticle,
]

/** Sortiert nach Datum, neueste zuerst */
export const ARTICLES_SORTED = [...ALL_ARTICLES].sort(
  (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
)

export function getArticleBySlug(slug: string): BlogArticle | null {
  return ALL_ARTICLES.find(a => a.slug === slug) ?? null
}

export function getRelatedArticles(currentSlug: string, count = 3): BlogArticle[] {
  return ARTICLES_SORTED.filter(a => a.slug !== currentSlug).slice(0, count)
}
