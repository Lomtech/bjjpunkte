'use client'

import { useState } from 'react'

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

type Phase = 'mindset' | 'opener' | 'discovery' | 'pitch' | 'objections' | 'close' | 'dq' | 'voicemail'

const PHASES: { id: Phase; label: string; icon: string }[] = [
  { id: 'mindset',    label: 'Mindset',       icon: '🧠' },
  { id: 'opener',     label: 'Einstieg',      icon: '👋' },
  { id: 'discovery',  label: 'Diagnose',      icon: '🩺' },
  { id: 'pitch',      label: 'Wedge',         icon: '🎯' },
  { id: 'objections', label: 'Einwände',      icon: '🛡' },
  { id: 'close',      label: 'Termin',        icon: '📅' },
  { id: 'dq',         label: 'Disqualify',    icon: '🚪' },
  { id: 'voicemail',  label: 'Mailbox',       icon: '📞' },
]

export function CallScript({ lead }: { lead: Lead }) {
  const [phase, setPhase] = useState<Phase>('mindset')
  const [showScript, setShowScript] = useState(false)

  // Personalize: detect primary sport for tailored hook
  const primarySport = pickPrimarySport(lead.sports)
  const sportHook = SPORT_HOOKS[primarySport] ?? SPORT_HOOKS.default
  const isReturningCall = lead.contact_count > 0
  const cityPart = lead.city ? ` in ${lead.city}` : ''

  return (
    <div className="bg-amber-50/50 border border-amber-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setShowScript(s => !s)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-100/60 transition-colors"
      >
        <span className="text-sm font-bold text-amber-900 flex items-center gap-2">
          📋 Anruf-Skript {isReturningCall && <span className="text-xs font-normal text-amber-700">(Folgeanruf)</span>}
        </span>
        <span className="text-amber-700 text-lg">{showScript ? '▾' : '▸'}</span>
      </button>

      {showScript && (
        <div className="p-4 pt-0 space-y-3">
          {/* Phase tabs */}
          <div className="flex gap-1 flex-wrap text-xs">
            {PHASES.map(p => (
              <button key={p.id} onClick={() => setPhase(p.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  phase === p.id
                    ? 'bg-amber-400 text-zinc-900'
                    : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}>
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          {/* Phase content */}
          <div className="bg-white border border-amber-200 rounded-lg p-3 text-sm leading-relaxed text-zinc-800 space-y-3">
            {phase === 'mindset'    && <Mindset />}
            {phase === 'opener'     && <Opener  lead={lead} sportHook={sportHook} cityPart={cityPart} returning={isReturningCall} />}
            {phase === 'discovery'  && <Discovery lead={lead} primarySport={primarySport} />}
            {phase === 'pitch'      && <Pitch lead={lead} primarySport={primarySport} />}
            {phase === 'objections' && <Objections />}
            {phase === 'close'      && <Close lead={lead} cityPart={cityPart} />}
            {phase === 'dq'         && <Disqualify />}
            {phase === 'voicemail'  && <Voicemail sportHook={sportHook} cityPart={cityPart} />}
          </div>

          <div className="text-xs text-amber-800/80">
            💡 <strong>Goldene Regel</strong>: Disqualifizieren ist kein Versagen — es ist Effizienz. 9 saubere DQs in einer Stunde sind besser als 1 lauwarme Demo, die nie konvertiert.
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────

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
          <strong>Disqualifizieren ist KEIN Versagen.</strong> Es ist die einzige Art, in 1 Stunde 10 Leads
          zu bewerten statt 3 zu überreden.
        </p>
      </div>

      <div className="bg-rose-50 rounded-lg p-3 border border-rose-200">
        <p className="font-bold text-rose-900 mb-2 text-xs uppercase tracking-wide">⚠️ Realitäts-Check</p>
        <p className="text-sm text-rose-900 mb-1.5">
          <strong>9 von 10 sagen „kein Bedarf" oder „Lösungen wie Sand am Meer".</strong>
          Das ist kein Skill-Problem. Es ist die <strong>Wahrheit</strong>: gesättigter Markt + hohe Switching-Costs.
        </p>
        <p className="text-sm text-rose-900">
          → Akzeptiere das. Streite NIE dagegen an. Spare deine Energie für die 10. Person, die ein echtes
          Problem hat.
        </p>
      </div>

      <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
        <p className="font-bold text-emerald-900 mb-2 text-xs uppercase tracking-wide">✅ Dein Ziel pro Anruf</p>
        <ul className="text-sm text-emerald-900 space-y-1 list-disc pl-5">
          <li><strong>1 spezifische Pain-Information</strong> bekommen (welches Tool, welcher Frust, welche Stunden)</li>
          <li>Wenn Pain echt → <strong>Demo-Termin</strong> setzen</li>
          <li>Wenn Pain null → <strong>sauber „Tschüss"</strong> in 30 Sekunden</li>
          <li><strong>NIEMALS</strong>: überreden, argumentieren, „aber wir können doch…"</li>
        </ul>
      </div>

      <p className="text-xs text-zinc-500 italic">
        Atemübung vor dem Wählen: 4 Sekunden ein, 4 halten, 6 aus. Stimme wird ruhiger, kein Verkaufston.
      </p>
    </>
  )
}

function Opener({ lead, sportHook, cityPart, returning }: { lead: Lead; sportHook: string; cityPart: string; returning: boolean }) {
  void sportHook
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        ⏱ ZIEL: 12 Sekunden. Permission holen → DIREKT in Diagnose-Frage übergehen.
      </div>

      {returning ? (
        <p className="italic">
          „Hi, Lom hier. Wir hatten kurz Kontakt zu <strong>{lead.name}</strong>{cityPart}.
          Hattest du Zeit drüber nachzudenken, oder ist es gerade einfach zu viel?"
        </p>
      ) : (
        <>
          {/* PRIMARY OPENER — kurz, direkt, Pain-Hook ohne Schwurbelei */}
          <div className="bg-emerald-50 rounded-lg p-3 border-2 border-emerald-300">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
              🎯 PRIMÄR · Direkt-Pain-Hook (10 Sek, brutal kurz)
            </p>
            <p className="italic text-base leading-relaxed font-medium text-zinc-900">
              „Hallo, Lom-Ali Imadaev hier. <strong>Kurze Frage</strong>: Wie viele Stunden gehen bei
              dir aktuell für die <strong>Monatsabrechnung</strong> drauf?"
            </p>
            <div className="text-xs text-emerald-800 mt-3 space-y-1 border-t border-emerald-200 pt-2">
              <p><strong>Warum es wirkt:</strong></p>
              <p>• Voller Name = seriös, nicht wie Telemarketer</p>
              <p>• &bdquo;Kurze Frage" = Pacing-Signal: er weiß, das wird nicht 10 Min</p>
              <p>• Konkrete Zahl-Frage = er muss <em>nachdenken</em>, nicht abwehren</p>
              <p>• Pattern-Interrupt: niemand erwartet so Direktheit</p>
            </div>
            <div className="text-xs text-emerald-700 mt-2 bg-emerald-100/50 rounded p-2">
              <p className="font-semibold mb-1">Mögliche Antworten + Reaktion:</p>
              <p>→ <strong>Konkrete Zahl</strong> („3-4 Stunden") = HEISS. Ab in Diagnose-Frage 2.</p>
              <p>→ <strong>„Mache ich gar nicht selbst"</strong> = WARM. Frag: „Wer macht&apos;s?"</p>
              <p>→ <strong>„Wer bist du?"</strong> = Pacing zu schnell. Sag: „Ich bau Software für Kampfsport-Gyms — frag aber gerade Coaches durch um zu verstehen wo&apos;s wehtut."</p>
              <p>→ <strong>„Geht dich nichts an"</strong> = DQ. Sag: „Verstehe, kein Stress. Tschüss." Auflegen.</p>
            </div>
          </div>

          {/* ALTERNATIVE 1 — Story-First (sanfter, für Skeptiker) */}
          <details className="bg-white rounded-lg border border-amber-200">
            <summary className="cursor-pointer p-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Alternative · Story-First (sanfter, für skeptische Boomer-Coaches)
            </summary>
            <div className="px-3 pb-3 space-y-2 text-sm">
              <p className="italic">
                „Hi, Lom hier. Ich rufe gerade Kampfsport-Gyms in DACH durch — <strong>{lead.name}</strong>
                {cityPart} ist bei mir auf der Liste. 30 Sekunden, dann legst du auf — fair?"
              </p>
              <p className="italic">
                [Auf „ja" warten.] „Ich rede gerade mit vielen Coaches über die Monatsabrechnung. Die meisten
                sagen mir &bdquo;das ist der Tag den ich hasse&ldquo;. Bei dir auch ein Thema — oder schon gut gelöst?"
              </p>
            </div>
          </details>

          {/* ALTERNATIVE 2 — 3rd-Person-Story */}
          <details className="bg-white rounded-lg border border-amber-200">
            <summary className="cursor-pointer p-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Alternative · 3rd-Person-Story (indirekt, für Defensive)
            </summary>
            <p className="italic text-sm px-3 pb-3 leading-relaxed">
              „Hi, Lom hier. Ich hab gestern mit einem {sportLabel(lead.sports)}-Coach in {lead.city || 'Hamburg'}
              gesprochen — der verbringt jeden Monatsersten ne ganze Stunde mit Beitrags-Tracking.
              <strong> Kennst du das, oder läuft das bei euch automatisch?</strong>"
            </p>
          </details>

          {/* ALTERNATIVE 3 — Honest-Outsider */}
          <details className="bg-white rounded-lg border border-amber-200">
            <summary className="cursor-pointer p-3 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Alternative · Honest-Outsider (maximale Ehrlichkeit)
            </summary>
            <p className="italic text-sm px-3 pb-3 leading-relaxed">
              „Hi, ich ruf direkt durch — ehrlich: ich rufe bei Kampfsport-Gyms an die ich auf Google
              gefunden habe. Eine einzige Frage, 30 Sekunden, <strong>danach hörst du nie wieder von
              mir wenn&apos;s nicht passt</strong>. Frage: Was nervt dich am meisten an deiner aktuellen Verwaltung?"
            </p>
          </details>
        </>
      )}

      <div className="text-xs text-zinc-700 bg-rose-50 rounded p-2 mt-2 space-y-1 border border-rose-200">
        <p className="font-bold text-rose-800">⚠️ NIE in den ersten 8 Sekunden:</p>
        <p>❌ „Ich baue eine Software für Kampfsport-Gyms…" → triggert Defense-Reflex</p>
        <p>❌ „Ich will Ihnen nichts verkaufen" → klassische Sales-Floskel, alle wissen es</p>
        <p>❌ „Ich frage ob es Bedarf am Markt gibt" → klingt wie Marktforscher, sie wimmeln dich ab</p>
        <p>❌ „Wie geht es Ihnen?" → sofortiger Aufleger</p>
      </div>
    </>
  )
}

function Discovery({ lead, primarySport }: { lead: Lead; primarySport: string }) {
  void lead
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🩺 ZIEL: 90 Sekunden Diagnose. 3 Fragen. Wenn KEIN Pain → Disqualify.
      </div>

      <p className="text-xs text-zinc-700">
        Stelle die 3 Fragen <strong>genau in dieser Reihenfolge</strong>. Nach jeder Antwort: 2 Sekunden Pause,
        zuhören, NICHTS dazu sagen außer „mhm" / „verstehe".
      </p>

      {/* FRAGE 1 — wer/wie? */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-amber-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          1️⃣ WER macht es heute?
        </p>
        <p className="italic text-sm">
          „Wer macht bei euch die Beitragsabrechnung am Monatsende — du selbst, ein Trainer, oder eine Software?"
        </p>
        <div className="text-xs text-zinc-600 mt-2 space-y-0.5">
          <p>→ <strong>„Ich selbst"</strong> = HEISS. Pain ist persönlich, du bekommst die Aufmerksamkeit.</p>
          <p>→ <strong>„Software X"</strong> = LAUWARM. Frag Frage 2 weiter, prüfe ob Frust da ist.</p>
          <p>→ <strong>„Steuerberater macht alles"</strong> = KALT. Probable DQ — kein Pain bei ihm.</p>
        </div>
      </div>

      {/* FRAGE 2 — was tut weh? */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-amber-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          2️⃣ WAS tut weh?
        </p>
        <p className="italic text-sm">
          „Was nervt dich aktuell am meisten am ganzen Beitrags-Thema — wenn du ehrlich bist?"
        </p>
        <div className="text-xs text-zinc-600 mt-2 space-y-0.5">
          <p>→ <strong>Konkrete Antwort</strong> („Mahnungen sind manuell" / „SEPA-Stornos kosten Zeit") = HEISS</p>
          <p>→ <strong>„Eigentlich nichts"</strong> = DQ. Akzeptiere und Tschüss.</p>
          <p>→ <strong>„Kostet zu viel"</strong> = HEISS — du hast 0% Plattformgebühr</p>
          <p>→ <strong>„Ist halt Zeit"</strong> = WARM — Frage 3 stellen für Zahl</p>
        </div>
      </div>

      {/* FRAGE 3 — wie teuer? */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-amber-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1">
          3️⃣ WIE TEUER ist es schon?
        </p>
        <p className="italic text-sm">
          „Wie viele Stunden im Monat kostet dich das ungefähr — 2, 5, 10?"
        </p>
        <div className="bg-amber-50 rounded p-2 mt-2 text-xs text-amber-900">
          <p className="font-bold">💰 Pain-Calc (sage ihm DAS Zahl-Argument):</p>
          <p>2h/Monat × 50 €/h = <strong>100 €/Monat = 1.200 €/Jahr</strong></p>
          <p>5h/Monat × 50 €/h = <strong>250 €/Monat = 3.000 €/Jahr</strong></p>
          <p>10h/Monat × 50 €/h = <strong>500 €/Monat = 6.000 €/Jahr</strong></p>
          <p className="mt-1">→ <strong>„Osss kostet 29-99 €/Monat. Das ist 90% Ersparnis."</strong></p>
        </div>
      </div>

      {/* Sport-spezifische Bonus-Frage falls Zeit übrig */}
      {(primarySport === 'bjj' || primarySport === 'judo' || primarySport === 'karate') && (
        <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
            🥋 Bonus für {primarySport.toUpperCase()} (nur wenn Frage 1-3 positiv)
          </p>
          <p className="italic text-xs">
            „Wie tracked ihr die Belt-Promotions? Excel, im Kopf, oder ne separate Liste?"
          </p>
          <p className="text-xs text-zinc-600 mt-1">→ Bei „Excel" / „im Kopf": <strong>perfektes Wedge-Use-Case</strong>.</p>
        </div>
      )}

      <div className="bg-rose-50 rounded-lg p-3 border border-rose-200 mt-3">
        <p className="font-bold text-rose-900 text-xs uppercase tracking-wide mb-1">🚪 Wenn nach 3 Fragen NULL Pain:</p>
        <p className="text-sm text-rose-900">
          → Tab <strong>„Disqualify"</strong> öffnen. Sage: „OK, dann seid ihr wirklich gut versorgt. Danke für deine
          Ehrlichkeit. Tschüss." → AUFLEGEN. Status auf „Kein Fit". Nächster Lead.
        </p>
      </div>
    </>
  )
}

function Pitch({ lead, primarySport }: { lead: Lead; primarySport: string }) {
  void lead
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        🎯 WEDGE statt Komplettverkauf. Kein Switching-Pitch — Lösung für EIN Problem.
      </div>

      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm">
        <p className="font-bold text-amber-900 mb-1">🪓 Strategie: Wedge-Use-Case</p>
        <p className="text-amber-900">
          Die meisten haben schon ein Tool. Wechsel ist teuer. <strong>Verkaufe NICHT „wechselt zu Osss"</strong> — verkaufe
          einen <strong>EINZELNEN konkreten Pain-Fix</strong>, der ihr aktuelles Tool ergänzt.
        </p>
      </div>

      {/* Wedge 1 — DATEV-Export */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-emerald-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
          🪓 Wedge 1 · Wenn Steuerberater-Pain genannt wurde
        </p>
        <p className="italic text-sm">
          „Hör mal — wir haben einen DATEV-Export der wirklich für deinen Steuerberater funktioniert.
          Probier das einfach mal aus, kostet nichts. <strong>Du musst dafür nicht von Eversports wechseln</strong>.
          Du exportierst einfach deine Beiträge als CSV und mein Tool macht dir DATEV draus. 5 Minuten Setup.
          Soll ich dir einen Login schicken?"
        </p>
      </div>

      {/* Wedge 2 — Belt-Tracking */}
      {(primarySport === 'bjj' || primarySport === 'judo' || primarySport === 'karate' || primarySport === 'taekwondo') && (
        <div className="bg-white rounded-lg p-3 border-l-4 border-emerald-400">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
            🪓 Wedge 2 · Wenn Belt-Tracking-Chaos genannt wurde
          </p>
          <p className="italic text-sm">
            „Belt-Tracking ist genau mein Thema. Ich hab das für {primarySport === 'bjj' ? 'BJJ' : primarySport === 'judo' ? 'Judo' : primarySport === 'karate' ? 'Karate' : 'Taekwondo'}-Schulen gebaut weil ich
            es selbst trainiere. Promotion-History pro Mitglied, mit Datum, Trainer, Notes. <strong>Kostet bis 30
            Mitglieder nichts.</strong> Soll ich dir den Free-Account schicken zum Anschauen?"
          </p>
        </div>
      )}

      {/* Wedge 3 — Beitragseinzug-Pain */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-emerald-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
          🪓 Wedge 3 · Wenn Beitragseinzug viel Zeit kostet
        </p>
        <p className="italic text-sm">
          „Bei eurer Größe und {'<X>'} Stunden im Monat = ungefähr {'<Y>'} € im Jahr was du verlierst.
          Mein Tool kostet dich 29 €/Monat = 348 €/Jahr. <strong>Du sparst {'<Z>'} € pro Jahr — und zwar
          deine eigene Zeit, nicht Geld auf Papier.</strong> Wenn du willst, mach ich dir 5 Minuten Demo,
          du entscheidest danach."
        </p>
      </div>

      {/* Wedge 4 — Komplett-Wechsler (selten) */}
      <div className="bg-white rounded-lg p-3 border-l-4 border-zinc-300">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
          🪓 Wedge 4 · Nur wenn echter Frust mit aktuellem Tool
        </p>
        <p className="italic text-sm">
          „Klingt als wärst du wirklich unzufrieden mit {'<aktuelles Tool>'}. Lass uns kurz drüber sprechen
          ob ein Wechsel überhaupt Sinn macht — kein Verkauf, ich frag dich konkret was funktionieren muss.
          15 Minuten morgen oder Donnerstag?"
        </p>
      </div>

      <div className="bg-rose-50 rounded-lg p-3 border border-rose-200 text-sm">
        <p className="font-bold text-rose-900 mb-1">⛔ NIE pitchen ohne Pain</p>
        <p className="text-rose-900">
          Wenn aus den 3 Diagnose-Fragen <strong>kein konkreter Pain</strong> rausgekommen ist: gehe NICHT
          in den Pitch. Direkt auf Tab <strong>„Disqualify"</strong>. Pitchen ohne Pain = du klingst wie
          ein Verkäufer. Mit Pain = du klingst wie eine Lösung.
        </p>
      </div>

      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2">
        🎯 <strong>Nach Wedge-Pitch immer:</strong> <em>„Macht das für dich Sinn?"</em> und WARTE.
        Stille = der Punkt wo der Lead entscheidet. Nicht reinreden!
      </div>
    </>
  )
}

function Objections() {
  const items: { obj: string; reply: string }[] = [
    {
      obj: '⭐ „Wir brauchen nichts." / „Lösungen wie Sand am Meer." (häufigster Einwand!)',
      reply: 'Du hast völlig recht — der Markt ist voll. Eine letzte Frage und ich lege auf: Was nervt dich denn aktuell am meisten an dem was ihr habt — oder läuft wirklich alles glatt? … [Wenn ECHT „läuft alles glatt" → DQ-Tab, sauber Tschüss. Wenn jetzt doch ein Pain rauskommt → „Ah ok, genau das löse ich. 5 Min Demo wenn du magst — falls nicht, kein Stress, kein Follow-up."]',
    },
    {
      obj: '„Kein Interesse." (sofort, ohne Erklärung)',
      reply: 'Verstehe. Letzte Frage und ich lege auf: Wenn du EINE Sache an deiner aktuellen Mitgliederverwaltung ändern könntest — was wäre das? … [Zuhören. Wenn echt: „Genau das löst mein Tool. Soll ich dir 5 Minuten zeigen?". Wenn null Pain: DQ-Tab.]',
    },
    {
      obj: '„Bin gerade im Training / habe keine Zeit."',
      reply: 'Klar — passt 17:00 oder eher 19:30 besser zum Zurückrufen? [Zwei konkrete Slots geben, nie offen lassen. „Ich melde mich" → Nein. „Ich rufe um 19:30 zurück" → Ja.]',
    },
    {
      obj: '„Schick mir Infos per Mail."',
      reply: 'Mache ich — aber ehrlich: ich schick keine 8-seitige PDF die du nie liest. 3 Sätze + 1 Link, 60 Sekunden zum Lesen. Welche Mail-Adresse? [E-Mail-Adresse abgreifen. Bei zögern: „Schick einfach an die info@…?" — wenn ja, du hast nichts gewonnen. Besser direkt Demo.]',
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
        ⏱ ZIEL: ruhig bleiben. Einwand = Interesse.
      </div>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i}>
            <div className="font-semibold text-rose-700">❌ {it.obj}</div>
            <div className="italic text-zinc-700 mt-1">→ {it.reply}</div>
          </li>
        ))}
      </ul>
      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2">
        💡 <strong>Regel</strong>: Niemals direkt widersprechen. Erst zustimmen („verstehe", „gute Frage"), dann rückfragen, dann antworten.
      </div>
    </>
  )
}

function Close({ lead, cityPart }: { lead: Lead; cityPart: string }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        ⏱ ZIEL: konkreter Termin. Diese Woche oder nächste.
      </div>
      <p className="italic">
        „Cool, dann mach ich dir einen Vorschlag: Ich schick dir einen Demo-Link, du klickst dich in 5 Minuten durch.
        Wenn dir was gefällt, machen wir 15 Minuten Video-Call. Passt das?"
      </p>
      <p className="italic">
        „Wann passt es dir besser — eher Anfang oder Ende der Woche?"
      </p>
      <p className="italic">
        „Ok, sagen wir <strong>Donnerstag um 14:00</strong>? Schick ich dir gleich eine Kalender-Einladung an … welche E-Mail nutzt du?"
      </p>
      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2">
        ✅ <strong>Wichtig</strong>: Konkreter Tag + Uhrzeit + Email. Nicht „melde mich nochmal".<br />
        📝 <strong>Direkt im CRM</strong>: nach dem Anruf <em>Status → „Demo geplant"</em>, <em>Next Follow-up</em> auf den Termin setzen.<br />
        📧 <strong>Innerhalb 5 Min</strong>: Calendar-Invite + 3-Satz-Mail mit dem Link zu osss.pro/gym/cscffb (Demo-Gym).
      </div>
    </>
  )
}

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
          <li>Überreden kostet 20+ Minuten und konvertiert 3% — DQ kostet 90 Sek und konvertiert 0% (ehrlich)</li>
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
          → Direkt auflegen. Status im CRM: <strong>„Kein Fit"</strong>. Notiz: warum (z.B. „happy mit Eversports", „kein Pain genannt").
        </p>
      </div>

      <div className="bg-white rounded-lg p-3 border-l-4 border-zinc-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
          🎤 Wenn sie sagen „Lösungen wie Sand am Meer"
        </p>
        <p className="italic text-sm">
          „Stimmt absolut. Ich würde auch sagen: wechsel nicht ohne Grund. Wenn dir aktuell nichts wirklich
          wehtut, ist das auch keine gute Investition. Danke für deine Ehrlichkeit. Tschüss."
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          → Stimme der Realität zu. Du bist nicht der Verkäufer, der überreden will. Das schafft <strong>Trust</strong>
          — wenn er später Pain bekommt, ruft er VON SICH AUS bei dir an.
        </p>
      </div>

      <div className="bg-white rounded-lg p-3 border-l-4 border-zinc-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">
          🎤 „Ich werd&apos;s mir nochmal überlegen / merken"
        </p>
        <p className="italic text-sm">
          „Klar. Eine Sache: <strong>Ich melde mich NICHT von alleine wieder.</strong> Wenn du jemals einen
          Anlass hast — Steuerberater stresst, Beitragsabrechnung killt deinen Sonntag — dann ruf direkt durch.
          Ich heb auch am Wochenende ab. Tschüss."
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          → Pattern-Interrupt: die meisten erwarten Hartnäckigkeit. Wenn du sie loslässt, bleiben sie hängen
          (Reverse-Reciprocity). Status: <strong>„Nicht kontaktieren"</strong>.
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

function Voicemail({ sportHook, cityPart }: { sportHook: string; cityPart: string }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        ⏱ ZIEL: max 20 Sek. Neugier wecken, nicht pitchen.
      </div>
      <p className="italic">
        „Hi, hier ist Lom Aliimadaev — ich baue Software für {sportHook}{cityPart}.
        Ich rufe nicht an um was zu verkaufen, sondern weil ich kurz wissen wollte ob ihr noch mit Eversports oder Magicline arbeitet —
        oder ob ihr da mal was neues sehen wollt mit 0 % Plattformgebühr.
        Erreichen Sie mich unter <strong>0151 ...</strong> oder lom@osss.pro. Bis dann!"
      </p>
      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2">
        💡 <strong>Tipp</strong>: <em>„0 % Plattformgebühr"</em> + <em>„nicht verkaufen"</em> sind die Trigger die Rückrufe bringen.<br />
        📞 <strong>Direkt im CRM</strong>: Anruf-Outcome <em>„Mailbox"</em>, Notiz <em>„Voicemail hinterlassen — Pitch X"</em>.
      </div>
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────

// Friendlicher Sport-Label für Story-Hooks ("BJJ-Coach" / "Karate-Coach")
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

const SPORT_HOOKS: Record<string, string> = {
  bjj:        'BJJ-Studios — Belt-Tracking, SEPA, DATEV',
  judo:       'Judo-Vereine — Gurtprüfungen, SEPA, DATEV',
  mma:        'MMA-Gyms — Mitgliederverwaltung, SEPA, DATEV',
  'muay-thai':'Thai-Box-Schulen — Klassen-Plan, SEPA, DATEV',
  kickbox:    'Kickbox-Schulen — Klassen-Plan, SEPA, DATEV',
  boxen:      'Boxclubs — Mitgliederverwaltung, SEPA, DATEV',
  karate:     'Karate-Dojos — Gürtelprüfungen, SEPA, DATEV',
  taekwondo:  'Taekwondo-Schulen — Gurtsystem, SEPA, DATEV',
  default:    'Kampfsport-Studios — SEPA-Lastschrift, DATEV-Export, 0 % Plattformgebühr',
}
