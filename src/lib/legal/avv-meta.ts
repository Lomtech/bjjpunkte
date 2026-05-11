/**
 * AVV-Metadaten (Constants only, KEINE JSX).
 *
 * Audit 2026-05-11: AVV-API-Routes (`/api/avv/status`, `/api/avv/accept`)
 * importierten AVV_VERSION direkt aus `avv-content.tsx` (JSX-Datei). Unter
 * Next.js 16 verursachte das einen Module-Load-Crash der Routes — Symptom
 * war ein generischer Plain-Text-500 "Internal Server Error" der den
 * graceful-Fallback im Handler-Code nie erreichte.
 *
 * Lösung: Constants leben hier in einer reinen `.ts`-Datei, JSX-Renderer
 * bleibt in `avv-content.tsx` und re-importiert die Constants. API-Routes
 * importieren NUR aus diesem Modul.
 */

export const AVV_VERSION = '1.0-2026-05-06'

export const AVV_PROVIDER = {
  name: 'Lom-Ali Imadaev (Osss)',
  address: 'Kreuzstraße 1, 82276 Adelshofen, Deutschland',
  email: 'oss@osss.pro',
}

/** Sub-Auftragsverarbeiter laut Art. 28(2) DSGVO. Bei Änderung Version bumpen! */
export const AVV_SUBPROCESSORS = [
  { name: 'Supabase Inc.',                        purpose: 'Datenbank, Authentifizierung, Storage', country: 'UK / USA', safeguard: 'EU-Adequacy-Decision UK + SCCs für US-Mutter' },
  { name: 'Stripe Payments Europe Ltd. / Stripe Inc.', purpose: 'Zahlungsabwicklung',                country: 'IE / USA', safeguard: 'EU-SCCs + DPF + PCI-DSS' },
  { name: 'Vercel Inc.',                          purpose: 'Hosting der Webanwendung',              country: 'USA',     safeguard: 'EU-SCCs + EU-US Data Privacy Framework' },
  { name: 'Resend Inc.',                          purpose: 'Transaktionaler E-Mail-Versand',        country: 'USA',     safeguard: 'EU-Standardvertragsklauseln' },
  { name: 'Functional Software, Inc. (Sentry)',   purpose: 'Anonymes Fehler-Tracking (kein PII)',   country: 'USA',     safeguard: 'EU-Standardvertragsklauseln' },
  { name: 'Upstash, Inc.',                        purpose: 'Rate-Limiting (Redis)',                 country: 'USA',     safeguard: 'EU-Standardvertragsklauseln' },
] as const

export interface AVVRenderProps {
  gymName: string
  gymAddress: string | null
  gymLegalName: string | null
}
