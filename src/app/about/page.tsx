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
import { ContactButton } from '@/app/_landing/ContactButton'
import { getServerLang } from '@/lib/i18n/server'
import { Calendar, MessageCircle, Zap, ArrowRight, MapPin } from 'lucide-react'

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
              { num: '€ 0', label: 'until you have 31 active members', sub: 'Free tier is not a 14-day trial. It\'s the actual product, forever, up to 30 paying members.' },
            ] : [
              { num: '0 %', label: 'Plattformgebühr auf Beiträge — niemals', sub: 'Stripe Connect leitet Zahlungen direkt aufs Gym-Konto. Wir verdienen an Abos, nicht am Mitglied.' },
              { num: '< 10 Min', label: 'vom Sign-up zum Live-Gym', sub: 'Kein Sales-Call. Kein 14-Tage-Onboarding. Account anlegen, Mitglieder importieren, Portal-Link teilen.' },
              { num: '0 €', label: 'bis zum 31. aktiven Mitglied', sub: 'Free-Tier ist keine 14-Tage-Probe. Das ist das echte Produkt, dauerhaft, bis 30 zahlende Mitglieder.' },
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

      {/* ── CONTACT / CONNECT ── */}
      <section className="py-20 px-5 bg-amber-50 border-b border-amber-200">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-amber-700 font-bold text-[10px] uppercase tracking-[0.2em] mb-3">
            {en ? 'Direct line to the founder' : 'Direkter Draht zum Founder'}
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight mb-5">
            {en ? 'Talk to me — really me.' : 'Schreib mir — wirklich mir.'}
          </h2>
          <p className="text-zinc-600 text-base mb-10 leading-relaxed">
            {en
              ? 'No support ticket queue. No "an agent will reply within 48 hours". You write, I read it, I reply — usually same day.'
              : 'Keine Support-Ticket-Schleife. Kein „ein Agent meldet sich in 48 Stunden". Du schreibst, ich lese es, ich antworte — meist am selben Tag.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {/* Plain <a> statt <Link>: cross-page Hash-Navigation umgeht Next.js-
                Prefetch-Caching (Prefetch hatte sonst die Page in vorigen
                Sprache gecached → User sah deutsch trotz EN-Setting). */}
            <a href="/#book-demo" data-track="cta_demo_about"
              className="inline-flex items-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Calendar size={15} className="text-amber-400" />
              {en ? '20-min demo with me' : '20-Min-Demo mit mir'}
            </a>
            {/* Kontakt-Modal-Trigger als Outlined-Button (statt mailto + tertiary-Link).
                Nutzt ContactButton mit Custom-Class für Button-Styling. */}
            <ContactButton lang={lang} className="inline-flex items-center gap-2 border border-zinc-300 hover:border-zinc-400 hover:bg-white text-zinc-700 font-semibold px-6 py-3 rounded-xl text-sm transition-all" />
          </div>
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
              ? 'Free up to 30 members. Live in 10 minutes. No credit card.'
              : 'Bis 30 Mitglieder gratis. Live in 10 Minuten. Ohne Kreditkarte.'}
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
