import Link from 'next/link'
import type { Metadata } from 'next'
import { OsssLogo } from '@/components/Logo'
import { CheckCircle2, AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Newsletter-Anmeldung bestätigt',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function NewsletterConfirmedPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const status = sp.status ?? 'ok'

  const cfg = (() => {
    switch (status) {
      case 'ok':       return { icon: 'success', title: 'Du bist drin!', body: 'Deine E-Mail-Adresse ist bestätigt. Eine Welcome-Mail mit den nächsten Themen ist unterwegs.' }
      case 'already':  return { icon: 'success', title: 'Schon bestätigt', body: 'Diese E-Mail-Adresse war bereits bestätigt. Alles gut — du bekommst weiter Mails.' }
      case 'invalid':  return { icon: 'error',   title: 'Link ungültig', body: 'Der Bestätigungs-Link ist nicht mehr gültig oder wurde bereits verwendet. Du kannst dich auf der Startseite neu anmelden.' }
      case 'error':
      default:         return { icon: 'error',   title: 'Etwas ist schiefgelaufen', body: 'Wir konnten die Bestätigung nicht durchführen. Versuche den Link erneut oder melde dich neu an.' }
    }
  })()

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
          {cfg.icon === 'success' ? (
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
          ) : (
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-rose-100 flex items-center justify-center">
              <AlertCircle size={32} className="text-rose-600" />
            </div>
          )}

          <h1 className="text-3xl font-black tracking-tighter text-zinc-950 mb-4">
            {cfg.title}
          </h1>
          <p className="text-zinc-500 leading-relaxed mb-8">
            {cfg.body}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/blog" className="bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
              Zum Blog
            </Link>
            <Link href="/" className="border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold px-6 py-3 rounded-xl text-sm transition-colors">
              Zur Startseite
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 px-5">
        <p className="text-zinc-400 text-xs text-center">© {new Date().getFullYear()} Osss</p>
      </footer>
    </div>
  )
}
