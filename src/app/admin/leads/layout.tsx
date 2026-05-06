import type { Metadata, Viewport } from 'next'

// Override the parent /admin layout: the Sales-CRM is its own installable
// PWA, distinct from the gym dashboard. iOS reads <link rel="manifest"> +
// apple-* meta tags to decide what the homescreen icon launches into.
export const metadata: Metadata = {
  manifest: '/sales-crm-manifest.webmanifest',
  title: 'osss Sales-CRM',
  applicationName: 'osss Sales-CRM',
  appleWebApp: {
    capable: true,
    title: 'osss CRM',
    statusBarStyle: 'default',
    startupImage: ['/apple-icon'],
  },
  // Keep noindex from parent /admin/layout
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  formatDetection: { telephone: true, email: true, address: true },
}

export const viewport: Viewport = {
  themeColor: '#fbbf24',
  // Ensure inputs don't trigger zoom + content fits the safe area
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function SalesCrmLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
