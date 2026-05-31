/**
 * GrowthBook Feature-Flag-Helper.
 *
 * Sprint Phase-2 (2026-05-31). Gradual Rollouts, A/B-Tests, Kill-Switches —
 * ohne Deploy. GrowthBook Open-Source-Cloud: free unlimited Flags + Users.
 *
 * Setup:
 *   1. https://app.growthbook.io → Sign up (free)
 *   2. SDK Connections → Create → Next.js → API-Key kopieren
 *   3. In Vercel/Coolify-Env: GROWTHBOOK_SDK_KEY + NEXT_PUBLIC_GROWTHBOOK_SDK_KEY
 *      (gleicher Wert — Server + Client beide pollen)
 *
 * Wenn nicht configured → Default-Werte aus dem Code (siehe DEFAULTS unten).
 */

import { GrowthBook } from '@growthbook/growthbook'

const SDK_KEY = process.env.GROWTHBOOK_SDK_KEY
            ?? process.env.NEXT_PUBLIC_GROWTHBOOK_SDK_KEY
            ?? null

/**
 * Default-Werte fuer den Fall dass GrowthBook nicht configured ist (Dev /
 * neuer Vercel-Project / GrowthBook down). Alle Server-Side-Checks lesen
 * von hier wenn der SDK-Cache leer ist.
 */
const DEFAULTS: Record<string, boolean | string | number> = {
  // Beispiel: Punch-Card V2 ist aus per default
  enable_punch_card_v2: false,
  // Beispiel: Redis-Cache-Debug-Logging
  redis_debug_logging: false,
  // Beispiel: neue Lead-Pipeline-UI
  leads_kanban_view: false,
}

let gb: GrowthBook | null = null
let gbInit: Promise<GrowthBook | null> | null = null

async function getGB(): Promise<GrowthBook | null> {
  if (gb) return gb
  if (gbInit) return gbInit
  if (!SDK_KEY) return null

  gbInit = (async () => {
    try {
      const client = new GrowthBook({
        apiHost: 'https://cdn.growthbook.io',
        clientKey: SDK_KEY,
        enableDevMode: process.env.NODE_ENV !== 'production',
      })
      await client.init({ timeout: 1000 })
      gb = client
      return client
    } catch (err) {
      console.error('[feature-flags] GrowthBook init failed', err)
      return null
    }
  })()
  return gbInit
}

/**
 * Pruefe ob ein Boolean-Flag aktiv ist.
 *
 * @param key Flag-Name (camelCase oder snake_case nach GrowthBook-Style)
 * @param attributes Optional: User/Gym-Attribute fuer Targeting
 */
export async function isFlagOn(
  key: string,
  attributes?: Record<string, string | number | boolean>,
): Promise<boolean> {
  const client = await getGB()
  if (!client) return Boolean(DEFAULTS[key] ?? false)
  if (attributes) client.setAttributes(attributes)
  return client.isOn(key)
}

/**
 * Hole einen String/Number-Wert (Multivariate-Test).
 */
export async function getFeatureValue<T = string | number | boolean>(
  key: string,
  fallback: T,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const client = await getGB()
  if (!client) return (DEFAULTS[key] as T) ?? fallback
  if (attributes) client.setAttributes(attributes)
  return client.getFeatureValue(key, fallback) as T
}

/**
 * Force-Refresh des Flag-Cache. Sinnvoll wenn Owner gerade ein Flag im
 * GrowthBook-Dashboard geflippt hat und es sofort im Server-Cache haben will.
 */
export async function refreshFlags(): Promise<void> {
  const client = await getGB()
  if (client) await client.refreshFeatures()
}
