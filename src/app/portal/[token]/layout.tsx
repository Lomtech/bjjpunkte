import type { Metadata } from 'next'

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params
  return {
    // Override root manifest — portal gets its own manifest with correct start_url
    manifest: `/api/portal/${token}/manifest`,
    appleWebApp: {
      capable: true,
      title: 'Mein Portal',
      statusBarStyle: 'black-translucent',
    },
  }
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
