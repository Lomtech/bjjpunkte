/**
 * Default-Vertragsvorlage für Mitgliedschaften.
 *
 * Wird verwendet, wenn `gyms.contract_template` leer/null ist. Der Gym-Owner
 * kann den Text in den Einstellungen anpassen, aber dieser Standard deckt:
 *  - Mitgliedschaftsvertrag
 *  - Hausordnung (Kurzfassung)
 *  - Haftungsausschluss (üblich für Kampfsport, NICHT bei Personenschaden)
 *
 * WICHTIG: Dies ist KEINE rechtsverbindliche Vorlage. Gym-Owner sollten den
 * Text einmal von einem Anwalt prüfen lassen — kostet einmalig ~300 €,
 * deckt aber alle künftigen Verträge ab.
 */

export const DEFAULT_CONTRACT_TEMPLATE = `MITGLIEDSCHAFTSVERTRAG

Zwischen dem Gym (im Folgenden: „Verein/Studio") und dem Mitglied wird folgender Vertrag geschlossen:

§1 GEGENSTAND
Das Mitglied ist berechtigt, das Trainings-Angebot des Studios im Rahmen der gewählten Mitgliedschaft zu nutzen.

§2 LAUFZEIT UND KÜNDIGUNG
Die Laufzeit ergibt sich aus dem gewählten Beitragsplan. Eine Kündigung kann jederzeit zum Ende des bezahlten Zeitraums über das Mitglieder-Portal oder per E-Mail an das Studio erfolgen.

§3 BEITRAGSZAHLUNG
Der Mitgliedsbeitrag wird per SEPA-Lastschrift, Kreditkarte oder anderen vom Studio angebotenen Verfahren eingezogen. Bei Zahlungsverzug behält sich das Studio vor, die Mitgliedschaft auszusetzen.

§4 HAUSORDNUNG
Mit Unterzeichnung dieses Vertrags akzeptiert das Mitglied die Hausordnung des Studios. Insbesondere:

  • Saubere Trainingskleidung und Hygiene auf der Matte/im Trainingsraum
  • Keine Außenschuhe auf der Trainingsfläche
  • Respektvoller Umgang mit Trainern, anderen Mitgliedern und Equipment
  • Keine Weitergabe von Zugangscodes / GPS-Check-in-Tokens an Dritte
  • Diebstahl, vorsätzliche Beschädigung oder Belästigung führen zum sofortigen Ausschluss
  • Foto- und Videoaufnahmen anderer Mitglieder nur mit deren ausdrücklicher Zustimmung

Verstöße gegen die Hausordnung können zur Kündigung der Mitgliedschaft ohne Rückerstattung führen.

§5 HAFTUNGSAUSSCHLUSS
Das Training findet auf eigenes Risiko statt. Kampfsport beinhaltet körperliche Belastung und Verletzungsrisiken. Das Mitglied versichert, körperlich gesund und uneingeschränkt sportfähig zu sein. Bei Vorerkrankungen ist vor Trainingsbeginn das Studio zu informieren.

Das Studio haftet nicht für leichte Fahrlässigkeit, sondern nur bei Vorsatz oder grober Fahrlässigkeit. Eine Haftung für mittelbare Schäden, entgangenen Gewinn und Folgeschäden ist ausgeschlossen.

Die gesetzliche Haftung für Verletzung von Leben, Körper oder Gesundheit (§309 Nr. 7 BGB) sowie nach dem Produkthaftungsgesetz bleibt unberührt.

Wertgegenstände sind in den Schließfächern zu deponieren. Das Studio haftet nicht für Diebstahl oder Verlust außerhalb der Schließfächer.

§6 DATENSCHUTZ
Die Verarbeitung der Mitgliederdaten erfolgt gemäß DSGVO. Details sind der Datenschutzerklärung zu entnehmen, einsehbar im Studio oder online.

§7 SCHLUSSBESTIMMUNGEN
Mündliche Nebenabreden bestehen nicht. Änderungen bedürfen der Textform. Sollten einzelne Bestimmungen unwirksam sein, bleibt der übrige Vertrag wirksam. Es gilt deutsches Recht.

Mit Klick auf „Mitgliedschaft abschließen" akzeptiert das Mitglied diesen Vertrag inkl. Hausordnung und Haftungsausschluss elektronisch nach eIDAS Art. 25 Abs. 1.
`

/**
 * Gibt das Vertrags-Template zurück. Wenn das Gym ein eigenes hat, wird es
 * verwendet, sonst der Default oben.
 */
export function resolveContractTemplate(gymTemplate: string | null | undefined): string {
  return gymTemplate?.trim() || DEFAULT_CONTRACT_TEMPLATE
}
