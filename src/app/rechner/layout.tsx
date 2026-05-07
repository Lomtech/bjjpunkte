import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gym-Software-Kosten-Rechner',
  description:
    'Was kostet dich Excel oder Eversports wirklich pro Jahr? Trag deine Mitgliederzahl + Stunden ein — bekommst sofort die Ersparnis im Vergleich zu Osss.',
  alternates: { canonical: '/rechner' },
  openGraph: {
    title: 'Gym-Software-Kosten-Rechner — was kostet dich Excel?',
    description: 'Interaktives Tool: Manuelle Verwaltung vs. Eversports vs. Osss.',
    url: 'https://www.osss.pro/rechner',
    type: 'website',
    locale: 'de_DE',
  },
  robots: { index: true, follow: true },
}

export default function RechnerLayout({ children }: { children: React.ReactNode }) {
  return children
}
