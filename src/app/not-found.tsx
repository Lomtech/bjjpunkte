import Link from 'next/link'
import { OsssLogo } from '@/components/Logo'
import { ContactButton } from '@/app/_landing/ContactButton'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Seite nicht gefunden',
  description: 'Diese Seite existiert nicht. Zurück zur Startseite oder zur Preisübersicht.',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col">

      <nav className="border-b border-zinc-100 bg-white">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <OsssLogo variant="dark" />
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium">
            Zur Startseite
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-5 py-20">
        <div className="max-w-lg text-center">
          <p className="text-amber-500 font-bold text-[10px] uppercase tracking-[0.3em] mb-4">404 · Nicht gefunden</p>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-zinc-950 mb-5">
            Diese Seite gibt&apos;s nicht.
          </h1>
          <p className="text-zinc-500 text-lg leading-relaxed mb-10">
            Vielleicht verschoben, vielleicht nie da gewesen. Hier findest du, was du suchst:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            <Link href="/" className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-colors">
              Zur Startseite
            </Link>
            <Link href="/pricing" className="border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold px-6 py-3.5 rounded-xl text-sm transition-colors">
              Preise ansehen
            </Link>
          </div>

          <div className="text-sm text-zinc-400 space-x-4">
            <Link href="/register" className="hover:text-zinc-700 transition-colors">Kostenlos starten</Link>
            <span className="text-zinc-300">·</span>
            <ContactButton lang="de" className="hover:text-zinc-700 transition-colors" />
            <span className="text-zinc-300">·</span>
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">Datenschutz</Link>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-zinc-100 py-6 px-5">
        <p className="text-zinc-400 text-xs text-center">
          © {new Date().getFullYear()} Osss · Die deutsche Gym-Software für Kampfsport
        </p>
      </footer>

    </div>
  )
}
