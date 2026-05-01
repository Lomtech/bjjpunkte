export const metadata = { title: 'Datenschutzerklärung – Osss' }

export default function DatenschutzPage() {
  return (
    <main className="max-w-2xl mx-auto px-5 py-12 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Datenschutzerklärung</h1>
      <p className="text-sm text-slate-400 mb-8">Stand: Mai 2025</p>

      <section className="space-y-8 text-sm leading-relaxed">

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">1. Verantwortlicher</h2>
          <p>
            Verantwortlich für die Datenverarbeitung auf dieser Plattform ist der jeweilige Gym-Betreiber
            (nachfolgend „Verantwortlicher"), dessen Name und Kontaktdaten in den Gym-Einstellungen hinterlegt sind.
            Die technische Plattform wird bereitgestellt durch:
          </p>
          <div className="mt-3 bg-gray-50 rounded-lg px-4 py-3 text-slate-600 border border-gray-200">
            <p className="font-medium text-slate-800">Lom-Ali Imadaev</p>
            <p>Kreuzstraße 1, 82276 Adelshofen</p>
            <p>lomaliimadaev@gmail.com</p>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">2. Welche Daten werden verarbeitet?</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Name, E-Mail-Adresse der Mitglieder</li>
            <li>Mitgliedschaftsstatus, Beltgrad und Anwesenheitsdaten</li>
            <li>Zahlungsinformationen (verarbeitet über Stripe – keine Kartendaten werden gespeichert)</li>
            <li>Login-Daten des Gym-Betreibers (E-Mail, verschlüsseltes Passwort)</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">3. Zweck der Verarbeitung</h2>
          <p className="text-slate-600">
            Die Daten werden ausschließlich zur Verwaltung der Mitgliedschaften,
            zur Abwicklung von Beitragszahlungen und zur Dokumentation von Anwesenheiten und Graduierungen
            im Rahmen der Vereins- oder Gymverwaltung verarbeitet.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">4. Rechtsgrundlagen (DSGVO)</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong>Art. 6 Abs. 1 lit. b DSGVO</strong> – Vertragserfüllung (Mitgliedschaft, Zahlungsabwicklung)</li>
            <li><strong>Art. 6 Abs. 1 lit. f DSGVO</strong> – berechtigte Interessen (Anwesenheitsdokumentation)</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">5. Auftragsverarbeiter / Drittanbieter</h2>
          <div className="space-y-3 text-slate-600">
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
              <p className="font-medium text-slate-800">Supabase Inc.</p>
              <p>Datenbankhosting (USA, EU-Standardvertragsklauseln). Datenschutzinfos: supabase.com/privacy</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
              <p className="font-medium text-slate-800">Stripe Inc.</p>
              <p>Zahlungsabwicklung (USA, EU-Standardvertragsklauseln, PCI-DSS-zertifiziert). Datenschutzinfos: stripe.com/de/privacy</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
              <p className="font-medium text-slate-800">Vercel Inc.</p>
              <p>Hosting der Webanwendung (USA, EU-Standardvertragsklauseln). Datenschutzinfos: vercel.com/legal/privacy-policy</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">6. Speicherdauer</h2>
          <p className="text-slate-600">
            Personenbezogene Daten werden gelöscht, sobald sie für den Zweck der Verarbeitung nicht mehr benötigt
            werden oder der Betroffene die Löschung verlangt, sofern keine gesetzlichen Aufbewahrungspflichten
            entgegenstehen (z. B. 10 Jahre für Buchhaltungsunterlagen nach HGB § 257).
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">7. Betroffenenrechte</h2>
          <p className="text-slate-600 mb-2">Gemäß DSGVO stehen dir folgende Rechte zu:</p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17)</li>
            <li>Einschränkung der Verarbeitung (Art. 18)</li>
            <li>Datenübertragbarkeit (Art. 20)</li>
            <li>Widerspruch (Art. 21)</li>
            <li>Beschwerde bei der zuständigen Datenschutzbehörde</li>
          </ul>
          <p className="mt-2 text-slate-600">
            Anfragen richte bitte an: <a href="mailto:lomaliimadaev@gmail.com" className="text-amber-600 hover:underline">lomaliimadaev@gmail.com</a>
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">8. Cookies und Tracking</h2>
          <p className="text-slate-600">
            Diese Anwendung verwendet ausschließlich technisch notwendige Session-Cookies zur Authentifizierung.
            Es werden keine Tracking- oder Marketing-Cookies eingesetzt.
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-slate-400">
            Diese Datenschutzerklärung gilt für die Nutzung der Osss Plattform.
            Bei Fragen wende dich an den oben genannten Verantwortlichen.
          </p>
        </div>

      </section>
    </main>
  )
}
