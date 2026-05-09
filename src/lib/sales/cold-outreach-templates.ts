/**
 * Cold-Outreach-Mail-Templates für DACH-Kampfsport-Studios.
 *
 * Synced mit `compliance/sales/cold-outreach-de.md`. Code lädt Templates,
 * UI rendert Auswahl, der Owner füllt Personalisierungs-Hooks pro Lead aus.
 *
 * WICHTIG — Compose-Hilfe ohne Auto-Versand:
 *   Diese Templates werden ausschließlich als Compose-Hilfe verwendet. Die
 *   UI öffnet einen `mailto:`-Link mit prefilled Subject + Body — der Owner
 *   sendet die Mail aus seinem eigenen Mail-Client (Apple Mail, Gmail, …).
 *
 *   Plattform versendet KEINE Cold-Mails. Damit:
 *   - Keine UWG-§7-Plattform-Haftung
 *   - Keine osss.pro-Domain-Spam-Reputation-Risiko
 *   - Owner trägt selbst Verantwortung für sein Outreach-Verhalten
 *
 *   Die Pflicht-Personalisierungs-Hooks sind trotzdem da — als Hilfe für den
 *   Owner, individualisierte Mails zu schreiben. Ohne min 10 Zeichen pro
 *   Hook lehnt die UI das mailto:-Open ab.
 */

export type ColdOutreachVariant = 'small' | 'medium' | 'large'

export interface OutreachTemplate {
  variant: ColdOutreachVariant
  /** UI-Label */
  label: string
  /** Wann dieses Template verwenden */
  whenToUse: string
  /** Empfohlene Subject-Zeilen (A/B-test-fähig) */
  subjects: readonly string[]
  /** Body-Template mit Mustache-style Platzhaltern */
  body: string
  /** Empfohlene Personalisierungs-Hooks (Pflicht) */
  hookPrompts: readonly string[]
}

/**
 * Variable-Substitution. Pflicht-Variablen werden automatisch aus dem Lead
 * ersetzt. Hook-Variablen müssen vom Owner pro Mail manuell eingegeben werden.
 */
export interface TemplateVars {
  /** Aus lead.name extrahiert (Studio-Name) */
  studio: string
  /** Vorname Ansprechpartner — manuell ergänzbar wenn nicht im Lead */
  vorname: string
  /** Aus lead.formatted_address abgeleitet — Stadt-Teil */
  stadt: string
  /** Aus lead.martial_arts oder lead.notes */
  sportart: string
  /** Optionaler Nachname für formelle Anrede */
  nachname: string
  /** PFLICHT-Hook 1: was hat der Owner auf Insta/Web gesehen? */
  hook_observation: string
  /** PFLICHT-Hook 2: was ist die wahrscheinliche Pain (z.B. „mehrere Standorte", „Wellpass-Mitglieder") */
  hook_pain: string
  /** Optional: Eigene Personalisierungs-Zeile */
  hook_custom: string
}

export const TEMPLATES: readonly OutreachTemplate[] = [
  {
    variant: 'small',
    label: 'Kleines Studio (<50 Mitglieder)',
    whenToUse: 'Excel-Nutzer, oft Solo-Trainer, persönliche Anrede via Vorname.',
    subjects: [
      '{{vorname}}, wie macht ihr aktuell die Mitgliedsbeiträge?',
      '{{studio}} + SEPA: kurze Frage zur Beitragsabrechnung',
      'Frage von einem BJJ-Trainee zu eurer Studio-Verwaltung',
    ],
    hookPrompts: [
      'Was hast du auf ihrer Insta/Webseite gesehen? (1 Satz, z.B. "ihr habt Probetraining-Button auf der Seite")',
      'Welche Pain vermutest du? (z.B. "manuelle Mahnungen", "noch Excel")',
    ],
    body: `Hallo {{vorname}},

{{hook_observation}}

Ich bin Lom, trainiere selbst BJJ und habe nebenbei eine kleine Software für
Kampfsport-Studios gebaut — weil ich gesehen habe, wie viel Zeit unser Coach mit
{{hook_pain}} verliert.

osss.pro macht genau das einfacher:
- SEPA-Lastschrift mit 0 % Plattformgebühr (läuft über Stripe)
- IBAN sauber verschlüsselt nach DSGVO
- Auto-Mahnung bei Rückbuchung statt manuell hinterhertelefonieren

Bis 30 Mitglieder ist es kostenlos, danach 49 €/Monat. Keine Mindestlaufzeit.

Hättest du diese Woche 15 Min für eine kurze Demo? Ich zeige dir konkret, wie
ein {{sportart}}-Studio aus eurer Größenordnung das nutzt.

Sportliche Grüße
Lom-Ali Imadaev
osss.pro

---
Falls kein Bedarf: kurz „Nein danke" reicht, dann melde ich mich nicht mehr.`,
  },
  {
    variant: 'medium',
    label: 'Mittleres Studio (50-150 Mitglieder)',
    whenToUse: 'Nutzt schon ein Tool oder ist Excel-Power-User. Wellpass/EGYM oft im Mix. Formellere Anrede.',
    subjects: [
      '{{studio}}: kurze Frage zu eurer Mitglieder-Software',
      'Wellpass-Mitglieder bei {{studio}}: Vertragsverwaltung',
      '30 % Kostenersparnis bei Mitgliederverwaltung — relevant für {{studio}}?',
    ],
    hookPrompts: [
      'Was hast du auf ihrer Webseite/Insta gesehen? (Wellpass-Logo? Anzahl Standorte? Tool-Hinweis?)',
      'Welche Pain hast du erkannt? (z.B. "drei Vertragsarten parallel", "manueller DATEV-Export")',
      'Optional: noch eine eigene Zeile zur Personalisierung',
    ],
    body: `Sehr geehrter Herr/Frau {{nachname}},

{{hook_observation}}

Gerade bei mittleren Studios sehen wir oft das gleiche Muster: {{hook_pain}}.
Inkasso läuft halbautomatisch, der Steuerberater bekommt am Monatsende einen
handgeschriebenen Export.

Wir haben osss.pro genau für diese Konstellation gebaut:
- Native Anbindung an Wellpass / Hansefit / EGYM (Anbieter-Mitglieder klar getrennt)
- Inkasso-Workflow mit Auto-Mahnung (14d/28d-Eskalation, PDF-Generation)
- DATEV-Export für den Steuerberater auf Knopfdruck
- Stripe SEPA-Lastschrift, 0 % Plattformgebühr

{{hook_custom}}

Erster zahlender Pilot ist das Combat-Sports-Center Fürstenfeldbruck. Für
{{studio}} könnten wir die ersten 3 Monate als vergünstigten Pilot fahren —
inkl. Migrations-Tool aus eurem aktuellen System.

Hätten Sie nächste Woche 30 Min für eine Demo?

Mit sportlichem Gruß
Lom-Ali Imadaev
osss.pro | Founder

---
Wenn osss.pro für {{studio}} aktuell nicht passt, gerne kurze Rückmeldung — dann
melde ich mich nicht weiter.`,
  },
  {
    variant: 'large',
    label: 'Großes Studio (150+ Mitglieder)',
    whenToUse: 'Multi-Location, Magicline/Aidoo/Mindbody-Nutzer. Nachname-Anrede, ROI-Pitch.',
    subjects: [
      'Magicline-Alternative für {{studio}}: 30-50 % Kostenersparnis',
      '{{stadt}}: {{studio}} und die Belt-Verwaltung in der Software',
      'DSGVO Art. 32 IBAN-Encryption: relevant für {{studio}}?',
    ],
    hookPrompts: [
      'Was weißt du über das Studio? (Standorte, Trainer-Anzahl, aktuelle Software)',
      'Konkreter Pain-Vermutung — was funktioniert vermutlich nicht? (z.B. "kein Belt-System in Magicline")',
      'Optional: persönliche Zeile (z.B. Decision-Maker-Name aus LinkedIn)',
    ],
    body: `Sehr geehrter Herr/Frau {{nachname}},

{{hook_observation}}

{{studio}} gehört zu den großen {{sportart}}-Adressen in {{stadt}}. Genau bei Studios in
eurer Größenordnung sehen wir aktuell zwei wiederkehrende Themen:

1. **Branchen-Spezifika fehlen.** Magicline und Aidoo sind generische
   Fitness-Software — kein Belt-System mit Stripes (BJJ-spezifisch), kein
   sauberes Probetraining mit Hausordnung-Akzeptanz, GPS-Check-in per Handy
   nur als Aufpreis-Modul.

2. **{{hook_pain}}**

osss.pro deckt das ab — bei 149 €/Monat für den Pro-Tarif.
Verglichen mit Magicline (~250 €/Monat) sind das real **40 % Ersparnis**, ohne
auf Branchen-Features zu verzichten.

{{hook_custom}}

**Konkrete Eckdaten:**
- Erster zahlender Pilot: Combat-Sports-Center Fürstenfeldbruck
- Migrations-Tool aus Magicline / Aidoo / Eversports vorhanden
- Stripe SEPA-Lastschrift, 0 % Plattformgebühr
- DATEV-Export, Wellpass/Hansefit/EGYM nativ
- Mitglieder-Portal mit GPS-Check-in, Tarif-Wechsel, Vertrag-PDF

Ich biete für Studios eurer Größenordnung eine 45-Min-Demo + Migrations-Plan
an — keine Verkaufsfolien, sondern ein Live-System mit euren echten Use-Cases
durchgespielt.

Wäre kommende Woche Dienstag oder Donnerstag passend?

Mit sportlichem Gruß
Lom-Ali Imadaev
Founder, osss.pro
SAP-Berater (Hauptberuf) | BJJ-Trainee

---
Falls Sie aktuell zufrieden sind oder eine Software-Migration nicht ansteht: kurze
Rückmeldung genügt, dann nehme ich {{studio}} aus dem Verteiler.`,
  },
] as const

/**
 * Render template body + subject by substituting variables.
 *
 * Empty hook variables → leave the placeholder visible so the UI's pre-send
 * validation can flag them. Doing the substitution silently with empty
 * strings would let half-baked mails through.
 */
export function renderTemplate(
  template: OutreachTemplate,
  vars: TemplateVars,
  subjectIndex = 0,
): { subject: string; body: string } {
  const subjectTemplate = template.subjects[subjectIndex] ?? template.subjects[0]
  const subject = applyVars(subjectTemplate, vars)
  const body = applyVars(template.body, vars)
  return { subject, body }
}

function applyVars(text: string, vars: TemplateVars): string {
  return text
    .replace(/\{\{studio\}\}/g, vars.studio)
    .replace(/\{\{vorname\}\}/g, vars.vorname || vars.studio.split(' ')[0])
    .replace(/\{\{nachname\}\}/g, vars.nachname || '[Nachname]')
    .replace(/\{\{stadt\}\}/g, vars.stadt)
    .replace(/\{\{sportart\}\}/g, vars.sportart)
    .replace(/\{\{hook_observation\}\}/g, vars.hook_observation)
    .replace(/\{\{hook_pain\}\}/g, vars.hook_pain)
    .replace(/\{\{hook_custom\}\}/g, vars.hook_custom)
}

/**
 * Validate that a rendered mail is sendable. Refuses mails that still contain
 * unfilled placeholders or whose hooks are too short to be considered
 * personalised (a one-word hook is not a personalisation in DACH-§7-sense).
 */
export function validateRendered(
  rendered: { subject: string; body: string },
  vars: TemplateVars,
): { ok: true } | { ok: false; reason: string } {
  // Reject obvious unfilled placeholders.
  if (/\{\{[a-z_]+\}\}/.test(rendered.subject) || /\{\{[a-z_]+\}\}/.test(rendered.body)) {
    return { ok: false, reason: 'Body enthält noch ungefüllte Platzhalter ({{…}}).' }
  }
  if (rendered.body.includes('[Nachname]') && rendered.body.includes('Sehr geehrter Herr/Frau [Nachname]')) {
    return { ok: false, reason: 'Nachname für formelle Anrede fehlt.' }
  }
  // Hook 1 (observation) muss mindestens 10 Zeichen haben — sonst ist es
  // keine echte Personalisierung im UWG-§7-Sinne.
  if ((vars.hook_observation ?? '').trim().length < 10) {
    return { ok: false, reason: 'Erster Personalisierungs-Hook (was du gesehen hast) ist leer oder zu kurz.' }
  }
  // Hook 2 (pain) ebenso.
  if ((vars.hook_pain ?? '').trim().length < 10) {
    return { ok: false, reason: 'Zweiter Personalisierungs-Hook (vermuteter Pain-Point) ist leer oder zu kurz.' }
  }
  return { ok: true }
}

/**
 * Auto-extract plausible vars from a sales_lead row. The owner can override
 * each one in the compose UI before send.
 *
 * Schema note: the DB column is `sports`, not `martial_arts` — Cliff in this
 * codebase. The `city` is its own column (not parsed from address) so we
 * prefer it when set.
 */
export function extractVars(lead: {
  name?: string | null
  city?: string | null
  formatted_address?: string | null
  notes?: string | null
  sports?: string[] | null
}): Pick<TemplateVars, 'studio' | 'stadt' | 'sportart'> {
  const studio = (lead.name ?? 'Studio').trim()
  const city = (lead.city ?? '').trim() || pickCityFromAddress((lead.formatted_address ?? '').trim())
  const sport = pickSport(lead.sports ?? [], lead.notes ?? '')
  return { studio, stadt: city, sportart: sport }
}

function pickCityFromAddress(addr: string): string {
  if (!addr) return '[Stadt]'
  // German addresses: "Strasse 1, 12345 Stadt, Germany"
  const m = addr.match(/\b\d{5}\s+([A-Za-zÄÖÜäöüß \-]+?)(?:,|$)/)
  if (m) return m[1].trim()
  // Fallback: token before last comma
  const parts = addr.split(',').map(s => s.trim()).filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 2] : '[Stadt]'
}

function pickSport(martialArts: string[], notes: string): string {
  const map: Record<string, string> = {
    bjj: 'BJJ',
    'brazilian jiu jitsu': 'BJJ',
    judo: 'Judo',
    karate: 'Karate',
    mma: 'MMA',
    boxing: 'Boxen',
    boxen: 'Boxen',
    muaythai: 'Muay Thai',
    'muay thai': 'Muay Thai',
    taekwondo: 'Taekwondo',
    kickboxing: 'Kickboxen',
    kickboxen: 'Kickboxen',
  }
  const normalized = [...martialArts, notes]
    .filter(Boolean)
    .map(s => s.toLowerCase())
    .join(' ')
  for (const [key, label] of Object.entries(map)) {
    if (normalized.includes(key)) return label
  }
  return 'Kampfsport'
}
