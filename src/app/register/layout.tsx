import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kostenlos registrieren – Dein Gym in 10 Minuten',
  description:
    'Erstelle dein Osss-Gym kostenlos. Bis 30 Mitglieder gratis, keine Kreditkarte, kein Verkaufs-Call. DSGVO-konform, DATEV-Export inklusive.',
  alternates: {
    canonical: '/register',
    languages: {
      'de-DE': '/register',
      'en-US': '/register?lang=en',
    },
  },
  openGraph: {
    title: 'Osss kostenlos registrieren',
    description:
      'Dein Gym ist live in 10 Minuten. Bis 30 Mitglieder kostenlos. Keine Kreditkarte.',
    url: 'https://www.osss.pro/register',
    type: 'website',
    locale: 'de_DE',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
