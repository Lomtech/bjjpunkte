import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer, Font,
} from '@react-pdf/renderer'

/** Escape HTML special characters to prevent XSS in HTML templates. */
function escHtml(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── PDF styles ────────────────────────────────────────────────────────────────

const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1e293b',
    padding: '40 48',
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 36,
  },
  logo: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  logoAccent: { color: '#f59e0b' },
  invoiceTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 4, textAlign: 'right' },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, marginBottom: 2 },
  metaLabel: { fontSize: 9, color: '#64748b' },
  metaValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  statusBadge: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#16a34a' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginBottom: 24 },
  partiesRow: { flexDirection: 'row', gap: 32, marginBottom: 32 },
  partyBlock: { flex: 1 },
  partyHeading: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  partyName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginBottom: 3 },
  partyLine: { fontSize: 9, color: '#334155', marginBottom: 2, lineHeight: 1.5 },
  tableHead: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: '8 10', borderBottomWidth: 2, borderBottomColor: '#e2e8f0' },
  tableHeadCell: { fontSize: 8, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', padding: '12 10', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableCell: { fontSize: 10, color: '#1e293b' },
  colService: { flex: 3 },
  colPeriod: { flex: 2 },
  colAmount: { flex: 1, textAlign: 'right' },
  amountBlock: { alignItems: 'flex-end', marginTop: 16, marginBottom: 16 },
  amountRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 32, marginBottom: 4 },
  amountLabel: { fontSize: 9, color: '#64748b', width: 120, textAlign: 'right' },
  amountValue: { fontSize: 9, color: '#1e293b', width: 80, textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 32, marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: '#0f172a' },
  totalLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a', width: 120, textAlign: 'right' },
  totalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#0f172a', width: 80, textAlign: 'right' },
  kleinNote: { fontSize: 8, color: '#64748b', fontStyle: 'italic', textAlign: 'right', marginTop: 8, maxWidth: 300, alignSelf: 'flex-end' },
  bankSection: { marginTop: 36, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  bankHeading: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  bankGrid: { flexDirection: 'row', gap: 32 },
  bankItem: { flex: 1 },
  bankLabel: { fontSize: 8, color: '#94a3b8', marginBottom: 2 },
  bankValue: { fontSize: 9, color: '#1e293b' },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, textAlign: 'center', fontSize: 8, color: '#94a3b8' },
})

// ── PDF Document component ────────────────────────────────────────────────────

interface InvoiceData {
  invoiceNumber: string | null
  formattedDate: string
  monthYear: string
  amountEur: string
  rawCents: number
  status: string
  gym: {
    name: string; legalName: string; address: string; phone: string | null
    email: string | null; taxNumber: string | null; ustid: string | null
    isKleinunternehmer: boolean
    bankIban: string | null; bankBic: string | null; bankName: string | null
  }
  member: { firstName: string; lastName: string; email: string | null; address: string | null }
}

function InvoicePDF({ data }: { data: InvoiceData }) {
  const { invoiceNumber, formattedDate, monthYear, amountEur, rawCents, status, gym, member } = data

  let netEur = ''
  let vatEur = ''
  if (!gym.isKleinunternehmer) {
    const netCents = Math.round(rawCents / 1.19)
    const vatCents = rawCents - netCents
    netEur = (netCents / 100).toFixed(2).replace('.', ',')
    vatEur = (vatCents / 100).toFixed(2).replace('.', ',')
  }

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: pdfStyles.page },

      // Header
      React.createElement(
        View,
        { style: pdfStyles.header },
        React.createElement(Text, { style: pdfStyles.logo }, 'Osss'),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: pdfStyles.invoiceTitle }, 'Rechnung'),
          invoiceNumber
            ? React.createElement(
                View,
                { style: pdfStyles.metaRow },
                React.createElement(Text, { style: pdfStyles.metaLabel }, 'Nr. '),
                React.createElement(Text, { style: pdfStyles.metaValue }, invoiceNumber),
              )
            : null,
          React.createElement(
            View,
            { style: pdfStyles.metaRow },
            React.createElement(Text, { style: pdfStyles.metaLabel }, 'Datum: '),
            React.createElement(Text, { style: pdfStyles.metaValue }, formattedDate),
          ),
          React.createElement(
            View,
            { style: pdfStyles.metaRow },
            React.createElement(Text, { style: pdfStyles.metaLabel }, 'Status: '),
            React.createElement(Text, { style: pdfStyles.statusBadge }, status === 'paid' ? 'Bezahlt' : 'Ausstehend'),
          ),
        ),
      ),

      React.createElement(View, { style: pdfStyles.divider }),

      // Parties
      React.createElement(
        View,
        { style: pdfStyles.partiesRow },
        // Sender
        React.createElement(
          View,
          { style: pdfStyles.partyBlock },
          React.createElement(Text, { style: pdfStyles.partyHeading }, 'Rechnungssteller'),
          React.createElement(Text, { style: pdfStyles.partyName }, gym.legalName || gym.name),
          gym.address
            ? React.createElement(Text, { style: pdfStyles.partyLine }, gym.address.replace(/\n/g, ', '))
            : null,
          gym.phone
            ? React.createElement(Text, { style: pdfStyles.partyLine }, gym.phone)
            : null,
          gym.email
            ? React.createElement(Text, { style: pdfStyles.partyLine }, gym.email)
            : null,
          gym.taxNumber
            ? React.createElement(Text, { style: pdfStyles.partyLine }, `St.-Nr.: ${gym.taxNumber}`)
            : null,
          gym.ustid
            ? React.createElement(Text, { style: pdfStyles.partyLine }, `USt-IdNr.: ${gym.ustid}`)
            : null,
        ),
        // Recipient
        React.createElement(
          View,
          { style: pdfStyles.partyBlock },
          React.createElement(Text, { style: pdfStyles.partyHeading }, 'Rechnungsempfänger'),
          React.createElement(Text, { style: pdfStyles.partyName }, `${member.firstName} ${member.lastName}`),
          member.email
            ? React.createElement(Text, { style: pdfStyles.partyLine }, member.email)
            : null,
          member.address
            ? React.createElement(Text, { style: pdfStyles.partyLine }, member.address.replace(/\n/g, ', '))
            : null,
        ),
      ),

      // Service table header
      React.createElement(
        View,
        { style: pdfStyles.tableHead },
        React.createElement(Text, { style: [pdfStyles.tableHeadCell, pdfStyles.colService] }, 'Leistung'),
        React.createElement(Text, { style: [pdfStyles.tableHeadCell, pdfStyles.colPeriod] }, 'Zeitraum'),
        React.createElement(Text, { style: [pdfStyles.tableHeadCell, pdfStyles.colAmount] }, 'Betrag'),
      ),
      // Service table row
      React.createElement(
        View,
        { style: pdfStyles.tableRow },
        React.createElement(Text, { style: [pdfStyles.tableCell, pdfStyles.colService] }, 'Monatlicher Mitgliedsbeitrag'),
        React.createElement(Text, { style: [pdfStyles.tableCell, pdfStyles.colPeriod] }, monthYear),
        React.createElement(Text, { style: [pdfStyles.tableCell, pdfStyles.colAmount] }, `${amountEur} €`),
      ),

      // Tax / total block
      gym.isKleinunternehmer
        ? React.createElement(
            View,
            { style: pdfStyles.amountBlock },
            React.createElement(Text, { style: [pdfStyles.totalValue, { fontSize: 14 }] }, `${amountEur} €`),
            React.createElement(
              Text,
              { style: pdfStyles.kleinNote },
              'Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).',
            ),
          )
        : React.createElement(
            View,
            { style: pdfStyles.amountBlock },
            React.createElement(
              View,
              { style: pdfStyles.amountRow },
              React.createElement(Text, { style: pdfStyles.amountLabel }, 'Nettobetrag'),
              React.createElement(Text, { style: pdfStyles.amountValue }, `${netEur} €`),
            ),
            React.createElement(
              View,
              { style: pdfStyles.amountRow },
              React.createElement(Text, { style: pdfStyles.amountLabel }, 'zzgl. 19% USt.'),
              React.createElement(Text, { style: pdfStyles.amountValue }, `${vatEur} €`),
            ),
            React.createElement(
              View,
              { style: pdfStyles.totalRow },
              React.createElement(Text, { style: pdfStyles.totalLabel }, 'Gesamtbetrag'),
              React.createElement(Text, { style: pdfStyles.totalValue }, `${amountEur} €`),
            ),
          ),

      // Bank info
      gym.bankIban
        ? React.createElement(
            View,
            { style: pdfStyles.bankSection },
            React.createElement(Text, { style: pdfStyles.bankHeading }, 'Bankverbindung'),
            React.createElement(
              View,
              { style: pdfStyles.bankGrid },
              gym.bankName
                ? React.createElement(
                    View,
                    { style: pdfStyles.bankItem },
                    React.createElement(Text, { style: pdfStyles.bankLabel }, 'Bank'),
                    React.createElement(Text, { style: pdfStyles.bankValue }, gym.bankName),
                  )
                : null,
              React.createElement(
                View,
                { style: pdfStyles.bankItem },
                React.createElement(Text, { style: pdfStyles.bankLabel }, 'IBAN'),
                React.createElement(Text, { style: pdfStyles.bankValue }, gym.bankIban),
              ),
              gym.bankBic
                ? React.createElement(
                    View,
                    { style: pdfStyles.bankItem },
                    React.createElement(Text, { style: pdfStyles.bankLabel }, 'BIC'),
                    React.createElement(Text, { style: pdfStyles.bankValue }, gym.bankBic),
                  )
                : null,
            ),
          )
        : null,

      // Footer
      React.createElement(
        Text,
        { style: pdfStyles.footer },
        'Erstellt mit Osss – BJJ Gym Software',
      ),
    ),
  )
}

// ── Shared data loader ────────────────────────────────────────────────────────

async function loadInvoiceData(paymentId: string) {
  const supabaseAdmin = createServiceClient()

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select(`
      *,
      members (first_name, last_name, email, address),
      gyms (name, address, phone, email, tax_number, ustid, is_kleinunternehmer, invoice_prefix, invoice_counter, bank_iban, bank_bic, bank_name, legal_name, legal_address, legal_email)
    `)
    .eq('id', paymentId)
    .single()

  return payment
}

async function generateInvoiceNumber(
  supabaseAdmin: ReturnType<typeof createServiceClient>,
  pmt: Record<string, unknown>,
  gym: Record<string, unknown>,
  paymentId: string,
): Promise<string | null> {
  if (pmt.invoice_number) return pmt.invoice_number as string
  if (pmt.status !== 'paid') return null

  try {
    const year = new Date((pmt.paid_at || pmt.created_at) as string).getFullYear()
    const { data: counter } = await supabaseAdmin.rpc('increment_invoice_counter', { p_gym_id: pmt.gym_id as string })
    const num = `${(gym.invoice_prefix as string | null) ?? 'RE'}-${year}-${String(counter ?? 1).padStart(4, '0')}`
    await supabaseAdmin.from('payments').update({ invoice_number: num }).eq('id', paymentId)
    return num
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params
  const format = new URL(req.url).searchParams.get('format')

  // Auth: Bearer token or cookie session
  let user: { id: string } | null = null
  const authHeader  = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (accessToken) {
    const supabase = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
    const { data } = await supabase.auth.getUser(accessToken)
    user = data.user
  } else {
    const serverSupabase = await createServerClient()
    const { data } = await serverSupabase.auth.getUser()
    user = data.user
  }
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const payment = await loadInvoiceData(paymentId)
  if (!payment) return new Response('Zahlung nicht gefunden', { status: 404 })

  // IDOR guard
  const authedSupabase = accessToken
    ? createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
    : await createServerClient()
  const { data: callerGym } = await (authedSupabase as ReturnType<typeof createClient>)
    .from('gyms')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!callerGym || (callerGym as { id: string }).id !== (payment as unknown as Record<string, unknown>).gym_id) {
    return new Response('Nicht autorisiert', { status: 403 })
  }

  const rawPayment = payment as unknown as Record<string, unknown>
  const gym    = rawPayment.gyms as Record<string, unknown> | null
  const member = rawPayment.members as Record<string, unknown> | null
  const pmt    = rawPayment

  if (!gym)    return new Response('Gym nicht gefunden',    { status: 404 })
  if (!member) return new Response('Mitglied nicht gefunden', { status: 404 })

  const supabaseAdmin  = createServiceClient()
  const invoiceNumber  = await generateInvoiceNumber(supabaseAdmin, pmt, gym, paymentId)

  const date          = new Date((pmt.paid_at || pmt.created_at) as string)
  const formattedDate = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const monthYear     = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const rawCents      = typeof pmt.amount_cents === 'number' ? pmt.amount_cents : 0
  const amountEur     = (rawCents / 100).toFixed(2).replace('.', ',')

  // ── PDF response ──────────────────────────────────────────────────────────
  if (format === 'pdf') {
    const invoiceData: InvoiceData = {
      invoiceNumber,
      formattedDate,
      monthYear,
      amountEur,
      rawCents,
      status: pmt.status as string,
      gym: {
        name:               String(gym.name ?? ''),
        legalName:          String(gym.legal_name ?? gym.name ?? ''),
        address:            String(gym.legal_address ?? gym.address ?? ''),
        phone:              (gym.phone as string | null) ?? null,
        email:              ((gym.legal_email ?? gym.email) as string | null) ?? null,
        taxNumber:          (gym.tax_number as string | null) ?? null,
        ustid:              (gym.ustid as string | null) ?? null,
        isKleinunternehmer: Boolean(gym.is_kleinunternehmer),
        bankIban:           (gym.bank_iban as string | null) ?? null,
        bankBic:            (gym.bank_bic as string | null) ?? null,
        bankName:           (gym.bank_name as string | null) ?? null,
      },
      member: {
        firstName: String(member.first_name ?? ''),
        lastName:  String(member.last_name ?? ''),
        email:     (member.email as string | null) ?? null,
        address:   (member.address as string | null) ?? null,
      },
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buffer = await renderToBuffer(React.createElement(InvoicePDF, { data: invoiceData }) as any)
      const filename = invoiceNumber
        ? `Rechnung-${invoiceNumber}.pdf`
        : `Rechnung-${paymentId.slice(0, 8)}.pdf`

      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (err) {
      console.error('[invoice] PDF generation failed:', err)
      return NextResponse.json({ error: 'PDF-Generierung fehlgeschlagen' }, { status: 500 })
    }
  }

  // ── HTML response (browser view) ──────────────────────────────────────────
  const gymName    = escHtml(gym.legal_name || gym.name || '')
  const gymAddress = escHtml(gym.legal_address || gym.address || '').replace(/\n/g, '<br>')

  let taxSection = ''
  if (gym.is_kleinunternehmer) {
    taxSection = `<p class="tax-note">Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</p>`
  } else {
    const grossCents = rawCents
    const netCents   = Math.round(grossCents / 1.19)
    const vatCents   = grossCents - netCents
    const netEur     = (netCents / 100).toFixed(2).replace('.', ',')
    const vatEur     = (vatCents / 100).toFixed(2).replace('.', ',')
    taxSection = `
      <table class="amount-table">
        <tr><td>Nettobetrag</td><td>${netEur} €</td></tr>
        <tr><td>zzgl. 19% USt.</td><td>${vatEur} €</td></tr>
        <tr class="total"><td><strong>Gesamtbetrag</strong></td><td><strong>${amountEur} €</strong></td></tr>
      </table>
    `
  }

  const pdfUrl = `${req.url.split('?')[0]}?format=pdf`

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Rechnung ${invoiceNumber ?? ''}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1e293b; background: white; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
  .logo { font-size: 24px; font-weight: 900; font-style: italic; color: #0f172a; }
  .logo span { color: #f59e0b; }
  .invoice-title { font-size: 28px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .invoice-meta { color: #64748b; font-size: 12px; }
  .invoice-meta strong { color: #0f172a; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
  .party h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 8px; }
  .party p { line-height: 1.6; color: #334155; }
  .party .name { font-weight: 700; font-size: 15px; color: #0f172a; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
  .service-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  .service-table th { text-align: left; padding: 10px 12px; background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
  .service-table td { padding: 16px 12px; border-bottom: 1px solid #f1f5f9; }
  .amount-table { width: 100%; max-width: 300px; margin-left: auto; border-collapse: collapse; }
  .amount-table td { padding: 6px 0; }
  .amount-table td:last-child { text-align: right; }
  .amount-table tr.total td { border-top: 2px solid #0f172a; padding-top: 10px; font-size: 16px; }
  .simple-total { text-align: right; font-size: 18px; font-weight: 700; color: #0f172a; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #dcfce7; color: #16a34a; }
  .tax-note { font-size: 11px; color: #64748b; margin-top: 16px; font-style: italic; }
  .bank-section { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; }
  .bank-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 12px; }
  .bank-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 12px; }
  .bank-grid .label { color: #94a3b8; font-size: 11px; }
  .footer { margin-top: 48px; text-align: center; color: #94a3b8; font-size: 11px; }
  .action-bar { position: fixed; top: 20px; right: 20px; display: flex; gap: 8px; }
  .btn { border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; text-decoration: none; display: inline-block; }
  .btn-primary { background: #0f172a; color: white; }
  .btn-secondary { background: #f1f5f9; color: #0f172a; }
  @media print { .action-bar { display: none; } body { padding: 20px; } }
</style>
<script>
  if (new URLSearchParams(window.location.search).get('print') === '1') {
    window.addEventListener('load', function() { setTimeout(function() { window.print() }, 400) })
  }
</script>
</head>
<body>
<div class="action-bar">
  <a href="${escHtml(pdfUrl)}" class="btn btn-secondary">PDF herunterladen</a>
  <button class="btn btn-primary" onclick="window.print()">Drucken</button>
</div>

<div class="header">
  <div class="logo"><span>Oss</span>s</div>
  <div>
    <div class="invoice-title">Rechnung</div>
    <div class="invoice-meta">
      ${invoiceNumber ? `<div>Nr. <strong>${escHtml(invoiceNumber)}</strong></div>` : ''}
      <div>Datum: <strong>${escHtml(formattedDate)}</strong></div>
      <div>Status: <span class="status-badge">${pmt.status === 'paid' ? 'Bezahlt' : 'Ausstehend'}</span></div>
    </div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <h3>Rechnungssteller</h3>
    <p class="name">${gymName}</p>
    <p>${gymAddress}</p>
    ${gym.phone ? `<p>${escHtml(gym.phone)}</p>` : ''}
    ${gym.legal_email || gym.email ? `<p>${escHtml((gym.legal_email ?? gym.email) as string)}</p>` : ''}
    ${gym.tax_number ? `<p>St.-Nr.: ${escHtml(gym.tax_number)}</p>` : ''}
    ${gym.ustid ? `<p>USt-IdNr.: ${escHtml(gym.ustid)}</p>` : ''}
  </div>
  <div class="party">
    <h3>Rechnungsempfänger</h3>
    <p class="name">${escHtml(member.first_name)} ${escHtml(member.last_name)}</p>
    ${member.email ? `<p>${escHtml(member.email)}</p>` : ''}
    ${member.address ? `<p>${escHtml(member.address as string).replace(/\n/g, '<br>')}</p>` : ''}
  </div>
</div>

<table class="service-table">
  <thead>
    <tr>
      <th>Leistung</th>
      <th>Zeitraum</th>
      <th style="text-align:right">Betrag</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Monatlicher Mitgliedsbeitrag</td>
      <td>${monthYear}</td>
      <td style="text-align:right;font-weight:600">${amountEur} €</td>
    </tr>
  </tbody>
</table>

${gym.is_kleinunternehmer
  ? `<div class="simple-total">${amountEur} €</div>${taxSection}`
  : taxSection
}

${gym.bank_iban ? `
<div class="bank-section">
  <h3>Bankverbindung</h3>
  <div class="bank-grid">
    ${gym.bank_name ? `<div><div class="label">Bank</div><div>${escHtml(gym.bank_name as string)}</div></div>` : ''}
    <div><div class="label">IBAN</div><div>${escHtml(gym.bank_iban as string)}</div></div>
    ${gym.bank_bic ? `<div><div class="label">BIC</div><div>${escHtml(gym.bank_bic as string)}</div></div>` : ''}
  </div>
</div>` : ''}

<div class="footer">
  <p>Erstellt mit Osss – BJJ Gym Software</p>
</div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
