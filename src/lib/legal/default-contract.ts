/**
 * Default-Vertragsvorlagen für Studios.
 *
 * Drei Template-Arten — je nach Use-Case beim Onboarding:
 *
 *  1. MEMBERSHIP_CONTRACT   → Vollständiger Mitgliedschaftsvertrag (mit IBAN,
 *                             Tarifen, AGB-§§). Verwendet bei Direkt-Mitgliedern.
 *  2. WELLPASS_AGREEMENT    → Kurz-Vereinbarung für Anbieter-Mitglieder
 *                             (Wellpass / Hansefit / EGYM / Urban Sports Club).
 *                             Kein SEPA — der Anbieter zahlt. 4 Kernpunkte.
 *  3. TRIAL_RULES           → Regelungen für Probestunden/Schnuppertraining.
 *                             Interessent wird über Verhalten + Haftung aufgeklärt.
 *
 * Platzhalter-System:
 *   {{gym_name}}           — Studio-Name
 *   {{gym_address}}        — Vollständige Adresse (Straße + PLZ + Ort)
 *   {{gym_city}}           — Nur Ort (für Unterschriftszeile "Musterstadt, den …")
 *   {{gym_url}}            — Website-Domain (z.B. www.csc-ffb.de)
 *
 * WICHTIG: Dies sind Vorlagen, KEINE rechtsverbindlichen Verträge. Studio-Owner
 * sollten den Text vor produktivem Einsatz von einem Anwalt prüfen lassen
 * (~300 € einmalig deckt alle künftigen Onboardings ab).
 */

// ──────────────────────────────────────────────────────────────────────────────
// 1. MEMBERSHIP CONTRACT — Vollvertrag mit AGB-§§
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONTRACT_TEMPLATE = `MITGLIEDSCHAFTSVERTRAG
{{gym_name}}, {{gym_address}}
{{gym_url}}

Hiermit beantrage ich die Mitgliedschaft im {{gym_name}} zu den nachstehenden Bedingungen, die ich durch meine Unterschrift als verbindlich anerkenne.

§1 GEGENSTAND
Das Mitglied ist berechtigt, die vertraglich gebuchten Kurse zu besuchen und die vorhandenen Trainingseinrichtungen zu den ausgeschriebenen Trainingszeiten beliebig zu nutzen. Sollte das {{gym_name}} aus irgendwelchen Gründen nicht geöffnet sein, hat das Mitglied keinen Anspruch auf Ersatzstunden.

§2 MITGLIEDSCHAFT, FORTDAUER, KÜNDIGUNG
Die Mitgliedschaft verlängert sich auf unbestimmte Zeit, falls nicht 1 Monat vor Ablauf des Vertrages seitens einer Vertragspartei die Kündigung erklärt wird. Nach Ende der Vertragslaufzeit besteht eine Kündigungsfrist von einem Monat. Für die Kündigung vereinbaren die Parteien die Textform. Für die Rechtzeitigkeit der Kündigung kommt es auf das Eingangsdatum im {{gym_name}} an.

Im Falle einer Erkrankung des Mitgliedes, die zur nachhaltigen Unfähigkeit führt, ein Training auch in leichterer Form zu führen, bzw. die sonstigen Angebote des Studios in Anspruch zu nehmen, sowie im Falle eines Umzuges des Mitgliedes, der zu einer Entfernung von mehr als 30 km zu den Räumen des {{gym_name}} führt, steht dem Mitglied ein Sonderkündigungsrecht unter Vorlage eines Nachweises (Attest / Meldebestätigung) zu. Die Kündigung hat schriftlich bis zum letzten Werktag eines Monats zu erfolgen und beendet den Vertrag zum Ende des Folgemonats.

Ein Sonderkündigungsrecht wegen Änderungen im Stundenplan oder Wechsel des Trainers besteht nicht.

Die Vereinbarung kann im gegenseitigen Einverständnis in begründeten Einzelfällen (z.B. Verletzung, Schwangerschaft, Auslandssemester etc.) für einen im Voraus zu bestimmenden Zeitraum, jedoch stets für volle Kalendermonate, pausiert werden. Hierfür ist die Vorlage eines entsprechenden Nachweises vor Beginn der Unterbrechung erforderlich. Die Vertragspause ist mindestens 10 Werktage vor dem Beginn dieser bekannt zu geben. Ein Anspruch auf nachträgliche Rückerstattung von Mitgliedsbeiträgen bei verspäteter Mitteilung besteht nicht. Die Vertragslaufzeit verlängert sich um die pausierte Zeit.

§3 MITGLIEDSBEITRAG
Der vereinbarte Mitgliedsbeitrag wird monatlich zum 01. des Monats im Voraus fällig und wird über das Abbuchungsverfahren (SEPA-Lastschrift) eingezogen. Der Beitrag gilt für die jeweils vereinbarte Laufzeit. Nach Ablauf des Vertragszeitraumes kann das {{gym_name}} die Mitgliedsbeiträge den jeweils geltenden Konditionen anpassen.

Gerät ein Mitglied mit mindestens zwei vereinbarten monatlichen Beiträgen in Verzug, so wird der Restbetrag bis zum vereinbarten Gesamtbetrag für die gesamte Vertragsdauer sofort zur Zahlung fällig. Bei einer Rückbelastung des abgebuchten Monatsbeitrages wird eine Bearbeitungsgebühr von 10 € fällig.

§4 FEIERTAGE / BETRIEBSURLAUB
Das {{gym_name}} behält sich vor, an gesetzlichen Feiertagen die Trainingsräume zu schließen und bis zu 21 Tage im Jahr Betriebsurlaub zu machen.

§5 MEDIKAMENTE
Es ist strengstens untersagt, verschreibungspflichtige Medikamente, die nicht dem persönlichen und ärztlich verordneten Verbrauch des Mitgliedes dienen, und/oder sonstige Mittel, die die körperliche Leistungsfähigkeit erhöhen (Anabolika etc.), in das {{gym_name}} mitzubringen. Ebenso ist es strengstens verboten, solche Mittel entgeltlich oder unentgeltlich anzubieten, zu vertreiben, zu vermitteln oder in sonstiger Weise Dritten zugänglich zu machen. Eine Zuwiderhandlung hat die sofortige fristlose Kündigung und eine Strafanzeige zur Folge. Das {{gym_name}} ist in diesem Falle berechtigt, sofort die restlichen Mitgliedsbeiträge bis zum Vertragsende als Schadenersatz zu verlangen.

§6 WERTGEGENSTÄNDE / HAFTUNG
Für mitgebrachte Kleidung, Wertgegenstände, Geld etc. wird keine Haftung übernommen. Es wird empfohlen, Wertgegenstände zu Hause zu lassen.

§7 ÄNDERUNGEN
Das Mitglied ist verpflichtet, jede Änderung — sei es Wohnsitz oder Bankverbindung — unverzüglich mitzuteilen.

§8 VERHALTEN
Während des Aufenthaltes und des Trainings im {{gym_name}} hat sich das Mitglied so zu verhalten, dass kein anderer geschädigt, belästigt oder behindert wird.

§9 PERSONEN- / SACHSCHÄDEN
Wer vorsätzlich oder fahrlässig das Leben, den Körper, die Gesundheit, die Freiheit, das Eigentum oder ein sonstiges Recht eines anderen widerrechtlich verletzt, ist dem anderen zum Ersatz des daraus entstehenden Schadens verpflichtet (§ 823 BGB). Dies gilt für Personenschäden sowie Sachbeschädigungen an den Trainingsgeräten und -Einrichtungen des {{gym_name}}.

§10 HAFTUNGSAUSSCHLUSS
Das Mitglied ist sich bewusst, dass Kampfsport / Sport eine Risikosportart sein kann. Die mit der Ausübung verbundenen Risiken sind ihm vollauf bekannt und bewusst. Das Mitglied weiß, dass das Training im {{gym_name}} auf eigenes Risiko, eigene Gefahr und eigene Verantwortung erfolgt. Das {{gym_name}} trifft alle möglichen Vorsichtsmaßnahmen, um Unfälle im Training zu vermeiden.

Das Studio haftet nicht für leichte Fahrlässigkeit, sondern nur bei Vorsatz oder grober Fahrlässigkeit. Die gesetzliche Haftung für Verletzung von Leben, Körper oder Gesundheit (§ 309 Nr. 7 BGB) sowie nach dem Produkthaftungsgesetz bleibt unberührt.

Unfall- und Haftpflichtversicherung sind Angelegenheit des Mitglieds.

§11 HAUSORDNUNG
Das Mitglied unterliegt der aushängenden Hausordnung und hat den Weisungen der Trainer Folge zu leisten. Insbesondere gilt:

  • Saubere Trainingskleidung und Hygiene auf der Matte / im Trainingsraum
  • Keine Außenschuhe auf der Trainingsfläche
  • Respektvoller Umgang mit Trainern, anderen Mitgliedern und Equipment
  • Keine Weitergabe von Zugangscodes / GPS-Check-in-Tokens an Dritte
  • Diebstahl, vorsätzliche Beschädigung oder Belästigung führen zum sofortigen Ausschluss
  • Foto- / Videoaufnahmen anderer Mitglieder nur mit deren ausdrücklicher Zustimmung

§12 NUTZUNG VON FOTO- UND FILMAUFNAHMEN
Das Mitglied erlaubt, dass Fotos bzw. Filme, die im Training und auf Studio-Veranstaltungen aufgenommen werden, zu Werbezwecken in Flyern, Pressemitteilungen und auf der Website des {{gym_name}} verwendet werden dürfen. Diese Einwilligung kann jederzeit per E-Mail an das Studio widerrufen werden.

§13 DATENSCHUTZ
Die Verarbeitung der Mitgliederdaten erfolgt gemäß DSGVO. Details sind der Datenschutzerklärung des {{gym_name}} zu entnehmen.

§14 VERTRAGSBESTIMMUNGEN / SCHLUSSBESTIMMUNGEN
Sollte eine Bestimmung dieses Vertrages ganz oder teilweise unwirksam sein, so wird dadurch die Wirksamkeit der übrigen Vertragsbestimmungen nicht berührt. Mündliche Nebenabreden bestehen nicht. Änderungen bedürfen der Textform. Es gilt deutsches Recht.

VOLLMACHT UND EINVERSTÄNDNIS
Das Mitglied bestätigt, die Vertragsbedingungen sorgfältig gelesen und den Inhalt zur Kenntnis genommen zu haben. Bei Minderjährigen unter 18 Jahren ist die Unterschrift eines gesetzlichen Vertreters notwendig.

Mit Klick auf „Mitgliedschaft abschließen" akzeptiert das Mitglied diesen Vertrag inkl. Hausordnung und Haftungsausschluss elektronisch nach eIDAS Art. 25 Abs. 1.
`

// ──────────────────────────────────────────────────────────────────────────────
// 2. WELLPASS AGREEMENT — Kurz-Vereinbarung für Anbieter-Mitglieder
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_WELLPASS_AGREEMENT_TEMPLATE = `VEREINBARUNG FÜR ANBIETER-MITGLIEDER
({{gym_name}}, {{gym_address}})

Diese Vereinbarung gilt für Mitglieder, die das {{gym_name}} über einen Anbieter wie Wellpass, Hansefit, EGYM Wellpass oder Urban Sports Club nutzen.

1 VERHALTEN
Während des Aufenthaltes und des Trainings im {{gym_name}} hat sich der Kunde so zu verhalten, dass kein anderer geschädigt, belästigt oder behindert wird.

2 PERSONEN- / SACHSCHÄDEN
Wer vorsätzlich oder fahrlässig das Leben, den Körper, die Gesundheit, die Freiheit, das Eigentum oder ein sonstiges Recht eines anderen widerrechtlich verletzt, ist dem anderen zum Ersatz des daraus entstehenden Schadens verpflichtet (§ 823 BGB). Dies gilt für Personenschäden sowie Sachbeschädigungen an den Trainingsgeräten und -Einrichtungen des {{gym_name}}.

3 HAFTUNGSAUSSCHLUSS
Der Kunde ist sich bewusst, dass Kampfsport / Sport eine Risikosportart sein kann. Die mit der Ausübung verbundenen Risiken sind ihm vollauf bekannt und bewusst. Der Kunde weiß, dass das Training im {{gym_name}} auf eigenes Risiko, eigene Gefahr und eigene Verantwortung erfolgt. Das {{gym_name}} trifft alle möglichen Vorsichtsmaßnahmen, um Unfälle im Training zu vermeiden.

Unfall- und Haftpflichtversicherung sind Angelegenheit des Kunden. Der Kunde wohnt dem Training auf eigene Verantwortung bei.

4 HAUSORDNUNG
Der Kunde hat den Weisungen der Trainer Folge zu leisten. Die ausgehängte Hausordnung ist Bestandteil dieser Vereinbarung. Bei Verstoß kann der Kunde vom Training ausgeschlossen werden. Der Anbieter-Beitrag (Wellpass / Hansefit / EGYM / Urban Sports Club) wird nicht rückerstattet.

GELESEN UND AKZEPTIERT
Mit Klick auf „Vereinbarung akzeptieren" wird diese Vereinbarung elektronisch nach eIDAS Art. 25 Abs. 1 unterschrieben.
`

// ──────────────────────────────────────────────────────────────────────────────
// 3. TRIAL RULES — Probestunden-Regeln
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_TRIAL_RULES_TEMPLATE = `REGELUNGEN FÜR PROBESTUNDEN IM {{gym_name}}
({{gym_address}})

Mit der Unterschrift bzw. dem Klick auf „Akzeptieren" werden diese Regeln anerkannt.

1 VERHALTEN
Während des Aufenthaltes und des Trainings im {{gym_name}} hat sich der Interessent so zu verhalten, dass kein anderer geschädigt, belästigt oder behindert wird.

2 PERSONEN- / SACHSCHÄDEN
Wer vorsätzlich oder fahrlässig das Leben, den Körper, die Gesundheit, die Freiheit, das Eigentum oder ein sonstiges Recht eines anderen widerrechtlich verletzt, ist dem anderen zum Ersatz des daraus entstehenden Schadens verpflichtet (§ 823 BGB). Dies gilt für Personenschäden sowie Sachbeschädigungen an den Trainingsgeräten und -Einrichtungen des {{gym_name}}.

3 HAFTUNGSAUSSCHLUSS
Der Interessent ist sich bewusst, dass Kampfsport / Sport eine Risikosportart sein kann. Die mit der Ausübung verbundenen Risiken sind ihm vollauf bekannt und bewusst. Der Interessent weiß, dass das Training im {{gym_name}} auf eigenes Risiko, eigene Gefahr und eigene Verantwortung erfolgt. Das {{gym_name}} trifft alle möglichen Vorsichtsmaßnahmen, um Unfälle im Training zu vermeiden.

Unfall- und Haftpflichtversicherung sind Angelegenheit des Interessenten. Der Interessent wohnt dem Training auf eigene Verantwortung bei.

4 HAUSORDNUNG
Der Interessent hat den Weisungen der Trainer Folge zu leisten. Die ausgehängte Hausordnung ist Bestandteil dieser Vereinbarung.

GELESEN UND AKZEPTIERT
Mit Klick auf „Probetraining buchen" werden diese Regelungen elektronisch nach eIDAS Art. 25 Abs. 1 anerkannt.
`

// ──────────────────────────────────────────────────────────────────────────────
// Template-Kinds + Resolver
// ──────────────────────────────────────────────────────────────────────────────

export type ContractKind = 'membership' | 'wellpass' | 'trial'

export interface GymInfo {
  name?: string | null
  address?: string | null
  city?: string | null
  url?: string | null
}

const TEMPLATE_BY_KIND: Record<ContractKind, string> = {
  membership: DEFAULT_CONTRACT_TEMPLATE,
  wellpass:   DEFAULT_WELLPASS_AGREEMENT_TEMPLATE,
  trial:      DEFAULT_TRIAL_RULES_TEMPLATE,
}

/**
 * Ersetzt Platzhalter im Template durch Studio-Daten.
 * Fehlende Werte fallen auf neutrale Defaults zurück (z.B. „dem Studio").
 */
export function renderTemplate(template: string, gym: GymInfo | null | undefined): string {
  const name    = gym?.name?.trim()    || 'dem Studio'
  const address = gym?.address?.trim() || ''
  const city    = gym?.city?.trim()    || ''
  const url     = gym?.url?.trim()     || ''

  return template
    .replace(/\{\{gym_name\}\}/g,    name)
    .replace(/\{\{gym_address\}\}/g, address)
    .replace(/\{\{gym_city\}\}/g,    city)
    .replace(/\{\{gym_url\}\}/g,     url)
}

/**
 * Liefert das passende Template für eine Vertrags-Art.
 * Eigenes Studio-Template hat Vorrang vor dem Default.
 *
 * @param kind         — 'membership' (Voll-Vertrag) | 'wellpass' (Anbieter) | 'trial' (Probestunde)
 * @param gymTemplate  — Gym-eigenes Template aus DB (z.B. gyms.contract_template)
 * @param gym          — Studio-Stammdaten für Platzhalter-Ersetzung (optional)
 */
export function resolveTemplate(
  kind: ContractKind,
  gymTemplate: string | null | undefined,
  gym?: GymInfo | null,
): string {
  const raw = gymTemplate?.trim() || TEMPLATE_BY_KIND[kind]
  return renderTemplate(raw, gym)
}

/**
 * Backwards-compat — alter Aufruf für `gyms.contract_template` (membership).
 * Bestehender Code im signup-Flow ruft nur `resolveContractTemplate(string|null)` auf,
 * ohne Studio-Stammdaten. Wir liefern das rohe Template (mit Platzhaltern), damit
 * der Caller selbst entscheiden kann ob er rendern will.
 */
export function resolveContractTemplate(gymTemplate: string | null | undefined, gym?: GymInfo | null): string {
  return resolveTemplate('membership', gymTemplate, gym)
}
