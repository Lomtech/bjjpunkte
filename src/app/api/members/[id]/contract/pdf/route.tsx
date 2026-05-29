import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveTemplate, type ContractKind } from '@/lib/legal/default-contract'
import { renderToStream, Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { loadSignatureForPdf } from '@/lib/signature-storage'
import React from 'react'

// Node-Runtime, weil @react-pdf/renderer auf Node-APIs angewiesen ist.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Dual-Auth: akzeptiert Bearer-Token (Frontend `fetch` mit Authorization-Header)
 * ODER Cookie-Session (direkter Browser-Aufruf via <a href>).
 * Returns null wenn unauthentifiziert.
 */
async function authenticateUser(req: Request): Promise<{ id: string } | null> {
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (accessToken) {
    const sb = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data } = await sb.auth.getUser(accessToken)
    return data.user ? { id: data.user.id } : null
  }
  const sb = await createServerClient()
  const { data } = await sb.auth.getUser()
  return data.user ? { id: data.user.id } : null
}

/**
 * GET /api/members/[id]/contract/pdf?kind=membership|wellpass|trial
 *
 * Rendert den unterzeichneten Vertrag als PDF — Owner-only, RLS via gym_id.
 *
 * Verwendung:
 *  - Steuer-Berater fragt nach: Owner schickt PDF
 *  - Mitglied fordert Kopie: Owner sendet PDF
 *  - Bei Kündigungs-/Inkasso-Streit: Original-Vertrag mit Signatur, IP, UA
 */

// ──────────────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#0f172a', lineHeight: 1.5 },
  header: { marginBottom: 16, paddingBottom: 12, borderBottom: '1pt solid #e5e7eb' },
  title: { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#64748b' },
  section: { marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  body: { fontSize: 9, color: '#374151', whiteSpace: 'pre-wrap' },
  meta: { marginTop: 18, padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, fontSize: 8 },
  metaRow: { flexDirection: 'row', marginBottom: 3 },
  metaLabel: { width: 120, color: '#64748b', fontWeight: 600 },
  metaValue: { flex: 1, color: '#0f172a' },
  signatureBox: { marginTop: 18, padding: 12, border: '1pt solid #d1d5db', borderRadius: 6 },
  signatureLabel: { fontSize: 8, color: '#64748b', marginBottom: 6, fontWeight: 700 },
  signatureImage: { width: 200, height: 60 },
  signatureLine: { borderBottom: '1pt solid #94a3b8', height: 50, marginBottom: 4 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 7, color: '#94a3b8', textAlign: 'center', borderTop: '0.5pt solid #e5e7eb', paddingTop: 6 },
})

// ──────────────────────────────────────────────────────────────────────────────
// Helper — split template into title + paragraphs
// ──────────────────────────────────────────────────────────────────────────────
function splitTemplate(text: string): { title: string; body: string } {
  const trimmed = text.trim()
  const firstLineEnd = trimmed.indexOf('\n')
  if (firstLineEnd < 0) return { title: trimmed, body: '' }
  return {
    title: trimmed.slice(0, firstLineEnd).trim(),
    body:  trimmed.slice(firstLineEnd + 1).trim(),
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// PDF Document Component
// ──────────────────────────────────────────────────────────────────────────────
interface ContractPdfProps {
  body:    string
  title:   string
  member:  {
    first_name: string; last_name: string; email: string | null; phone: string | null
    address: string | null; date_of_birth: string | null
    contract_signed_at: string | null
    consent_ip: string | null
    consent_user_agent: string | null
    signature_data: string | null
  }
  // Bereits aufgelöste data-URL (entweder Legacy-Plaintext aus DB oder aus
  // Storage-Path heruntergeladen). null = keine Signatur → leere Linie.
  signatureSrc: string | null
  gym: { name: string | null; address: string | null }
}

function ContractPdf({ body, title, member, gym, signatureSrc }: ContractPdfProps) {
  const fullName = `${member.first_name} ${member.last_name}`.trim()
  const signedAt = member.contract_signed_at
    ? new Date(member.contract_signed_at).toLocaleString('de-DE')
    : null

  return (
    <Document title={`Vertrag — ${fullName}`} author={gym.name ?? 'Gym'}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {gym.name && <Text style={styles.subtitle}>{gym.name}{gym.address ? ` · ${gym.address}` : ''}</Text>}
        </View>

        {/* Body — der Template-Text */}
        <View style={styles.section}>
          <Text style={styles.body}>{body}</Text>
        </View>

        {/* Member-Stammdaten */}
        <View style={styles.meta}>
          <View style={styles.metaRow}><Text style={styles.metaLabel}>Name:</Text><Text style={styles.metaValue}>{fullName}</Text></View>
          {member.email && <View style={styles.metaRow}><Text style={styles.metaLabel}>E-Mail:</Text><Text style={styles.metaValue}>{member.email}</Text></View>}
          {member.phone && <View style={styles.metaRow}><Text style={styles.metaLabel}>Telefon:</Text><Text style={styles.metaValue}>{member.phone}</Text></View>}
          {member.address && <View style={styles.metaRow}><Text style={styles.metaLabel}>Adresse:</Text><Text style={styles.metaValue}>{member.address}</Text></View>}
          {member.date_of_birth && <View style={styles.metaRow}><Text style={styles.metaLabel}>Geburtsdatum:</Text><Text style={styles.metaValue}>{new Date(member.date_of_birth).toLocaleDateString('de-DE')}</Text></View>}
        </View>

        {/* Signatur-Block */}
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabel}>UNTERSCHRIFT MITGLIED</Text>
          {signatureSrc ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.signatureImage} src={signatureSrc} />
          ) : (
            <View style={styles.signatureLine} />
          )}
          <Text style={{ fontSize: 7, color: '#64748b' }}>{fullName}</Text>
        </View>

        {/* eIDAS-Doku — IP, UA, Timestamp */}
        {signedAt && (
          <View style={styles.meta}>
            <Text style={{ fontSize: 8, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              ELEKTRONISCH UNTERZEICHNET nach eIDAS Art. 25 Abs. 1
            </Text>
            <View style={styles.metaRow}><Text style={styles.metaLabel}>Zeitpunkt:</Text><Text style={styles.metaValue}>{signedAt}</Text></View>
            {member.consent_ip && <View style={styles.metaRow}><Text style={styles.metaLabel}>IP-Adresse:</Text><Text style={styles.metaValue}>{member.consent_ip}</Text></View>}
            {member.consent_user_agent && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Browser:</Text>
                <Text style={styles.metaValue}>{member.consent_user_agent.slice(0, 90)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer} fixed>
          Generiert am {new Date().toLocaleString('de-DE')} · Vertrag-ID: {fullName} · Erstellt von {gym.name ?? 'Studio'}
        </Text>
      </Page>
    </Document>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Route Handler
// ──────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params
  const { searchParams } = new URL(req.url)
  const kindParam = searchParams.get('kind') || 'membership'
  const VALID_KINDS: ContractKind[] = ['membership', 'wellpass', 'trial']
  const kind: ContractKind = (VALID_KINDS as string[]).includes(kindParam) ? (kindParam as ContractKind) : 'membership'

  const user = await authenticateUser(req)
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  // Service-Client für DB-Reads (RLS-Bypass; wir prüfen Ownership selbst).
  const service = createServiceClient()

  // Verify caller owns a gym + this member belongs to that gym.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gym } = await (service.from('gyms') as any)
    .select('id, name, address, website_url, contract_template, wellpass_agreement_template, trial_rules_template')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!gym) return NextResponse.json({ error: 'Kein Gym' }, { status: 404 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (service.from('members') as any)
    .select('id, first_name, last_name, email, phone, address, date_of_birth, contract_signed_at, consent_ip, consent_user_agent, signature_data, membership_source')
    .eq('id', memberId)
    .eq('gym_id', gym.id)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Mitglied nicht gefunden' }, { status: 404 })

  // Pick template — gym-custom oder Default
  const customByKind: Record<ContractKind, string | null> = {
    membership: gym.contract_template ?? null,
    wellpass:   gym.wellpass_agreement_template ?? null,
    trial:      gym.trial_rules_template ?? null,
  }
  const fullText = resolveTemplate(kind, customByKind[kind], {
    name:    gym.name,
    address: gym.address,
    url:     gym.website_url,
  })
  const { title, body } = splitTemplate(fullText)

  // Signatur auflösen: Storage-Path → data-URL, oder Legacy-Plaintext direkt
  // weiterreichen. Bei Fehler/null rendert das PDF die leere Unterschriftslinie.
  const signatureSrc = await loadSignatureForPdf(member.signature_data ?? null)

  const stream = await renderToStream(
    <ContractPdf
      title={title}
      body={body}
      member={member}
      signatureSrc={signatureSrc}
      gym={{ name: gym.name, address: gym.address }}
    />
  )

  // Convert NodeJS.ReadableStream → ReadableStream<Uint8Array> for Web Response
  const webStream = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
      stream.on('end', () => controller.close())
      stream.on('error', (e: unknown) => controller.error(e))
    },
  })

  const filename = `Vertrag_${member.last_name}_${member.first_name}_${kind}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_')

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control':       'private, no-cache, no-store, must-revalidate',
    },
  })
}
