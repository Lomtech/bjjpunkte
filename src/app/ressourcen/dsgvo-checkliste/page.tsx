import Link from 'next/link'
import type { Metadata } from 'next'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { Check, AlertCircle, X } from 'lucide-react'
import { PrintButton } from './PrintButton'
import { TopNav } from '@/components/TopNav'

export const metadata: Metadata = {
  title: 'DSGVO-Checkliste für Kampfsport-Vereine 2026',
  description:
    'Die ehrliche Pflicht-Checkliste für DSGVO im Verein: Datenschutzerklärung, AVV, Verarbeitungsverzeichnis, Lösch-Prozess. Druckbar, ohne Anwaltsfloskeln.',
  alternates: { canonical: '/ressourcen/dsgvo-checkliste' },
  openGraph: {
    title: 'DSGVO-Checkliste für Kampfsport-Vereine',
    description: 'Pflichtliste + Praxis-Tipps. Direkt zum Abhaken oder Ausdrucken.',
    url: 'https://www.osss.pro/ressourcen/dsgvo-checkliste',
    type: 'article',
    locale: 'de_DE',
  },
  robots: { index: true, follow: true },
}

const PFLICHT_ITEMS = [
  {
    title: 'Datenschutzerklärung auf Vereins-Website',
    description: 'Pflicht nach Art. 13 DSGVO. Muss enthalten: Verantwortlicher, Datenkategorien, Zwecke, Rechtsgrundlagen, Auftragsverarbeiter, Speicherdauer, Betroffenenrechte.',
    tip: 'Generator-Vorlage von e-recht24.de oder datenschutz-generator.de reicht — solange du sie an deinen Verein anpasst.',
  },
  {
    title: 'Aktive Einwilligung beim Mitglieder-Beitritt',
    description: 'Kein vorausgefülltes Häkchen! Bei Online-Anmeldung: Checkbox + Hinweis auf Datenschutzerklärung.',
    tip: 'Du musst IP, Zeitstempel und den Einwilligungstext protokollieren — nicht nur „Ja, akzeptiert".',
  },
  {
    title: 'AVV mit jedem Cloud-Anbieter',
    description: 'Auftragsverarbeitungsverträge (Art. 28 DSGVO) mit Microsoft, Google, Mailbox-Anbieter, Software-Tools — überall wo Mitgliederdaten landen.',
    tip: 'Bei großen Anbietern automatisch via T&Cs. Bei spezialisierter Gym-Software wie Osss elektronisch im Dashboard signierbar.',
  },
  {
    title: 'Verarbeitungsverzeichnis (Art. 30 DSGVO)',
    description: 'Internes Dokument — muss nicht öffentlich sein, aber auf Verlangen der Aufsichtsbehörde (z.B. BayLDA) vorgelegt werden.',
    tip: 'Eine simple Tabelle reicht. Vorlagen kostenlos beim BfDI oder bei den Landes-Datenschutzbehörden.',
  },
  {
    title: 'Lösch-Prozess für Ex-Mitglieder',
    description: 'Nach Vertragsende dürfen Daten nur so lange gespeichert werden, wie gesetzliche Aufbewahrungspflichten verlangen.',
    tip: 'Rechnungsrelevante Daten 10 Jahre (§ 257 HGB / § 147 AO). Alles andere früher löschen.',
  },
  {
    title: 'Datenpannen-Plan',
    description: 'Bei Datenleck: 72-Stunden-Frist für Meldung an Aufsichtsbehörde (Art. 33 DSGVO).',
    tip: 'Schreibe eine 1-Seiten-Anweisung: Wer macht was, wenn ein Laptop mit Mitgliederdaten geklaut wird?',
  },
  {
    title: 'Betroffenenrechte umsetzbar machen',
    description: 'Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Datenübertragbarkeit (Art. 20) — alles binnen 30 Tagen.',
    tip: 'Bei Software-Tool: prüfen ob CSV-Export pro Mitglied möglich. Manuell ist OK, aber bei vielen Anfragen mühsam.',
  },
]

const MYTHEN = [
  {
    mythos: 'Ich brauche zwingend einen Datenschutzbeauftragten',
    wahrheit: 'Erst ab 20 Personen, die regelmäßig PII verarbeiten. Solo-Vereinsvorstand braucht keinen.',
  },
  {
    mythos: 'Cookie-Banner ist Pflicht',
    wahrheit: 'Nein! Nur wenn du Tracking-Tools (Google Analytics, Meta Pixel) nutzt. Technisch notwendige Cookies (Login) sind ohne Banner OK.',
  },
  {
    mythos: 'Server müssen in Deutschland stehen',
    wahrheit: 'Innerhalb der EU oder in Ländern mit Adequacy-Decision (UK, Schweiz) ist alles legal.',
  },
  {
    mythos: 'Foto in WhatsApp-Gruppe ist OK',
    wahrheit: 'Falsch — wenn das Mitglied nicht aktiv eingewilligt hat, ist das ein DSGVO-Verstoß. Gilt auch für Internas.',
  },
]

export default function DSGVOChecklistePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Nav (hidden on print) */}
      <div className="print:hidden">
        <TopNav back={{ href: '/ressourcen', label: 'Ressourcen' }} />
      </div>

      <article className="flex-1 max-w-3xl mx-auto px-5 py-10 sm:py-14 w-full">

        {/* Header */}
        <header className="mb-8 pb-6 border-b border-zinc-100">
          <div className="flex items-start justify-between gap-4 mb-3">
            <p className="text-amber-500 font-bold text-[10px] uppercase tracking-[0.3em] print:text-amber-700">
              Checkliste · Stand 2026
            </p>
            <div className="print:hidden flex-shrink-0">
              <PrintButton />
            </div>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tighter leading-[1.1] mb-4">
            DSGVO im Kampfsport-Verein.<br className="hidden sm:block" /><span className="text-zinc-500">Die ehrliche Pflicht-Liste.</span>
          </h1>
          <p className="text-zinc-600 leading-relaxed">
            Was du als Vereinsvorstand oder Gym-Inhaber wirklich erledigen musst — ohne
            Anwaltsfloskeln. Druckbar als PDF (Cmd+P / Strg+P → „Als PDF speichern").
          </p>
          <div className="mt-4 inline-flex items-start gap-2 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
            <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <span>Diese Checkliste ist <strong>keine Rechtsberatung</strong>. Bei Unsicherheit: einmal Anwalt fragen — kostet ~300 €, lohnt sich.</span>
          </div>
        </header>

        {/* Pflicht-Items */}
        <section className="mb-10">
          <h2 className="text-2xl font-black text-zinc-950 tracking-tight mb-2">7 Pflicht-Punkte</h2>
          <p className="text-sm text-zinc-500 mb-6">Häkchen für „erledigt", Notiz neben jedem Punkt für deine Realität.</p>

          <ul className="space-y-3">
            {PFLICHT_ITEMS.map((item, i) => (
              <li key={i} className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 print:break-inside-avoid">
                <label className="flex items-start gap-3 cursor-pointer">
                  <span className="w-6 h-6 rounded-md border-2 border-zinc-300 flex-shrink-0 flex items-center justify-center print:border-zinc-600 mt-0.5 transition-colors hover:border-amber-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-zinc-900 mb-1">{i + 1}. {item.title}</p>
                    <p className="text-sm text-zinc-600 leading-relaxed mb-2">{item.description}</p>
                    <p className="text-xs text-amber-700 leading-relaxed bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 print:bg-white print:border-amber-300">
                      💡 <strong>Praxis:</strong> {item.tip}
                    </p>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </section>

        {/* Mythen */}
        <section className="mb-10 print:break-before-page">
          <h2 className="text-2xl font-black text-zinc-950 tracking-tight mb-2">4 verbreitete Mythen — entkräftet</h2>
          <p className="text-sm text-zinc-500 mb-6">Was du <em>nicht</em> brauchst, obwohl viele es behaupten.</p>

          <div className="grid grid-cols-1 gap-3">
            {MYTHEN.map((m, i) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 print:break-inside-avoid">
                <div className="flex items-start gap-2 mb-2">
                  <X size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="font-bold text-zinc-900">Mythos: „{m.mythos}"</p>
                </div>
                <div className="flex items-start gap-2 ml-6">
                  <Check size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-zinc-600 leading-relaxed">{m.wahrheit}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Behörden-Kontakte */}
        <section className="mb-10 bg-zinc-50 rounded-2xl p-5 sm:p-7 print:bg-white print:border print:border-zinc-300">
          <h2 className="text-xl font-black text-zinc-950 tracking-tight mb-3">Aufsichtsbehörden DACH</h2>
          <ul className="space-y-2 text-sm text-zinc-700">
            <li><strong>Bayern:</strong> BayLDA — Promenade 18, 91522 Ansbach · <a href="mailto:poststelle@lda.bayern.de" className="text-amber-600">poststelle@lda.bayern.de</a></li>
            <li><strong>NRW:</strong> LDI NRW — Kavalleriestr. 2-4, 40213 Düsseldorf</li>
            <li><strong>Berlin:</strong> Berliner Beauftragte für Datenschutz — Friedrichstr. 219, 10969 Berlin</li>
            <li><strong>Bund:</strong> BfDI — bfdi.bund.de (Vorlagen + Muster kostenlos)</li>
            <li><strong>Österreich:</strong> Datenschutzbehörde Wien — dsb.gv.at</li>
            <li><strong>Schweiz:</strong> EDÖB — edoeb.admin.ch</li>
          </ul>
        </section>

        {/* CTA — hidden on print */}
        <section className="print:hidden bg-amber-50 border border-amber-200 rounded-2xl p-6 sm:p-7 mb-10">
          <h3 className="font-black text-zinc-950 text-lg mb-2 tracking-tight">Wenn dir das alles zu viel ist:</h3>
          <p className="text-sm text-zinc-700 leading-relaxed mb-4">
            <Link href="/" className="text-amber-700 font-semibold underline hover:text-amber-900">Osss</Link> automatisiert
            das meiste: Einwilligung mit IP+Zeitstempel beim Signup, AVV elektronisch im Dashboard,
            Verarbeitungsverzeichnis als Vorlage, Lösch-Prozess per Knopfdruck.
          </p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
            Kostenlos testen →
          </Link>
        </section>

        {/* Newsletter */}
        <section className="print:hidden mb-10">
          <NewsletterSignup
            source="dsgvo-checkliste"
            title="Mehr Praxis-Tools wie diese?"
            description="Wir veröffentlichen alle 1-2 Wochen neue Hilfen für Kampfsport-Vereine. Direkt im Postfach."
          />
        </section>

      </article>

      {/* Footer */}
      <footer className="print:hidden bg-white border-t border-zinc-100 py-6 px-5">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
          <p>© {new Date().getFullYear()} Osss · Stand der Checkliste: 2026</p>
          <div className="flex gap-5">
            <Link href="/ressourcen" className="hover:text-zinc-700 transition-colors">Mehr Ressourcen</Link>
            <Link href="/blog" className="hover:text-zinc-700 transition-colors">Blog</Link>
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">Datenschutz</Link>
          </div>
        </div>
      </footer>

      {/* Print-only footer */}
      <div className="hidden print:block mt-12 pt-6 border-t border-zinc-300 text-xs text-zinc-500">
        <p><strong>Quelle:</strong> osss.pro/ressourcen/dsgvo-checkliste · Lom-Ali Imadaev, Adelshofen · Stand 2026</p>
        <p className="mt-1"><strong>Disclaimer:</strong> Diese Checkliste ersetzt keine Rechtsberatung.</p>
      </div>
    </div>
  )
}
