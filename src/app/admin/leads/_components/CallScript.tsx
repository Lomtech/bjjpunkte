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
  { id: 'mindset',    label: 'Mindset',    icon: '🧠' },
  { id: 'opener',     label: 'Einstieg',   icon: '👋' },
  { id: 'discovery',  label: 'Diagnose',   icon: '🩺' },
  { id: 'pitch',      label: 'Wedge',      icon: '🎯' },
  { id: 'objections', label: 'Einwände',   icon: '🛡' },
  { id: 'close',      label: 'Termin',     icon: '📅' },
  { id: 'dq',         label: 'Tschüss',    icon: '🚪' },
  { id: 'voicemail',  label: 'Mailbox',    icon: '📞' },
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
          📋 Anruf-Skript
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
            {phase === 'opener'     && <Opener lead={lead} cityPart={cityPart} primarySport={primarySport} returning={isReturningCall} />}
            {phase === 'discovery'  && <Discovery primarySport={primarySport} />}
            {phase === 'pitch'      && <Pitch primarySport={primarySport} />}
            {phase === 'objections' && <Objections />}
            {phase === 'close'      && <Close />}
            {phase === 'dq'         && <Disqualify />}
            {phase === 'voicemail'  && <Voicemail cityPart={cityPart} />}
          </div>

          <div className="text-xs text-amber-800/80">
            💡 <strong>Goldene Regel</strong>: Disqualifizieren ist kein Versagen, es ist Effizienz.
            9 saubere DQs in einer Stunde sind besser als 1 lauwarme Demo, die nie konvertiert.
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
        🧠 30 Sekunden Pre-Call. Lies das BEVOR du wählst.
      </div>

      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
        <p className="font-bold text-zinc-900 mb-2">Du rufst nicht an, um zu verkaufen.</p>
        <p className="text-sm text-zinc-700 mb-2">
          Du rufst an, um in 90 Sekunden zu erkennen, ob hier <strong>echte Schmerzen</strong> existieren.
          Wenn ja → Demo-Termin. Wenn nein → höflich auflegen.
        </p>
        <p className="text-sm text-zinc-700">
          <strong>Disqualifizieren ist KEIN Versagen.</strong> Es ist die einzige Art, in 1 Stunde
          10 Leads zu bewerten statt 3 zu überreden.
        </p>
      </div>

      <div className="bg-rose-50 rounded-lg p-3 border border-rose-200">
        <p className="font-bold text-rose-900 mb-2 text-xs uppercase tracking-wide">⚠️ Realitäts-Check</p>
        <p className="text-sm text-rose-900 mb-1.5">
          <strong>9 von 10 sagen „kein Bedarf" oder „Lösungen wie Sand am Meer".</strong>
          Das ist kein Skill-Problem — das ist der Markt. Gesättigt + hohe Switching-Costs.
        </p>
        <p className="text-sm text-rose-900">
          → Akzeptiere das. Streite NIE dagegen an. Spare deine Energie für die 10. Person, die echten
          Pain hat.
        </p>
      </div>

      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
        <p className="font-bold text-emerald-900 mb-2 text-xs uppercase tracking-wide">✅ Dein Ziel pro Anruf</p>
        <ul className="text-sm text-emerald-900 space-y-1 list-disc pl-5">
          <li><strong>1 spezifischen Pain</strong> rausbekommen (was nervt konkret?)</li>
          <li>Wenn Pain echt → <strong>Demo-Termin</strong> setzen</li>
          <li>Wenn Pain null → <strong>sauber Tschüss</strong> in 30 Sek</li>
          <li><strong>NIEMALS</strong>: überreden, argumentieren, „aber wir können doch…"</li>
        </ul>
      </div>

      <div className="text-xs text-zinc-500 italic">
        Atemübung vor dem Wählen: 4 Sek ein, 4 halten, 6 aus. Stimme wird ruhiger, kein Verkaufston.
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Opener({ lead, cityPart, primarySport, returning }: { lead: Lead; cityPart: string; primarySport: string; returning: boolean }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        ⏱ ZIEL: 10 Sekunden. Nicht-invasive Struktur-Frage. Permission impliziert.
      </div>

      {returning ? (
        <p className="italic">
          „Hi, Lom hier. Wir hatten kurz Kontakt zu <strong>{lead.name}</strong>{cityPart}.
          Hattest du Zeit drüber nachzudenken — oder ist es gerade einfach zu viel?"
        </p>
      ) : (
        <>
          {/* PRIMARY OPENER — 3-Fragen-Sequenz in Sie-Form */}
          <div className="bg-emerald-50 rounded-lg p-3 border-2 border-emerald-300">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-2">
              🎯 PRIMÄR · 3-Fragen-Diagnose-Sequenz (Sie-Form, je 1 Frage pro Atemzug)
            </p>

            <p className="italic text-base leading-relaxed font-medium text-zinc-900">
              „Hallo, ich bin Lom-Ali Imadaev. Kurze Frage."
            </p>
            <p className="text-xs text-emerald-700 mt-1 mb-3 italic">[2 Sek Pause — er weiß, jetzt kommt was Konkretes.]</p>

            <div className="space-y-3 mt-3 border-t border-emerald-200 pt-3">
              {/* Frage 1 */}
              <div className="bg-white rounded p-3 border-l-4 border-emerald-500">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Frage 1 · Tool oder manuell? (binär, nicht-invasiv)</p>
                <p className="italic text-sm">
                  „Haben Sie ein Tool für die Mitgliederverwaltung — oder machen Sie das manuell?"
                </p>
                <p className="text-xs text-zinc-500 mt-1">[Antwort abwarten. Nicht selbst weiterreden.]</p>
              </div>

              {/* Frage 2 */}
              <div className="bg-white rounded p-3 border-l-4 border-emerald-500">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Frage 2 · Quantifizieren (Stunden = Pain in Zahl)</p>
                <p className="italic text-sm">
                  „Und wie viele Stunden kostet Sie das in der Woche, ungefähr?"
                </p>
                <p className="text-xs text-zinc-500 mt-1">[Erwarte: 1, 2, 5, 10. Notieren!]</p>
              </div>

              {/* Frage 3 */}
              <div className="bg-white rounded p-3 border-l-4 border-emerald-500">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Frage 3 · Emotion-Trigger (echter Pain kommt raus)</p>
                <p className="italic text-sm">
                  „Was machen Sie davon <strong>besonders ungern</strong>?"
                </p>
                <p className="text-xs text-zinc-500 mt-1">[ZUHÖREN. Seine exakten Worte notieren — du nutzt sie später im Pitch.]</p>
              </div>
            </div>

            <div className="text-xs text-emerald-800 mt-3 space-y-1 border-t border-emerald-200 pt-2">
              <p className="font-semibold">⚡ Wichtig zum Vortrag:</p>
              <p>• Sage <strong>NICHT</strong> alle 3 Fragen auf einmal — er hört sonst nur die letzte</p>
              <p>• <strong>Eine Frage, Pause, Antwort, dann nächste Frage</strong></p>
              <p>• Bei jeder Antwort: 2 Sek warten, „mhm" / „verstehe" — keine Pitches</p>
              <p>• Nach Frage 3 entweder direkt Wedge-Pitch (wenn Pain echt) oder DQ (wenn null Pain)</p>
            </div>

            <div className="text-xs text-emerald-700 mt-3 bg-emerald-100/50 rounded p-2 space-y-1.5">
              <p className="font-bold text-emerald-900">Antwort-Pfade nach Frage 1:</p>
              <p>→ <strong>„Tool [Name]"</strong>: weiter mit Frage 2 + 3. Bei Frage 3 hörst du Frust mit dem Tool → Wedge.</p>
              <p>→ <strong>„Manuell / Excel"</strong> = 🔥 HEISS. Frage 2 + 3, dann konkreter Pain-Calc.</p>
              <p>→ <strong>„Trainer / Steuerberater"</strong>: „Wie zufrieden sind Sie damit?"</p>
              <p>→ <strong>„Wer sind Sie eigentlich?"</strong>: „Ich baue Software für Kampfsport-Gyms. Frage gerade Coaches durch um zu verstehen, wo&apos;s wehtut. Kein Verkauf — nur die Fragen."</p>
              <p>→ <strong>„Geht Sie nichts an"</strong> = DQ. „Verstehe, kein Stress. Auf Wiederhören." Auflegen.</p>
            </div>
          </div>

          {/* ALTERNATIVE 1 — Story-First (für Boomer-Skeptiker) */}
          <details className="bg-white rounded-lg border border-amber-200">
            <summary className="cursor-pointer p-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Alternative · Story-First (sanfter, für skeptische Coaches)
            </summary>
            <div className="px-3 pb-3 space-y-2 text-sm">
              <p className="italic">
                „Hi, Lom hier. Ich rufe gerade Kampfsport-Gyms in DACH durch — <strong>{lead.name}</strong>
                {cityPart} ist bei mir auf der Liste. 30 Sekunden, dann legst du auf — fair?"
              </p>
              <p className="italic">
                [Auf „ja" warten.] „Ich rede gerade mit vielen Coaches. Die meisten sagen mir,
                dass die Mitgliederverwaltung mehr Zeit frisst als sie geben kann. Bei dir auch ein
                Thema — oder schon gut gelöst?"
              </p>
            </div>
          </details>

          {/* ALTERNATIVE 2 — Belt-Pain (sport-conditional) */}
          {(primarySport === 'bjj' || primarySport === 'judo' || primarySport === 'karate' || primarySport === 'taekwondo') && (
            <details className="bg-white rounded-lg border border-amber-200">
              <summary className="cursor-pointer p-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Alternative · Belt-Tracking ({sportLabel(lead.sports)}-spezifisch, emotionaler Pain)
              </summary>
              <p className="italic text-sm px-3 pb-3 leading-relaxed">
                „Hi, ich bin Lom-Ali Imadaev. Kurze Frage: <strong>Wie tracked ihr eigentlich die
                Belt-Promotions — Excel, Whiteboard, oder im Kopf?</strong>"
              </p>
            </details>
          )}

          {/* ALTERNATIVE 3 — Honest-Outsider (max. Ehrlichkeit) */}
          <details className="bg-white rounded-lg border border-amber-200">
            <summary className="cursor-pointer p-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Alternative · Honest-Outsider (für Skeptiker)
            </summary>
            <p className="italic text-sm px-3 pb-3 leading-relaxed">
              „Hi, ich ruf direkt durch — ehrlich: ich rufe bei Kampfsport-Gyms an die ich auf Google
              gefunden habe. Eine einzige Frage, 30 Sekunden, <strong>danach hörst du nie wieder von
              mir wenn&apos;s nicht passt</strong>. Frage: machst du die Mitgliederverwaltung allein
              oder hast du Hilfe?"
            </p>
          </details>
        </>
      )}

      <div className="text-xs text-zinc-700 bg-rose-50 rounded p-2 mt-2 space-y-1 border border-rose-200">
        <p className="font-bold text-rose-800">⚠️ NIE in den ersten 8 Sekunden:</p>
        <p>❌ „Ich baue eine Software für Kampfsport…" → Defense-Reflex sofort aktiv</p>
        <p>❌ „Ich will Ihnen nichts verkaufen" → klassische Sales-Floskel</p>
        <p>❌ „Ich frage, ob es Bedarf am Markt gibt" → Marktforscher-Vibe</p>
        <p>❌ „Wie viele Mitglieder zahlen nicht?" → zu privat, sofort dicht</p>
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Discovery({ primarySport }: { primarySport: string }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🩺 ZIEL: 90 Sekunden Diagnose. Wenn nach 3 Fragen NULL Pain → Tab „Tschüss".
      </div>

      <p className="text-xs text-zinc-700">
        Folge dem natürlichen Gesprächsfluss. <strong>Eine Frage gleichzeitig, 2 Sekunden Pause</strong>,
        zuhören, „mhm" / „verstehe" — sonst NICHTS dazu sagen.
      </p>

      {/* FRAGE 1 — Folge aus Opener */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-amber-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          1️⃣ Konkretisieren: Stunden / Frequenz
        </p>
        <p className="italic text-sm">
          „Wie viele Stunden gehen pro Woche dafür drauf, ungefähr?"
        </p>
        <div className="text-xs text-zinc-600 mt-2 space-y-0.5">
          <p>→ <strong>„2-3h"</strong> = LAUWARM — Pain ist da, aber nicht groß genug</p>
          <p>→ <strong>„5h+"</strong> = WARM — Pain echt, weiter</p>
          <p>→ <strong>„10h+"</strong> = 🔥 HEISS — direkter Demo-Kandidat</p>
          <p>→ <strong>„keine Ahnung"</strong> = LAUWARM — Pain wird nicht spürbar gemessen</p>
        </div>
      </div>

      {/* FRAGE 2 — der echte Pain */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-amber-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          2️⃣ Emotion-Trigger: was nervt am meisten?
        </p>
        <p className="italic text-sm">
          „Was ist eine Sache, die du <strong>besonders ungern</strong> machst?"
        </p>
        <div className="text-xs text-zinc-600 mt-2 space-y-0.5">
          <p>→ Konkrete Antwort („Mahnungen", „SEPA-Stornos", „Datev-Übergabe") = <strong>Goldader</strong></p>
          <p>→ „Eigentlich nichts" = DQ-Signal</p>
          <p>→ Sport-conditional Bonus für {primarySport.toUpperCase()}: „Wie tracked ihr Belt-Promotions?"</p>
        </div>
        <div className="bg-amber-50 rounded p-2 mt-2 text-xs text-amber-900">
          <strong>📝 SEINE EXAKTEN WORTE NOTIEREN!</strong> Du nutzt sie später im Pitch.
          Wenn er „Mahnungen sind anstrengend" sagt → du sagst: „Genau für anstrengende Mahnungen…"
        </div>
      </div>

      {/* FRAGE 3 — wie viel kostet's? */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-amber-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          3️⃣ Pain in Geld umrechnen
        </p>
        <p className="italic text-sm">
          „Wenn du das in Stunden hochrechnest — wie viel ist das im Jahr? 50, 100 Stunden?"
        </p>
        <div className="bg-amber-50 rounded p-2 mt-2 text-xs text-amber-900 space-y-1">
          <p className="font-bold">💰 Pain-Calc (sage ihm das Zahl-Argument):</p>
          <p>2 h/Woche × 50 Wochen × 50 €/h = <strong>5.000 €/Jahr</strong></p>
          <p>5 h/Woche × 50 Wochen × 50 €/h = <strong>12.500 €/Jahr</strong></p>
          <p>→ <strong>„Osss kostet 0–99 €/Monat. Du sparst Faktor 5–10× deine Lebenszeit."</strong></p>
        </div>
      </div>

      <div className="bg-rose-50 rounded-lg p-3 border border-rose-200 mt-3">
        <p className="font-bold text-rose-900 text-xs uppercase tracking-wide mb-1">🚪 Wenn nach 3 Fragen NULL Pain:</p>
        <p className="text-sm text-rose-900">
          Tab <strong>„Tschüss"</strong> öffnen. Sage: „OK, dann seid ihr wirklich gut versorgt.
          Danke für deine Ehrlichkeit." → AUFLEGEN. Status: „Kein Fit". Nächster Lead.
        </p>
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Pitch({ primarySport }: { primarySport: string }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🎯 WEDGE statt Komplettverkauf. Lösung für EIN Problem, nicht „wechselt zu Osss".
      </div>

      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm">
        <p className="font-bold text-amber-900 mb-1">🪓 Strategie</p>
        <p className="text-amber-900">
          Die meisten haben schon ein Tool. Wechsel ist teuer. <strong>Verkaufe NICHT</strong>{' '}
          „wechselt zu Osss" — biete einen <strong>EINZELNEN Pain-Fix</strong>, der ergänzt.
        </p>
      </div>

      {/* Wedge 1 — DATEV */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-emerald-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
          🪓 Wedge 1 · DATEV-Pain (Steuerberater-Übergabe)
        </p>
        <p className="italic text-sm">
          „Wir haben einen DATEV-Export, der wirklich für deinen Steuerberater funktioniert.
          <strong> Du musst dafür nicht von [aktuelles Tool] wechseln</strong>. Du exportierst
          deine Beiträge als CSV, mein Tool macht dir DATEV draus. 5 Minuten Setup. Soll ich dir
          einen Login schicken?"
        </p>
      </div>

      {/* Wedge 2 — Belt (sport-conditional) */}
      {(primarySport === 'bjj' || primarySport === 'judo' || primarySport === 'karate' || primarySport === 'taekwondo') && (
        <div className="bg-white rounded-lg p-3 border-l-4 border-emerald-400">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
            🪓 Wedge 2 · Belt-Tracking ({primarySport.toUpperCase()}-spezifisch)
          </p>
          <p className="italic text-sm">
            „Belt-Tracking ist genau mein Thema. Hab das gebaut weil ich es selbst trainiere.
            Promotion-History pro Mitglied, mit Datum, Trainer, Notes. <strong>Bis 30 Mitglieder
            kostet das nichts.</strong> Soll ich dir den Free-Account schicken?"
          </p>
        </div>
      )}

      {/* Wedge 3 — Zeit-Pain */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-emerald-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
          🪓 Wedge 3 · Zeit-Argument (mit konkreten €-Zahlen aus Diagnose)
        </p>
        <p className="italic text-sm">
          „Bei deinen {'<X>'} Stunden pro Woche × 50 Wochen × 50 €/h = ungefähr {'<Y>'} € im Jahr,
          die du in Verwaltung steckst statt Training. Mein Tool kostet 29 €/Monat = 348 €/Jahr.
          <strong> Du sparst {'<Z>'} € pro Jahr deiner Lebenszeit.</strong> Wenn du willst, mach
          ich dir 5 Min Demo, du entscheidest danach."
        </p>
      </div>

      {/* Wedge 4 — Komplett-Wechsel (selten) */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-zinc-300">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
          🪓 Wedge 4 · Komplett-Wechsel (NUR bei echtem Frust mit aktuellem Tool)
        </p>
        <p className="italic text-sm">
          „Klingt als wärst du wirklich unzufrieden mit {'<aktuelles Tool>'}. Lass uns kurz drüber
          sprechen ob ein Wechsel überhaupt Sinn macht — kein Verkauf, ich frag dich konkret was
          funktionieren muss. 15 Minuten morgen oder Donnerstag?"
        </p>
      </div>

      <div className="bg-rose-50 rounded-lg p-3 border border-rose-200 text-sm">
        <p className="font-bold text-rose-900 mb-1">⛔ NIE pitchen ohne Pain</p>
        <p className="text-rose-900">
          Wenn aus den 3 Diagnose-Fragen <strong>kein konkreter Pain</strong> rausgekommen ist:
          gehe NICHT in den Pitch. Direkt auf Tab „Tschüss". Pitchen ohne Pain = du klingst wie
          Verkäufer. Mit Pain = du klingst wie Lösung.
        </p>
      </div>

      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2">
        🎯 <strong>Nach Wedge-Pitch IMMER:</strong> <em>„Macht das für dich Sinn?"</em> und WARTE.
        Stille = der Punkt wo der Lead entscheidet. Nicht reinreden!
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Objections() {
  const items: { obj: string; reply: string; tone?: 'top' }[] = [
    {
      tone: 'top',
      obj: '⭐ „Wir brauchen nichts." / „Lösungen wie Sand am Meer." (häufigster Einwand!)',
      reply: 'Du hast völlig recht — der Markt ist voll. Eine letzte Frage und ich lege auf: Was nervt dich aktuell am meisten an dem was ihr habt — oder läuft wirklich alles glatt? … [Wenn ECHT „läuft alles glatt" → Tab Tschüss, sauber Auflegen. Wenn jetzt doch Pain rauskommt → „Ah ok, genau das löse ich. 5 Min Demo wenn du magst — sonst kein Stress, kein Follow-up."]',
    },
    {
      obj: '„Kein Interesse." (sofort, ohne Erklärung)',
      reply: 'Verstehe. Letzte Frage und ich lege auf: Wenn du EINE Sache an deiner Mitgliederverwaltung ändern könntest — was wäre das? … [Zuhören. Wenn echt: „Genau das löst mein Tool. 5 Minuten zeigen?" Wenn null Pain: Tab Tschüss.]',
    },
    {
      obj: '„Bin gerade im Training / habe keine Zeit."',
      reply: 'Klar — passt 17:00 oder eher 19:30 besser zum Zurückrufen? [Zwei konkrete Slots geben, nie offen lassen. „Ich melde mich" → Nein. „Ich rufe um 19:30 zurück" → Ja.]',
    },
    {
      obj: '„Schick mir Infos per Mail."',
      reply: 'Mache ich — aber ehrlich: ich schick keine 8-seitige PDF die du nie liest. 3 Sätze + 1 Link, 60 Sekunden zum Lesen. Welche Mail-Adresse?',
    },
    {
      obj: '„Wir sind happy mit Eversports / Magicline."',
      reply: 'Cool, freut mich. Was funktioniert da besonders gut für euch? … [ZUHÖREN — keine Argumente bauen!]. Und gibt&apos;s irgendwas wo du dir was wünschen würdest? … [Hier kommt der Pain. Wenn ja → „Genau das hab ich anders gelöst, 5 Min Demo?". Wenn nein → „OK, dann seid ihr gut versorgt. Tschüss."]',
    },
    {
      obj: '„Wir machen das mit Excel — funktioniert."',
      reply: 'Versteh ich — Excel ist gratis und niemand redet rein. Frage: Was passiert wenn am 5. eine SEPA-Lastschrift platzt? Wie merkst du das? Manuell oder automatisch? … [Wenn manuell → „Da liegt mein Tool 80 € im Monat günstiger als deine Lebenszeit." Wenn automatisch → „Welches Tool nutzt du dann? Vielleicht passt meines gar nicht — wäre fair zu sagen."]',
    },
    {
      obj: '„Wer hat Ihnen meine Nummer gegeben?"',
      reply: 'Google Maps — ihr seid dort öffentlich gelistet, deshalb rufe ich auch direkt an statt einen Lead-Anbieter zu bezahlen. Das ist ehrlich gemeint — wenn dich das stört, lege ich auf, kein Problem.',
    },
    {
      obj: '„Wir haben kein Budget."',
      reply: 'Verstehe. Bis 30 Mitglieder ist Osss kostenlos — ihr seid wie viele? … [Wenn <30: „Dann zahlt ihr nichts. Soll ich dir trotzdem 5 Min zeigen?". Wenn >30: „Ab 50 sind&apos;s 29 €/Monat. Was kostet euch aktuell die Beitragsverwaltung an Zeit pro Monat? Multipliziert mit eurem Stundensatz?"]',
    },
    {
      obj: '„Wer steht dahinter? Ist das ein großes Unternehmen?"',
      reply: 'Solo-Founder, ich allein. SAP-Berater im Hauptberuf, baue Osss nebenher. Das heißt: kein Investor-Druck, kein Pleite-Risiko durch Burn, kein Sales-Mitarbeiter der dir hinterherrennt. Du redest direkt mit dem Coder — wenn dir was fehlt, baue ich&apos;s in 1-2 Tagen.',
    },
    {
      obj: '„Datenschutz / DSGVO?"',
      reply: 'Daten in der EU/UK (London, EU-Angemessenheitsbeschluss). DSGVO-Export pro Mitglied. AVV ist direkt im Dashboard elektronisch unterzeichenbar — kein Papierkram, kein E-Mail-Hin-und-Her.',
    },
    {
      obj: '„Was wenn das Ding pleite geht?"',
      reply: 'Faire Frage. CSV + JSON-Export jederzeit. Du nimmst alles mit. Plus: keinen Investor, keinen Burn — ich kann nicht „pleite gehen" wie ein VC-finanziertes Startup. Bin auch in 5 Jahren noch da.',
    },
    {
      obj: '„Ich denk drüber nach / sprech mit meinem Partner."',
      reply: 'Klar. Damit ich keine Folge-Mail rumschicke die du nie liest: Wann hast du wieder Zeit dafür — Donnerstag oder eher nächste Woche? [Konkreter Termin oder Auflegen, kein „Ich melde mich".]',
    },
  ]

  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🛡 EINWANDBEHANDLUNG · Wahrheit zustimmen → eine ehrliche Frage → wenn null Pain auflegen
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
        💡 <strong>Regel</strong>: Niemals direkt widersprechen. Erst zustimmen („verstehe", „gute Frage"),
        dann rückfragen, dann antworten. Wenn keine Pain rauskommt → Tab „Tschüss", nicht überreden.
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Close() {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        📅 ZIEL: konkreter Termin. Diese Woche oder nächste.
      </div>
      <p className="italic">
        „Cool, dann mach ich dir einen Vorschlag: Ich schick dir einen Demo-Link, du klickst dich in
        5 Minuten durch. Wenn dir was gefällt, machen wir 15 Minuten Video-Call. Passt das?"
      </p>
      <p className="italic">
        „Wann passt es dir besser — eher Anfang oder Ende der Woche?"
      </p>
      <p className="italic">
        „Ok, sagen wir <strong>Donnerstag um 14:00</strong>? Schick ich dir gleich eine Kalender-
        Einladung an … welche E-Mail nutzt du?"
      </p>
      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2 space-y-1">
        <p>✅ <strong>Konkreter Tag + Uhrzeit + Email</strong>. Niemals „melde mich nochmal".</p>
        <p>📝 <strong>Direkt im CRM</strong>: Status → „Demo geplant", Next Follow-up auf den Termin setzen.</p>
        <p>📧 <strong>Innerhalb 5 Min</strong>: Calendar-Invite + 3-Satz-Mail mit Demo-Link.</p>
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Disqualify() {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🚪 SAUBER AUFLEGEN. Kein Pain = kein Kunde. Spare deine Energie für den nächsten Lead.
      </div>

      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-300">
        <p className="font-bold text-emerald-900 mb-2">✅ Warum Disqualifizieren ein Sieg ist</p>
        <ul className="text-sm text-emerald-900 list-disc pl-5 space-y-1">
          <li>1 sauberer DQ in 90 Sek = 10× mehr Zeit für die nächsten 9 Leads</li>
          <li>Du baust <strong>Reputation</strong> als ehrlicher Anrufer auf — sie empfehlen dich vielleicht weiter</li>
          <li>Jeder Lead, den du nicht überredest, kann <strong>später</strong> wiederkommen wenn der Pain echt wird</li>
          <li>Überreden kostet 20+ Min und konvertiert ~3% — DQ kostet 90 Sek und schützt deine Energie</li>
        </ul>
      </div>

      <div className="bg-white rounded-lg p-3 border-l-4 border-zinc-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
          🎤 Standard-Auflegen (90% der Fälle)
        </p>
        <p className="italic text-sm">
          „OK — dann seid ihr wirklich gut versorgt. Danke dass du dir die 30 Sekunden genommen hast,
          ich respektier das. Hab einen guten Tag."
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          → Direkt auflegen. Status: <strong>„Kein Fit"</strong>. Notiz: warum (z.B. „happy mit Eversports", „kein Pain").
        </p>
      </div>

      <div className="bg-white rounded-lg p-3 border-l-4 border-zinc-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
          🎤 Wenn sie sagen „Lösungen wie Sand am Meer"
        </p>
        <p className="italic text-sm">
          „Stimmt absolut. Ich würde auch sagen: wechsel nicht ohne Grund. Wenn dir aktuell nichts
          wirklich wehtut, ist das auch keine gute Investition. Danke für deine Ehrlichkeit. Tschüss."
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          → Stimme der Realität zu. Du bist nicht der Verkäufer der überreden will. Das schafft <strong>Trust</strong>
          — wenn er später Pain bekommt, ruft er VON SICH AUS bei dir an.
        </p>
      </div>

      <div className="bg-white rounded-lg p-3 border-l-4 border-zinc-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
          🎤 „Ich werd&apos;s mir nochmal überlegen"
        </p>
        <p className="italic text-sm">
          „Klar. Eine Sache: <strong>Ich melde mich NICHT von alleine wieder.</strong> Wenn du jemals
          einen Anlass hast — Steuerberater stresst, Beitragsabrechnung killt deinen Sonntag — dann
          ruf direkt durch. Ich heb auch am Wochenende ab. Tschüss."
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          → Pattern-Interrupt: die meisten erwarten Hartnäckigkeit. Wenn du sie loslässt, bleiben sie
          hängen (Reverse-Reciprocity). Status: <strong>„Nicht kontaktieren"</strong>.
        </p>
      </div>

      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm">
        <p className="font-bold text-amber-900 mb-1">📊 Nach dem Auflegen — sofort im CRM:</p>
        <ol className="list-decimal pl-5 text-amber-900 space-y-0.5">
          <li>Status auf <strong>„Kein Fit"</strong> oder <strong>„Nicht kontaktieren"</strong></li>
          <li>Activity-Log: was war der Hauptgrund? („happy mit X", „kein Pain", „kein Budget")</li>
          <li><strong>Nicht</strong> auf „Kontaktiert" lassen — sonst landet er in deinem morgigen Follow-up-Loop</li>
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
        📞 Maximal 20 Sekunden. Konkret, Name + Rückrufnummer + 1 Hook.
      </div>
      <p className="italic">
        „Hi, hier ist Lom-Ali Imadaev. Ich rufe wegen einer kurzen Frage zur Mitgliederverwaltung an
        — ich bau gerade was speziell für Kampfsport-Gyms{cityPart}. Wenn das interessant ist:
        ruf mich zurück unter <strong>[deine Nummer]</strong>. Wenn nicht: kein Stress, melde mich
        nicht nochmal."
      </p>
      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2 space-y-1">
        <p>✅ Direkt nach Mailbox: <strong>Activity-Log „Voicemail" anlegen</strong>, Status auf
          „Kontaktiert".</p>
        <p>✅ Nicht zweimal die gleiche Mailbox besprechen — wirkt aufdringlich.</p>
        <p>✅ Bei Rückruf: <strong>Tab „Einstieg"</strong> nutzen, du beginnst von vorn.</p>
      </div>
    </>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sportLabel(sports: string[]): string {
  const primary = pickPrimarySport(sports)
  const labels: Record<string, string> = {
    bjj: 'BJJ',
    judo: 'Judo',
    mma: 'MMA',
    'muay-thai': 'Muay-Thai',
    kickbox: 'Kickbox',
    boxen: 'Box',
    karate: 'Karate',
    taekwondo: 'Taekwondo',
    default: 'Kampfsport',
  }
  return labels[primary] ?? 'Kampfsport'
}

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
