// Sandbox Inkasso provider — deterministic, no network. Lets the whole
// handoff→submit→webhook→status flow be exercised end-to-end before any real
// provider contract exists. Enabled via INKASSO_SANDBOX_ENABLED=true.
//
// A real provider (e.g. fair_pay, debtist) is a sibling file implementing the
// same InkassoProvider interface — submitCase() hits their REST API, verify/
// parseWebhook() handle their callback signature + payload shape.

import { timingSafeEqual } from 'node:crypto'
import {
  type InkassoProvider,
  type InkassoCase,
  type SubmitResult,
  type StatusUpdate,
  isHandoffStatus,
} from './provider'

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export class SandboxProvider implements InkassoProvider {
  readonly name = 'other' // maps to the 'other' provider slot in the CHECK constraint

  constructor(
    private readonly opts: { enabled: boolean; webhookSecret: string } = {
      enabled: process.env.INKASSO_SANDBOX_ENABLED === 'true',
      webhookSecret: process.env.INKASSO_WEBHOOK_SECRET ?? '',
    },
  ) {}

  isConfigured(): boolean {
    return this.opts.enabled
  }

  async submitCase(c: InkassoCase): Promise<SubmitResult> {
    // Deterministic external reference derived from our handoff id — idempotent:
    // re-submitting the same handoff yields the same provider case id.
    const referenceId = `SBX-${c.handoffId.slice(0, 8).toUpperCase()}`
    return {
      ok: true,
      referenceId,
      status: 'sent_to_provider',
      raw: {
        sandbox: true,
        reference: c.reference,
        debtor: `${c.debtor.firstName} ${c.debtor.lastName}`.trim(),
        amount_cents: c.amountCents,
      },
    }
  }

  verifyWebhook(_rawBody: string, headers: Record<string, string>): boolean {
    if (!this.opts.webhookSecret) return false
    const provided = headers['x-inkasso-secret'] ?? ''
    return constantTimeEqual(provided, this.opts.webhookSecret)
  }

  parseWebhook(payload: unknown): StatusUpdate[] | null {
    if (!payload || typeof payload !== 'object') return null
    const p = payload as Record<string, unknown>
    const referenceId = typeof p.reference_id === 'string' ? p.reference_id : null
    const status = typeof p.status === 'string' ? p.status : null
    if (!referenceId || !status || !isHandoffStatus(status)) return null
    return [{ referenceId, status, raw: p }]
  }
}
