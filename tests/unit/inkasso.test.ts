/**
 * Unit tests for the provider-agnostic Inkasso scaffold (src/lib/inkasso).
 * Pure — no DB, no network. The SandboxProvider takes its config via the
 * constructor so tests are deterministic without env vars.
 */

import { describe, test, expect } from 'vitest'
import {
  registerProvider,
  getProvider,
  getApiProvider,
  listConfiguredProviders,
  isHandoffStatus,
  buildReference,
  type InkassoProvider,
  type InkassoCase,
} from '@/lib/inkasso/provider'
import { SandboxProvider } from '@/lib/inkasso/sandbox'

const baseCase: InkassoCase = {
  handoffId: 'abcdef12-3456-7890-aaaa-bbbbbbbbbbbb',
  gymId: 'gym12345-6789-0000-1111-222222222222',
  memberId: 'mem00000-0000-0000-0000-000000000000',
  amountCents: 123_45,
  reference: 'OSSS-gym12345-abcdef12',
  debtor: { firstName: 'Max', lastName: 'Müller', email: 'max@example.com' },
  creditor: { gymName: 'CSC FFB' },
  notes: null,
}

describe('handoff status helpers', () => {
  test('isHandoffStatus accepts the live CHECK values, rejects others', () => {
    for (const s of ['initiated', 'pdf_exported', 'sent_to_provider', 'accepted', 'rejected', 'paid', 'written_off', 'closed']) {
      expect(isHandoffStatus(s)).toBe(true)
    }
    for (const s of ['submitted', 'open', 'done', '']) expect(isHandoffStatus(s)).toBe(false)
  })

  test('buildReference is stable + derived from gym+handoff', () => {
    expect(buildReference(baseCase.gymId, baseCase.handoffId)).toBe('OSSS-gym12345-abcdef12')
  })
})

describe('SandboxProvider — submitCase', () => {
  const sb = new SandboxProvider({ enabled: true, webhookSecret: 's3cret' })

  test('is configured only when enabled', () => {
    expect(sb.isConfigured()).toBe(true)
    expect(new SandboxProvider({ enabled: false, webhookSecret: '' }).isConfigured()).toBe(false)
  })

  test('submit returns sent_to_provider + deterministic reference', async () => {
    const r = await sb.submitCase(baseCase)
    expect(r.ok).toBe(true)
    expect(r.status).toBe('sent_to_provider')
    expect(r.referenceId).toBe('SBX-ABCDEF12')
    // same handoff → same provider reference (idempotent)
    const r2 = await sb.submitCase(baseCase)
    expect(r2.referenceId).toBe(r.referenceId)
  })
})

describe('SandboxProvider — webhook verify + parse', () => {
  const sb = new SandboxProvider({ enabled: true, webhookSecret: 's3cret' })

  test('verifyWebhook matches the shared secret (constant-time)', () => {
    expect(sb.verifyWebhook('body', { 'x-inkasso-secret': 's3cret' })).toBe(true)
    expect(sb.verifyWebhook('body', { 'x-inkasso-secret': 'wrong' })).toBe(false)
    expect(sb.verifyWebhook('body', {})).toBe(false)
  })

  test('verifyWebhook is false when no secret configured', () => {
    const noSecret = new SandboxProvider({ enabled: true, webhookSecret: '' })
    expect(noSecret.verifyWebhook('body', { 'x-inkasso-secret': '' })).toBe(false)
  })

  test('parseWebhook maps a valid payload to a StatusUpdate', () => {
    const out = sb.parseWebhook({ reference_id: 'SBX-ABCDEF12', status: 'paid' })
    expect(out).toEqual([{ referenceId: 'SBX-ABCDEF12', status: 'paid', raw: { reference_id: 'SBX-ABCDEF12', status: 'paid' } }])
  })

  test('parseWebhook rejects invalid status / missing fields', () => {
    expect(sb.parseWebhook({ reference_id: 'X', status: 'bogus' })).toBeNull()
    expect(sb.parseWebhook({ status: 'paid' })).toBeNull()
    expect(sb.parseWebhook(null)).toBeNull()
    expect(sb.parseWebhook('nope')).toBeNull()
  })
})

describe('provider registry', () => {
  test('register → getProvider; getApiProvider gates on isConfigured', () => {
    const configured = new SandboxProvider({ enabled: true, webhookSecret: 's' })
    registerProvider(configured)
    expect(getProvider('other')).toBeTruthy()
    expect(getApiProvider('other')).toBeTruthy()
    expect(listConfiguredProviders()).toContain('other')

    // an unconfigured provider is registered but NOT returned by getApiProvider
    const unconfigured: InkassoProvider = {
      name: 'eos',
      isConfigured: () => false,
      submitCase: async () => ({ ok: false, status: 'initiated', raw: {}, error: 'no creds' }),
    }
    registerProvider(unconfigured)
    expect(getProvider('eos')).toBeTruthy()
    expect(getApiProvider('eos')).toBeNull()
    expect(listConfiguredProviders()).not.toContain('eos')
  })

  test('unknown provider → null', () => {
    expect(getProvider('does-not-exist')).toBeNull()
    expect(getApiProvider('does-not-exist')).toBeNull()
  })
})
