'use client'

import { useState } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

type Lead = {
  name: string
  city: string | null
  is_martial_arts: boolean
  sports: string[]
  rating: number | null
  user_ratings_total: number | null
  contact_count: number
  notes: string | null
}

type Phase =
  | 'mindset'
  | 'opener'
  | 'discovery'
  | 'pitch'
  | 'objections'
  | 'close'
  | 'dq'
  | 'voicemail'

const PHASES: { id: Phase; label: string; icon: string }[] = [
  { id: 'mindset',    label: 'Mindset',       icon: '🧠' },
  { id: 'opener',     label: 'Pilot-Anfrage', icon: '👋' },
  { id: 'discovery',  label: 'Fit-Check',     icon: '🩺' },
  { id: 'pitch',      label: 'Pilot-Deal',    icon: '🎯' },
  { id: 'objections', label: 'Einwände',      icon: '🛡' },
  { id: 'close',      label: 'Setup-Termin',  icon: '📅' },
  { id: 'dq',         label: 'Tschüss',       icon: '🚪' },
  { id: 'voicemail',  label: 'Mailbox',       icon: '📞' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function CallScript({ lead }: { lead: Lead }) {
  const [phase, setPhase] = useState<Phase>('mindset')
  const [showScript, setShowScript] = useState(false)

  const primarySport = pickPrimarySport(lead.sports)
  const isReturningCall = lead.contact_count > 0
  const cityPart = lead.city ? ` in ${lead.city}` : ''

  return (
    <div className="bg-amber-50/50 border border-amber-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setShowScript(s => !s)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-100/60 transition-colors"
      >
        <span className="text-sm font-bold text-amber-900 flex items-center gap-2">
          📋 Pilot-Skript
          {isReturningCall && <span className="text-xs font-normal text-amber-700">(Folgeanruf)</span>}
        </span>
        <span className="text-amber-700 text-lg">{showScript ? '▾' : '▸'}</span>
      </button>

      {showScript && (
        <div className="p-4 pt-0 space-y-3">
          {/* Phase tabs */}
          <div className="flex gap-1 flex-wrap text-xs">
            {PHASES.map(p => (
              <button
                key={p.id}
                onClick={() => setPhase(p.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  phase === p.id
                    ? 'bg-amber-400 text-zinc-900'
                    : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          {/* Phase content */}
          <div className="bg-white border border-amber-200 rounded-lg p-3 text-sm leading-relaxed text-zinc-800 space-y-3">
            {phase === 'mindset'    && <Mindset />}
            {phase === 'opener'     && <Opener lead={lead} cityPart={cityPart} returning={isReturningCall} />}
            {phase === 'discovery'  && <Discovery primarySport={primarySport} />}
            {phase === 'pitch'      && <PilotDeal primarySport={primarySport} />}
            {phase === 'objections' && <Objections />}
            {phase === 'close'      && <Close />}
            {phase === 'dq'         && <Disqualify />}
            {phase === 'voicemail'  && <Voicemail cityPart={cityPart} />}
          </div>

          <div className="text-xs text-amber-800/80">
            💡 <strong>Goldene Regel</strong>: Du suchst <strong>3 Pilot-Gyms</strong>, kein Geld.
            Knappheit bewahren — wer nicht passt, ist raus. Lieber 0 Pilots als der Falsche.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Phases ─────────────────────────────────────────────────────────────────

function Mindset() {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🧠 30 Sekunden vor dem Wählen — Mindset-Reset.
      </div>

      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
        <p className="font-bold text-zinc-900 mb-2">Du verkaufst NICHTS. Du bietest etwas an.</p>
        <p className="text-sm text-zinc-700 mb-2">
          Du bietest 3 ausgewählten Gyms an, deine Software <strong>6 Monate gratis</strong> zu testen.
          Im Gegenzug: ehrliches Feedback. Das ist kein Sales-Pitch — das ist eine
          <strong> Einladung zum Pilot-Programm</strong>.
        </p>
        <p className="text-sm text-zinc-700">
          → Wenn der Coach „Nein" sagt: <strong>er verliert die Chance</strong>, nicht du den Verkauf.
        </p>
      </div>

      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
        <p className="font-bold text-emerald-900 mb-2 text-xs uppercase tracking-wide">✅ Knappheit ist deine Stärke</p>
        <ul className="text-sm text-emerald-900 space-y-1 list-disc pl-5">
          <li><strong>3 Pilot-Plätze.</strong> Nicht 30, nicht 10. Drei.</li>
          <li>Du suchst <strong>einen Fit</strong>, keine Mitleids-Tester</li>
          <li>Wenn er nicht passt → schade, nächster.</li>
          <li>Wenn er passt → er bekommt einen <strong>persönlichen Setup-Termin</strong> mit dir</li>
        </ul>
      </div>

      <div className="bg-rose-50 rounded-lg p-3 border border-rose-200">
        <p className="font-bold text-rose-900 mb-2 text-xs uppercase tracking-wide">⚠️ Anti-Pattern</p>
        <ul className="text-sm text-rose-900 space-y-1 list-disc pl-5">
          <li>❌ Bittstellerig wirken (&bdquo;Hätten Sie vielleicht Lust...")</li>
          <li>❌ Sich entschuldigen für den Anruf</li>
          <li>❌ Auf jeden Einwand nochmal nachsetzen</li>
          <li>❌ „Sind Sie sicher? Bedenken Sie..." — niemals überreden</li>
        </ul>
      </div>

      <p className="text-xs text-zinc-500 italic">
        Atemübung: 4 Sek ein, 4 halten, 6 aus. Stimme ruhiger, nicht nervös.
      </p>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Opener({ lead, cityPart, returning }: { lead: Lead; cityPart: string; returning: boolean }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        ⏱ ZIEL: 15 Sek Pilot-Anfrage. Knappheit. Wert. Klare Frage am Ende.
      </div>

      {returning ? (
        <p className="italic">
          „Hi, Lom hier. Wir hatten kurz Kontakt zu <strong>{lead.name}</strong>{cityPart}.
          Hattest du Zeit drüber nachzudenken — oder ist es gerade zu viel?"
        </p>
      ) : (
        <>
          {/* PRIMARY — Discovery-First-Opener (2026-05-11 User-Wunsch).
              Statt direktem Pitch sofort filtern: redet er nur weiter wenn
              er die Persona "keine Software" oder "unzufrieden" anspricht.
              Knappheit + 6-Monate-Pilot-Wert kommen erst in Phase "Pilot-Deal". */}
          <div className="bg-emerald-50 rounded-lg p-3 border-2 border-emerald-300">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-2">
              🎯 PRIMÄR · Discovery-First (10 Sek, Persona-Filter)
            </p>

            <p className="italic text-base leading-relaxed font-medium text-zinc-900">
              „Hallo, ich bin <strong>Lom-Ali Imadaev</strong>. Ich bin auf der Suche nach Gyms,
              die <strong>noch keine Software nutzen</strong> oder <strong>nicht ganz zufrieden</strong> mit
              ihrer vorhandenen sind."
            </p>
            <p className="text-xs text-emerald-700 mt-1 mb-3 italic">[2 Sek Pause — du wartest auf Reaktion. Stille ist dein Freund.]</p>

            <div className="text-xs text-emerald-800 mt-3 space-y-1 border-t border-emerald-200 pt-2">
              <p><strong>Warum es wirkt:</strong></p>
              <p>• <strong>Kein Pitch</strong> — du verkaufst nicht, du suchst Fit</p>
              <p>• <strong>Zwei klare Personas</strong> — er weiß sofort ob er gemeint ist</p>
              <p>• <strong>„Nicht ganz zufrieden"</strong> öffnet den Dialog auch bei Eversports/Magicline-Nutzern</p>
              <p>• <strong>Keine Knappheit am Anfang</strong> — die kommt erst wenn klar ist dass er passt</p>
              <p>• <strong>Klare Reaktions-Aufforderung</strong> — er muss „Ja/Nein/Mehr Info?" antworten</p>
            </div>

            <div className="mt-3 bg-white rounded-lg p-2 border border-emerald-200 text-xs text-zinc-700">
              <p className="font-bold text-emerald-900 mb-1">→ Wenn er reagiert mit „Ja, erzähl mehr":</p>
              <p>Geh in Tab <strong>Fit-Check</strong> → die 3 Fragen (Größe, aktuelle Lösung, Setup-Bereitschaft).</p>
              <p className="font-bold text-emerald-900 mb-1 mt-2">→ Wenn er sagt „Wir nutzen X und sind happy":</p>
              <p>Tab <strong>Einwände</strong> → Empfehlungs-Frage stellen.</p>
              <p className="font-bold text-emerald-900 mb-1 mt-2">→ Wenn er ablehnt:</p>
              <p>Tab <strong>Tschüss</strong> → sauber auflegen, Status „Kein Fit".</p>
            </div>
          </div>

          {/* ALTERNATIVE 1 — kürzer */}
          <details className="bg-white rounded-lg border border-amber-200">
            <summary className="cursor-pointer p-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Alternative · Ultra-kurz (für viel-beschäftigte Coaches)
            </summary>
            <div className="px-3 pb-3 space-y-2 text-sm">
              <p className="italic">
                „Hallo, ich bin Lom-Ali Imadaev. Ich habe eine Software für Kampfsport-Gyms entwickelt
                und suche 3 Pilot-Gyms zum kostenlosen Testen. Wäre das was für euch?"
              </p>
              <p className="text-xs text-zinc-600">
                → 8 Sek. Maximal effizient. Wenn er „erzähl mehr" sagt, gehst du in die Diagnose.
              </p>
            </div>
          </details>

          {/* ALTERNATIVE 2 — mit Empfehlungs-Hinweis */}
          <details className="bg-white rounded-lg border border-amber-200">
            <summary className="cursor-pointer p-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Alternative · Empfehlungs-Trigger (wenn er nicht passt)
            </summary>
            <div className="px-3 pb-3 space-y-2 text-sm">
              <p className="italic">
                „Hallo, ich bin Lom-Ali Imadaev. Ich suche gerade 3 Pilot-Gyms, die meine Software
                für Kampfsport 6 Monate gratis testen. <strong>Falls das nichts für euch ist —
                kennt ihr vielleicht ein Gym, dem das gerade weiterhelfen würde?</strong>"
              </p>
              <p className="text-xs text-zinc-600">
                → Niedrigere Schwelle. Selbst bei „nicht für uns" gewinnst du potenziell eine
                Empfehlung.
              </p>
            </div>
          </details>
        </>
      )}

      <div className="text-xs text-zinc-700 bg-rose-50 rounded p-2 mt-2 space-y-1 border border-rose-200">
        <p className="font-bold text-rose-800">⚠️ NIE in den ersten 15 Sekunden:</p>
        <p>❌ „Hätten Sie vielleicht Interesse..." — bittstellerig</p>
        <p>❌ „Entschuldigen Sie die Störung" — Schwäche signalisieren</p>
        <p>❌ „Ich bin Solo-Founder und brauche..." — du bittest nicht um Mitleid</p>
        <p>❌ „Ich will Ihnen nichts verkaufen" — klassische Floskel</p>
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Discovery({ primarySport }: { primarySport: string }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🩺 ZIEL: 60 Sek Fit-Check. Passt der Gym als Pilot? Wenn nicht → DQ.
      </div>

      <p className="text-xs text-zinc-700">
        Du bist nicht der Bittsteller — du <strong>prüfst, ob ER reinpasst</strong>. Pilot-Plätze
        sind knapp.
      </p>

      {/* FRAGE 1 — Größe / Aktivität */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-amber-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          1️⃣ Größe & Aktivität (Fit-Check 1)
        </p>
        <p className="italic text-sm">
          „Wie groß seid ihr ungefähr — Mitgliederzahl, Stundenplan, paar Trainer?"
        </p>
        <div className="text-xs text-zinc-600 mt-2 space-y-0.5">
          <p>→ <strong>20-150 Mitglieder</strong> = ✅ idealer Pilot-Sweet-Spot</p>
          <p>→ <strong>&lt;20 Mitglieder</strong> = ⚠️ wenig Daten zum Testen</p>
          <p>→ <strong>&gt;200 Mitglieder</strong> = ⚠️ Migration komplex, ggf. zu groß</p>
        </div>
      </div>

      {/* FRAGE 2 — aktuelle Lösung */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-amber-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          2️⃣ Was nutzt ihr aktuell? (Migration-Aufwand klären)
        </p>
        <p className="italic text-sm">
          „Mit was verwaltet ihr aktuell — Excel, Eversports, Magicline, oder gar nichts?"
        </p>
        <div className="text-xs text-zinc-600 mt-2 space-y-0.5">
          <p>→ <strong>„Excel / nichts"</strong> = 🔥 perfekt — Migration trivial</p>
          <p>→ <strong>„Eversports / Magicline"</strong> = ⚠️ Switching-Costs hoch — wirklich offen?</p>
          <p>→ <strong>„Spezial-Tool"</strong> = nachfragen welches</p>
        </div>
      </div>

      {/* FRAGE 3 — Bereitschaft */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-amber-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          3️⃣ Setup-Bereitschaft (Pilot-Commit-Check)
        </p>
        <p className="italic text-sm">
          „Wenn das passt: Wärst du bereit, 1-2 Stunden Setup mit mir zu machen — Daten importieren,
          Trainer einrichten, alles?"
        </p>
        <div className="text-xs text-zinc-600 mt-2 space-y-0.5">
          <p>→ <strong>„Klar, kein Problem"</strong> = ✅ echtes Commitment</p>
          <p>→ <strong>„Hmm, viel Aufwand..."</strong> = ⚠️ wird&apos;s nicht durchziehen</p>
          <p>→ <strong>„Nur wenn schnell geht"</strong> = ✅ ehrlich, Versprechen halten</p>
        </div>
      </div>

      {/* Sport-spezifische Bonus-Frage */}
      {(primarySport === 'bjj' || primarySport === 'judo' || primarySport === 'karate' || primarySport === 'taekwondo') && (
        <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
            🥋 Bonus für {primarySport.toUpperCase()} (Fit-Boost)
          </p>
          <p className="italic text-xs">
            „Tracked ihr Belt-Promotions — also wer wann welchen Streifen oder Grad bekommen hat?"
          </p>
          <p className="text-xs text-zinc-600 mt-1">→ Wenn ja: <strong>perfektes Pilot-Match</strong> (das ist Osss&apos; Killer-Feature).</p>
        </div>
      )}

      <div className="bg-rose-50 rounded-lg p-3 border border-rose-200 mt-3">
        <p className="font-bold text-rose-900 text-xs uppercase tracking-wide mb-1">🚪 Wenn nach 3 Fragen kein Fit:</p>
        <p className="text-sm text-rose-900">
          Tab <strong>„Tschüss"</strong>. Sag: „Klingt als wären wir aktuell nicht der richtige
          Fit fürs Pilot-Programm. Danke für deine Offenheit!" Auflegen. Status: „Kein Fit".
        </p>
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function PilotDeal({ primarySport }: { primarySport: string }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🎯 ZIEL: in 60 Sek den Pilot-Deal erklären. Knappheit. Wert. Verpflichtung.
      </div>

      <p className="text-xs text-zinc-700">
        Sag NUR diese Punkte — nicht mehr. Keine Feature-Liste, keine Demo-Versuch am Telefon.
      </p>

      <div className="bg-white rounded-lg p-3 border-l-4 border-emerald-400 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          📋 Was im Pilot-Programm enthalten ist
        </p>

        <p className="italic text-sm">
          „Cool — dann erkläre ich kurz wie das Pilot-Programm funktioniert:"
        </p>

        <div className="space-y-2 text-sm">
          <p>
            <strong>1. Du bekommst 6 Monate volle Software gratis</strong> — Mitgliederverwaltung,
            SEPA-Lastschrift, Belt-Tracking{primarySport && primarySport !== 'default' ? ` (${primarySport.toUpperCase()}-konfiguriert)` : ''},
            DATEV-Export, Mitglieder-Portal, alles.
          </p>
          <p>
            <strong>2. Ich richte alles persönlich ein</strong> — wir machen 1-2 Stunden Setup-Call,
            ich migriere deine Daten, schule dich. Kein Self-Service.
          </p>
          <p>
            <strong>3. Im Gegenzug:</strong> 3-4 Feedback-Calls à 20 Min über die 6 Monate. Ehrliches
            Feedback — was funktioniert, was nervt, was fehlt.
          </p>
          <p>
            <strong>4. Nach 6 Monaten</strong> entscheidest du frei: weitermachen für 49 €/Monat
            (oder 39 € im Jahresabo, unbegrenzte Mitglieder), oder aufhören und alle Daten als Export mitnehmen.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
        <p className="font-bold text-amber-900 mb-1 text-sm">⚡ Wichtig zu sagen:</p>
        <p className="italic text-sm text-amber-900">
          „Ich nehm nur 3 Gyms ins Pilot-Programm — weil ich jeden persönlich einrichte und betreue.
          Wenn das passt, wäre der nächste Schritt ein 30-Min-Setup-Termin diese oder nächste Woche.
          <strong>Was sagst du?</strong>"
        </p>
      </div>

      <div className="bg-rose-50 rounded-lg p-3 border border-rose-200 text-sm">
        <p className="font-bold text-rose-900 mb-1">⛔ NICHT machen:</p>
        <ul className="text-rose-900 list-disc pl-5 space-y-0.5">
          <li>Feature-für-Feature-Liste runterleiern</li>
          <li>Vergleich mit Konkurrenz starten</li>
          <li>Tech-Details (Server, DSGVO, etc.) vorab erklären</li>
          <li>„Wenn Ihnen das gefällt..." — kein Sales-Speak</li>
        </ul>
      </div>

      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2">
        🎯 <strong>Nach dem Pitch IMMER:</strong> <em>„Was sagst du?"</em> und WARTE.
        Stille = der Punkt wo er entscheidet. Nicht reinreden.
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Objections() {
  const items: { obj: string; reply: string; tone?: 'top' }[] = [
    {
      tone: 'top',
      obj: '⭐ „Was ist der Haken? Warum gratis?" (häufigster Pilot-Einwand)',
      reply: 'Fair. Ehrliche Antwort: Ich bin Solo-Entwickler, baue das Tool nebenher zum SAP-Job. Statt 50.000€ Marketing-Budget für Werbung wähle ich 3 echte Pilot-Gyms. Ihr bekommt 6 Monate gratis + persönliches Setup, ich bekomme echtes Feedback statt Marketing-Bauchgefühl. Win-Win, kein Haken.',
    },
    {
      obj: '„Wir sind happy mit Eversports / Magicline."',
      reply: 'Cool, freut mich. Pilot-Programm ist auch nicht für Wechsler gedacht. Falls dir das passt — ich kenne aber genug Gyms die unzufrieden sind: Wer aus deinem Umfeld könnte das spannend finden? Dann hab ich meine 3 schneller voll.',
    },
    {
      obj: '„Wir machen das mit Excel — funktioniert."',
      reply: 'Excel funktioniert für vieles. Pilot ist genau für Gyms wo Excel langsam an die Grenze stößt — 50+ Mitglieder, SEPA-Themen, Belt-Tracking. Wenn ihr noch nicht da seid: kein Problem. Wenn doch: 6 Monate gratis testen, kein Risiko.',
    },
    {
      obj: '„Ich denk drüber nach / sprech mit meinem Partner."',
      reply: 'Klar. Ich nehm 3 Pilot-Gyms — wenn die voll sind, ist das Programm zu. Damit ich dich nicht ewig blocke: Wann sprichst du mit deinem Partner? Donnerstag oder eher Anfang nächste Woche? Ich melde mich dann nochmal kurz.',
    },
    {
      obj: '„Was kostet das danach?"',
      reply: '49 € pro Monat — flat, egal wie viele Mitglieder. Oder 39 €/Monat im Jahresabo (spart 120 €/Jahr). 14 Tage kostenlos testen, keine Karte nötig. Keine Plattform-Gebühr auf eure Beiträge. Aber: erst nach den 6 Pilot-Monaten — und du entscheidest dann frei.',
    },
    {
      obj: '„Schick mir Infos per Mail."',
      reply: 'Mache ich — aber ehrlich: 8-Seiten-PDF liest niemand. Ich schick 3 Sätze + Demo-Link. Welche Mail-Adresse? [Email-Adresse aufnehmen. Bei Zögern: „Lass uns gleich einen 15-Min-Setup-Termin machen, ist effizienter."]',
    },
    {
      obj: '„Wer steht dahinter? Ist das ein großes Unternehmen?"',
      reply: 'Solo-Entwickler, ich allein. SAP-Berater im Hauptberuf, baue Osss nebenher. Heißt: kein Investor-Druck, kein Burn, kein Sales-Mitarbeiter. Du redest direkt mit dem Coder — wenn dir was fehlt, baue ich&apos;s in 1-2 Tagen.',
    },
    {
      obj: '„Datenschutz / DSGVO?"',
      reply: 'Daten in der EU/UK (London, EU-Angemessenheitsbeschluss). DSGVO-Export pro Mitglied. AVV ist im Dashboard elektronisch unterzeichenbar — kein Papierkram. Beim Pilot-Setup machen wir den AVV in 2 Minuten zusammen.',
    },
    {
      obj: '„Was wenn das Ding pleite geht?"',
      reply: 'Faire Frage. CSV + JSON-Export jederzeit, du nimmst alles mit. Plus: keinen Investor, keinen Burn — ich kann nicht „pleite gehen" wie ein VC-Startup. Bin auch in 5 Jahren noch da.',
    },
    {
      obj: '„Bin gerade im Training / hab keine Zeit."',
      reply: 'Klar — passt 17:00 oder 19:30 zum Zurückrufen? [Konkreter Slot. „Ich melde mich" → Nein. „Ich rufe um 19:30" → Ja.]',
    },
    {
      obj: '„Kein Interesse." (sofort, ohne Begründung)',
      reply: 'Verstehe, kein Stress. Falls du jemanden kennst dem das Pilot-Programm helfen würde: ich nehm Empfehlungen gerne. Ansonsten: Tschüss und alles Gute. [Auflegen. Status: Kein Fit.]',
    },
    {
      obj: '„Wer hat Ihnen meine Nummer gegeben?"',
      reply: 'Google Maps — ihr seid öffentlich gelistet. Ich rufe direkt an, statt teure Lead-Anbieter zu nutzen. Falls dich das stört, lege ich auf, kein Problem.',
    },
  ]

  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🛡 EINWANDBEHANDLUNG — Pilot-Mode. Knappheit + Wert hochhalten, niemals überreden.
      </div>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className={it.tone === 'top' ? 'bg-amber-50 border border-amber-200 rounded-lg p-3' : ''}>
            <div className={`font-semibold ${it.tone === 'top' ? 'text-amber-900' : 'text-rose-700'}`}>
              {it.tone === 'top' ? it.obj : `❌ ${it.obj}`}
            </div>
            <div className="italic text-zinc-700 mt-1">→ {it.reply}</div>
          </li>
        ))}
      </ul>
      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2">
        💡 <strong>Pilot-Regel</strong>: Wer überredet werden muss, ist <strong>kein guter Pilot</strong>.
        Pilot heißt Commitment. Ohne Commitment kein Setup, kein Feedback, kein Wert für dich.
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Close() {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        📅 ZIEL: Konkreter Setup-Termin diese oder nächste Woche.
      </div>

      <p className="italic">
        „Cool, dann lass uns das durchziehen. <strong>Setup-Termin: 60 Minuten Video-Call</strong>.
        Da migrieren wir deine Daten, richten Trainer ein, schalten dein Mitglieder-Portal frei.
        Danach läuft alles."
      </p>
      <p className="italic">
        „Was passt besser — eher Vormittag oder Abend?"
      </p>
      <p className="italic">
        „Ok, sagen wir <strong>Donnerstag um 19:00</strong>? Schick ich dir gleich Calendar-Invite +
        eine Email mit kurzer Vorbereitungs-Liste. Welche Mail-Adresse?"
      </p>

      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200 text-sm">
        <p className="font-bold text-emerald-900 mb-1">🎁 Pilot-Bonus erwähnen:</p>
        <p className="italic text-emerald-900">
          „Übrigens — du bist <strong>Pilot Nr. {'<2/3>'}</strong>. Wenn alles glatt läuft, kannst
          du gerne als Referenz dabei sein, wenn ich öffentlich starte. Klar nur freiwillig."
        </p>
      </div>

      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2 space-y-1">
        <p>✅ <strong>Konkreter Tag + Uhrzeit + Email</strong>. Niemals „melde mich nochmal".</p>
        <p>📝 <strong>Direkt im CRM</strong>: Status → „Demo geplant", Next Follow-up auf den Setup-Termin.</p>
        <p>📧 <strong>Innerhalb 5 Min nach Auflegen</strong>: Calendar-Invite + Vorbereitungs-Mail.</p>
        <p>📋 <strong>Vorbereitungs-Mail enthält</strong>: Mitglieder-CSV-Export-Anleitung, Stripe-Account-Hinweis, AVV-Erklärung.</p>
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Disqualify() {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🚪 SAUBER AUFLEGEN. Falscher Pilot ist schlimmer als keiner.
      </div>

      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-300">
        <p className="font-bold text-emerald-900 mb-2">✅ Warum DQ ein Sieg ist</p>
        <ul className="text-sm text-emerald-900 list-disc pl-5 space-y-1">
          <li><strong>1 falscher Pilot</strong> = 6 Monate Support-Last ohne ehrliches Feedback</li>
          <li><strong>1 sauberer DQ</strong> = du machst Platz für den richtigen Pilot</li>
          <li>Du baust Reputation als <strong>ehrlicher Anrufer</strong> auf</li>
          <li>Wer abgewiesen wurde, kann später wiederkommen — wenn der Pain echt wird</li>
        </ul>
      </div>

      <div className="bg-white rounded-lg p-3 border-l-4 border-zinc-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
          🎤 Standard-Auflegen (kein Fit)
        </p>
        <p className="italic text-sm">
          „Klingt als wären wir gerade nicht der richtige Fit fürs Pilot-Programm. Danke für deine
          Offenheit. Falls du jemanden kennst, dem das Pilot-Angebot helfen würde — ich freu mich
          über Empfehlungen. Hab einen guten Tag."
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          → Auflegen. Status: <strong>„Kein Fit"</strong>. Notiz: warum (z.B. „zu klein", „zu groß",
          „kein Migration-Commit").
        </p>
      </div>

      <div className="bg-white rounded-lg p-3 border-l-4 border-zinc-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
          🎤 „Wir testen ungerne neue Tools"
        </p>
        <p className="italic text-sm">
          „Verständlich — Pilot ist eben Commitment. Wenn das gerade nicht passt, ist das auch
          ehrlich. Falls sich was ändert: meine Mail ist oss@osss.pro. Ansonsten: alles Gute."
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          → Stimme zu. Du verteidigst den Pilot nicht — du suchst nur Fit.
        </p>
      </div>

      <div className="bg-white rounded-lg p-3 border-l-4 border-zinc-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
          🎤 „Schick mir was zum Anschauen, dann meld ich mich"
        </p>
        <p className="italic text-sm">
          „Mache ich — aber damit ich dich nicht ewig nerve: <strong>Ich melde mich NICHT von alleine
          wieder.</strong> Falls du nach dem Anschauen Lust hast, ruf direkt durch. Tschüss."
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          → Reverse-Reciprocity. Status: <strong>„Nicht kontaktieren"</strong>. Eine 3-Satz-Mail
          schicken, dann Funkstille.
        </p>
      </div>

      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm">
        <p className="font-bold text-amber-900 mb-1">📊 Nach dem Auflegen — sofort im CRM:</p>
        <ol className="list-decimal pl-5 text-amber-900 space-y-0.5">
          <li>Status auf <strong>„Kein Fit"</strong> oder <strong>„Nicht kontaktieren"</strong></li>
          <li>Notiz: was war der Hauptgrund? („zu klein", „happy mit X", „kein Setup-Commit")</li>
          <li>Wenn er Empfehlung andeutete: in Notes festhalten, später nachfragen</li>
          <li>Nächsten Lead ziehen, weiter</li>
        </ol>
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Voicemail({ cityPart }: { cityPart: string }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        📞 Maximal 25 Sekunden. Knappheit. Konkrete Frage. Keine zweite Mailbox.
      </div>
      <p className="italic">
        „Hi, hier ist Lom-Ali Imadaev. Ich hab eine Software für Kampfsport-Gyms entwickelt
        und suche gerade <strong>3 Pilot-Gyms{cityPart}</strong> für 6 Monate kostenloses Testen.
        Falls das interessant klingt: ruf zurück unter <strong>[deine Nummer]</strong>. Ansonsten:
        kein Stress, ich melde mich nicht nochmal."
      </p>
      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2 space-y-1">
        <p>✅ Direkt nach Mailbox: <strong>Activity-Log „Voicemail"</strong>, Status auf „Kontaktiert".</p>
        <p>✅ Nicht zweimal die gleiche Mailbox besprechen — wirkt aufdringlich.</p>
        <p>✅ Bei Rückruf: Tab „Pilot-Anfrage" — du beginnst frisch wie beim ersten Mal.</p>
      </div>
    </>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function pickPrimarySport(sports: string[]): string {
  if (!sports || sports.length === 0) return 'default'
  const priority = ['bjj', 'jiu-jitsu', 'judo', 'mma', 'muay thai', 'kickbox', 'boxen', 'karate', 'taekwondo']
  for (const p of priority) {
    if (sports.some(s => s.includes(p))) {
      if (p === 'jiu-jitsu' || p === 'jiu jitsu') return 'bjj'
      if (p === 'muay thai') return 'muay-thai'
      if (p === 'kickbox') return 'kickbox'
      return p
    }
  }
  return 'default'
}
