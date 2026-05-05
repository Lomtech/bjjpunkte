import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function authClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Run up to `limit` async tasks concurrently.
async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = []
  let i = 0
  async function run(): Promise<void> {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await tasks[idx]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, run))
  return results
}

// Composite dedup key: prefer payment_intent, fall back to identity+amount+minute.
function dedupKey(piId: string | null, identity: string, amountCents: number, paidAt: string): string {
  if (piId) return `pi:${piId}`
  return `m:${identity}:${amountCents}:${paidAt.slice(0, 16)}`
}

// POST /api/stripe/sync-payments
// Fetches all paid Stripe invoices from the connected account and
// inserts any missing records into the payments table.
//
// Also cleans up any duplicate rows already in the DB — keeps the
// first inserted row (lowest id) for each unique (payment_intent /
// member+amount+minute) combination.
export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe nicht konfiguriert' }, { status: 400 })

  const accessToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const authed = authClient(accessToken)
  const { data: { user } } = await authed.auth.getUser(accessToken)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const { data: gym } = await authed.from('gyms').select('id, stripe_account_id').single()
  if (!gym) return NextResponse.json({ error: 'Gym nicht gefunden' }, { status: 404 })

  const connectedAccountId = (gym as any).stripe_account_id as string | null
  if (!connectedAccountId) return NextResponse.json({ error: 'Kein Stripe-Konto verbunden' }, { status: 400 })

  const stripe     = new Stripe(stripeKey)
  const supabase   = serviceClient()
  const stripeOpts = { stripeAccount: connectedAccountId }

  let inserted     = 0
  let alreadyHad   = 0
  let noMemberId   = 0
  let cleaned      = 0
  const insertErrors: string[] = []

  // ── Step 0: remove existing duplicate rows for this gym ────────────────────
  // Keeps the row with the lowest id (first inserted) per unique payment.
  // Handles duplicates left by earlier sync runs before dedup was correct.
  {
    const { data: allPayments } = await supabase
      .from('payments')
      .select('id, stripe_payment_intent_id, member_id, member_name, amount_cents, paid_at')
      .eq('gym_id', (gym as any).id)
      .order('id')  // ascending — lowest id = earliest, keep this one

    if (allPayments && allPayments.length > 1) {
      const seen = new Set<string>()
      const toDelete: string[] = []

      for (const p of allPayments as any[]) {
        const identity = p.member_id ?? p.member_name ?? ''
        const key = dedupKey(p.stripe_payment_intent_id, identity, p.amount_cents, p.paid_at ?? '')
        if (seen.has(key)) {
          toDelete.push(p.id)
        } else {
          seen.add(key)
        }
      }

      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from('payments').delete().in('id', toDelete)
        if (!delErr) cleaned = toDelete.length
        else console.error('[sync-payments] cleanup error:', delErr)
      }
    }
  }

  let startingAfter: string | undefined = undefined

  while (true) {
    const invoices: Stripe.ApiList<Stripe.Invoice> = await stripe.invoices.list(
      { status: 'paid', limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) },
      stripeOpts,
    )

    // ── Step 1: collect all payment_intent IDs from this page ──────────────
    const pageInvoices = invoices.data.filter(inv => inv.amount_paid > 0)
    const piIds = pageInvoices
      .map(inv => (inv as any).payment_intent)
      .filter((id): id is string => typeof id === 'string')

    // ── Step 2: single batch query — which payment_intents are already recorded ──
    const existingPiIds = new Set<string>()
    if (piIds.length > 0) {
      const { data: existing } = await supabase
        .from('payments')
        .select('stripe_payment_intent_id')
        .in('stripe_payment_intent_id', piIds)
      for (const row of existing ?? []) {
        if ((row as any).stripe_payment_intent_id) {
          existingPiIds.add((row as any).stripe_payment_intent_id)
        }
      }
    }

    // ── Step 3: resolve memberId for invoices that need it (Stripe API calls) ──
    // Only for invoices without metadata — run up to 5 Stripe calls concurrently.
    type InvoiceResolved = {
      inv: Stripe.Invoice
      memberId: string | undefined
      gymId: string
      paymentIntentId: string | null
      memberNameFallback: string | null
      paidAt: string
      amountCents: number
    }

    const toResolve: (() => Promise<InvoiceResolved | null>)[] = pageInvoices.map(inv => async () => {
      const amountCents = inv.amount_paid
      let meta: Record<string, string> = (inv as any).subscription_details?.metadata ?? inv.metadata ?? {}
      let memberId = meta.memberId as string | undefined
      const gymId  = (meta.gymId as string | undefined) ?? (gym as any).id

      // Try subscription metadata if not directly available
      const invSub = (inv as any).subscription
      if (!memberId && invSub && typeof invSub === 'string') {
        try {
          const sub = await stripe.subscriptions.retrieve(invSub, {}, stripeOpts)
          memberId = sub.metadata?.memberId
        } catch { /* non-fatal */ }
      }

      // Fallback: match by stored stripe_customer_id
      if (!memberId) {
        const customerId = typeof (inv as any).customer === 'string' ? (inv as any).customer as string : null
        if (customerId) {
          const { data: byCustomer } = await supabase
            .from('members').select('id')
            .eq('stripe_customer_id', customerId)
            .eq('gym_id', (gym as any).id)
            .single()
          memberId = (byCustomer as any)?.id
        }
      }

      let memberNameFallback: string | null = null
      if (!memberId) {
        const customerId = typeof (inv as any).customer === 'string' ? (inv as any).customer as string : null
        if (customerId) {
          try {
            const customer = await stripe.customers.retrieve(customerId, {}, stripeOpts) as Stripe.Customer
            memberNameFallback = customer.name ?? customer.email ?? 'Ex-Mitglied'
          } catch { /* non-fatal */ }
        }
        if (!memberNameFallback) return null // truly unknown — skip
      }

      const paymentIntentId = typeof (inv as any).payment_intent === 'string'
        ? (inv as any).payment_intent as string
        : null
      const paidAt = inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
        : new Date().toISOString()

      return { inv, memberId, gymId, paymentIntentId, memberNameFallback, paidAt, amountCents }
    })

    const resolved = (await pLimit(toResolve, 5)).filter((r): r is InvoiceResolved => r !== null)

    // ── Step 4: filter out already-existing ones ────────────────────────────
    const toInsert = resolved.filter(r => {
      if (r.paymentIntentId && existingPiIds.has(r.paymentIntentId)) {
        alreadyHad++
        return false
      }
      return true
    })

    // ── Step 5: batch-resolve member names for new records ──────────────────
    const memberIds = [...new Set(toInsert.map(r => r.memberId).filter((id): id is string => !!id))]
    const memberNames = new Map<string, string>()
    if (memberIds.length > 0) {
      const { data: members } = await supabase
        .from('members').select('id, first_name, last_name')
        .in('id', memberIds)
      for (const m of members ?? []) {
        memberNames.set((m as any).id, `${(m as any).first_name} ${(m as any).last_name}`)
      }
    }

    // ── Step 6: secondary dedup — always runs as safety net ────────────────
    // Catches: (a) SEPA invoices without payment_intent, (b) invoices whose
    // payment_intent was stored as null on a previous sync and now has one,
    // (c) memberId=undefined case where .eq('member_id', '') would miss null rows.
    const afterDbDedup: InvoiceResolved[] = []
    for (const r of toInsert) {
      const dayBefore = new Date(new Date(r.paidAt).getTime() - 86_400_000).toISOString()
      const dayAfter  = new Date(new Date(r.paidAt).getTime() + 86_400_000).toISOString()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase.from('payments') as any)
        .select('id')
        .eq('amount_cents', r.amountCents)
        .eq('status', 'paid')
        .gte('paid_at', dayBefore)
        .lte('paid_at', dayAfter)
        .limit(1)

      // Narrow by identity: prefer member_id, fall back to member_name for deleted members.
      // Never use '' as a substitute for null — PostgREST treats them differently.
      if (r.memberId) {
        q = q.eq('member_id', r.memberId)
      } else if (r.memberNameFallback) {
        q = q.eq('member_name', r.memberNameFallback)
      }

      const { data: nearby } = await q
      if (nearby && nearby.length > 0) { alreadyHad++; continue }

      afterDbDedup.push(r)
    }

    // ── Step 6b: deduplicate within the current batch ───────────────────────
    // Two invoices on the same Stripe page can be identical (same PI, or same
    // member+amount+minute for SEPA invoices without a PI). Both would pass the
    // DB check above because neither is in the DB yet. Deduplicate here so only
    // the first occurrence is inserted.
    const batchSeen = new Set<string>()
    const finalToInsert: InvoiceResolved[] = []
    for (const r of afterDbDedup) {
      const identity = r.memberId ?? r.memberNameFallback ?? ''
      const key = dedupKey(r.paymentIntentId, identity, r.amountCents, r.paidAt)
      if (batchSeen.has(key)) { alreadyHad++; continue }
      batchSeen.add(key)
      finalToInsert.push(r)
    }

    // ── Step 7: batch insert all new records ─────────────────────────────────
    if (finalToInsert.length > 0) {
      const rows = finalToInsert.map(r => ({
        gym_id:                   r.gymId,
        member_id:                r.memberId ?? null,
        member_name:              r.memberId ? (memberNames.get(r.memberId) ?? r.memberNameFallback) : r.memberNameFallback,
        amount_cents:             r.amountCents,
        status:                   'paid',
        paid_at:                  r.paidAt,
        stripe_payment_intent_id: r.paymentIntentId,
      }))

      const { error: insertError } = await (supabase.from('payments') as any).insert(rows)
      if (insertError) {
        console.error('[sync-payments] batch insert error:', insertError)
        insertErrors.push(`batch(${rows.length}): ${insertError.message}`)
      } else {
        inserted += rows.length
      }
    }

    // Invoices with amount=0 counted in noMemberId (consistent with before)
    noMemberId += invoices.data.length - pageInvoices.length

    if (!invoices.has_more) break
    startingAfter = invoices.data[invoices.data.length - 1].id
  }

  return NextResponse.json({ success: true, inserted, alreadyHad, noMemberId, cleaned, insertErrors })
}
