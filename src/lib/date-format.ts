/**
 * Date- und Zahl-Formatter — deterministisch & SSR-safe.
 *
 * Problem das wir lösen:
 *   `(new Date(x)).toLocaleString('de-DE')` ist im Browser stabil, aber
 *   Node.js liefert je nach ICU-Bundle ein leicht anderes Ergebnis. Das
 *   produziert React #418 ("hydration text mismatch") in Client-Components.
 *
 * Lösung:
 *   Wir nutzen `Intl.DateTimeFormat` / `Intl.NumberFormat` *einmalig* beim
 *   Modul-Init mit explizit gesetzten Optionen. Das Format ist:
 *     - immer numerisch (keine Monatsnamen — die haben locale-spezifische
 *       Übersetzungs-Unterschiede zwischen Node und Browser)
 *     - mit hartem `timeZone: 'Europe/Berlin'` (Server läuft in UTC, Client
 *       in lokaler TZ — ohne fixe TZ driftet die Anzeige am Tageswechsel)
 *
 * Konvention:
 *   - `fmtDate(d)`      → 12.05.2026
 *   - `fmtDateTime(d)`  → 12.05.2026, 14:32
 *   - `fmtTime(d)`      → 14:32
 *   - `fmtRelative(d)`  → "vor 3 Tagen" / "in 2 Stunden"
 *   - `fmtEur(n)`       → 1.234,56 €
 *   - `fmtNumber(n)`    → 1.234
 *   - `fmtPercent(n)`   → 42 %
 *
 * Locale-Switching:
 *   Alle Formatter haben optionalen `locale`-Param. Default 'de-DE'.
 *   English-Variante ('en-IE' für €) auf Anfrage.
 *
 * Hydration-Safe-Pattern:
 *   Diese Helper sind deterministisch — sie funktionieren beide auf Server
 *   und Client *gleich*, weil Optionen explizit gesetzt sind und keine
 *   Locale-Inference passiert. `toLocaleString()` OHNE Argument macht
 *   Locale-Inference und ist der Bug.
 */

const TZ = 'Europe/Berlin'

type Locale = 'de-DE' | 'en-IE' | 'en-US'

// ─── Formatter-Singletons (am Modul-Init gebaut, danach nur noch .format()) ──
// .format() ist viel günstiger als jedes Mal einen neuen Formatter zu bauen,
// und garantiert deterministische Resultate.

const FMT_DATE: Record<Locale, Intl.DateTimeFormat> = {
  'de-DE': new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }),
  'en-IE': new Intl.DateTimeFormat('en-IE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }),
  'en-US': new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }),
}

const FMT_DATETIME: Record<Locale, Intl.DateTimeFormat> = {
  'de-DE': new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }),
  'en-IE': new Intl.DateTimeFormat('en-IE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }),
  'en-US': new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }),
}

const FMT_TIME: Record<Locale, Intl.DateTimeFormat> = {
  'de-DE': new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
  'en-IE': new Intl.DateTimeFormat('en-IE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
  'en-US': new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
}

const FMT_NUMBER: Record<Locale, Intl.NumberFormat> = {
  'de-DE': new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }),
  'en-IE': new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 }),
  'en-US': new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }),
}

const FMT_EUR: Record<Locale, Intl.NumberFormat> = {
  'de-DE': new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  'en-IE': new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  'en-US': new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}

const FMT_PERCENT: Record<Locale, Intl.NumberFormat> = {
  'de-DE': new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 }),
  'en-IE': new Intl.NumberFormat('en-IE', { style: 'percent', maximumFractionDigits: 0 }),
  'en-US': new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 0 }),
}

// ─── Helper ──────────────────────────────────────────────────────────────────

type DateInput = Date | string | number | null | undefined

function toDate(v: DateInput): Date | null {
  if (v == null) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** 12.05.2026 — leer wenn Eingabe ungültig. */
export function fmtDate(v: DateInput, locale: Locale = 'de-DE', fallback = ''): string {
  const d = toDate(v); if (!d) return fallback
  return FMT_DATE[locale].format(d)
}

/** 12.05.2026, 14:32 */
export function fmtDateTime(v: DateInput, locale: Locale = 'de-DE', fallback = ''): string {
  const d = toDate(v); if (!d) return fallback
  return FMT_DATETIME[locale].format(d)
}

/** 14:32 */
export function fmtTime(v: DateInput, locale: Locale = 'de-DE', fallback = ''): string {
  const d = toDate(v); if (!d) return fallback
  return FMT_TIME[locale].format(d)
}

/** "vor 3 Tagen" / "in 2 Stunden" — Relativ zur Referenz (default jetzt). */
export function fmtRelative(v: DateInput, locale: Locale = 'de-DE', ref: Date = new Date()): string {
  const d = toDate(v); if (!d) return ''
  const diffMs = d.getTime() - ref.getTime()
  const abs = Math.abs(diffMs)
  const min = 60_000, hour = 60 * min, day = 24 * hour, week = 7 * day, month = 30 * day, year = 365 * day
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const sign = diffMs < 0 ? -1 : 1
  if (abs < min)        return rtf.format(0, 'second')
  if (abs < hour)       return rtf.format(sign * Math.round(diffMs / min), 'minute')
  if (abs < day)        return rtf.format(sign * Math.round(diffMs / hour), 'hour')
  if (abs < week)       return rtf.format(sign * Math.round(diffMs / day), 'day')
  if (abs < month)      return rtf.format(sign * Math.round(diffMs / week), 'week')
  if (abs < year)       return rtf.format(sign * Math.round(diffMs / month), 'month')
  return rtf.format(sign * Math.round(diffMs / year), 'year')
}

/** 1.234 (de) / 1,234 (en) */
export function fmtNumber(n: number | null | undefined, locale: Locale = 'de-DE', fallback = '0'): string {
  if (n == null || Number.isNaN(n)) return fallback
  return FMT_NUMBER[locale].format(n)
}

/** 1.234,56 € */
export function fmtEur(n: number | null | undefined, locale: Locale = 'de-DE', fallback = '0,00 €'): string {
  if (n == null || Number.isNaN(n)) return fallback
  return FMT_EUR[locale].format(n)
}

/** 42 % — Input ist Bruchteil (0.42 → 42 %). Wenn Input bereits Prozent ist: /100 vorher. */
export function fmtPercent(n: number | null | undefined, locale: Locale = 'de-DE', fallback = '0 %'): string {
  if (n == null || Number.isNaN(n)) return fallback
  return FMT_PERCENT[locale].format(n)
}

/** ISO-Date String 'YYYY-MM-DD' aus Date — TZ-safe für Datums-Inputs */
export function toIsoDate(v: DateInput): string {
  const d = toDate(v); if (!d) return ''
  return d.toISOString().slice(0, 10)
}
