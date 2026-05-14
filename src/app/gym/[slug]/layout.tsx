/**
 * Server-Layout für die Public-Gym-Page (osss.pro/gym/[slug]).
 *
 * Audit 2026-05-14: vorher hatte die Page weder `generateMetadata` noch
 * Open-Graph-Tags pro Gym — wenn ein Studio seinen Link in WhatsApp/Slack/
 * LinkedIn pastete, kam keine Brand-Preview (kein Studio-Name, kein Logo,
 * kein Stadt-Kontext). Massiver Trust-Signal-Killer für Studios die ihre
 * eigene Gym-Seite teilen wollen.
 *
 * Lösung: server-side Layout, das die public-API anfragt und dynamische
 * <title> + Open-Graph + Twitter-Card erzeugt. Die Page selbst bleibt
 * 'use client' für Interaktion — die Metadata-Schicht ist ein separates
 * Server-Component davor.
 */
import type { Metadata } from 'next'
import { getAppUrl } from '@/lib/app-url'

interface GymPublicData {
  gym?: {
    name: string
    tagline: string | null
    about: string | null
    logo_url: string | null
    hero_image_url: string | null
    address: string | null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params

  // Fetch the public-gym payload through our own API so we re-use the same
  // RLS-respecting query, the same cache, and the same field-set.
  // Failure modes: API down → fall back to generic metadata that still
  // shows the brand. Never throw — broken metadata blocks the page render.
  let gymData: GymPublicData['gym'] | null = null
  try {
    const res = await fetch(`${getAppUrl()}/api/public/gym/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    })
    if (res.ok) {
      const json = await res.json() as GymPublicData
      gymData = json.gym ?? null
    }
  } catch {
    // fall through to generic
  }

  if (!gymData) {
    return {
      title: 'Gym · Osss',
      description: 'Trainings-Plan, Probetraining buchen, Mitglied werden — direkt auf der Gym-Seite.',
      robots: { index: false, follow: false },
    }
  }

  const title = gymData.tagline
    ? `${gymData.name} — ${gymData.tagline}`
    : gymData.name
  const description = gymData.about
    ? gymData.about.slice(0, 200)
    : `Trainings-Plan, Probetraining buchen und Mitglied werden bei ${gymData.name}${gymData.address ? ` in ${gymData.address.split(',').pop()?.trim() ?? ''}` : ''}.`

  const ogImage = gymData.hero_image_url ?? gymData.logo_url ?? `${getAppUrl()}/opengraph-image`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${getAppUrl()}/gym/${slug}`,
      siteName: 'Osss',
      images: ogImage ? [{ url: ogImage, alt: gymData.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
    alternates: {
      canonical: `${getAppUrl()}/gym/${slug}`,
    },
  }
}

export default function GymPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
