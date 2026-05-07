/**
 * Inkasso-Übergabe-Dossier-PDF.
 *
 * Wenn der Owner einem (beliebigen) Inkasso-Dienstleister einen Fall übergibt,
 * rendern wir hier eine **anbieter-agnostische** Standard-Aktenmappe als A4-PDF.
 * Damit kann der Owner alles (Stammdaten, Forderungs-Übersicht, Mahnungs-Verlauf,
 * eIDAS-Beleg) auf einmal weiterleiten — kein telefonischer Datendump nötig.
 *
 * Layout-Vorbild: `src/app/api/members/[id]/contract/route.tsx` und
 * `src/lib/dunning-pdf.tsx` (gleiche Helper-Strukturen, gleiches Tonalsystem).
 *
 * Nutzt NUR Helvetica/Courier — kein zusätzliches Font-Loading nötig.
 *
 * NICHT verändern: `lib/dunning-pdf.tsx` (das ist das Mahnschreiben für das
 * Mitglied) — dies hier ist ein eigener Renderer für den B2B-Kanal an Inkasso.
 */

import {
  renderToStream,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import React from 'react'

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface HandoffPdfMember {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address: string | null
  date_of_birth: string | null
  join_date: string | null
  contract_end_date: string | null
  contract_signed_at: string | null
  consent_ip: string | null
  consent_user_agent: string | null
}

export interface HandoffPdfGym {
  name: string | null
  address: string | null
  phone: string | null
  email: string | null
  tax_number: string | null
  iban: string | null
}

export interface HandoffPdfAction {
  id: string
  action_type: string
  amount_cents: number | null
  notes: string | null
  performed_by: string | null
  performed_at: string
}

export interface RenderHandoffArgs {
  member: HandoffPdfMember
  gym: HandoffPdfGym
  dunningActions: HandoffPdfAction[]
  /** Hauptforderung (offene Beträge) in Cent */
  totalAmount: number
}

// ──────────────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 50,
    paddingBottom: 70, // Platz für Footer
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    lineHeight: 1.5,
  },

  // Briefkopf
  letterhead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 10,
    borderBottom: '1pt solid #e5e7eb',
  },
  studioBlock: { width: '55%' },
  studioName: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 2,
  },
  studioLine: {
    fontSize: 8,
    color: '#475569',
    marginBottom: 1,
  },
  metaBlock: { width: '40%', textAlign: 'right' },
  metaLabel: {
    fontSize: 7,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  metaValue: {
    fontSize: 9,
    color: '#0f172a',
    fontWeight: 700,
    marginBottom: 2,
  },

  // Titel
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#9f1239',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 9,
    color: '#475569',
    marginBottom: 18,
  },

  // Empfänger-Hinweis
  recipientBox: {
    marginBottom: 18,
    padding: 10,
    backgroundColor: '#fef2f2',
    border: '1pt solid #fecaca',
    borderRadius: 6,
  },
  recipientLabel: {
    fontSize: 7,
    color: '#9f1239',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  recipientText: {
    fontSize: 10,
    color: '#7f1d1d',
    fontWeight: 700,
  },

  // Sektionen
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: '0.5pt solid #cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  section: {
    marginBottom: 16,
  },

  // Stammdaten-Tabelle (key/value)
  kvRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: '0.25pt solid #f1f5f9',
  },
  kvKey: {
    width: 130,
    fontSize: 8,
    color: '#64748b',
    fontWeight: 700,
  },
  kvValue: {
    flex: 1,
    fontSize: 9,
    color: '#0f172a',
  },
  kvValueMono: {
    flex: 1,
    fontSize: 9,
    color: '#0f172a',
    fontFamily: 'Courier',
  },

  // Forderungs-Box
  amountBox: {
    marginTop: 4,
    padding: 10,
    backgroundColor: '#f8fafc',
    border: '1pt solid #e2e8f0',
    borderRadius: 6,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9,
    paddingVertical: 2,
  },
  amountKey: { color: '#475569' },
  amountVal: { color: '#0f172a', fontWeight: 700, fontFamily: 'Courier' },
  amountTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTop: '1pt solid #cbd5e1',
    fontSize: 11,
  },
  amountTotalKey: { color: '#0f172a', fontWeight: 700 },
  amountTotalVal: {
    color: '#9f1239',
    fontWeight: 700,
    fontFamily: 'Courier',
  },
  noteText: {
    fontSize: 7,
    color: '#64748b',
    marginTop: 6,
    fontStyle: 'italic',
  },

  // History-Tabelle
  histHead: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTop: '0.5pt solid #cbd5e1',
    borderBottom: '0.5pt solid #cbd5e1',
  },
  histHeadCell: {
    fontSize: 7,
    color: '#475569',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  histRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottom: '0.25pt solid #f1f5f9',
  },
  histCell: {
    fontSize: 8,
    color: '#1f2937',
  },
  histCellMono: {
    fontSize: 8,
    color: '#0f172a',
    fontFamily: 'Courier',
  },
  histColDate: { width: 60 },
  histColAction: { width: 110 },
  histColAmount: { width: 60, textAlign: 'right' },
  histColSource: { width: 50 },
  histColNotes: { flex: 1 },
  histEmpty: {
    fontSize: 8,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },

  // eIDAS-Block
  eidasBox: {
    marginTop: 4,
    padding: 10,
    backgroundColor: '#f0f9ff',
    border: '1pt solid #bae6fd',
    borderRadius: 6,
  },
  eidasTitle: {
    fontSize: 8,
    color: '#075985',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 50,
    right: 50,
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
    borderTop: '0.5pt solid #e5e7eb',
    paddingTop: 6,
  },
  footerConfidential: {
    fontSize: 7,
    color: '#9f1239',
    fontWeight: 700,
    marginBottom: 1,
  },
})

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatEur(cents: number | null | undefined): string {
  const c = typeof cents === 'number' ? cents : 0
  return (c / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  })
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Aktenzeichen-Format: INK-YYYYMMDD-Lastname-MemberId8
 * Anbieter-agnostisch, klar identifizierbar, sortierbar.
 */
export function buildHandoffFileNumber(
  memberLastName: string,
  memberId: string,
  issuedAt: Date = new Date(),
): string {
  const ymd =
    String(issuedAt.getFullYear()) +
    String(issuedAt.getMonth() + 1).padStart(2, '0') +
    String(issuedAt.getDate()).padStart(2, '0')
  const lastName = (memberLastName || 'Unbekannt')
    .replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '')
    .slice(0, 20)
  const id8 = (memberId || '').slice(0, 8).toUpperCase()
  return `INK-${ymd}-${lastName}-${id8}`
}

const ACTION_LABEL_MAP: Record<string, string> = {
  first_reminder: '1. Mahnung',
  second_reminder: '2. Mahnung',
  final_warning: 'Letzte Mahnung',
  collection_handoff: 'Inkasso-Übergabe',
  payment_received: 'Zahlung erhalten',
  note: 'Notiz',
}

function actionLabel(t: string): string {
  return ACTION_LABEL_MAP[t] ?? t
}

function shortNotes(s: string | null | undefined, max = 80): string {
  if (!s) return ''
  const trimmed = s.trim().replace(/\s+/g, ' ')
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`
}

function shortUa(s: string | null | undefined, max = 90): string {
  if (!s) return '—'
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

interface HandoffPdfProps extends RenderHandoffArgs {
  fileNo: string
  issuedAt: Date
  feesCents: number
  startedAt: string | null
}

function HandoffDossierPdf({
  member,
  gym,
  dunningActions,
  totalAmount,
  fileNo,
  issuedAt,
  feesCents,
  startedAt,
}: HandoffPdfProps) {
  const fullName = `${member.first_name} ${member.last_name}`.trim()
  const studioName = gym.name ?? 'Studio'
  const issuedFmt = formatDate(issuedAt)
  const grandTotal = totalAmount + feesCents

  return (
    <Document
      title={`Inkasso-Dossier — ${fullName}`}
      author={studioName}
      subject={`Übergabe-Dossier ${fileNo}`}
    >
      {/* ────────────── SEITE 1: Anschreiben + Stammdaten ────────────── */}
      <Page size="A4" style={styles.page} wrap>
        {/* Briefkopf — Studio links, Akten-Meta rechts */}
        <View style={styles.letterhead}>
          <View style={styles.studioBlock}>
            <Text style={styles.studioName}>{studioName}</Text>
            {gym.address &&
              gym.address.split('\n').map((line, i) => (
                <Text key={i} style={styles.studioLine}>
                  {line}
                </Text>
              ))}
            {gym.phone && <Text style={styles.studioLine}>Tel: {gym.phone}</Text>}
            {gym.email && <Text style={styles.studioLine}>{gym.email}</Text>}
            {gym.tax_number && (
              <Text style={styles.studioLine}>
                Steuer-Nr: {gym.tax_number}
              </Text>
            )}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Datum</Text>
            <Text style={styles.metaValue}>{issuedFmt}</Text>
            <Text style={styles.metaLabel}>Aktenzeichen</Text>
            <Text style={styles.metaValue}>{fileNo}</Text>
          </View>
        </View>

        {/* Titel */}
        <Text style={styles.title}>Inkasso-Übergabe</Text>
        <Text style={styles.subtitle}>
          Standard-Aktenmappe zur Übergabe an einen Inkasso-Dienstleister.
        </Text>

        {/* Empfänger-Hinweis — anbieter-agnostisch */}
        <View style={styles.recipientBox}>
          <Text style={styles.recipientLabel}>An</Text>
          <Text style={styles.recipientText}>
            den beauftragten Inkasso-Dienstleister
          </Text>
        </View>

        {/* Schuldner-Stammdaten */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schuldner-Stammdaten</Text>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Name</Text>
            <Text style={styles.kvValue}>{fullName || '—'}</Text>
          </View>
          {member.date_of_birth && (
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Geburtsdatum</Text>
              <Text style={styles.kvValue}>
                {formatDate(member.date_of_birth)}
              </Text>
            </View>
          )}
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Adresse</Text>
            <Text style={styles.kvValue}>
              {member.address ? member.address : 'Nicht hinterlegt'}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>E-Mail</Text>
            <Text style={styles.kvValue}>{member.email ?? '—'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Telefon</Text>
            <Text style={styles.kvValue}>{member.phone ?? '—'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Mitgliedschaftsbeginn</Text>
            <Text style={styles.kvValue}>{formatDate(member.join_date)}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Vertragslaufzeit-Ende</Text>
            <Text style={styles.kvValue}>
              {member.contract_end_date
                ? formatDate(member.contract_end_date)
                : 'Unbefristet'}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Konto Studio (IBAN)</Text>
            <Text style={styles.kvValueMono}>
              {gym.iban ?? 'auf Anfrage'}
            </Text>
          </View>
        </View>

        {/* Forderungs-Übersicht */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Forderungs-Übersicht</Text>
          <View style={styles.amountBox}>
            <View style={styles.amountRow}>
              <Text style={styles.amountKey}>Hauptforderung (offen)</Text>
              <Text style={styles.amountVal}>{formatEur(totalAmount)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountKey}>Mahngebühren (10 € je Stufe)</Text>
              <Text style={styles.amountVal}>{formatEur(feesCents)}</Text>
            </View>
            <View style={styles.amountRow}>
              <Text style={styles.amountKey}>Verzugszinsen</Text>
              <Text style={styles.amountVal}>
                nach §288 BGB ab {formatDate(startedAt)}
              </Text>
            </View>
            <View style={styles.amountTotalRow}>
              <Text style={styles.amountTotalKey}>Gesamtforderung</Text>
              <Text style={styles.amountTotalVal}>
                {formatEur(grandTotal)}
              </Text>
            </View>
          </View>
          <Text style={styles.noteText}>
            Verzugszinsen sind hier NICHT berechnet. Der Zinslauf beginnt nach
            §288 BGB ab dem oben angegebenen Verzugsdatum und ist vom
            Inkasso-Dienstleister zu ermitteln.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerConfidential}>
            Vertrauliches Inkasso-Dossier — nur für autorisierten Empfänger
          </Text>
          <Text>
            {studioName} · {fileNo} · Erstellt am {issuedFmt}
          </Text>
        </View>
      </Page>

      {/* ────────────── SEITE 2: Mahnungs-Verlauf + eIDAS ────────────── */}
      <Page size="A4" style={styles.page} wrap>
        {/* Mini-Header für Seite 2 */}
        <View style={styles.letterhead}>
          <View style={styles.studioBlock}>
            <Text style={styles.studioName}>{studioName}</Text>
            <Text style={styles.studioLine}>
              Schuldner: {fullName} · Aktenzeichen: {fileNo}
            </Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Seite</Text>
            <Text style={styles.metaValue}>2</Text>
          </View>
        </View>

        {/* Mahnungs-Verlauf */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Mahnungs-Verlauf ({dunningActions.length})
          </Text>

          <View style={styles.histHead}>
            <Text style={[styles.histHeadCell, styles.histColDate]}>Datum</Text>
            <Text style={[styles.histHeadCell, styles.histColAction]}>
              Aktion
            </Text>
            <Text style={[styles.histHeadCell, styles.histColAmount]}>
              Betrag
            </Text>
            <Text style={[styles.histHeadCell, styles.histColSource]}>
              Quelle
            </Text>
            <Text style={[styles.histHeadCell, styles.histColNotes]}>
              Notiz
            </Text>
          </View>

          {dunningActions.length === 0 ? (
            <Text style={styles.histEmpty}>
              Keine erfassten Mahnungs-Aktionen.
            </Text>
          ) : (
            dunningActions.map((a) => (
              <View key={a.id} style={styles.histRow} wrap={false}>
                <Text style={[styles.histCellMono, styles.histColDate]}>
                  {formatDate(a.performed_at)}
                </Text>
                <Text style={[styles.histCell, styles.histColAction]}>
                  {actionLabel(a.action_type)}
                </Text>
                <Text style={[styles.histCellMono, styles.histColAmount]}>
                  {a.amount_cents != null ? formatEur(a.amount_cents) : '—'}
                </Text>
                <Text style={[styles.histCell, styles.histColSource]}>
                  {a.performed_by === null ? 'Auto' : 'Manuell'}
                </Text>
                <Text style={[styles.histCell, styles.histColNotes]}>
                  {shortNotes(a.notes) || '—'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* eIDAS-Block — Beleg für die elektronische Unterschrift */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Vertragsbeleg (eIDAS Art. 25 Abs. 1)
          </Text>
          <View style={styles.eidasBox}>
            <Text style={styles.eidasTitle}>
              Elektronisch unterzeichneter Vertrag
            </Text>
            {member.contract_signed_at ? (
              <>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>Unterzeichnet am</Text>
                  <Text style={styles.kvValue}>
                    {new Date(member.contract_signed_at).toLocaleString(
                      'de-DE',
                    )}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>IP-Adresse</Text>
                  <Text style={styles.kvValueMono}>
                    {member.consent_ip ?? '—'}
                  </Text>
                </View>
                <View style={styles.kvRow}>
                  <Text style={styles.kvKey}>User-Agent</Text>
                  <Text style={styles.kvValue}>
                    {shortUa(member.consent_user_agent)}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.noteText}>
                Kein elektronischer Unterschrifts-Beleg gespeichert. Vertrag
                ggf. in Papierform — Original auf Anfrage verfügbar.
              </Text>
            )}
            <Text style={styles.noteText}>
              Original-Vertrag (PDF mit Unterschrift, IP, Zeitstempel) auf
              Anfrage beim Studio verfügbar.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerConfidential}>
            Vertrauliches Inkasso-Dossier — nur für autorisierten Empfänger
          </Text>
          <Text>
            {studioName} · {fileNo} · Erstellt am {issuedFmt}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Public renderer
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Berechnet die Mahngebühren-Summe basierend auf den erfassten
 * `dunning_actions`. Annahme aus der DB-Spec: 10 € je Mahn-Stufe.
 *
 * Wir zählen distinct Stufen, damit eine doppelt erfasste „1. Mahnung" nicht
 * doppelt 10 € erzeugt — der Owner soll bewusst eine Stufe pro Schreiben haben.
 */
function calcFees(actions: HandoffPdfAction[]): number {
  const stages = new Set<string>()
  for (const a of actions) {
    if (
      a.action_type === 'first_reminder' ||
      a.action_type === 'second_reminder' ||
      a.action_type === 'final_warning'
    ) {
      stages.add(a.action_type)
    }
  }
  return stages.size * 1000 // 10 € = 1000 cent pro Stufe
}

/**
 * Rendert das Übergabe-Dossier als PDF-Stream (NodeJS.ReadableStream).
 *
 * Caller (siehe `api/members/[id]/dunning/handoff-pdf/route.tsx`) konvertiert
 * den NodeJS-Stream in einen Web-ReadableStream und streamt mit
 * Content-Disposition: inline an den Browser.
 */
export async function renderHandoffPdf(
  args: RenderHandoffArgs,
): Promise<NodeJS.ReadableStream> {
  const issuedAt = new Date()
  const fileNo = buildHandoffFileNumber(
    args.member.last_name,
    args.member.id,
    issuedAt,
  )
  const feesCents = calcFees(args.dunningActions)

  // started_at = ältester first_reminder oder ältestes Action-Datum
  const sortedAsc = [...args.dunningActions].sort(
    (a, b) =>
      new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime(),
  )
  const firstReminder = sortedAsc.find(
    (a) => a.action_type === 'first_reminder',
  )
  const startedAt = firstReminder
    ? firstReminder.performed_at
    : sortedAsc[0]?.performed_at ?? null

  return renderToStream(
    <HandoffDossierPdf
      {...args}
      fileNo={fileNo}
      issuedAt={issuedAt}
      feesCents={feesCents}
      startedAt={startedAt}
    />,
  )
}
