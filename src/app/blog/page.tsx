import Link from 'next/link'
import type { Metadata } from 'next'
import { ARTICLES_SORTED } from '@/lib/blog'
import { ArrowRight, Clock } from 'lucide-react'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { TopNav } from '@/components/TopNav'

export const metadata: Metadata = {
  title: 'Blog – Praxis-Wissen für Kampfsport-Vereine',
  description:
    'DSGVO, Steuern, Mitgliederverwaltung, Marketing: ehrliche Anleitungen für Gym-Inhaber und Vereinsvorstände. Ohne Marketing-Geschwurbel.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Osss Blog – Praxis-Wissen für Kampfsport-Vereine',
    description:
      'DSGVO, Steuern, Mitgliederverwaltung, Marketing: ehrliche Anleitungen für Gym-Inhaber.',
    url: 'https://www.osss.pro/blog',
    type: 'website',
    locale: 'de_DE',
  },
  robots: { index: true, follow: true },
}

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">

      <TopNav />

      {/* Header */}
      <header className="border-b border-zinc-100 bg-white">
        <div className="max-w-3xl mx-auto px-5 py-16 sm:py-20">
          <p className="text-amber-500 font-bold text-[10px] uppercase tracking-[0.3em] mb-4">Osss Blog</p>
          <h1 className="text-4xl sm:text-5xl font-black text-zinc-950 tracking-tighter mb-4">
            Praxis-Wissen für Kampfsport-Vereine.
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed">
            DSGVO, Steuern, Mitgliederverwaltung, Marketing — ehrliche Anleitungen für Gym-Inhaber
            und Vereinsvorstände. Ohne Marketing-Geschwurbel, ohne Anwalts-Floskeln.
          </p>
        </div>
      </header>

      {/* Article list */}
      <main className="flex-1 max-w-3xl mx-auto px-5 py-16 w-full">
        {ARTICLES_SORTED.length === 0 ? (
          <p className="text-zinc-500 text-center py-20">Bald geht&apos;s los — der erste Artikel kommt in Kürze.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {ARTICLES_SORTED.map(article => (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="group block py-8 hover:bg-zinc-50/60 -mx-5 px-5 rounded-2xl transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    {article.category}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-zinc-400">
                    <Clock size={11} /> {article.readingTime} min
                  </span>
                  <time className="text-xs text-zinc-400" dateTime={article.publishedAt}>
                    {new Date(article.publishedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </time>
                </div>

                <h2 className="text-2xl sm:text-3xl font-black text-zinc-950 tracking-tight mb-3 group-hover:text-amber-600 transition-colors">
                  {article.title}
                </h2>
                <p className="text-zinc-500 leading-relaxed mb-3">
                  {article.description}
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 group-hover:text-amber-700 transition-colors">
                  Weiterlesen <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Newsletter */}
      <section className="bg-zinc-50 border-t border-zinc-100 py-16 px-5">
        <div className="max-w-3xl mx-auto">
          <NewsletterSignup
            source="blog-index"
            variant="hero"
            title="Keinen Artikel mehr verpassen."
            description="Alle 1-2 Wochen ein neuer Praxis-Artikel — DSGVO, DATEV, SEPA, Belt-Tracking, Mitglieder-Pipeline. Direkt im Postfach."
          />
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-white border-t border-zinc-100 py-16 px-5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-black text-zinc-950 tracking-tight mb-3">
            Du willst Praxis statt Theorie?
          </h2>
          <p className="text-zinc-500 mb-8 leading-relaxed">
            Osss übernimmt DSGVO, Rechnungen und Mitgliederverwaltung — direkt eingebaut.
            Bis 30 Mitglieder kostenlos.
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
            <Link href="/pricing" className="hover:text-zinc-700 transition-colors">Preise</Link>
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">Datenschutz</Link>
            <Link href="/impressum" className="hover:text-zinc-700 transition-colors">Impressum</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
