import Link from 'next/link'
import type { Metadata } from 'next'
import { OsssLogo } from '@/components/Logo'
import { CheckCircle2, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Vom Newsletter abgemeldet',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function UnsubscribedPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const ok = (sp.status ?? 'ok') === 'ok'

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <nav className="border-b border-zinc-100">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <OsssLogo variant="dark" />
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium">
            Zur Startseite
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center px-5 py-20">
        <div className="max-w-md text-center">
          {ok ? (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-600" />
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-zinc-950 mb-4">
                Abgemeldet.
              </h1>
              <p className="text-zinc-500 leading-relaxed mb-8">
                Du bekommst keine weiteren Newsletter-Mails von uns. Schade, dass du gehst —
                falls du Feedback hast, schreib uns einfach an{' '}
                <a href="mailto:oss@osss.pro" className="text-amber-600 hover:underline">oss@osss.pro</a>.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertCircle size={32} className="text-rose-600" />
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-zinc-950 mb-4">
                Etwas ist schiefgelaufen
              </h1>
              <p className="text-zinc-500 leading-relaxed mb-8">
                Wir konnten dich nicht abmelden. Schreib uns kurz an{' '}
                <a href="mailto:oss@osss.pro" className="text-amber-600 hover:underline">oss@osss.pro</a>{' '}
                — wir entfernen deine Adresse manuell.
              </p>
            </>
          )}
          <Link href="/" className="inline-block bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
            Zur Startseite
          </Link>
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 px-5">
        <p className="text-zinc-400 text-xs text-center">© {new Date().getFullYear()} Osss</p>
      </footer>
    </div>
  )
}
