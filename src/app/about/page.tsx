// About Page — Founder + Mission + Timeline.
//
// Server Component (RSC). No client interactivity needed: copy, photo, links.
// Modeled after maatapp.com/about's structure (We are X → Mission → Team →
// Story-Timeline) but adapted to a solo-founder side-project at the
// pre-revenue stage. Honest underdog framing > fake "trusted by X" claims.
//
// FOUNDER PHOTO: drop a square image at `/public/founder-lom.jpg` (recommended:
// 800×800 px, JPG, real photo on the mat — not a corporate headshot). Until
// the file exists, the placeholder block renders.

import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { TopNav } from '@/components/TopNav'
import { OsssLogo } from '@/components/Logo'
import { getServerLang } from '@/lib/i18n/server'
import { MessageCircle, Zap, ArrowRight, MapPin, FileUser } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Über Osss · Lom-Ali Imadaev, Solo-Founder',
  description: 'Hi, ich bin Lom. Ich baue Osss — die Gym-Software für Kampfsport-Studios in Deutschland. Hier ist, warum.',
  openGraph: {
    title: 'Über Osss',
    description: 'Hi, ich bin Lom. Ich baue Osss — die Gym-Software für Kampfsport-Studios in Deutschland.',
    type: 'website',
  },
}

export default async function AboutPage() {
  const lang = await getServerLang()
  const en = lang === 'en'

  return (
    <div className="min-h-screen bg-white">
      <TopNav />

      {/* ── HERO — Founder intro ── */}
      <section className="relative bg-white overflow-hidden border-b border-zinc-100">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(251,191,36,0.06) 0%, transparent 60%)' }} />

        <div className="max-w-5xl mx-auto px-5 py-20 sm:py-28 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Founder photo — Hochkant-BJJ-Selfie, Hayabusa-Rashguard, echte
                Trainings-Atmosphäre. Aspect 3:4 erhält das natürliche Hochformat
                ohne Crop. */}
            <div className="order-2 md:order-1">
              <div className="relative aspect-[3/4] w-full max-w-sm mx-auto">
                <div className="absolute inset-0 rounded-3xl overflow-hidden bg-gradient-to-br from-amber-100 via-amber-50 to-zinc-100 border border-amber-200/60 shadow-xl shadow-amber-200/40">
                  <Image
                    src="/founder-lom.jpg"
                    alt="Lom-Ali Imadaev — Founder von Osss, im BJJ-Training"
                    width={1200}
                    height={1600}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>
                {/* Caption pill */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-zinc-950 text-white px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg">
                  <MapPin size={11} className="text-amber-400" />
                  Adelshofen · Bayern
                </div>
              </div>
            </div>

            {/* Intro text */}
            <div className="order-1 md:order-2">
              <p className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-4">
                {en ? 'Solo Founder · Building in public' : 'Solo-Founder · baut öffentlich'}
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-zinc-950 tracking-tighter leading-[0.95] mb-6">
                {en ? <>Hi, I&apos;m <span className="text-amber-500">Lom</span>.</> : <>Hi, ich bin <span className="text-amber-500">Lom</span>.</>}
              </h1>
              <p className="text-zinc-600 text-lg leading-relaxed mb-5">
                {en
                  ? 'I build Osss — the gym software for martial-arts studios in Germany. Solo. From a desk in Adelshofen, near Munich.'
                  : 'Ich baue Osss — die Gym-Software für Kampfsport-Studios in Deutschland. Solo. Vom Schreibtisch in Adelshofen, vor den Toren Münchens.'}
              </p>
              <p className="text-zinc-500 text-base leading-relaxed">
                {en
                  ? 'No VC. No 50-person team. No "100K+ practitioners worldwide" claims. Just one engineer who got tired of seeing martial-arts gyms pay 1-3 % platform fees on every membership — and built the alternative.'
                  : 'Kein VC. Kein 50-Personen-Team. Keine „100k+ Mitglieder weltweit"-Sprüche. Nur ein Ingenieur, der genug davon hatte, dass Kampfsport-Studios 1-3 % Plattformgebühr auf jede Mitgliedschaft zahlen — und die Alternative gebaut hat.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY OSSS EXISTS — the personal hook ── */}
      <section className="py-20 px-5 bg-zinc-50 border-b border-zinc-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-zinc-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">
            {en ? 'Why Osss exists' : 'Warum es Osss gibt'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-8">
            {en
              ? <>Most gym software treats martial arts<br />like an afterthought.</>
              : <>Die meiste Gym-Software<br />behandelt Kampfsport als Nebensache.</>}
          </h2>

          <div className="prose prose-zinc max-w-none space-y-5 text-zinc-600 text-base leading-relaxed">
            <p>
              {en
                ? 'I grew up watching my friends run jiu-jitsu academies, boxing gyms, kickboxing schools. Every single one of them used Excel. WhatsApp groups for "did you pay this month?". Hand-written invoices. Manual SEPA mandates printed out and signed.'
                : 'Ich bin damit aufgewachsen, Freunden beim Aufbau von BJJ-Akademien, Box- und Kickbox-Studios zuzusehen. Alle benutzten Excel. WhatsApp-Gruppen für „hast du diesen Monat gezahlt?". Handgeschriebene Rechnungen. Manuell ausgedruckte und unterschriebene SEPA-Mandate.'}
            </p>
            <p>
              {en
                ? 'When I asked them why they don\'t use a tool: "Too expensive." "Doesn\'t do DATEV." "English-only." "1.5 % platform fee on every membership — that\'s 600 € a year I\'m losing." "I tried Mindbody for two weeks and gave up."'
                : 'Wenn ich gefragt habe warum sie nicht ein Tool nutzen: „Zu teuer." „Macht kein DATEV." „Nur englisch." „1,5 % Plattformgebühr auf jede Mitgliedschaft — das sind 600 € im Jahr die mir verloren gehen." „Hab Mindbody zwei Wochen probiert, dann aufgegeben."'}
            </p>
            <p className="text-zinc-900 font-semibold">
              {en
                ? 'Osss is what those gyms asked for, and what nobody built.'
                : 'Osss ist, was diese Studios sich gewünscht haben — und was niemand gebaut hat.'}
            </p>
            <p>
              {en
                ? 'Built for the German market: DATEV export, §19 UStG-compliant invoices, DSGVO from day one, support in German. Built for martial arts: belt systems, promotion tracking, GPS check-in for outdoor classes. And the part nobody else does: '
                : 'Gebaut für den deutschen Markt: DATEV-Export, §19-UStG-konforme Rechnungen, DSGVO ab Tag eins, Support auf Deutsch. Gebaut für Kampfsport: Gürtel-Systeme, Promotion-Tracking, GPS-Check-in für Outdoor-Classes. Und die Sache die sonst niemand macht: '}
              <strong className="text-zinc-900">
                {en
                  ? '0 % platform fee on member payments. Forever.'
                  : '0 % Plattformgebühr auf Mitgliedszahlungen. Für immer.'}
              </strong>
            </p>
          </div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="py-20 px-5 bg-white border-b border-zinc-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.2em] mb-3 text-center">
            {en ? 'Mission' : 'Mission'}
          </p>
          <h2 className="text-3xl sm:text-5xl font-black text-zinc-950 tracking-tighter leading-[1.05] text-center mb-10 max-w-2xl mx-auto">
            {en
              ? <>The gym keeps 100 % of every euro<br />a member pays.</>
              : <>Das Studio behält 100 %<br />jedes Euros vom Mitglied.</>}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {(en ? [
              { num: '0 %', label: 'platform fee on member dues — ever', sub: 'Stripe Connect routes payments straight to the gym\'s bank account. We earn from subscriptions, not by skimming.' },
              { num: '< 10 min', label: 'from sign-up to live gym', sub: 'No sales call. No 14-day onboarding. Create account, import members, share the portal link.' },
              { num: '14 days', label: 'free trial — no credit card', sub: 'Full access to every feature. After 14 days you choose: subscribe at 49 €/month (or 39 €/month annually), or cancel — no questions asked.' },
            ] : [
              { num: '0 %', label: 'Plattformgebühr auf Beiträge — niemals', sub: 'Stripe Connect leitet Zahlungen direkt aufs Gym-Konto. Wir verdienen an Abos, nicht am Mitglied.' },
              { num: '< 10 Min', label: 'vom Sign-up zum Live-Gym', sub: 'Kein Sales-Call. Kein 14-Tage-Onboarding. Account anlegen, Mitglieder importieren, Portal-Link teilen.' },
              { num: '14 Tage', label: 'gratis testen — ohne Kreditkarte', sub: 'Voller Zugang zu allen Features. Nach 14 Tagen: 49 €/Monat (oder 39 €/Monat jährlich) — oder kündigen, ohne Rückfrage.' },
            ]).map(b => (
              <div key={b.label} className="bg-zinc-50 rounded-2xl p-7 border border-zinc-100">
                <p className="text-4xl font-black text-amber-500 tracking-tight mb-2 leading-none">{b.num}</p>
                <p className="font-bold text-zinc-900 text-sm mb-2 leading-snug">{b.label}</p>
                <p className="text-zinc-500 text-xs leading-relaxed">{b.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TIMELINE — honest underdog version ── */}
      <section className="py-20 px-5 bg-zinc-950 border-b border-zinc-900">
        <div className="max-w-3xl mx-auto">
          <p className="text-amber-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">
            {en ? 'The story' : 'Die Geschichte'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-12">
            {en ? 'Built in public, in real time' : 'Öffentlich gebaut, in Echtzeit'}
          </h2>

          <div className="space-y-8">
            {(en ? [
              { date: 'Q4 2025', title: 'First lines of code',
                desc: 'After three years of working with SAP enterprise systems and watching gym owners struggle with consumer SaaS, I started Osss as a side project. Goal: prove the 0 % platform fee model works.' },
              { date: 'Mar 2026', title: 'Product v1',
                desc: 'Members, SEPA via Stripe Connect, member portal, public gym page, schedule, belt system. 6 sports preconfigured. DATEV CSV export added.' },
              { date: 'May 2026', title: 'Pilot phase begins',
                desc: 'Open the first 10 lifetime-pilot slots. 40 % off forever for early studios. First warm leads in the pipeline.' },
              { date: 'You are here', title: 'Looking for the first 10',
                desc: 'I\'m talking to studio owners directly. If you run a martial-arts gym in Germany, Austria or Switzerland and want to migrate from Excel, Eversports or Magicline — let\'s talk.', current: true },
            ] : [
              { date: 'Q4 2025', title: 'Erste Code-Zeilen',
                desc: 'Nach drei Jahren SAP-Enterprise-Beratung und beim Zusehen, wie Studio-Owner sich mit Consumer-SaaS abquälen, habe ich Osss als Side-Project gestartet. Ziel: beweisen dass das 0-%-Plattformgebühr-Modell funktioniert.' },
              { date: 'März 2026', title: 'Produkt v1',
                desc: 'Mitgliederverwaltung, SEPA über Stripe Connect, Member-Portal, öffentliche Gym-Seite, Stundenplan, Gürtel-System. 6 Sportarten vorkonfiguriert. DATEV-CSV-Export eingebaut.' },
              { date: 'Mai 2026', title: 'Pilot-Phase startet',
                desc: 'Erste 10 Lifetime-Pilot-Plätze öffnen. 40 % Rabatt für immer für Early-Adopter. Erste warme Leads in der Pipeline.' },
              { date: 'Du bist hier', title: 'Suche die ersten 10',
                desc: 'Ich spreche direkt mit Studio-Ownern. Wenn du ein Kampfsport-Gym in DACH betreibst und von Excel, Eversports oder Magicline migrieren willst — lass uns reden.', current: true },
            ]).map((item, idx) => (
              <div key={idx} className="flex gap-5 relative">
                {/* Timeline dot + line */}
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${item.current ? 'bg-amber-400 ring-4 ring-amber-400/20 animate-pulse' : 'bg-zinc-600'}`} />
                  {idx < 3 && <div className="w-px flex-1 bg-zinc-800 mt-2" />}
                </div>
                <div className="flex-1 pb-2">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${item.current ? 'text-amber-400' : 'text-zinc-500'}`}>{item.date}</p>
                  <p className="text-white font-bold text-base mb-1.5">{item.title}</p>
                  <p className="text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIREKTER DRAHT — Social/Direct-Channels — übernommen aus onepage/index.html ── */}
      <section className="py-20 px-5 bg-amber-50 border-b border-amber-200">
        <div className="max-w-3xl mx-auto">
          <p className="text-amber-700 font-bold text-[10px] uppercase tracking-[0.2em] text-center mb-10">
            {en ? 'Direct line' : 'Direkter Draht'}
          </p>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* WhatsApp — eigene SVG für authentisches Brand-Recognition.
                MessageCircle als Fallback wäre zu generisch. */}
            <li>
              <a
                href="https://wa.me/4915127600077"
                target="_blank"
                rel="noopener noreferrer"
                data-track="cta_whatsapp_about"
                className="group flex items-center justify-between gap-4 bg-white rounded-2xl px-6 py-5 border border-amber-200 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-100/40 transition-all"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    {/* WhatsApp brand SVG (Simple Icons style, single-color für Konsistenz) */}
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-emerald-600" aria-hidden="true">
                      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.413c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.866 9.866 0 001.671 5.482l.6.953-1.001 3.648 3.744-.982zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.299-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.711.307 1.265.489 1.697.626.713.226 1.362.194 1.875.118.572-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                    </svg>
                  </span>
                  <span className="font-bold text-zinc-950 truncate">WhatsApp</span>
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 group-hover:text-emerald-600 transition-colors flex-shrink-0">
                  message <ArrowRight size={14} />
                </span>
              </a>
            </li>

            {/* Instagram — Lucide Icon mit Brand-rosa */}
            <li>
              <a
                href="https://www.instagram.com/lom_combatgrappler/"
                target="_blank"
                rel="noopener noreferrer"
                data-track="cta_instagram_about"
                className="group flex items-center justify-between gap-4 bg-white rounded-2xl px-6 py-5 border border-amber-200 hover:border-pink-400 hover:shadow-lg hover:shadow-pink-100/40 transition-all"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-pink-50 group-hover:bg-pink-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    {/* Instagram brand SVG (Simple Icons) — Lucide v1.13 hat das Icon
                        nicht (Trademark-Cleanup), daher inline. */}
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-pink-600" aria-hidden="true">
                      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                    </svg>
                  </span>
                  <span className="font-bold text-zinc-950 truncate">Instagram</span>
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 group-hover:text-pink-600 transition-colors flex-shrink-0">
                  follow <ArrowRight size={14} />
                </span>
              </a>
            </li>

            {/* LinkedIn — Lucide Icon mit Brand-Blau */}
            <li>
              <a
                href="https://www.linkedin.com/in/lom-ali-imadaev-0a0915184/"
                target="_blank"
                rel="noopener noreferrer"
                data-track="cta_linkedin_about"
                className="group flex items-center justify-between gap-4 bg-white rounded-2xl px-6 py-5 border border-amber-200 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100/40 transition-all"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    {/* LinkedIn brand SVG (Simple Icons) — Lucide v1.13 hat es nicht. */}
                    <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-blue-700" aria-hidden="true">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </span>
                  <span className="font-bold text-zinc-950 truncate">LinkedIn</span>
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 group-hover:text-blue-700 transition-colors flex-shrink-0">
                  connect <ArrowRight size={14} />
                </span>
              </a>
            </li>

            {/* CV — Lucide FileUser für Lebenslauf-Icon */}
            <li>
              <a
                href="https://lomtech.github.io/cv/"
                target="_blank"
                rel="noopener noreferrer"
                data-track="cta_cv_about"
                className="group flex items-center justify-between gap-4 bg-white rounded-2xl px-6 py-5 border border-amber-200 hover:border-amber-500 hover:shadow-lg hover:shadow-amber-100/40 transition-all"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-amber-100 group-hover:bg-amber-200 flex items-center justify-center flex-shrink-0 transition-colors">
                    <FileUser size={18} className="text-amber-700" />
                  </span>
                  <span className="font-bold text-zinc-950 truncate">{en ? 'Curriculum Vitae' : 'Curriculum Vitæ'}</span>
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-amber-600 group-hover:text-amber-700 transition-colors flex-shrink-0">
                  open <ArrowRight size={14} />
                </span>
              </a>
            </li>
          </ul>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 px-5 bg-white text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-zinc-950 mb-5">
            {en ? 'Or just try it.' : 'Oder einfach ausprobieren.'}
          </h2>
          <p className="text-zinc-500 text-base mb-8 leading-relaxed">
            {en
              ? '14 days free trial. Live in 10 minutes. No credit card.'
              : '14 Tage gratis testen. Live in 10 Minuten. Ohne Kreditkarte.'}
          </p>
          <Link href="/register" data-track="cta_signup_about_bottom"
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-200">
            <Zap size={16} />
            {en ? 'Start free now' : 'Jetzt gratis starten'}
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-zinc-50 border-t border-zinc-100 py-10 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <OsssLogo variant="dark" />
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-zinc-400">
            <Link href="/" className="hover:text-zinc-700 transition-colors">{en ? 'Home' : 'Start'}</Link>
            <Link href="/pricing" className="hover:text-zinc-700 transition-colors">{en ? 'Pricing' : 'Preise'}</Link>
            <Link href="/datenschutz" className="hover:text-zinc-700 transition-colors">{en ? 'Privacy' : 'Datenschutz'}</Link>
            <Link href="/impressum" className="hover:text-zinc-700 transition-colors">Impressum</Link>
          </div>
          <p className="text-zinc-400 text-xs flex items-center gap-1.5">
            <MessageCircle size={11} />
            <a href="mailto:oss@osss.pro" className="hover:text-zinc-700 transition-colors">oss@osss.pro</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
