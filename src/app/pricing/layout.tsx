import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Preise – Ein Plan, alles inklusive',
  description:
    'Osss-Preise: 14 Tage gratis testen, danach 49 €/Monat oder 39 €/Monat im Jahresabo. 0 % Plattformgebühr. Unbegrenzte Mitglieder. Jederzeit kündbar.',
  alternates: {
    canonical: '/pricing',
    languages: {
      'de-DE': '/pricing',
      'en-US': '/pricing?lang=en',
    },
  },
  openGraph: {
    title: 'Osss-Preise – Ein Plan, alles inklusive',
    description:
      '49 €/Monat (oder 39 €/Monat jährlich). 0 % Plattformgebühr auf Mitglieds-Beiträge. Unbegrenzte Mitglieder, alle Features ab Tag 1.',
    url: 'https://www.osss.pro/pricing',
    type: 'website',
    locale: 'de_DE',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
