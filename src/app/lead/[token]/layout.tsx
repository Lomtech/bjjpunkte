import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params
  return {
    // Override root manifest — lead portal gets its own manifest with correct start_url
    manifest: `/api/public/lead/${token}/manifest`,
    appleWebApp: {
      capable: true,
      title: 'Mein Portal',
      statusBarStyle: 'black-translucent',
    },
  }
}

export default function LeadPortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
