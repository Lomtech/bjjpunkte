import Link from 'next/link'
import { OsssLogo } from '@/components/Logo'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Datenschutzerklärung der Osss Gym-Software',
}

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="border-b border-zinc-100 bg-white">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <OsssLogo variant="dark" />
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium">
            Zur Startseite
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-16">
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">Datenschutzerklärung</h1>
        <p className="text-zinc-400 text-sm mb-10">Stand: Mai 2026</p>

        <div className="space-y-8 text-sm text-zinc-700 leading-relaxed">

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">1. Verantwortlicher</h2>
            <p className="text-zinc-600 mb-3">Verantwortlich für die Datenverarbeitung auf dieser Plattform ist:</p>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-1 text-zinc-600">
              <p className="font-semibold text-zinc-900">Lom-Ali Imadaev</p>
              <p>Kreuzstraße 1</p>
              <p>82276 Adelshofen</p>
              <p>
                <a href="mailto:oss@osss.pro" className="text-amber-600 hover:underline">
                  oss@osss.pro
                </a>
              </p>
            </div>
            <p className="text-zinc-600 mt-4 mb-2">
              Die technische Plattform (Osss) wird ebenfalls durch oben genannte Person bereitgestellt.
              Gym-Betreiber, die Osss zur Mitgliederverwaltung nutzen, sind jeweils eigenständige
              Verantwortliche für die Daten ihrer Mitglieder.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">2. Welche Daten werden verarbeitet?</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li>Name, E-Mail-Adresse, Telefonnummer und Adresse der Mitglieder</li>
              <li>Geburtsdatum und weitere freiwillige Angaben</li>
              <li>Mitgliedschaftsstatus, Gürtelgrad und Anwesenheitsdaten</li>
              <li>Digitale Einwilligung und Vertragsbestätigung (IP-Adresse, Zeitstempel, Vertragstext)</li>
              <li>Zahlungsinformationen (verarbeitet über Stripe — keine Kartendaten werden bei uns gespeichert)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">3. Zweck der Verarbeitung</h2>
            <p className="text-zinc-600">
              Die Daten werden ausschließlich zur Verwaltung der Mitgliedschaften,
              zur Abwicklung von Beitragszahlungen und zur Dokumentation von Anwesenheiten und Graduierungen
              im Rahmen der Gym-Verwaltung verarbeitet.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">4. Rechtsgrundlagen (DSGVO)</h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li><strong className="text-zinc-800">Art. 6 Abs. 1 lit. b DSGVO</strong> — Vertragserfüllung (Mitgliedschaft, Zahlungsabwicklung)</li>
              <li><strong className="text-zinc-800">Art. 6 Abs. 1 lit. a DSGVO</strong> — Einwilligung (digitale Zustimmung beim Anmeldeprozess)</li>
              <li><strong className="text-zinc-800">Art. 6 Abs. 1 lit. f DSGVO</strong> — berechtigte Interessen (Anwesenheitsdokumentation)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">5. Auftragsverarbeiter / Drittanbieter</h2>
            <div className="space-y-3 text-zinc-600">
              {[
                { name: 'Supabase Inc.', desc: 'Datenbankhosting (USA, EU-Standardvertragsklauseln). supabase.com/privacy' },
                { name: 'Stripe Inc.',   desc: 'Zahlungsabwicklung (USA, EU-Standardvertragsklauseln, PCI-DSS-zertifiziert). stripe.com/de/privacy' },
                { name: 'Vercel Inc.',   desc: 'Hosting der Webanwendung (USA, EU-Standardvertragsklauseln). vercel.com/legal/privacy-policy' },
                { name: 'Resend Inc.',   desc: 'E-Mail-Versand (USA, EU-Standardvertragsklauseln). resend.com/privacy' },
              ].map(p => (
                <div key={p.name} className="bg-zinc-50 border border-zinc-200 rounded-xl px-5 py-3.5">
                  <p className="font-semibold text-zinc-900 mb-0.5">{p.name}</p>
                  <p className="text-zinc-500">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">6. Speicherdauer</h2>
            <p className="text-zinc-600">
              Personenbezogene Daten werden gelöscht, sobald sie für den Zweck der Verarbeitung nicht mehr benötigt
              werden oder der Betroffene die Löschung verlangt, sofern keine gesetzlichen Aufbewahrungspflichten
              entgegenstehen (z.B. 10 Jahre für Buchhaltungsunterlagen nach §257 HGB).
            </p>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">7. Betroffenenrechte</h2>
            <p className="text-zinc-600 mb-2">Gemäß DSGVO stehen dir folgende Rechte zu:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li>Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17)</li>
              <li>Einschränkung der Verarbeitung (Art. 18)</li>
              <li>Datenübertragbarkeit (Art. 20)</li>
              <li>Widerspruch (Art. 21)</li>
              <li>Beschwerde bei der zuständigen Datenschutzbehörde</li>
            </ul>
            <p className="mt-3 text-zinc-600">
              Anfragen richte bitte an:{' '}
              <a href="mailto:oss@osss.pro" className="text-amber-600 hover:underline">
                oss@osss.pro
              </a>
            </p>
          </section>

          <section>
            <h2 className="font-bold text-zinc-900 text-base mb-3">8. Cookies und Tracking</h2>
            <p className="text-zinc-600">
              Diese Anwendung verwendet ausschließlich technisch notwendige Session-Cookies zur Authentifizierung.
              Es werden keine Tracking- oder Marketing-Cookies eingesetzt.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-zinc-100 flex flex-col sm:flex-row gap-3 text-xs text-zinc-400">
          <Link href="/impressum" className="hover:text-zinc-700 transition-colors">Impressum</Link>
          <span className="hidden sm:inline">·</span>
          <Link href="/" className="hover:text-zinc-700 transition-colors">Startseite</Link>
        </div>
      </div>
    </div>
  )
}
