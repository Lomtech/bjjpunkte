import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getArticleBySlug, getRelatedArticles, ARTICLES_SORTED } from '@/lib/blog'
import { ArrowRight, Clock, Calendar } from 'lucide-react'
import { TopNav } from '@/components/TopNav'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return ARTICLES_SORTED.map(a => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return { title: 'Artikel nicht gefunden' }

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `https://www.osss.pro/blog/${article.slug}`,
      type: 'article',
      locale: 'de_DE',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: ['Osss'],
    },
    robots: { index: true, follow: true },
  }
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  const related = getRelatedArticles(slug, 3)

  // Article-Schema für Google Rich Snippets
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { '@type': 'Organization', name: 'Osss', url: 'https://www.osss.pro' },
    publisher: {
      '@type': 'Organization',
      name: 'Osss',
      logo: { '@type': 'ImageObject', url: 'https://www.osss.pro/icon-512' },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://www.osss.pro/blog/${article.slug}`,
    },
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <TopNav back={{ href: '/blog', label: 'Blog' }} />

      <article className="flex-1 max-w-3xl mx-auto px-5 py-12 sm:py-16 w-full">

        {/* Header */}
        <header className="mb-10 pb-8 border-b border-zinc-100">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              {article.category}
            </span>
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <Clock size={11} /> {article.readingTime} min
            </span>
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <Calendar size={11} />
              <time dateTime={article.publishedAt}>
                {new Date(article.publishedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
              </time>
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-zinc-950 tracking-tighter leading-[1.05] mb-4">
            {article.title}
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed">
            {article.description}
          </p>
        </header>

        {/* Content — Tailwind Typography style applied via custom classes */}
        <div className="article-content">
          {article.content()}
        </div>

      </article>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="bg-zinc-50 border-t border-zinc-100 py-14 px-5">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Auch lesenswert</h2>
            <div className="space-y-3">
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`}
                  className="block bg-white border border-zinc-200 rounded-2xl p-5 hover:border-amber-300 hover:shadow-sm transition-all group">
                  <p className="font-bold text-zinc-900 mb-1 group-hover:text-amber-600 transition-colors">{r.title}</p>
                  <p className="text-sm text-zinc-500 leading-relaxed">{r.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="bg-amber-400 py-16 px-5 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-black tracking-tight text-zinc-950 mb-3">
            Lieber Software statt Theorie?
          </h2>
          <p className="text-zinc-800 mb-8 leading-relaxed">
            Osss erledigt DSGVO, Rechnungen und Mitgliederverwaltung — direkt eingebaut.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-8 py-3.5 rounded-xl text-base transition-all">
            Kostenlos testen <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="bg-white border-t border-zinc-100 py-6 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} Osss · Die Kampfsport-Gym-Software</p>
          <div className="flex gap-5">
            <Link href="/" className="hover:text-zinc-700 transition-colors">Start</Link>
            <Link href="/blog" className="hover:text-zinc-700 transition-colors">Blog</Link>
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">Datenschutz</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
