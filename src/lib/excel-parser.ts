/**
 * Excel/CSV import for member migration.
 *
 * No external dependencies — CSV is simple enough that adding `papaparse`
 * for ~30kB of bundle would be overkill. We support:
 *  - Quoted fields (incl. embedded commas, escaped "" inside quotes)
 *  - CRLF + LF
 *  - UTF-8 BOM (Excel exports often have it)
 *  - Both `,` and `;` as separator (Excel-DE uses `;` by default)
 *  - Bilingual (DE/EN) header aliases — case + whitespace insensitive
 *
 * XLSX is not supported in this version: the `xlsx` library would add
 * 500+kB to the route bundle for an Edge case. Owners get a clear
 * "save as CSV" hint in the UI instead — that covers >90% of migrations.
 */
import type { Belt } from '@/types/database'

// ── Member insert payload (subset we care about for CSV import) ──────────────
export interface MemberCsvInsert {
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  address: string | null
  belt: Belt
  stripes: number
  join_date: string
  monthly_fee_override_cents: number | null
  notes: string | null
}

const VALID_BELTS = new Set<Belt>(['white', 'blue', 'purple', 'brown', 'black'])

// ── Header aliases (lowercased, trimmed, separators normalized to '_') ──────
// Logical key → list of accepted spellings. Add more as users send weird files.
const HEADER_ALIASES: Record<string, string[]> = {
  first_name: ['vorname', 'firstname', 'first_name', 'forename', 'name'],
  last_name:  ['nachname', 'lastname', 'last_name', 'surname', 'familienname'],
  email:      ['email', 'e_mail', 'mail', 'emailadresse', 'e_mail_adresse'],
  phone:      ['telefon', 'phone', 'handy', 'mobil', 'mobile', 'tel', 'telefonnummer'],
  dob:        ['geburtsdatum', 'birthday', 'dob', 'date_of_birth', 'birthdate', 'geburtstag'],
  street:     ['strasse', 'straße', 'street', 'address', 'adresse', 'anschrift'],
  zip:        ['plz', 'postleitzahl', 'zip', 'postal_code', 'zipcode'],
  city:       ['ort', 'stadt', 'city', 'town'],
  belt:       ['gurt', 'gürtel', 'guertel', 'belt'],
  stripes:    ['streifen', 'stripes'],
  join_date:  ['beitrittsdatum', 'joindate', 'join_date', 'mitglied_seit', 'eintrittsdatum', 'startdatum', 'start_date'],
  fee:        ['monatsbeitrag', 'fee', 'beitrag', 'monthly_fee', 'preis', 'price'],
  notes:      ['notizen', 'notes', 'bemerkungen', 'kommentar', 'comment'],
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^﻿/, '')           // strip BOM if attached to first header
    .toLowerCase()
    .trim()
    .replace(/["']/g, '')
    .replace(/[\s\-./]+/g, '_')        // "first name", "first-name", "first.name" → first_name
}

/** Build a `header → logical_key` map for the given input headers. */
function mapHeaders(headers: string[]): Record<number, string> {
  const out: Record<number, string> = {}
  headers.forEach((raw, i) => {
    const norm = normalizeHeader(raw)
    for (const [logical, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(norm)) { out[i] = logical; break }
    }
  })
  return out
}

// ── CSV parser (RFC 4180 style with relaxed quoting) ─────────────────────────
/**
 * Parse CSV text into row objects keyed by raw header.
 *
 * Robust against:
 *  - CRLF, LF, mixed line endings
 *  - UTF-8 BOM
 *  - Quoted fields with embedded commas, quotes ("" → ")
 *  - Excel-DE semicolon separator (auto-detected)
 *  - Trailing empty lines
 *  - Empty cells
 *
 * Returns [] if no header row detected.
 */
export function parseCsv(text: string): Record<string, string>[] {
  // Strip BOM
  const s = text.replace(/^﻿/, '')
  if (!s.trim()) return []

  // Auto-detect separator: count occurrences in first non-empty line outside quotes
  const firstLine = s.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
  const sep = countUnquoted(firstLine, ';') > countUnquoted(firstLine, ',') ? ';' : ','

  const rows = parseDelimited(s, sep)
  if (rows.length < 1) return []

  const headers = rows[0].map(h => h.trim())
  return rows.slice(1)
    .filter(r => r.some(c => c.trim().length > 0)) // skip blank lines
    .map(r => {
      const o: Record<string, string> = {}
      headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim() })
      return o
    })
}

function countUnquoted(line: string, ch: string): number {
  let inQ = false
  let count = 0
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { i++; continue }
      inQ = !inQ
    } else if (!inQ && c === ch) {
      count++
    }
  }
  return count
}

/** Hand-written state-machine CSV parser. Returns rows of cells. */
function parseDelimited(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let cell = ''
  let inQ = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue }
        inQ = false
        i++
        continue
      }
      cell += c
      i++
      continue
    }
    if (c === '"') { inQ = true; i++; continue }
    if (c === sep) { cur.push(cell); cell = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = ''; i++; continue }
    cell += c
    i++
  }
  // trailing cell / row (file without final newline)
  if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur) }
  return rows
}

// ── Field-level parsers ──────────────────────────────────────────────────────
function parseBelt(raw: string): Belt {
  const n = raw.toLowerCase().trim()
  const map: Record<string, Belt> = {
    white: 'white', weiss: 'white', weiß: 'white', weiss_: 'white',
    blue: 'blue', blau: 'blue',
    purple: 'purple', lila: 'purple', violett: 'purple',
    brown: 'brown', braun: 'brown',
    black: 'black', schwarz: 'black',
  }
  if (map[n]) return map[n]
  if (VALID_BELTS.has(n as Belt)) return n as Belt
  return 'white'
}

function parseStripes(raw: string): number {
  if (!raw) return 0
  const n = parseInt(raw.trim(), 10)
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 4) return 4
  return n
}

/**
 * Accepts: YYYY-MM-DD, YYYY/MM/DD, DD.MM.YYYY, DD/MM/YYYY, D.M.YY,
 * Excel-style DD-MM-YYYY. Returns ISO YYYY-MM-DD or null if unparseable.
 */
export function parseDate(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null

  // ISO-ish (YYYY-MM-DD or YYYY/MM/DD)
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (iso) {
    const [, y, m, d] = iso
    return formatDate(parseInt(y, 10), parseInt(m, 10), parseInt(d, 10))
  }

  // German DD.MM.YYYY or DD-MM-YYYY or DD/MM/YYYY
  const ger = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2}|\d{4})$/)
  if (ger) {
    const [, d, m, y] = ger
    let year = parseInt(y, 10)
    if (year < 100) year += year >= 50 ? 1900 : 2000
    return formatDate(year, parseInt(m, 10), parseInt(d, 10))
  }

  // No fallback to `new Date(s)` — JS's Date constructor accepts garbage
  // like "4" → year 4 or "12 2023" → unpredictable, which would silently
  // ship malformed birth dates to the DB. Better to return null and let
  // the importer flag it as an error row.
  return null
}

function formatDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null
  // Validate with Date to catch e.g. Feb 30
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

/**
 * Parse "89,00", "89.00", "89", "89,00 €", "EUR 89.50" → cents.
 * Returns null if unparseable.
 */
export function parseFeeToCents(raw: string): number | null {
  if (!raw) return null
  // Strip currency symbols, letters, spaces — keep digits, separators, sign
  let s = raw.replace(/[^\d.,\-]/g, '').trim()
  if (!s) return null

  // If both `.` and `,` present, the LAST one is the decimal separator.
  // ("1.234,56" → de;  "1,234.56" → en)
  const lastDot   = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // de format: . is thousands, , is decimal
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // en format: , is thousands, . is decimal
      s = s.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    // Only comma → always decimal separator (German + EU style)
    s = s.replace(',', '.')
  } else if (lastDot !== -1) {
    // Only dot is ambiguous: "89.50" is decimal, "1.234" is German thousand-separator.
    // Heuristic: if the dot is followed by exactly 2 digits, treat it as decimal.
    // Otherwise (3+ digits or none after the LAST dot), it's a thousands-separator
    // — strip ALL dots. This is the convention German Excel uses when saving
    // CSV without a decimal column ("1.234" → 1234, not 1.234).
    const tailLen = s.length - lastDot - 1
    if (tailLen !== 2) {
      s = s.replace(/\./g, '')
    }
    // tailLen === 2 → decimal, leave as-is (parseFloat handles "89.50")
  }

  const n = parseFloat(s)
  if (Number.isNaN(n)) return null
  if (n < 0) return null
  return Math.round(n * 100)
}

function parseEmail(raw: string): string | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  // Forgiving check — let bad addresses through but obvious garbage stays out
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null
  return s
}

// ── Row → MemberInsert ───────────────────────────────────────────────────────
type RowResult = { ok: true; data: MemberCsvInsert } | { ok: false; error: string }

/**
 * Map a CSV row (object keyed by raw header) to a MemberCsvInsert,
 * applying the alias resolution + per-field validators.
 */
export function mapMemberRow(row: Record<string, string>, headerMap?: Record<number, string>): RowResult {
  // If a header map was provided, prefer it; otherwise, do per-row alias lookup.
  const valueOf = (logical: string): string => {
    if (headerMap) {
      for (const [idx, key] of Object.entries(headerMap)) {
        if (key === logical) {
          const headerName = Object.keys(row)[parseInt(idx, 10)]
          if (headerName) return row[headerName] ?? ''
        }
      }
      return ''
    }
    // Fallback: scan keys for a match
    for (const [k, v] of Object.entries(row)) {
      const norm = normalizeHeader(k)
      if (HEADER_ALIASES[logical]?.includes(norm)) return v
    }
    return ''
  }

  const first_name = valueOf('first_name').trim()
  const last_name  = valueOf('last_name').trim()
  if (!first_name || !last_name) {
    return { ok: false, error: 'Vor- und Nachname sind Pflicht' }
  }

  const emailRaw = valueOf('email').trim()
  let email: string | null = null
  if (emailRaw) {
    email = parseEmail(emailRaw)
    if (!email) return { ok: false, error: `Ungültige E-Mail: ${emailRaw}` }
  }

  const phoneRaw = valueOf('phone').trim()
  const phone = phoneRaw || null

  const dobRaw = valueOf('dob').trim()
  let date_of_birth: string | null = null
  if (dobRaw) {
    date_of_birth = parseDate(dobRaw)
    // Don't reject row on bad DOB — just drop the field; name+belt are what matter
  }

  // Address: concat street + zip + city if any present
  const street = valueOf('street').trim()
  const zip    = valueOf('zip').trim()
  const city   = valueOf('city').trim()
  let address: string | null = null
  if (street || zip || city) {
    const parts: string[] = []
    if (street) parts.push(street)
    if (zip || city) parts.push([zip, city].filter(Boolean).join(' '))
    address = parts.join(', ') || null
  }

  const belt    = parseBelt(valueOf('belt'))
  const stripes = parseStripes(valueOf('stripes'))

  const joinRaw = valueOf('join_date').trim()
  const join_date = parseDate(joinRaw) ?? new Date().toISOString().split('T')[0]

  const feeRaw = valueOf('fee').trim()
  const monthly_fee_override_cents = feeRaw ? parseFeeToCents(feeRaw) : null

  const notesRaw = valueOf('notes').trim()
  const notes = notesRaw || null

  return {
    ok: true,
    data: {
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      address,
      belt,
      stripes,
      join_date,
      monthly_fee_override_cents,
      notes,
    },
  }
}

/** Convenience: parse + map a whole CSV in one go. Returns {data, errors}. */
export function parseAndMapCsv(text: string): {
  data: MemberCsvInsert[]
  errors: { row: number; error: string }[]
} {
  const rows = parseCsv(text)
  const data: MemberCsvInsert[] = []
  const errors: { row: number; error: string }[] = []

  // Pre-compute header map once for speed
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const headerMap = mapHeaders(headers)

  rows.forEach((row, i) => {
    const r = mapMemberRow(row, headerMap)
    if (r.ok) data.push(r.data)
    else errors.push({ row: i + 2, error: r.error }) // +2 = 1 (1-indexed) + header row
  })

  return { data, errors }
}
