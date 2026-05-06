import Link from 'next/link'
import type { BlogArticle } from '../types'

/**
 * SEO-Strategie:
 * - Primary keyword: "DSGVO Kampfsport"
 * - Secondary: "Mitgliederdaten DSGVO", "AVV Sportverein", "Datenschutz Gym"
 * - Search volume: niedrig (~50/mo), aber 0 Konkurrenz mit echtem DACH-Content
 * - Conversion-Hook: "Wir haben das in unsere Software eingebaut → Link Pricing"
 */
export const dsgvoKampfsportChecklisteArticle: BlogArticle = {
  slug: 'dsgvo-kampfsport-checkliste',
  title: 'DSGVO im Kampfsport-Verein: Die ehrliche Checkliste 2026',
  description:
    'Was muss ein BJJ-, Karate- oder Judo-Verein wirklich für die DSGVO erledigen? Pflicht-Dokumente, Auftragsverarbeitung, Mitglieder-Rechte — ohne Anwaltsgebühren-Geschwurbel.',
  primaryKeyword: 'DSGVO Kampfsport',
  publishedAt: '2026-05-06',
  updatedAt: '2026-05-06',
  readingTime: 8,
  category: 'DSGVO',
  content: () => (
    <>
      <p className="lead">
        Die DSGVO ist seit 2018 in Kraft. Trotzdem führen 90&nbsp;% der deutschen Kampfsport-Vereine
        ihre Mitgliederlisten in einer Excel-Tabelle, ohne Verarbeitungsverzeichnis, ohne AVV mit dem
        Cloud-Anbieter, ohne dokumentierten Lösch-Prozess. Die meisten kommen damit durch — bis ein
        gekündigtes Mitglied sich beschwert oder ein Wettbewerber abmahnt.
      </p>

      <p>
        Dieser Artikel ist <strong>keine Rechtsberatung</strong>. Aber eine ehrliche
        Praxis-Checkliste, was du als Vereinsvorstand oder Gym-Inhaber wirklich erledigen solltest —
        in der richtigen Reihenfolge, mit konkreten Vorlagen.
      </p>

      <h2>1. Was die DSGVO von dir verlangt — kurz</h2>

      <p>
        Du verarbeitest <strong>personenbezogene Daten</strong>: Name, E-Mail, Telefonnummer,
        Geburtsdatum, Mitgliedschaftsdaten, Anwesenheiten, Gürtelgrade. Das macht dich zum
        <em>Verantwortlichen</em> nach Art. 4 Nr. 7 DSGVO. Damit bist du verpflichtet:
      </p>

      <ul>
        <li>Mitglieder zu <strong>informieren</strong>, was du mit ihren Daten machst (Art. 13)</li>
        <li>Einwilligungen rechtssicher <strong>einzuholen und zu dokumentieren</strong> (Art. 7)</li>
        <li>Ein <strong>Verarbeitungsverzeichnis</strong> zu führen (Art. 30)</li>
        <li>Mit deinen Software-Anbietern <strong>AVVs zu schließen</strong> (Art. 28)</li>
        <li>Auf Anfragen zu <strong>Auskunft, Berichtigung, Löschung</strong> binnen 30 Tagen zu reagieren (Art. 15-21)</li>
        <li>Datenpannen binnen <strong>72 Stunden</strong> zu melden (Art. 33)</li>
      </ul>

      <p>
        Nicht-Einhaltung kann theoretisch bis zu 20 Mio.&nbsp;€ Bußgeld kosten. Realistisch bei
        einem Vereinsverstoß: Abmahnung 600-3.000&nbsp;€, in Wiederholungsfällen 5.000-20.000&nbsp;€.
      </p>

      <h2>2. Die ehrliche Pflicht-Checkliste</h2>

      <h3>✅ Datenschutzerklärung auf der Vereins-Website</h3>
      <p>
        Pflicht. Muss enthalten: Verantwortlicher, Datenkategorien, Zwecke, Rechtsgrundlagen,
        Auftragsverarbeiter, Speicherdauer, Betroffenenrechte. Eine generische Vorlage von einem
        Generator reicht — solange du sie an deinen Verein anpasst.
      </p>

      <h3>✅ Einwilligung beim Mitglieder-Beitritt</h3>
      <p>
        Muss <strong>aktiv</strong> erfolgen (kein vorausgefülltes Häkchen!). Bei Online-Anmeldung:
        Checkbox + Hinweis auf Datenschutzerklärung. Du musst <strong>IP, Zeitstempel und den
        Einwilligungstext</strong> protokollieren — nicht nur "Ja, akzeptiert".
      </p>

      <h3>✅ Auftragsverarbeitungsverträge (AVV) mit allen Software-Anbietern</h3>
      <p>
        Wenn du Mitgliederdaten in einer Software speicherst (egal ob Excel-Cloud, Buchhaltungs-Tool,
        Mail-Client), musst du mit dem Anbieter einen AVV haben. Bei großen Anbietern wie Microsoft,
        Google, oder spezialisierter Gym-Software wie Osss ist das ein Standard-Dokument, das du
        unterschreiben musst.
      </p>

      <p className="info-box">
        <strong>Praxis-Tipp:</strong> Bei <Link href="/">Osss</Link> ist der AVV
        elektronisch im Dashboard signierbar — eIDAS-konform, Audit-Trail wird automatisch
        gespeichert. Spart das übliche E-Mail-Hin-und-Her.
      </p>

      <h3>✅ Verarbeitungsverzeichnis (Art. 30)</h3>
      <p>
        Internes Dokument — muss nicht öffentlich sein, aber <strong>auf Verlangen der
        Aufsichtsbehörde vorgelegt werden</strong>. In Bayern: BayLDA. Inhalt: Welche Verarbeitungen
        finden statt? Welche Daten? Welche Empfänger? Speicherdauer? Schutzmaßnahmen?
      </p>
      <p>
        Eine simple Tabelle reicht. Vorlagen findest du beim Bundesdatenschutzbeauftragten oder
        bei den Landes-Datenschutzbehörden kostenlos.
      </p>

      <h3>✅ Lösch-Prozess für Ex-Mitglieder</h3>
      <p>
        Nach Vertragsende dürfen Mitgliederdaten nur noch so lange gespeichert werden, wie
        gesetzliche Aufbewahrungspflichten es verlangen — typischerweise 10 Jahre für
        rechnungsrelevante Daten (§ 257 HGB / § 147 AO), alle anderen Daten <strong>früher
        löschen</strong>.
      </p>

      <h3>✅ Datenpannen-Plan</h3>
      <p>
        Du brauchst eine kurze Anweisung: Wer macht was, wenn ein Laptop mit Mitgliederdaten
        gestohlen wird oder ein Hack-Vorfall passiert? 72-Stunden-Frist für die Meldung an die
        Aufsichtsbehörde ist eng.
      </p>

      <h2>3. Was du <em>nicht</em> brauchst (entgegen verbreiteter Mythen)</h2>

      <ul>
        <li>
          <strong>Cookie-Banner</strong> — wenn deine Vereinswebsite nur technisch notwendige Cookies
          setzt (Session-Login, kein Tracking), brauchst du keinen Banner. Erst Google Analytics oder
          Meta Pixel machen ihn nötig.
        </li>
        <li>
          <strong>Datenschutzbeauftragten</strong> — erst ab 20 Personen, die regelmäßig
          personenbezogene Daten verarbeiten. Solo-Vereinsvorstand braucht keinen.
        </li>
        <li>
          <strong>Server in Deutschland</strong> — innerhalb der EU oder in Ländern mit
          Adequacy-Decision (UK, Schweiz) ist alles legal. Marketing-Mythos, dass nur Frankfurt geht.
        </li>
      </ul>

      <h2>4. Praxis-Vorlagen</h2>

      <p>
        Statt Anwaltsgebühren — diese kostenlosen Quellen reichen für 95&nbsp;% der Vereine:
      </p>

      <ul>
        <li><strong>Datenschutzerklärung-Generator:</strong> e-recht24.de oder datenschutz-generator.de</li>
        <li><strong>Verarbeitungsverzeichnis-Vorlage:</strong> bfdi.bund.de oder lda.bayern.de</li>
        <li><strong>AVV-Muster:</strong> bei den meisten Software-Anbietern direkt im Dashboard</li>
        <li><strong>Datenpannen-Playbook:</strong> die Aufsichtsbehörden bieten 1-Seiten-PDFs</li>
      </ul>

      <h2>5. Wenn dir das alles zu viel ist</h2>

      <p>
        Dann lass es eine Software für dich machen.
        <Link href="/"> Osss</Link> erfasst Einwilligungen automatisch (IP + Zeitstempel + Text),
        führt das Verarbeitungsverzeichnis dokumentiert mit, hat den AVV elektronisch unterzeichenbar
        eingebaut und löscht Mitgliederdaten auf Anfrage per Knopfdruck. Deine Aufsichtsbehörde wird
        davon nichts mehr lesen müssen — du auch nicht.
      </p>

      <div className="cta-card">
        <h3>Osss kostenlos testen</h3>
        <p>Bis 30 Mitglieder gratis. Keine Kreditkarte. AVV inklusive.</p>
        <Link href="/register" className="cta-button">
          Jetzt starten →
        </Link>
      </div>
    </>
  ),
}
