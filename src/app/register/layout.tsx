import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '14 Tage gratis testen – Dein Gym in 10 Minuten',
  description:
    'Erstelle dein Osss-Gym mit 14-Tage-Trial. Ohne Kreditkarte, ohne Verkaufs-Call. Danach 49 €/Monat (oder 39 €/Monat jährlich). DSGVO + DATEV-Export inklusive.',
  alternates: {
    canonical: '/register',
    languages: {
      'de-DE': '/register',
      'en-US': '/register?lang=en',
    },
  },
  openGraph: {
    title: 'Osss — 14 Tage gratis testen',
    description:
      'Dein Gym ist live in 10 Minuten. 14 Tage gratis testen, ohne Kreditkarte. Danach 49 €/Monat oder 39 €/Monat jährlich.',
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
