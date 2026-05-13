# Pricing Rationale — May 2026 realignment

> **Audience.** This 1-pager exists so a future lawyer, tax advisor, board member,
> or auditor can reconstruct *why* Osss prices what it prices. It is not customer-facing.

> **Status.** Decision taken 2026-05-08. Effective on the public site immediately.
> First customers under the new pricing: pilot-cohort applicants from May 2026 onward.

## 1. The change at a glance

| Tier    | Member window | Old monthly | **New monthly** | Annual (10 × monthly) |
|---------|---------------|-------------|-----------------|-----------------------|
| Free    | 0–30          | 0 €         | **0 €**         | 0 €                   |
| Starter | 31–99         | 29 €        | **49 €**        | 490 €                 |
| Grow    | 100–249       | 49 €        | **89 €**        | 890 €                 |
| Pro     | 250+          | 99 €        | **149 €**       | 1,490 €               |

Free tier is **not** time-limited. A studio that stays under 30 active
members never pays anything.

## 2. Why these numbers

### 2.1 Market benchmarking (verified 2026-05-08, public list prices)

| Provider     | Range          | Free tier | Notes |
|--------------|----------------|-----------|-------|
| **Osss**     | 0–149 €        | yes       | 0 % platform fee |
| Eversports   | ~49–149 €      | no        | ~1.5 % on member payments |
| Aidoo        | ~69–149 €      | no        | 12-month minimum term |
| Magicline    | ~99–300 €      | no        | Setup fee 500–1,500 € + ~1.5 % |

We sit at the **lower end of the mid-tier** on monthly fees while
**under-cutting all three competitors on total cost of ownership**:
no setup fee, no minimum term, no platform fee on member payments.

### 2.2 Cost-of-ownership math (50-member studio, 1 year)

- Osss Starter: **49 € × 12 = 588 €** (+ Stripe processing only)
- Eversports equivalent: **49 € × 12 + 1.5 % × ~3.6 k€ = 1,128 €**
- Excel + manual admin (3 h/week × 40 €/h): **6,000 € in opportunity cost**

This is the comparison shown on the landing page. It remains valid under
the new Starter price.

### 2.3 Why we did not stay at 29 € / 49 € / 99 €

- 29 € underpriced our **DSGVO-Premium** stack (encryption, eIDAS-signed
  AVV, 6 sub-processors disclosed). Studios perceived "too cheap to be
  serious".
- The lower price made it impossible to absorb a single support
  conversation per customer per month at our planned support SLAs.
- Magicline's entry price is ~99 € — being 3.4× cheaper made us look
  like a hobby project to studios already spending money on software.

The new pricing **still leaves Magicline 2× more expensive** at every
tier, so we keep our positioning ("pro software at fair pricing") while
giving ourselves margin to fund support and development.

## 3. Conversion-rate assumptions

These are working assumptions used to set the price, not commitments.

- **Free → Starter conversion target:** 8 % within 90 days of hitting
  the 30-member ceiling. Industry benchmark for SMB SaaS freemium is 2–5 %.
- **Starter → Grow upgrade:** 25 % within 12 months — our member-window
  bands are designed so that a healthy growing studio naturally migrates.
- **Annual-plan adoption:** 30 % of paying customers within 6 months,
  attracted by the "2 months free" framing. This brings forward cash
  and improves working capital.
- **Churn:** 3 %/month assumed for Starter, 1.5 %/month for Grow/Pro.

If we miss any of these by >50 % for two consecutive quarters,
the next pricing review (see §6) is triggered early.

## 4. Lifetime-Pilot programme — REMOVED 2026-05-13

The PILOT10 40 %-off-lifetime discount was retired on 2026-05-13.
Public pricing is now uniform: 49 €/month monthly, 39 €/month annual,
no promo codes, no first-N-discount.

### Why it was removed

- **Anchoring problem.** A visible "40 % off forever" discount
  trained prospects to wait for the discount rather than buy at
  standard price. Future paying customers would have asked
  "where's mine?".
- **Loss-aversion is bidirectional.** The discount we offered as a
  carrot also signalled "we're not sure our price is right" — a
  weaker founder signal than charging the asked price confidently.
- **No promise rollback.** Existing pilot studios (none signed as of
  2026-05-13) would have been unaffected. Removal is a forward-only
  change to the public marketing surface.

### What replaced it

- 14-day free trial without credit card is the entry path.
- Founder-led onboarding ("Lom personally sets you up") is the
  scarcity hook in the sales script (see `CallScript.tsx` —
  "3 Pilot-Gyms, 6 Monate gratis" pitch retained).

## 5. What is NOT included in this change

- **Stripe Price IDs.** The owner-checkout route currently uses
  ad-hoc `price_data` (see `src/app/api/stripe/owner-checkout/route.ts`,
  lines 15–17 still reference the old amounts). The Owner needs to
  decide whether to migrate to fixed Stripe Price IDs *or* to update
  those literals to match the new pricing in `src/lib/pricing.ts`.
  Until that file is aligned, **Checkout will quote the old prices**.
  This is a deliberate scope boundary for the pricing-page change —
  the SaaS-side billing config is a separate ticket.
- **Existing paying customers.** Anyone subscribed to the old prices
  before 2026-05-08 keeps their old price unless they actively
  upgrade or downgrade. This is not a contractual price guarantee, but
  it is the operational policy until §6 triggers.
- **VAT handling.** Unchanged. Stripe Tax remains the source of truth
  for jurisdiction-specific VAT.

## 6. When we expect to raise prices again

Pricing review is scheduled when **any** of these is true:

- 100 paying studios on the platform — at that scale our support /
  hosting cost-per-customer is well understood and can be priced in.
- Two consecutive quarters where Starter conversion < 4 % (our
  bottom-half target).
- A material new feature ships that meaningfully expands the
  per-customer cost base (e.g. live video, AI-generated content,
  full ERP-side integrations).

A price *decrease* is not currently on the roadmap.

## 7. Revision log

| Date       | Change                                                 | By    |
|------------|--------------------------------------------------------|-------|
| 2026-05-08 | Initial — 29/49/99 → 49/89/149, pilot programme set up | x1F   |
