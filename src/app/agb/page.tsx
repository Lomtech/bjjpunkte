import Link from 'next/link'
import { OsssLogo } from '@/components/Logo'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AGB – Osss',
  description: 'Allgemeine Geschäftsbedingungen der Osss Gym-Management-Software',
}

export default function AgbPage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      <nav className="border-b border-zinc-100 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <OsssLogo variant="light" />
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors font-medium">
            Zur Startseite
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-5 py-16">
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">Allgemeine Geschäftsbedingungen</h1>
        <p className="text-zinc-400 text-sm mb-10">Stand: Mai 2026</p>

        <div className="space-y-10 text-sm text-zinc-700 leading-relaxed">

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 1 Geltungsbereich</h2>
            <p>
              Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen der Lomtechs
              (nachfolgend „Osss" oder „Anbieter") und ihren Kunden (nachfolgend „Nutzer") über die Nutzung
              der Software-as-a-Service-Plattform „Osss" zur Gym-Verwaltung, zugänglich unter{' '}
              <span className="font-medium text-zinc-900">bjjpunkte.vercel.app</span> sowie zugehörigen Domains.
            </p>
            <p className="mt-3">
              Abweichende, entgegenstehende oder ergänzende AGB des Nutzers werden nicht Vertragsbestandteil,
              es sei denn, der Anbieter stimmt ihrer Geltung ausdrücklich schriftlich zu.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 2 Vertragsgegenstand</h2>
            <p>
              Osss stellt dem Nutzer eine webbasierte Software zur Verwaltung von Fitness- und
              Kampfsport-Studios zur Verfügung. Der Leistungsumfang umfasst je nach gewähltem Tarif:
              Mitgliederverwaltung, Anwesenheitstracking, Stundenplanung, Zahlungsabwicklung via Stripe,
              Rechnungsgenerierung, Lead-Management sowie ein Mitgliederportal.
            </p>
            <p className="mt-3">
              Der Anbieter stellt die Software als SaaS-Dienst bereit. Ein Anspruch auf Überlassung von
              Quellcode oder Installationsdateien besteht nicht.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 3 Vertragsschluss und Registrierung</h2>
            <p>
              Der Vertrag kommt zustande durch die Registrierung des Nutzers auf der Plattform und die
              Bestätigung dieser AGB. Der Nutzer muss geschäftsfähig und mindestens 18 Jahre alt sein.
              Die Registrierung ist nur für Unternehmer im Sinne des § 14 BGB zulässig.
            </p>
            <p className="mt-3">
              Der Nutzer ist verpflichtet, bei der Registrierung wahrheitsgemäße Angaben zu machen und
              diese aktuell zu halten. Pro Unternehmen ist ein Konto zulässig.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 4 Leistungsumfang und Tarifmodelle</h2>
            <p>
              Osss bietet verschiedene Tarife an (Free, Starter, Grow, Pro). Der jeweils aktuelle
              Leistungsumfang und die Preise sind auf der Preisseite unter{' '}
              <Link href="/pricing" className="text-amber-600 hover:underline">/pricing</Link> einsehbar.
            </p>
            <p className="mt-3">
              Der Anbieter behält sich vor, den Leistungsumfang der Tarife mit angemessener Vorankündigung
              (mindestens 30 Tage) anzupassen. Wesentliche Leistungsreduzierungen berechtigen den Nutzer
              zur außerordentlichen Kündigung.
            </p>
            <p className="mt-3">
              Bei Zahlungsabwicklung über Stripe Connect erhebt Osss eine Plattformgebühr gemäß dem
              jeweils gültigen Tarif. Diese wird automatisch bei jeder Transaktion einbehalten.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 5 Vergütung und Zahlung</h2>
            <p>
              Die Vergütung für kostenpflichtige Tarife wird monatlich oder jährlich im Voraus fällig und
              per Stripe-Abonnement eingezogen. Alle Preise verstehen sich zzgl. der gesetzlichen
              Mehrwertsteuer, sofern der Anbieter nicht Kleinunternehmer im Sinne des § 19 UStG ist.
            </p>
            <p className="mt-3">
              Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang zur Plattform zu sperren bis
              der ausstehende Betrag beglichen ist. Weitergehende Schadensersatzansprüche bleiben vorbehalten.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 6 Laufzeit und Kündigung</h2>
            <p>
              Der Free-Tarif ist kostenlos und läuft auf unbestimmte Zeit. Kostenpflichtige Abonnements
              laufen monatlich und können jederzeit zum Ende des laufenden Abrechnungszeitraums gekündigt
              werden. Nach Kündigung wird das Konto automatisch auf den Free-Tarif zurückgestuft.
            </p>
            <p className="mt-3">
              Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger
              Grund liegt insbesondere vor bei wesentlichen Verstößen gegen diese AGB.
            </p>
            <p className="mt-3">
              Nach Vertragsende hat der Nutzer 30 Tage Zeit, seine Daten zu exportieren. Danach können
              die Daten unwiderruflich gelöscht werden.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 7 Pflichten des Nutzers</h2>
            <p>Der Nutzer verpflichtet sich:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>die Plattform nur für legale Zwecke zu nutzen</li>
              <li>Zugangsdaten vertraulich zu behandeln und nicht an Dritte weiterzugeben</li>
              <li>keine automatisierten Zugriffe (Scraping, Bots) ohne ausdrückliche Genehmigung durchzuführen</li>
              <li>Mitgliederdaten der eigenen Mitglieder gemäß DSGVO zu verarbeiten und als eigenverantwortlicher Verantwortlicher zu handeln</li>
              <li>den Anbieter unverzüglich über Sicherheitsvorfälle oder Missbrauch zu informieren</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 8 Datenschutz und Datenverarbeitung</h2>
            <p>
              Der Nutzer ist hinsichtlich der von ihm in die Plattform eingegebenen Mitgliederdaten
              datenschutzrechtlich Verantwortlicher im Sinne der DSGVO. Osss agiert als Auftragsverarbeiter.
              Ein Auftragsverarbeitungsvertrag (AVV) wird auf Anfrage zur Verfügung gestellt und ist
              Bestandteil des Vertragsverhältnisses.
            </p>
            <p className="mt-3">
              Einzelheiten zur Datenverarbeitung durch Osss sind der{' '}
              <Link href="/datenschutz" className="text-amber-600 hover:underline">Datenschutzerklärung</Link>{' '}
              zu entnehmen. Daten werden ausschließlich auf europäischen Servern (Supabase EU West) gespeichert.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 9 Verfügbarkeit und Support</h2>
            <p>
              Der Anbieter strebt eine Verfügbarkeit von 99 % im Monatsmittel an, übernimmt jedoch keine
              Garantie. Geplante Wartungsarbeiten werden nach Möglichkeit vorab angekündigt.
            </p>
            <p className="mt-3">
              Support wird per E-Mail unter{' '}
              <a href="mailto:oss@osss.pro" className="text-amber-600 hover:underline">oss@osss.pro</a>{' '}
              angeboten. Reaktionszeiten variieren je nach Tarif und Anfragevolumen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 10 Haftungsbeschränkung</h2>
            <p>
              Der Anbieter haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers
              oder der Gesundheit sowie für vorsätzliche und grob fahrlässige Pflichtverletzungen.
            </p>
            <p className="mt-3">
              Im Übrigen ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt.
              Die Haftung für mittelbare Schäden, entgangenen Gewinn und Datenverlust ist — soweit
              gesetzlich zulässig — ausgeschlossen.
            </p>
            <p className="mt-3">
              Der Anbieter haftet nicht für Schäden, die durch die fehlerhafte Nutzung der Stripe-Zahlungsinfrastruktur,
              durch Drittanbieter-Ausfälle (Supabase, Vercel, Stripe) oder durch höhere Gewalt entstehen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 11 Änderungen der AGB</h2>
            <p>
              Der Anbieter behält sich vor, diese AGB mit einer Ankündigungsfrist von mindestens 30 Tagen
              per E-Mail zu ändern. Widerspricht der Nutzer nicht innerhalb dieser Frist, gelten die neuen
              AGB als angenommen. Auf das Widerspruchsrecht und die Folgen des Schweigens wird in der
              Änderungsmitteilung gesondert hingewiesen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-zinc-900 mb-3">§ 12 Schlussbestimmungen</h2>
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
              Gerichtsstand für alle Streitigkeiten aus diesem Vertrag ist — soweit gesetzlich zulässig —
              der Sitz des Anbieters.
            </p>
            <p className="mt-3">
              Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit
              der übrigen Bestimmungen unberührt.
            </p>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-zinc-100 flex flex-wrap gap-4 text-xs text-zinc-400">
          <Link href="/impressum" className="hover:text-zinc-600 transition-colors">Impressum</Link>
          <Link href="/datenschutz" className="hover:text-zinc-600 transition-colors">Datenschutz</Link>
          <Link href="/" className="hover:text-zinc-600 transition-colors">Startseite</Link>
        </div>
      </div>
    </div>
  )
}
