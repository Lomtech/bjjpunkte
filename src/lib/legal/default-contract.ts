/**
 * Default-Vertragsvorlagen für Studios.
 *
 * Drei Templates — 1:1 abgeleitet aus den drei CSC-Fürstenfeldbruck Vorlagen
 * (Bild-Vorlagen vom 2026-05-07), nur Studio-Spezifika durch Platzhalter ersetzt.
 *
 *  1. MEMBERSHIP_CONTRACT   → Mitgliedschaftsvertrag §§ 2-14 (Voll-Vertrag)
 *                             §1 ("Vollmacht und Einverständnis") wird im
 *                             digitalen Flow ans Ende gestellt — im Papier-
 *                             Original steht es auf der Vorderseite.
 *  2. WELLPASS_AGREEMENT    → Vereinbarung für Anbieter-Mitglieder
 *                             (Wellpass / Hansefit / EGYM / Urban Sports).
 *                             Kein SEPA. 4 Kernpunkte.
 *  3. TRIAL_RULES           → Regelungen für Probestunden — 4 Punkte für
 *                             Interessenten (kürzeste Variante, §4 Hausordnung
 *                             nur 1 Satz).
 *
 * Platzhalter:
 *   {{gym_name}}      — Studio-Name              (Default: "dem Studio")
 *   {{gym_address}}   — Vollständige Adresse     (z.B. "Brucker Str. 31, 82275 …")
 *   {{gym_city}}      — Nur Ort                  (für „Musterstadt, den …")
 *   {{gym_url}}       — Website-Domain           (z.B. "www.csc-ffb.de")
 *
 * WICHTIG: Vorlage, KEIN rechtsverbindlicher Vertrag. Studio-Owner sollten
 * den Text vor produktivem Einsatz von einem Anwalt prüfen lassen.
 */

// ──────────────────────────────────────────────────────────────────────────────
// 1. MITGLIEDSCHAFTSVERTRAG — §§ 2-14 (1:1 aus CSC-FFB-Vorlage)
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CONTRACT_TEMPLATE = `Mitgliedschaftsvertrag
{{gym_name}}, {{gym_address}}
{{gym_url}}

Hiermit beantrage ich die Mitgliedschaft im {{gym_name}} zu den nachstehenden Bedingungen, die ich durch meine Unterschrift als verbindlich anerkenne.

2. Mitgliedschaft, Fortdauer des Vertrages, Kündigung
Die Mitgliedschaft verlängert sich auf unbestimmte Zeit, falls nicht 1 Monat vor Ablauf des Vertrages seitens einer Vertragspartei die Kündigung erklärt wird. Nach Ende der Vertragslaufzeit besteht eine Kündigungsfrist von einem Monat. Für die Kündigung, vereinbaren die Parteien die Textform. Für die Rechtzeitigkeit der Kündigung kommt es auf das Eingangsdatum im {{gym_name}} an.
Im Falle einer Erkrankung des Mitgliedes, die zur nachhaltigen Unfähigkeit führt, ein Training auch in leichterer Form zu führen, bzw. die sonstigen Angebote des {{gym_name}} in Anspruch zu nehmen, sowie im Falle eines Umzuges des Mitgliedes, der zu einer Entfernung von mehr als 30 km zu den Räumen des {{gym_name}} führt, steht dem Mitglied ein Sonderkündigungsrecht unter Vorlage eines Nachweises (Attest/Meldebestätigung) zu. Die Kündigung hat schriftlich bis zum letzten Werktag eines Monats zu erfolgen und beendet den Vertrag zum Ende des Folgemonats, in dem die Kündigung erfolgt ist.
Ein Sonderkündigungsrecht wegen Änderungen im Stundenplan oder Wechsel des Trainers besteht nicht.
Die Vereinbarung kann im gegenseitigen Einverständnis in begründeten Einzelfällen (z.B. Verletzung, Schwangerschaft, Auslandssemester etc.) für einen im Voraus zu bestimmenden Zeitraum, jedoch stets für volle Kalendermonate, pausiert werden. Hierfür ist die Vorlage eines entsprechenden Nachweises vor Beginn der Unterbrechung erforderlich. Die Vertragspause ist mindestens 10 Werktage vor dem Beginn dieser bekannt zu geben. Ein Anspruch auf nachträgliche Rückerstattung von Mitgliedsbeiträgen bei verspäteter Mitteilung besteht nicht. Die Vertragslaufzeit verlängert sich um die pausierte Zeit.

3. Mitgliedsbeitrag
Der vereinbarte Mitgliedsbeitrag wird monatlich zum 01. des Monats im Voraus fällig und wird über das Abbuchungsverfahren eingezogen. Der Beitrag gilt für die jeweils vereinbarte Laufzeit. Nach Ablauf des Vertragszeitraumes kann das {{gym_name}}, die Mitgliedsbeiträge den jeweils geltenden Konditionen anpassen. Gerät ein Mitglied mit mindestens zwei vereinbarten monatlichen Beiträgen in Verzug, so wird der Restbetrag bis zum vereinbarten Gesamtbetrag für die gesamte Vertragsdauer sofort zur Zahlung fällig.
Bei einer Rückbelastung des abgebuchten Monatsbeitrages wird eine Bearbeitungsgebühr von 10 € fällig.

4. Benutzung
Das Mitglied ist berechtigt, die vertraglich gebuchten Kurse zu besuchen und die vorhandenen Trainingseinrichtungen zu den ausgeschriebenen Trainingszeiten beliebig zu nutzen.
Sollte das {{gym_name}}, aus irgendwelchen Gründen nicht geöffnet sein, hat das Mitglied keinen Anspruch auf Ersatzstunden.

5. Feiertage
Das {{gym_name}} behält sich vor, an gesetzlichen Feiertagen die Trainingsräume zu schließen und 21 Tage im Jahr Betriebsurlaub zu machen.

6. Medikamente
Es ist strengstens untersagt, verschreibungspflichtige Medikamente, die nicht dem persönlichen und ärztlich verordneten Verbrauch des Mitgliedes dienen und/oder sonstige Mittel, die die körperliche Leistungsfähigkeit erhöhen (Anabolika etc.) in das {{gym_name}} mitzubringen. Ebenso ist es strengstens verboten, solche Mittel entgeltlich oder unentgeltlich anzubieten, zu vertreiben, zu vermitteln oder in sonstiger Weise Dritten zugänglich zu machen. Eine Zuwiderhandlung hat die sofortige, fristlose Kündigung und eine Strafanzeige zur Folge. Das {{gym_name}} ist in diesem Falle berechtigt, sofort die restlichen Mitgliedsbeiträge bis zum Vertragsende als Schadenersatz zu verlangen.

7. Wertgegenstände/Haftung
Für mitgebrachte Kleidung, Wertgegenstände, Geld, etc. wird keine Haftung übernommen.
Es wird empfohlen, Wertgegenstände zu Hause zu lassen.

8. Änderungen
Das Mitglied ist verpflichtet, jede Änderung, sei es Wohnsitz oder Bankverbindung, unverzüglich mitzuteilen.

9. Verhalten
Während des Aufenthaltes und des Trainings im {{gym_name}} hat sich das Mitglied so zu verhalten, dass kein anderer geschädigt, belästigt oder behindert wird.

10. Personen-/Sachschäden
Wer vorsätzlich oder fahrlässig das Leben, den Körper, die Gesundheit, die Freiheit, das Eigentum oder ein sonstiges Recht eines anderen widerrechtlich verletzt, ist dem anderen zum Ersatz des daraus entstehenden Schadens verpflichtet. (§823 BGB)
Dies gilt für Personenschäden sowie Sachbeschädigungen an den Trainingsgeräten und –Einrichtungen des {{gym_name}}.

11. Haftungsausschluss
Das Mitglied ist sich bewusst, dass Kampfsport eine Risikosportart ist. Die mit der Ausübung des Kampfsports verbundenen Risiken sind ihm vollauf bekannt und bewusst. Das Mitglied weiß, dass das Training im {{gym_name}} auf eigenes Risiko, eigene Gefahr und eigene Verantwortung erfolgt. Das {{gym_name}} trifft alle möglichen Vorsichtsmaßnahmen, um Unfälle im Training zu vermeiden.
Unfall- und Haftpflichtversicherung ist Angelegenheit des Mitglieds.

12. Hausordnung
Das Mitglied unterliegt der aushängenden Hausordnung und hat den Weisungen der Trainer Folge zu leisten.

13. Nutzung von Fotoaufnahmen und Filmmaterial
Das Mitglied erlaubt, dass Fotos bzw. Filme, die im Training und auf {{gym_name}}-Veranstaltungen aufgenommen werden, zu Werbezwecken in Flyern, Pressemitteilungen und auf der Website des {{gym_name}} verwendet werden dürfen.

14. Vertragsbestimmungen
Sollte eine Bestimmung dieses Vertrages ganz oder teilweise unwirksam sein, so wird dadurch die Wirksamkeit der übrigen Vertragsbestimmungen nicht berührt.

1. Vollmacht und Einverständnis
Das Mitglied bestätigt, die Vertragsbedingungen sorgfältig gelesen und den Inhalt zur Kenntnis genommen zu haben. Bei Minderjährigen unter 18 Jahren, ist die Unterschrift eines gesetzlichen Vertreters notwendig.
`

// ──────────────────────────────────────────────────────────────────────────────
// 2. VEREINBARUNG FÜR ANBIETER-MITGLIEDER (Wellpass) — 1:1 aus CSC-Vorlage
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_WELLPASS_AGREEMENT_TEMPLATE = `Vereinbarung für Wellpasskunden im {{gym_name}}

1 Verhalten
Während des Aufenthaltes und des Trainings im {{gym_name}}, hat sich der Kunde so zu verhalten, dass kein Anderer geschädigt, belästigt oder behindert wird.

2 Personen-/Sachschäden
Wer vorsätzlich oder fahrlässig das Leben, den Körper, die Gesundheit, die Freiheit, das Eigentum oder ein sonstiges Recht eines anderen widerrechtlich verletzt, ist dem anderen zum Ersatz des daraus entstehenden Schadens verpflichtet. (§823 BGB)
Dies gilt für Personenschäden sowie Sachbeschädigungen an den Trainingsgeräten und -Einrichtungen des {{gym_name}}.

3 Haftungsausschluss
Der Kunde ist sich bewusst, dass Kampfsport eine Risikosportart ist. Die mit der Ausübung des Kampfsports verbundenen Risiken sind ihm vollauf bekannt und bewusst. Der Kunde weiß, dass das Training im {{gym_name}}, auf eigenes Risiko, eigene Gefahr und eigene Verantwortung erfolgt. Das {{gym_name}} trifft alle möglichen Vorsichtsmaßnahmen, um Unfälle im Training zu vermeiden.
Unfall- und Haftpflichtversicherung ist Angelegenheit des Kunden.
Der Kunde wohnt dem Training auf eigene Verantwortung bei.

4 Hausordnung
Der Kunde hat den Weisungen der Trainer Folge zu leisten.
Die ausgehängte Hausordnung ist Bestandteil dieser Vereinbarung.
Bei Verstoss kann der Kunde vom Training ausgeschlossen werden.
Der Wellpass Beitrag wird nicht rückerstattet.

Gelesen und akzeptiert.
`

// ──────────────────────────────────────────────────────────────────────────────
// 3. REGELUNGEN FÜR PROBESTUNDEN — 1:1 aus CSC-Vorlage
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_TRIAL_RULES_TEMPLATE = `Regelungen für Probestunden im {{gym_name}}

Mit der Unterschrift werden diese Regeln anerkannt.

1 Verhalten
Während des Aufenthaltes und des Trainings im {{gym_name}}, hat sich der Interessent so zu verhalten, dass kein Anderer geschädigt, belästigt oder behindert wird.

2 Personen-/Sachschäden
Wer vorsätzlich oder fahrlässig das Leben, den Körper, die Gesundheit, die Freiheit, das Eigentum oder ein sonstiges Recht eines anderen widerrechtlich verletzt, ist dem anderen zum Ersatz des daraus entstehenden Schadens verpflichtet. (§823 BGB)
Dies gilt für Personenschäden sowie Sachbeschädigungen an den Trainingsgeräten und -Einrichtungen des {{gym_name}}.

3 Haftungsausschluss
Der Interessent ist sich bewusst, dass Kampfsport eine Risikosportart ist. Die mit der Ausübung des Kampfsports verbundenen Risiken sind ihm vollauf bekannt und bewusst. Der Interessent weiß, dass das Training im {{gym_name}}, auf eigenes Risiko, eigene Gefahr und eigene Verantwortung erfolgt. Das {{gym_name}} trifft alle möglichen Vorsichtsmaßnahmen, um Unfälle im Training zu vermeiden.
Unfall- und Haftpflichtversicherung ist Angelegenheit des Interessenten.
Der Interessent wohnt dem Training auf eigene Verantwortung bei.

4 Hausordnung
Der Interessent hat den Weisungen der Trainer Folge zu leisten.
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
 * Fehlende Werte fallen auf neutrale Defaults zurück.
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
 */
export function resolveContractTemplate(gymTemplate: string | null | undefined, gym?: GymInfo | null): string {
  return resolveTemplate('membership', gymTemplate, gym)
}
