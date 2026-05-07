/**
 * Mahnungs-PDF-Renderer.
 *
 * Erzeugt ein DSGVO/AGB-konformes Mahnschreiben (1./2./Letzte Mahnung) als
 * A4-PDF im Stil des bestehenden Vertrag-PDFs (`contract/route.tsx`).
 *
 * Wird genutzt von:
 *  - `lib/dunning-mail.ts`: hängt das PDF an die Mahnungs-Mail an Mitglied
 *  - `api/members/[id]/dunning/pdf/route.tsx`: Owner-only Vorschau/Download
 *
 * Layout:
 *  - Studio-Briefkopf (Name + Adresse) oben rechts
 *  - Empfänger-Block (Mitglied + Adresse) links
 *  - Datum + Aktenzeichen (member.id last 8)
 *  - Betreff je nach Stufe
 *  - Body-Text mit Frist (14 Tage) + offenem Betrag + IBAN
 *  - Stufenspezifische Hinweise (Mahngebühr / Inkasso-Drohung)
 *  - Footer mit Kontakt
 *
 * Hinweis: Wir nutzen NUR Helvetica/Standard-Schriften, damit kein zusätzliches
 * Font-Loading nötig ist (analog Contract-PDF).
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

export type DunningKind = 'first_reminder' | 'second_reminder' | 'final_warning'

export interface DunningPdfMember {
  id: string
  first_name: string
  last_name: string
  email: string | null
  address: string | null
}

export interface DunningPdfGym {
  name: string | null
  address: string | null
  email: string | null
  iban: string | null
}

export interface DunningPdfData {
  /** offen stehender Betrag in Cent */
  amount_cents: number
  /** Datum, ab dem der Verzug begann (für die Akte) */
  started_at: string | null
  /** Datum, an dem das Schreiben erstellt wird */
  issued_at: Date
  /** Frist für die Zahlung (default: issued_at + 14 Tage) */
  due_date: Date
  /** zusätzliche Mahngebühr in Cent (nur bei 2. Mahnung relevant) */
  fee_cents: number
}

interface RenderArgs {
  member: DunningPdfMember
  gym: DunningPdfGym
  dunning: DunningPdfData
  kind: DunningKind
}

// ──────────────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    lineHeight: 1.5,
  },
  letterhead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 36,
  },
  recipientBlock: {
    width: '50%',
  },
  recipientLabel: {
    fontSize: 7,
    color: '#94a3b8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  recipientName: {
    fontSize: 10,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 2,
  },
  recipientLine: {
    fontSize: 10,
    color: '#374151',
    marginBottom: 1,
  },
  senderBlock: {
    width: '45%',
    textAlign: 'right',
  },
  senderName: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 2,
  },
  senderLine: {
    fontSize: 9,
    color: '#475569',
    marginBottom: 1,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    fontSize: 9,
    color: '#475569',
  },
  subject: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 14,
  },
  paragraph: {
    marginBottom: 10,
    fontSize: 10,
    color: '#1f2937',
    lineHeight: 1.6,
  },
  bold: {
    fontWeight: 700,
    color: '#0f172a',
  },
  amountBox: {
    marginTop: 6,
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#fef3c7',
    border: '1pt solid #fbbf24',
    borderRadius: 6,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 10,
    marginBottom: 3,
  },
  amountLabel: { color: '#78350f' },
  amountValue: { color: '#0f172a', fontWeight: 700 },
  amountTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 11,
    marginTop: 4,
    paddingTop: 6,
    borderTop: '1pt solid #fbbf24',
  },
  amountTotalLabel: { color: '#0f172a', fontWeight: 700 },
  amountTotalValue: { color: '#0f172a', fontWeight: 700 },
  ibanBox: {
    marginTop: 6,
    marginBottom: 18,
    padding: 12,
    backgroundColor: '#f8fafc',
    border: '1pt solid #e2e8f0',
    borderRadius: 6,
  },
  ibanLabel: {
    fontSize: 7,
    color: '#94a3b8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ibanRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  ibanKey: {
    width: 80,
    fontSize: 9,
    color: '#64748b',
  },
  ibanValue: {
    flex: 1,
    fontSize: 10,
    color: '#0f172a',
    fontFamily: 'Courier',
  },
  warningBox: {
    marginTop: 8,
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#fee2e2',
    border: '1pt solid #fca5a5',
    borderRadius: 6,
  },
  warningTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#991b1b',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 9,
    color: '#7f1d1d',
    lineHeight: 1.5,
  },
  closing: {
    marginTop: 20,
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 4,
  },
  signature: {
    marginTop: 16,
    fontSize: 10,
    color: '#0f172a',
    fontWeight: 700,
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 50,
    right: 50,
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
    borderTop: '0.5pt solid #e5e7eb',
    paddingTop: 6,
  },
})

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function formatEur(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  })
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fileNumber(memberId: string, issuedAt: Date): string {
  const last8 = memberId.slice(-8).toUpperCase()
  const ymd =
    String(issuedAt.getFullYear()) +
    String(issuedAt.getMonth() + 1).padStart(2, '0') +
    String(issuedAt.getDate()).padStart(2, '0')
  return `${ymd}-${last8}`
}

function subjectFor(kind: DunningKind): string {
  switch (kind) {
    case 'first_reminder':
      return '1. Mahnung — Zahlungserinnerung'
    case 'second_reminder':
      return '2. Mahnung'
    case 'final_warning':
      return 'Letzte Mahnung vor Übergabe an Inkasso'
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// PDF Component
// ──────────────────────────────────────────────────────────────────────────────

function DunningPdf({ member, gym, dunning, kind }: RenderArgs) {
  const fullName = `${member.first_name} ${member.last_name}`.trim()
  const subject = subjectFor(kind)
  const amountFmt = formatEur(dunning.amount_cents)
  const feeFmt = formatEur(dunning.fee_cents)
  const totalFmt = formatEur(dunning.amount_cents + dunning.fee_cents)
  const dueFmt = formatDate(dunning.due_date)
  const issuedFmt = formatDate(dunning.issued_at)
  const startedFmt = dunning.started_at ? formatDate(dunning.started_at) : null
  const fileNo = fileNumber(member.id, dunning.issued_at)
  const studioName = gym.name ?? 'Ihr Studio'

  return (
    <Document title={`${subject} — ${fullName}`} author={studioName}>
      <Page size="A4" style={styles.page}>
        {/* Briefkopf — links: Empfänger, rechts: Absender */}
        <View style={styles.letterhead}>
          {/* Recipient (Mitglied) */}
          <View style={styles.recipientBlock}>
            <Text style={styles.recipientLabel}>Empfänger</Text>
            <Text style={styles.recipientName}>{fullName}</Text>
            {member.address ? (
              member.address
                .split('\n')
                .map((line, i) => (
                  <Text key={i} style={styles.recipientLine}>
                    {line}
                  </Text>
                ))
            ) : (
              <Text style={styles.recipientLine}>Adresse nicht hinterlegt</Text>
            )}
          </View>
          {/* Sender (Studio) */}
          <View style={styles.senderBlock}>
            <Text style={styles.senderName}>{studioName}</Text>
            {gym.address &&
              gym.address.split('\n').map((line, i) => (
                <Text key={i} style={styles.senderLine}>
                  {line}
                </Text>
              ))}
            {gym.email && <Text style={styles.senderLine}>{gym.email}</Text>}
          </View>
        </View>

        {/* Datum + Aktenzeichen */}
        <View style={styles.metaRow}>
          <Text>Aktenzeichen: {fileNo}</Text>
          <Text>{issuedFmt}</Text>
        </View>

        {/* Betreff */}
        <Text style={styles.subject}>{subject}</Text>

        {/* Anrede */}
        <Text style={styles.paragraph}>Sehr geehrte/r {fullName},</Text>

        {/* Body je nach Stufe */}
        {kind === 'first_reminder' && (
          <Text style={styles.paragraph}>
            in unserer Buchhaltung ist die unten aufgeführte Forderung noch nicht ausgeglichen.
            Möglicherweise ist Ihnen das entgangen. Wir bitten Sie daher, den offenen Betrag bis
            spätestens <Text style={styles.bold}>{dueFmt}</Text> auf das unten genannte Konto zu
            überweisen. Falls Sie zwischenzeitlich bereits gezahlt haben, betrachten Sie dieses
            Schreiben bitte als gegenstandslos.
          </Text>
        )}

        {kind === 'second_reminder' && (
          <Text style={styles.paragraph}>
            trotz unserer ersten Zahlungserinnerung haben wir den unten aufgeführten Betrag bisher
            nicht erhalten. Wir mahnen daher hiermit zum zweiten Mal und setzen Ihnen eine letzte
            Frist zur Zahlung bis <Text style={styles.bold}>{dueFmt}</Text>. Bitte überweisen Sie
            den Gesamtbetrag (inklusive Mahngebühr) auf das unten genannte Konto.
          </Text>
        )}

        {kind === 'final_warning' && (
          <Text style={styles.paragraph}>
            trotz mehrfacher Aufforderung haben wir den offenen Betrag bisher nicht erhalten. Wir
            fordern Sie hiermit ein letztes Mal auf, den Gesamtbetrag bis spätestens{' '}
            <Text style={styles.bold}>{dueFmt}</Text> zu begleichen. Sollte bis zu diesem Termin
            kein Zahlungseingang erfolgen, werden wir die Forderung ohne weitere Ankündigung an ein
            Inkassobüro übergeben.
          </Text>
        )}

        {startedFmt && (
          <Text style={styles.paragraph}>
            Die Forderung besteht seit dem <Text style={styles.bold}>{startedFmt}</Text>.
          </Text>
        )}

        {/* Betrag-Box */}
        <View style={styles.amountBox}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Offener Betrag</Text>
            <Text style={styles.amountValue}>{amountFmt}</Text>
          </View>
          {dunning.fee_cents > 0 && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Mahngebühr</Text>
              <Text style={styles.amountValue}>{feeFmt}</Text>
            </View>
          )}
          <View style={styles.amountTotalRow}>
            <Text style={styles.amountTotalLabel}>Gesamtbetrag</Text>
            <Text style={styles.amountTotalValue}>{totalFmt}</Text>
          </View>
        </View>

        {/* IBAN-Block */}
        <View style={styles.ibanBox}>
          <Text style={styles.ibanLabel}>Bankverbindung für die Überweisung</Text>
          <View style={styles.ibanRow}>
            <Text style={styles.ibanKey}>Empfänger:</Text>
            <Text style={styles.ibanValue}>{studioName}</Text>
          </View>
          <View style={styles.ibanRow}>
            <Text style={styles.ibanKey}>IBAN:</Text>
            <Text style={styles.ibanValue}>{gym.iban ?? 'wird Ihnen separat mitgeteilt'}</Text>
          </View>
          <View style={styles.ibanRow}>
            <Text style={styles.ibanKey}>Verwendung:</Text>
            <Text style={styles.ibanValue}>{fileNo}</Text>
          </View>
        </View>

        {/* Hinweis bei 2. Mahnung */}
        {kind === 'second_reminder' && dunning.fee_cents > 0 && (
          <Text style={styles.paragraph}>
            Bitte beachten Sie, dass wir wegen des andauernden Zahlungsverzugs eine pauschale
            Mahngebühr in Höhe von {feeFmt} berechnen müssen.
          </Text>
        )}

        {/* Hinweis bei letzter Mahnung */}
        {kind === 'final_warning' && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Wichtiger Hinweis</Text>
            <Text style={styles.warningText}>
              Bei Übergabe an ein Inkassobüro entstehen Ihnen weitere Kosten (Inkassogebühren,
              Verzugszinsen, ggf. Anwaltskosten), die zusätzlich zum oben genannten Betrag von Ihnen
              zu tragen sind. Nehmen Sie dies bitte ernst und vermeiden Sie unnötige Kosten durch
              eine fristgerechte Zahlung.
            </Text>
          </View>
        )}

        {/* Schluss */}
        <Text style={styles.closing}>
          Bei Fragen oder falls Sie eine Ratenzahlung vereinbaren möchten, kontaktieren Sie uns
          bitte zeitnah{gym.email ? ` unter ${gym.email}` : ''}.
        </Text>
        <Text style={styles.closing}>Mit freundlichen Grüßen</Text>
        <Text style={styles.signature}>{studioName}</Text>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Erstellt am {issuedFmt} · Aktenzeichen {fileNo}
          {gym.email ? ` · Kontakt: ${gym.email}` : ''}
        </Text>
      </Page>
    </Document>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Public renderer
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Rendert die Mahnung als PDF-Stream (NodeJS.ReadableStream).
 *
 * Caller-Beispiel (Buffer für Mail-Attachment):
 *   const stream = await renderDunningPdf({...})
 *   const chunks: Buffer[] = []
 *   for await (const c of stream) chunks.push(c as Buffer)
 *   const buf = Buffer.concat(chunks)
 */
export async function renderDunningPdf(
  args: RenderArgs,
): Promise<NodeJS.ReadableStream> {
  return renderToStream(<DunningPdf {...args} />)
}
