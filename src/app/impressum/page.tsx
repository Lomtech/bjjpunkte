import Link from 'next/link'
import { OsssLogo } from '@/components/Logo'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Impressum von Osss — Angaben gemäß §5 TMG',
}

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="border-b border-zinc-100 bg-white">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <OsssLogo variant="light" />
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium">
            Zur Startseite
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-16">
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">Impressum</h1>
        <p className="text-zinc-400 text-sm mb-10">Angaben gemäß §5 TMG</p>

        <div className="space-y-8 text-sm text-zinc-700 leading-relaxed">

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-2">Anbieter</h2>
            <p className="text-zinc-500 italic text-xs mb-3">
              Bitte ergänze hier deinen vollständigen Namen, deine Anschrift und deine Kontaktdaten.
            </p>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-1 text-zinc-600">
              <p>[Vor- und Nachname / Firmenname]</p>
              <p>[Straße und Hausnummer]</p>
              <p>[PLZ Ort]</p>
              <p>Deutschland</p>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">Kontakt</h2>
            <div className="space-y-1 text-zinc-600">
              <p>
                E-Mail:{' '}
                <a href="mailto:support@osss.pro" className="text-amber-600 hover:underline">
                  support@osss.pro
                </a>
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">Umsatzsteuer</h2>
            <p className="text-zinc-600">
              Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).<br />
              <span className="text-zinc-400 text-xs italic">
                Wenn du umsatzsteuerpflichtig bist, ersetze diesen Absatz durch deine USt-ID.
              </span>
            </p>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">Verantwortlich für den Inhalt</h2>
            <p className="text-zinc-600">
              gemäß §55 Abs. 2 RStV:<br />
              [Vor- und Nachname, Anschrift wie oben]
            </p>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">Streitschlichtung</h2>
            <p className="text-zinc-600">
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 hover:underline"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
              .<br /><br />
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">Haftung für Inhalte</h2>
            <p className="text-zinc-500 leading-relaxed">
              Als Diensteanbieter sind wir gemäß §7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den
              allgemeinen Gesetzen verantwortlich. Nach §§8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
              verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
              forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-zinc-100 flex flex-col sm:flex-row gap-3 text-xs text-zinc-400">
          <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">Datenschutzerklärung</Link>
          <span className="hidden sm:inline">·</span>
          <Link href="/" className="hover:text-zinc-700 transition-colors">Startseite</Link>
        </div>
      </div>
    </div>
  )
}
