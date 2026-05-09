// Static data for the landing page — pure data, no React, importable by both RSC and Client.
// Originally inlined in src/app/page.tsx (which was 'use client'); extracted so RSC sections
// can render them server-side without dragging the whole page into the client bundle.

export type SportId =
  | 'bjj' | 'judo' | 'karate' | 'mma' | 'muaythai'
  | 'boxing' | 'wrestling' | 'taekwondo' | 'wingtsun' | 'kungfu'

export const SPORTS: { id: SportId; label: string; belt: boolean }[] = [
  { id: 'bjj',       label: 'BJJ',       belt: true  },
  { id: 'judo',      label: 'Judo',      belt: true  },
  { id: 'karate',    label: 'Karate',    belt: true  },
  { id: 'taekwondo', label: 'Taekwondo', belt: true  },
  { id: 'wingtsun',  label: 'Wing Tsun', belt: true  },
  { id: 'kungfu',    label: 'Kung Fu',   belt: true  },
  { id: 'mma',       label: 'MMA',       belt: false },
  { id: 'muaythai',  label: 'Muay Thai', belt: false },
  { id: 'boxing',    label: 'Boxen',     belt: false },
  { id: 'wrestling', label: 'Ringen',    belt: false },
]

type SportFeature = { title: string; items: string[] }

const SPORT_FEATURES_DE: Record<SportId, SportFeature> = {
  bjj:       { title: 'Für BJJ optimiert',          items: ['5-Gürtel-System (Weiß bis Schwarz)', 'Streifen-Tracking bis 4 Stufen', 'Gi / No-Gi Klassen-Typen', 'Promotions mit Verlauf & Datum'] },
  judo:      { title: 'Für Judo konfiguriert',      items: ['7-Stufen Kyu-System', 'Gelb bis Schwarz vorkonfiguriert', 'Wettkampf-Klassen-Typen', 'Dan-Grade frei erweiterbar'] },
  karate:    { title: 'Für Karate konfiguriert',    items: ['8 Kyu-Stufen vorkonfiguriert', 'Kata & Kumite Klassen-Typen', 'Prüfungsprotokoll per Promotion', 'Farben & Labels anpassbar'] },
  taekwondo: { title: 'Für Taekwondo konfiguriert', items: ['6 Gürtelfarben vorkonfiguriert', 'Poomse & Sparring Klassen', 'Prüfungsprotokoll', 'Dan-Grade frei erweiterbar'] },
  wingtsun:  { title: 'Für Wing Tsun konfiguriert', items: ['Schülergrade 1-12 + 4 Technikergrade', 'EWTO-kompatibles Stufensystem', 'Chi Sao & Lat Sao Klassen-Typen', 'Lehrerprüfungen mit Datum & Notizen'] },
  kungfu:    { title: 'Für Kung Fu konfiguriert',   items: ['Sash-Farben (Weiß bis Schwarz)', 'Wushu, Wing Chun, Sanda kompatibel', 'Forms & Sparring Klassen-Typen', 'Belt-System pro Schule deaktivierbar'] },
  mma:       { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Fokus auf Anwesenheit & Zahlungen', 'Sparring & Klassen verwalten', 'Mitglieder-Portal ohne Gürtel'] },
  muaythai:  { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Pad Work & Sparring Klassen', 'Anwesenheit & Beiträge', 'Eigene Klassen-Typen konfigurierbar'] },
  boxing:    { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Boxklassen & Sparring verwalten', 'Wettkampf-Tracking per Notiz', 'Monatsbeiträge per Stripe'] },
  wrestling: { title: 'Kein Gürtelsystem nötig',    items: ['Belt-Tracking deaktiviert', 'Ringen & Freistil Klassen', 'Gewichtsklassen als Notiz', 'Anwesenheit & Mitglieder'] },
}

const SPORT_FEATURES_EN: Record<SportId, SportFeature> = {
  bjj:       { title: 'Optimised for BJJ',       items: ['5-belt system (White to Black)', 'Stripe tracking up to 4 levels', 'Gi / No-Gi class types', 'Promotions with history & date'] },
  judo:      { title: 'Configured for Judo',      items: ['7-level Kyu system', 'Yellow to Black pre-configured', 'Competition class types', 'Dan grades freely extendable'] },
  karate:    { title: 'Configured for Karate',    items: ['8 Kyu levels pre-configured', 'Kata & Kumite class types', 'Exam log per promotion', 'Colours & labels customisable'] },
  taekwondo: { title: 'Configured for Taekwondo', items: ['6 belt colours pre-configured', 'Poomsae & Sparring classes', 'Exam log', 'Dan grades freely extendable'] },
  wingtsun:  { title: 'Configured for Wing Tsun', items: ['Student grades 1-12 + 4 technician grades', 'EWTO-compatible level system', 'Chi Sao & Lat Sao class types', 'Teacher exams with date & notes'] },
  kungfu:    { title: 'Configured for Kung Fu',   items: ['Sash colours (White to Black)', 'Wushu, Wing Chun, Sanda compatible', 'Forms & Sparring class types', 'Belt system can be disabled per school'] },
  mma:       { title: 'No belt system needed',    items: ['Belt tracking disabled', 'Focus on attendance & payments', 'Manage sparring & classes', 'Member portal without belts'] },
  muaythai:  { title: 'No belt system needed',    items: ['Belt tracking disabled', 'Pad work & sparring classes', 'Attendance & dues', 'Custom class types configurable'] },
  boxing:    { title: 'No belt system needed',    items: ['Belt tracking disabled', 'Manage boxing classes & sparring', 'Competition tracking via notes', 'Monthly dues via Stripe'] },
  wrestling: { title: 'No belt system needed',    items: ['Belt tracking disabled', 'Wrestling & freestyle classes', 'Weight classes as notes', 'Attendance & members'] },
}

export function getSportFeatures(lang: 'de' | 'en'): Record<SportId, SportFeature> {
  return lang === 'en' ? SPORT_FEATURES_EN : SPORT_FEATURES_DE
}

export const MARQUEE_ITEMS_DE = [
  'BJJ', 'MMA', 'Judo', 'Karate', 'Muay Thai', 'Boxen', 'Ringen', 'Taekwondo',
  'Hamburg', 'München', 'Berlin', 'Köln', 'Frankfurt', 'Stuttgart', 'Leipzig', 'Dresden',
  'BJJ', 'MMA', 'Judo', 'Karate', 'Muay Thai', 'Boxen', 'Ringen', 'Taekwondo',
  'Hamburg', 'München', 'Berlin', 'Köln', 'Frankfurt', 'Stuttgart', 'Leipzig', 'Dresden',
]

export const MARQUEE_ITEMS_EN = [
  'BJJ', 'MMA', 'Judo', 'Karate', 'Muay Thai', 'Boxing', 'Wrestling', 'Taekwondo',
  'Hamburg', 'Munich', 'Berlin', 'Cologne', 'Frankfurt', 'Stuttgart', 'Leipzig', 'Dresden',
  'BJJ', 'MMA', 'Judo', 'Karate', 'Muay Thai', 'Boxing', 'Wrestling', 'Taekwondo',
  'Hamburg', 'Munich', 'Berlin', 'Cologne', 'Frankfurt', 'Stuttgart', 'Leipzig', 'Dresden',
]
