import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Anmelden',
  description: 'Melde dich in deinem Osss-Gym-Account an. Mitglieder, Beiträge, Stundenplan — einen Klick entfernt.',
  alternates: { canonical: '/login' },
  // Login-Page muss nicht im Search-Index erscheinen — keinen SEO-Wert
  robots: {
    index: false,
    follow: true,
  },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
