'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface GymLegal {
  name: string
  legal_name: string | null
  legal_address: string | null
  legal_email: string | null
}

export default function DatenschutzPage() {
  const [gym, setGym] = useState<GymLegal | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('gyms').select('name, legal_name, legal_address, legal_email').single()
      .then(({ data }) => { if (data) setGym(data as unknown as GymLegal) })
  }, [])

  const responsible = gym?.legal_name || gym?.name || '[Gym-Name]'
  const address     = gym?.legal_address || '[Adresse]'
  const email       = gym?.legal_email   || '[E-Mail]'

  return (
    <main className="max-w-2xl mx-auto px-5 py-12 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Datenschutzerklärung</h1>
      <p className="text-sm text-slate-400 mb-8">Stand: Mai 2025</p>

      <section className="space-y-8 text-sm leading-relaxed">

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">1. Verantwortlicher</h2>
          <p>Verantwortlich für die Datenverarbeitung ist:</p>
          <div className="mt-3 bg-gray-50 rounded-lg px-4 py-3 text-slate-600 border border-gray-200">
            <p className="font-medium text-slate-800">{responsible}</p>
            {address !== '[Adresse]' && <p>{address}</p>}
            {email !== '[E-Mail]' && <p>{email}</p>}
          </div>
          <p className="mt-3">Die technische Plattform (Osss) wird bereitgestellt durch:</p>
          <div className="mt-2 bg-gray-50 rounded-lg px-4 py-3 text-slate-600 border border-gray-200 text-xs">
            <p className="font-medium text-slate-700">Lom-Ali Imadaev · Kreuzstraße 1, 82276 Adelshofen</p>
            <p>lomaliimadaev@gmail.com</p>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">2. Welche Daten werden verarbeitet?</h2>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Name, E-Mail-Adresse, Telefonnummer und Adresse der Mitglieder</li>
            <li>Geburtsdatum, Notfallkontakt</li>
            <li>Mitgliedschaftsstatus, Beltgrad und Anwesenheitsdaten</li>
            <li>Digitale Unterschrift und Vertragsbestätigung</li>
            <li>Zahlungsinformationen (verarbeitet über Stripe – keine Kartendaten werden gespeichert)</li>
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
            <li><strong>Art. 6 Abs. 1 lit. a DSGVO</strong> – Einwilligung (digitale Unterschrift beim Anmeldeprozess)</li>
            <li><strong>Art. 6 Abs. 1 lit. f DSGVO</strong> – berechtigte Interessen (Anwesenheitsdokumentation)</li>
          </ul>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">5. Auftragsverarbeiter / Drittanbieter</h2>
          <div className="space-y-3 text-slate-600">
            {[
              { name: 'Supabase Inc.', desc: 'Datenbankhosting (USA, EU-Standardvertragsklauseln). supabase.com/privacy' },
              { name: 'Stripe Inc.',   desc: 'Zahlungsabwicklung (USA, EU-Standardvertragsklauseln, PCI-DSS-zertifiziert). stripe.com/de/privacy' },
              { name: 'Vercel Inc.',   desc: 'Hosting der Webanwendung (USA, EU-Standardvertragsklauseln). vercel.com/legal/privacy-policy' },
            ].map(p => (
              <div key={p.name} className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                <p className="font-medium text-slate-800">{p.name}</p>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 mb-2">6. Speicherdauer</h2>
          <p className="text-slate-600">
            Personenbezogene Daten werden gelöscht, sobald sie für den Zweck der Verarbeitung nicht mehr benötigt
            werden oder der Betroffene die Löschung verlangt, sofern keine gesetzlichen Aufbewahrungspflichten
            entgegenstehen (z.B. 10 Jahre für Buchhaltungsunterlagen nach HGB § 257).
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
            Anfragen richte bitte an:{' '}
            <a href={`mailto:${email}`} className="text-amber-600 hover:underline">{email}</a>
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
            Diese Datenschutzerklärung gilt für die Nutzung der Osss-Plattform durch {responsible}.
          </p>
        </div>

      </section>
    </main>
  )
}
