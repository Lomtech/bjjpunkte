import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Osss – Gym-Software für BJJ',
    short_name: 'Osss',
    description: 'Mitgliederverwaltung, Belt-Tracking und Zahlungen für BJJ-Gyms.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    categories: ['sports', 'business', 'productivity'],
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Mitglieder',
        url: '/dashboard/members',
        description: 'Mitgliederliste öffnen',
      },
      {
        name: 'Anwesenheit',
        url: '/dashboard/attendance',
        description: 'Einchecken',
      },
    ],
  }
}
