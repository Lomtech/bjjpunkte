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

type Phase = 'opener' | 'discovery' | 'pitch' | 'objections' | 'close' | 'voicemail'

const PHASES: { id: Phase; label: string; icon: string }[] = [
  { id: 'opener',     label: 'Einstieg',      icon: '👋' },
  { id: 'discovery',  label: 'Fragen',        icon: '🔍' },
  { id: 'pitch',      label: 'Pitch',         icon: '🎯' },
  { id: 'objections', label: 'Einwände',      icon: '🛡' },
  { id: 'close',      label: 'Termin',        icon: '📅' },
  { id: 'voicemail',  label: 'Mailbox',       icon: '📞' },
]

export function CallScript({ lead }: { lead: Lead }) {
  const [phase, setPhase] = useState<Phase>('opener')
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
            {phase === 'opener'     && <Opener  lead={lead} sportHook={sportHook} cityPart={cityPart} returning={isReturningCall} />}
            {phase === 'discovery'  && <Discovery lead={lead} primarySport={primarySport} />}
            {phase === 'pitch'      && <Pitch lead={lead} primarySport={primarySport} />}
            {phase === 'objections' && <Objections />}
            {phase === 'close'      && <Close lead={lead} cityPart={cityPart} />}
            {phase === 'voicemail'  && <Voicemail sportHook={sportHook} cityPart={cityPart} />}
          </div>

          <div className="text-xs text-amber-800/80">
            💡 <strong>Goldene Regel</strong>: Mehr fragen, weniger reden. Dein Ziel ist nicht der Verkauf am Telefon — nur der Demo-Termin.
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function Opener({ lead, sportHook, cityPart, returning }: { lead: Lead; sportHook: string; cityPart: string; returning: boolean }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        ⏱ ZIEL: 15 Sekunden bis sie weiterhören wollen
      </div>
      <p className="italic">
        „Hi, mein Name ist Lom Aliimadaev. Ich rufe wegen <strong>{lead.name}</strong> an{cityPart}.
        {returning ? ' Wir hatten ja schon mal kurz Kontakt — passt es gerade 2 Minuten?' : ' Hab kurz 30 Sekunden für eine ehrliche Frage?"'}
      </p>
      {!returning && (
        <p className="italic">
          „Ich baue eine Software speziell für {sportHook} — DATEV-Export, SEPA, 0 % Plattformgebühr.
          Ich will euch nichts verkaufen — nur kurz fragen wie ihr aktuell Mitglieder + Beiträge verwaltet?"
        </p>
      )}
      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2">
        ✅ <strong>Tonfall</strong>: ruhig, kein Sales-Ton. Du fragst um Hilfe, nicht um Geld.<br />
        ✅ <strong>Wenn „passt nicht jetzt"</strong>: „Klar — wann wäre besser? Heute Nachmittag oder eher morgen?"<br />
        ❌ <strong>Vermeide</strong>: „Wie geht es Ihnen?" / „Habe ich Sie kurz an der Strippe?" — sofortiger Aufleger.
      </div>
    </>
  )
}

function Discovery({ lead, primarySport }: { lead: Lead; primarySport: string }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        ⏱ ZIEL: 2-3 Minuten zuhören. Schmerzpunkt finden.
      </div>
      <p>Stelle 2-3 dieser Fragen — keine Liste runterhaspeln, eine Frage gleichzeitig:</p>
      <ul className="space-y-2 list-disc pl-5">
        <li>„Wie viele aktive Mitglieder habt ihr aktuell?"</li>
        <li>„Wie verwaltet ihr die monatlichen Beiträge — Lastschrift, manuell, oder über eine Software?"</li>
        {primarySport === 'bjj' && <li>„Wie tracked ihr die Belt-Promotions? Excel oder im Kopf?"</li>}
        {primarySport === 'bjj' && <li>„Wie sieht's mit Wellpass / Hansefit aus — habt ihr die Integration?"</li>}
        <li>„Was nervt euch aktuell am meisten an eurer Mitgliederverwaltung?"</li>
        <li>„Nutzt ihr Eversports oder Magicline? Was sind eure größten Pain-Points?"</li>
        <li>„Wer macht bei euch die Buchhaltung — Steuerberater mit DATEV?"</li>
      </ul>
      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2">
        💬 <strong>Wenn sie über Probleme reden</strong>: AKTIV ZUHÖREN. Nichts pitchen. Notizen machen.<br />
        🎯 <strong>Suche nach</strong>: „zu teuer", „zu kompliziert", „nicht für Kampfsport gemacht", „kein DATEV", „schlechter Support"
      </div>
    </>
  )
}

function Pitch({ lead, primarySport }: { lead: Lead; primarySport: string }) {
  return (
    <>
      <div className="font-bold text-amber-900 text-xs uppercase tracking-wide">
        ⏱ ZIEL: 30 Sekunden Pitch. Nicht länger.
      </div>
      <p className="italic">
        „Genau dafür hab ich osss gebaut. Drei Sachen die andere nicht haben:"
      </p>
      <ol className="space-y-2 list-decimal pl-5">
        <li>
          <strong>0 % Plattformgebühr</strong> — ihr zahlt nur Stripe-Gebühren wie sonst auch. Eversports nimmt 1,5–3 % von jedem Beitrag, Magicline noch mehr.
        </li>
        {primarySport === 'bjj' || primarySport === 'judo' ? (
          <li>
            <strong>Belt-Tracking eingebaut</strong> — White → Blue → Purple → Brown → Black mit Stripes. Promotion-History pro Mitglied. Hat sonst keiner.
          </li>
        ) : (
          <li>
            <strong>Kampfsport-spezifisch</strong> — Anwesenheit pro Klasse, Open-Mat-Tracking, kein generisches Fitness-Studio-Schema.
          </li>
        )}
        <li>
          <strong>DATEV + SEPA out of the box</strong> — euer Steuerberater bekommt einen 1-Klick-Export. Buchhaltung ist nach Anlage 60 Sekunden.
        </li>
      </ol>
      <p className="italic mt-3">
        „Das ganze kostet bei euch wahrscheinlich zwischen 0 € und 99 € im Monat — je nach Mitgliederzahl.
        Ich lass dich {primarySport === 'bjj' ? 'auch keine Mitgliederzahl-Lüge' : 'auch nicht in eine versteckte Gebühr'} laufen."
      </p>
      <div className="text-xs text-zinc-600 bg-zinc-50 rounded p-2 mt-2">
        🎯 <strong>Stoppe nach 30 Sek</strong>. Sage: <em>„Macht das Sinn was ich erzähle?"</em> und WARTE.<br />
        ⛔ Nicht weiterreden bis sie antworten. Stille ist OK.
      </div>
    </>
  )
}

function Objections() {
  const items: { obj: string; reply: string }[] = [
    {
      obj: '„Wir sind happy mit Eversports / Magicline."',
      reply: 'Verstehe — was kostet euch das aktuell? … Und wie viel Plattformgebühr nehmen die? … Ok, das sind bei 50 Mitgliedern ungefähr X €/Jahr. Lass mich dir 5 Min zeigen wo das bei mir landet.',
    },
    {
      obj: '„Wir machen das mit Excel und es funktioniert."',
      reply: 'Cool — wie viele Stunden pro Monat fließen da rein? … Was passiert wenn ein Mitglied seine SEPA-Lastschrift platzt? Sicht ihr das automatisch? … Genau dafür hab ich osss gebaut.',
    },
    {
      obj: '„Schick mir mal Infos per Mail."',
      reply: 'Mach ich — aber ich schick dir nicht 8 Seiten PDF die du nie liest. Nur 3 Sätze + Demo-Link. Welche Mail-Adresse?',
    },
    {
      obj: '„Wir haben kein Budget."',
      reply: 'Bis 30 Mitglieder ist osss kostenlos. Ihr seid wie viele? … Dann zahlt ihr keinen Cent. Mach 5 Min Demo, du entscheidest.',
    },
    {
      obj: '„Wer steht dahinter?"',
      reply: 'Solo-Founder, ich. Selbst 15 Jahre BJJ. Ich kenne den Pain weil ich ihn selbst hatte. Dafür ist die Software auch genau für Kampfsport gebaut, nicht für Yoga-Studios mit Kampfsport-Modul.',
    },
    {
      obj: '„Datenschutz / DSGVO?"',
      reply: 'Server in Deutschland (Frankfurt). DSGVO-Export pro Mitglied per Knopfdruck. Steuerberater-Export nach DATEV. Auftragsverarbeitungsvertrag schick ich euch.',
    },
    {
      obj: '„Was wenn das Ding pleite geht?"',
      reply: 'Faire Frage. Daten-Export jederzeit als CSV + JSON. Du nimmst alles mit. Plus: ich hab keinen Investor, kein Burn — ich kann nicht „pleite gehen" wie ein VC-finanziertes Startup.',
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
