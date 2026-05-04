/**
 * HMAC-signed OAuth state helpers.
 *
 * The state param in Stripe Connect OAuth is passed back in the callback URL.
 * Without signing, an attacker can forge the state and link any Stripe account
 * to any gym (CSRF / account takeover).
 *
 * Usage:
 *   const state = await createOAuthState(gymId)   // before redirect
 *   const gymId = await verifyOAuthState(state)    // in callback
 */

const ALGO = { name: 'HMAC', hash: 'SHA-256' }

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.OAUTH_STATE_SECRET ?? process.env.NEXTAUTH_SECRET ?? ''
  if (!secret) throw new Error('OAUTH_STATE_SECRET env var is required')
  const enc = new TextEncoder()
  return crypto.subtle.importKey('raw', enc.encode(secret), ALGO, false, ['sign', 'verify'])
}

/** Create a signed state string: "<gymId>.<hmac>" */
export async function createOAuthState(gymId: string): Promise<string> {
  const key = await getKey()
  const sig = await crypto.subtle.sign(ALGO, key, new TextEncoder().encode(gymId))
  const b64 = Buffer.from(sig).toString('base64url')
  return `${gymId}.${b64}`
}

/**
 * Verify the signed state and return the gymId.
 * Throws if invalid or tampered.
 */
export async function verifyOAuthState(state: string): Promise<string> {
  const dot = state.lastIndexOf('.')
  if (dot === -1) throw new Error('Invalid state format')

  const gymId = state.slice(0, dot)
  const sigB64 = state.slice(dot + 1)

  const key = await getKey()
  const sig = Buffer.from(sigB64, 'base64url')
  const valid = await crypto.subtle.verify(ALGO, key, sig, new TextEncoder().encode(gymId))

  if (!valid) throw new Error('State signature invalid')
  return gymId
}
