import type { Metadata } from 'next'

// Hard noindex on the entire /admin/** tree — this is internal tooling for the
// platform owner only. Gym customers should never see this.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  title: 'Internal · Osss',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-osss-internal="admin-only">
      {children}
    </div>
  )
}
