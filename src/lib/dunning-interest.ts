/**
 * Verzugszinsen-Berechnung nach §§ 247, 288 BGB.
 *
 * Formel:
 *   zinsen = forderung × (basisrate + aufschlag) / 100 × tage_im_verzug / 365
 *
 * Basiszinssatz (§ 247 BGB) wird von der Deutschen Bundesbank halbjährlich
 * festgesetzt (1.1. + 1.7.). Aufschlag (§ 288 BGB): 5% bei Verbrauchern,
 * 9% im B2B-Verkehr. Beides per Gym konfigurierbar (gyms.dunning_interest_*).
 *
 * Sprint 2026-05-27 — Audit-Memo 2026-05-11 hatte das als HIGH-Risk markiert.
 */

export interface CalcInterestArgs {
  /** Offene Forderung in Cents. */
  amountCents: number
  /** Tage im Verzug (ab Datum der ersten Mahnung oder Fälligkeit + Grace). */
  daysOverdue: number
  /** Basiszinssatz nach § 247 BGB in Prozent. z.B. 2.27 für 2,27%. */
  basisratePct: number
  /** Aufschlag nach § 288 BGB in Prozent. 5.0 Verbraucher, 9.0 B2B. */
  surchargePct: number
}

export interface CalcInterestResult {
  /** Berechnete Verzugszinsen in Cents (gerundet auf ganze Cent). */
  interestCents: number
  /** Effektiver Zinssatz (basisrate + surcharge). */
  effectiveRatePct: number
  /** Annualisierter Anteil: tage / 365. */
  yearFraction: number
}

export function calculateInterestCents(args: CalcInterestArgs): CalcInterestResult {
  const { amountCents, daysOverdue, basisratePct, surchargePct } = args

  // Defensive: keine negativen Zinsen (z.B. wenn daysOverdue negativ wäre)
  const days = Math.max(0, daysOverdue)
  const amount = Math.max(0, amountCents)

  const effectiveRatePct = basisratePct + surchargePct
  const yearFraction = days / 365

  // 100 für die Prozent-Konvertierung
  const interestCents = Math.round(amount * (effectiveRatePct / 100) * yearFraction)

  return {
    interestCents,
    effectiveRatePct,
    yearFraction,
  }
}

/** Hilfs-Format für PDF: '2,27 % Basis + 5,00 % Aufschlag = 7,27 %' */
export function formatInterestRateDe(basisratePct: number, surchargePct: number): string {
  const fmt = (n: number) => n.toFixed(2).replace('.', ',')
  return `${fmt(basisratePct)} % Basiszinssatz + ${fmt(surchargePct)} % Aufschlag = ${fmt(basisratePct + surchargePct)} %`
}

/** Tage zwischen zwei Daten (ganzzahlig, gerundet ab). */
export function daysBetween(fromIso: string | Date, toIso: string | Date = new Date()): number {
  const from = fromIso instanceof Date ? fromIso : new Date(fromIso)
  const to   = toIso   instanceof Date ? toIso   : new Date(toIso)
  const ms = to.getTime() - from.getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}
