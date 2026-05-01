/**
 * Returns the correct public URL for the app.
 * Priority: NEXT_PUBLIC_APP_URL → VERCEL_URL (auto-set by Vercel) → fallback
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  return 'https://bjjpunkte.vercel.app'
}

export function getWebhookUrl(): string {
  return `${getAppUrl()}/api/stripe/webhook`
}
