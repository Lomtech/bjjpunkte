/**
 * Blog-Article Typen.
 *
 * Artikel werden als TSX-Files unter src/lib/blog/posts/ gepflegt — voll
 * type-safe, mit Tailwind-Komponenten, ohne externe MDX-Deps.
 */

import type { ReactNode } from 'react'

export interface BlogArticle {
  /** URL-Slug — wird zu osss.pro/blog/{slug} */
  slug: string

  /** SEO-Title (50-60 Zeichen ideal) */
  title: string

  /** Meta-Description + Listenpreview (150-160 Zeichen ideal) */
  description: string

  /** Primäres Keyword für SEO-Tracking (intern, kein Output) */
  primaryKeyword: string

  /** Veröffentlichungsdatum */
  publishedAt: string

  /** Letzte Änderung (für Sitemap + Schema) */
  updatedAt: string

  /** Lesezeit in Minuten — wird angezeigt */
  readingTime: number

  /** Kategorie für Filter */
  category: 'DSGVO' | 'Steuern' | 'Sportarten' | 'Software' | 'Mitgliederverwaltung' | 'Marketing'

  /** Hero-Bild-URL (optional, sonst Standard) */
  heroImage?: string

  /** Artikel-Inhalt — JSX-Komponente, voller Tailwind-Zugriff */
  content: () => ReactNode
}
