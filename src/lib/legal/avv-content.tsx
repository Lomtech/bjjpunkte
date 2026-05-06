/**
 * AVV — Auftragsverarbeitungsvertrag zwischen Gym (Verantwortlicher) und Osss
 * (Auftragsverarbeiter) nach Art. 28 DSGVO.
 *
 * VERSIONIERUNG: Bei jeder Änderung am Text MUSS AVV_VERSION hochgezählt werden.
 * Bestehende Acceptances bleiben für ihre Version gültig — User wird zu neuer
 * Version geführt, wenn sich Text ändert.
 *
 * Eine Akzeptanz ist nach eIDAS Art. 25(1) eine Simple Electronic Signature und
 * für AVVs ausreichend (kein Schriftform-Erfordernis nach Art. 28 DSGVO).
 */

export const AVV_VERSION = '1.0-2026-05-06'

export const AVV_PROVIDER = {
  name: 'Lom-Ali Imadaev (Osss)',
  address: 'Kreuzstraße 1, 82276 Adelshofen, Deutschland',
  email: 'oss@osss.pro',
}

/** Sub-Auftragsverarbeiter laut Art. 28(2) DSGVO. Bei Änderung Version bumpen! */
export const AVV_SUBPROCESSORS = [
  { name: 'Supabase Inc.',                        purpose: 'Datenbank, Authentifizierung, Storage', country: 'USA',     safeguard: 'EU-Standardvertragsklauseln' },
  { name: 'Stripe Payments Europe Ltd. / Stripe Inc.', purpose: 'Zahlungsabwicklung',                country: 'IE / USA', safeguard: 'EU-SCCs + DPF + PCI-DSS' },
  { name: 'Vercel Inc.',                          purpose: 'Hosting der Webanwendung',              country: 'USA',     safeguard: 'EU-SCCs + EU-US Data Privacy Framework' },
  { name: 'Resend Inc.',                          purpose: 'Transaktionaler E-Mail-Versand',        country: 'USA',     safeguard: 'EU-Standardvertragsklauseln' },
  { name: 'Functional Software, Inc. (Sentry)',   purpose: 'Anonymes Fehler-Tracking (kein PII)',   country: 'USA',     safeguard: 'EU-Standardvertragsklauseln' },
  { name: 'Upstash, Inc.',                        purpose: 'Rate-Limiting (Redis)',                 country: 'USA',     safeguard: 'EU-Standardvertragsklauseln' },
] as const

export interface AVVRenderProps {
  gymName: string
  gymAddress: string | null
  gymLegalName: string | null
}

/**
 * Reiner Render-Helper. Gibt strukturierte JSX-Sektionen zurück, die im Modal,
 * auf der Settings-Seite und im Print-View identisch dargestellt werden.
 */
export function AVVDocument({ gymName, gymAddress, gymLegalName }: AVVRenderProps) {
  const customerName = gymLegalName || gymName

  return (
    <article className="prose prose-sm max-w-none text-zinc-700 leading-relaxed">
      <header className="not-prose border-b border-zinc-200 pb-4 mb-6">
        <p className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mb-1">
          Vereinbarung zur Auftragsverarbeitung
        </p>
        <h1 className="text-2xl font-black text-zinc-900 mt-0">
          Auftragsverarbeitungsvertrag (AVV)
        </h1>
        <p className="text-xs text-zinc-500 mt-2">
          Nach Art. 28 DSGVO &middot; Version {AVV_VERSION}
        </p>
      </header>

      <section className="not-prose mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">Verantwortlicher</p>
          <p className="font-semibold text-zinc-900">{customerName}</p>
          {gymAddress && <p className="text-zinc-600 text-sm">{gymAddress}</p>}
          <p className="text-zinc-500 text-xs mt-1">— im Folgenden &bdquo;Gym&ldquo; oder &bdquo;Auftraggeber&ldquo;</p>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold mb-1">Auftragsverarbeiter</p>
          <p className="font-semibold text-zinc-900">{AVV_PROVIDER.name}</p>
          <p className="text-zinc-600 text-sm">{AVV_PROVIDER.address}</p>
          <p className="text-zinc-500 text-xs mt-1">— im Folgenden &bdquo;Osss&ldquo; oder &bdquo;Auftragnehmer&ldquo;</p>
        </div>
      </section>

      <Section title="§ 1  Gegenstand und Dauer">
        <p>
          (1) Gegenstand des Auftrags ist die Verarbeitung personenbezogener Daten durch Osss im Auftrag des Gyms im
          Rahmen der Bereitstellung der Software-as-a-Service-Plattform &bdquo;Osss&ldquo; zur Verwaltung von
          Gym-Mitgliedern, Kursen, Zahlungen und Anwesenheiten.
        </p>
        <p>
          (2) Die Verarbeitung erfolgt auf Grundlage des zwischen den Parteien geschlossenen
          Software-Nutzungsvertrages (Hauptvertrag).
        </p>
        <p>
          (3) Diese Vereinbarung gilt für die Dauer des Hauptvertrages und endet mit dessen Beendigung. Sie kann
          jederzeit gemeinsam mit dem Hauptvertrag in Textform gekündigt werden.
        </p>
      </Section>

      <Section title="§ 2  Art und Zweck der Verarbeitung; Datenkategorien; Betroffene">
        <p>
          (1) <strong>Art und Zweck</strong>: Speicherung, Abruf, Veränderung, Löschung und Übertragung
          personenbezogener Daten zum Zwecke der Mitglieder-, Kurs- und Beitragsverwaltung.
        </p>
        <p>
          (2) <strong>Datenkategorien</strong>: Stammdaten (Name, Anschrift, E-Mail, Telefon, Geburtsdatum),
          Vertragsdaten (Mitgliedschaftsstatus, Beitritt, Kündigung), Anwesenheits- und Trainingsdaten,
          Graduierungs-/Belt-Daten, Zahlungsbezugsdaten (Beträge, Status; <em>keine</em> Karten- oder Kontodaten —
          diese werden ausschließlich von Stripe verarbeitet).
        </p>
        <p>
          (3) <strong>Betroffene Personen</strong>: Mitglieder, Trainer und sonstige Mitarbeiter des Gyms, sowie
          Interessenten (Leads) sofern vom Gym im System erfasst.
        </p>
      </Section>

      <Section title="§ 3  Pflichten des Auftragnehmers">
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            Osss verarbeitet die personenbezogenen Daten ausschließlich auf dokumentierte Weisung des Gyms. Eine
            Datenverarbeitung zu eigenen Zwecken (z.B. Werbung) findet nicht statt.
          </li>
          <li>
            Osss verpflichtet die zur Verarbeitung befugten Personen schriftlich zur Vertraulichkeit, soweit sie nicht
            bereits einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen.
          </li>
          <li>
            Osss trifft die in <strong>§ 6</strong> beschriebenen technischen und organisatorischen Maßnahmen (Art. 32
            DSGVO).
          </li>
          <li>
            Osss unterstützt das Gym bei der Erfüllung von Betroffenenrechten (Art. 12-22 DSGVO) durch geeignete
            technische und organisatorische Maßnahmen, soweit möglich.
          </li>
          <li>
            Osss meldet dem Gym Verletzungen des Schutzes personenbezogener Daten unverzüglich, spätestens innerhalb
            von 48 Stunden nach Bekanntwerden.
          </li>
          <li>
            Auf Verlangen des Gyms unterstützt Osss bei Datenschutz-Folgenabschätzungen (Art. 35 DSGVO) und vorherigen
            Konsultationen mit der Aufsichtsbehörde (Art. 36 DSGVO).
          </li>
          <li>
            Nach Beendigung des Hauptvertrages werden alle personenbezogenen Daten gelöscht oder — auf schriftliches
            Verlangen des Gyms — zurückgegeben, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen
            (§ 257 HGB, § 147 AO).
          </li>
        </ol>
      </Section>

      <Section title="§ 4  Pflichten des Auftraggebers">
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            Das Gym ist im Rahmen dieses Vertrages für die Einhaltung der DSGVO und sonstiger Datenschutzvorschriften
            allein verantwortlich (&bdquo;Verantwortlicher&ldquo; im Sinne von Art. 4 Nr. 7 DSGVO).
          </li>
          <li>
            Das Gym informiert seine Mitglieder ordnungsgemäß über die Datenverarbeitung (Art. 13/14 DSGVO) und holt
            erforderliche Einwilligungen selbst ein.
          </li>
          <li>
            Das Gym erteilt Weisungen grundsätzlich in Textform; mündliche Weisungen sind unverzüglich in Textform zu
            bestätigen.
          </li>
        </ol>
      </Section>

      <Section title="§ 5  Sub-Auftragsverarbeiter">
        <p>
          (1) Osss setzt zur Erbringung der Leistung folgende Sub-Auftragsverarbeiter ein, deren Einsatz das Gym mit
          Abschluss dieses AVV genehmigt:
        </p>
        <div className="not-prose mt-3 mb-3 overflow-x-auto">
          <table className="w-full text-xs border border-zinc-200 rounded-lg">
            <thead className="bg-zinc-50">
              <tr className="text-left text-zinc-600">
                <th className="px-3 py-2 font-semibold">Anbieter</th>
                <th className="px-3 py-2 font-semibold">Zweck</th>
                <th className="px-3 py-2 font-semibold">Land</th>
                <th className="px-3 py-2 font-semibold">Schutzmaßnahme</th>
              </tr>
            </thead>
            <tbody>
              {AVV_SUBPROCESSORS.map(p => (
                <tr key={p.name} className="border-t border-zinc-200">
                  <td className="px-3 py-2 text-zinc-900 font-medium">{p.name}</td>
                  <td className="px-3 py-2 text-zinc-600">{p.purpose}</td>
                  <td className="px-3 py-2 text-zinc-600">{p.country}</td>
                  <td className="px-3 py-2 text-zinc-600">{p.safeguard}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          (2) Osss informiert das Gym über beabsichtigte Änderungen in Bezug auf die Hinzuziehung oder Ersetzung
          weiterer Auftragsverarbeiter mit einer Frist von 30 Tagen. Das Gym kann der Änderung innerhalb von 14 Tagen
          widersprechen; in diesem Fall ist Osss zur außerordentlichen Kündigung des Hauptvertrages berechtigt.
        </p>
        <p>
          (3) Osss schließt mit jedem Sub-Auftragsverarbeiter einen Vertrag, der dem vorliegenden AVV entspricht
          (Art. 28(4) DSGVO).
        </p>
      </Section>

      <Section title="§ 6  Technische und organisatorische Maßnahmen (Art. 32 DSGVO)">
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            <strong>Vertraulichkeit:</strong> Cloud-Hosting bei zertifizierten Anbietern (ISO 27001/SOC 2),
            Authentifizierung mit gehashten Passwörtern (bcrypt) und JWT-Token, Row-Level-Security in der Datenbank,
            getrennte Datenhaltung pro Gym (Multi-Tenant via gym_id), Rate-Limiting gegen Brute-Force.
          </li>
          <li>
            <strong>Integrität:</strong> Audit-Logs für sensible Operationen, TLS 1.3 für alle Übertragungen, HSTS,
            Sub-Resource-Integrity wo anwendbar.
          </li>
          <li>
            <strong>Verfügbarkeit:</strong> Tägliche Backups mit Point-in-Time-Recovery (mind. 7 Tage), Multi-Region
            Edge-Hosting, dokumentierter Wiederherstellungs-Prozess.
          </li>
          <li>
            <strong>Belastbarkeit:</strong> Auto-Scaling, Monitoring &amp; anonymes Error-Tracking ohne PII.
          </li>
          <li>
            <strong>Verfahren zur regelmäßigen Überprüfung:</strong> jährliches TOM-Review, halbjährlicher
            Backup-Restore-Test, quartalsweiser Review der Sub-Auftragsverarbeiter-Zertifikate.
          </li>
        </ol>
      </Section>

      <Section title="§ 7  Kontrollrechte">
        <p>
          (1) Das Gym hat das Recht, sich vor Beginn der Verarbeitung und während der Vertragslaufzeit über die
          getroffenen technischen und organisatorischen Maßnahmen von Osss zu vergewissern.
        </p>
        <p>
          (2) Osss erbringt diesen Nachweis vorrangig durch aktuelle Zertifikate, Audit-Berichte oder
          Selbstauskünfte (z.B. SOC 2-Berichte der Sub-Auftragsverarbeiter, abrufbar via E-Mail-Anfrage an{' '}
          <a href={`mailto:${AVV_PROVIDER.email}`} className="text-amber-600">{AVV_PROVIDER.email}</a>).
        </p>
        <p>
          (3) Vor-Ort-Kontrollen sind nach vorheriger Anmeldung mit angemessener Frist möglich; entstehende Kosten
          trägt das Gym.
        </p>
      </Section>

      <Section title="§ 8  Haftung">
        <p>
          (1) Die Haftung der Parteien richtet sich nach Art. 82 DSGVO. Im Innenverhältnis haftet jede Partei für
          Schäden, die sie zu vertreten hat.
        </p>
        <p>
          (2) Im Übrigen gelten die Haftungsregelungen des Hauptvertrages.
        </p>
      </Section>

      <Section title="§ 9  Schlussbestimmungen">
        <p>
          (1) Sollten einzelne Bestimmungen dieses Vertrages unwirksam sein oder werden, so berührt dies die
          Wirksamkeit der übrigen Bestimmungen nicht.
        </p>
        <p>
          (2) Es gilt deutsches Recht. Gerichtsstand ist — soweit gesetzlich zulässig — der Sitz des Auftragnehmers.
        </p>
        <p>
          (3) Änderungen und Ergänzungen bedürfen der Textform. Dies gilt auch für die Aufhebung dieser
          Schriftformklausel.
        </p>
        <p>
          (4) <strong>Elektronische Form:</strong> Beide Parteien sind sich einig, dass die elektronische Annahme
          dieses Vertrages durch Klick auf &bdquo;Ich akzeptiere&ldquo; in der Osss-Plattform eine
          rechtsverbindliche Unterschrift im Sinne von Art. 25(1) eIDAS-VO darstellt. Der Audit-Trail (Name,
          Zeitstempel, IP-Adresse, User-Agent) dient als Beweismittel.
        </p>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="not-prose font-bold text-zinc-900 text-base mb-2">{title}</h2>
      <div className="text-sm text-zinc-700 leading-relaxed space-y-2">{children}</div>
    </section>
  )
}
