import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Preise – Vier Pläne, keine Versteckkosten',
  description:
    'Osss-Preise: kostenlos bis 30 Mitglieder, dann ab €29/Monat. 0% Plattformgebühr. 30 Tage gratis testen, jederzeit kündbar.',
  alternates: {
    canonical: '/pricing',
    languages: {
      'de-DE': '/pricing',
      'en-US': '/pricing?lang=en',
    },
  },
  openGraph: {
    title: 'Osss-Preise – Vier Pläne, keine Versteckkosten',
    description:
      'Kostenlos bis 30 Mitglieder. Dann €29/€59/€99 pro Monat. 0% Plattformgebühr — du zahlst nur die Stripe-Gebühren.',
    url: 'https://www.osss.pro/pricing',
    type: 'website',
    locale: 'de_DE',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
