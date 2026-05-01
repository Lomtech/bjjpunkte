import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function adminClient() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function GET(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params

  // Auth check: accept Bearer token (fetch calls) or cookie-based session (browser navigation)
  let user: { id: string } | null = null
  const authHeader = req.headers.get('Authorization')
  const accessToken = authHeader?.replace('Bearer ', '')
  if (accessToken) {
    const supabase = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } } })
    const { data } = await supabase.auth.getUser(accessToken)
    user = data.user
  } else {
    // Fallback: cookie-based session (browser <a href> link)
    const serverSupabase = await createServerClient()
    const { data } = await serverSupabase.auth.getUser()
    user = data.user
  }
  if (!user) return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })

  const supabaseAdmin = adminClient()

  // Load payment with member and gym data
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select(`
      *,
      members (first_name, last_name, email, address),
      gyms (name, address, phone, email, tax_number, ustid, is_kleinunternehmer, invoice_prefix, invoice_counter, bank_iban, bank_bic, bank_name, legal_name, legal_address, legal_email)
    `)
    .eq('id', paymentId)
    .single()

  if (!payment) return new Response('Zahlung nicht gefunden', { status: 404 })

  const gym = payment.gyms as any
  const member = payment.members as any
  const pmt = payment as any

  // Null-safety: gyms or members could be null
  if (!gym) return new Response('Gym nicht gefunden', { status: 404 })
  if (!member) return new Response('Mitglied nicht gefunden', { status: 404 })

  // Generate invoice number if not yet set — uses atomic DB function to prevent duplicates
  let invoiceNumber = pmt.invoice_number
  try {
    if (!invoiceNumber && pmt.status === 'paid') {
      const year = new Date(pmt.paid_at || pmt.created_at).getFullYear()
      // Atomic increment via SQL function (no race condition)
      const { data: counter } = await supabaseAdmin.rpc('increment_invoice_counter', { p_gym_id: pmt.gym_id })
      invoiceNumber = `${gym.invoice_prefix ?? 'RE'}-${year}-${String(counter ?? 1).padStart(4, '0')}`
      await supabaseAdmin.from('payments').update({ invoice_number: invoiceNumber }).eq('id', paymentId)
    }
  } catch {
    // invoice number generation is non-critical — continue without it
  }

  const date = new Date(pmt.paid_at || pmt.created_at)
  const formattedDate = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const monthYear = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  const amountEur = (pmt.amount_cents / 100).toFixed(2).replace('.', ',')

  const gymName = gym.legal_name || gym.name || ''
  const gymAddress = gym.legal_address || gym.address || ''

  let taxSection = ''
  if (gym.is_kleinunternehmer) {
    taxSection = `<p class="tax-note">Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).</p>`
  } else {
    // amount_cents is gross (inkl. 19% USt)
    const grossCents = pmt.amount_cents
    const netCents = Math.round(grossCents / 1.19)
    const vatCents = grossCents - netCents
    const netEur = (netCents / 100).toFixed(2).replace('.', ',')
    const vatEur = (vatCents / 100).toFixed(2).replace('.', ',')
    taxSection = `
      <table class="amount-table">
        <tr><td>Nettobetrag</td><td>${netEur} €</td></tr>
        <tr><td>zzgl. 19% USt.</td><td>${vatEur} €</td></tr>
        <tr class="total"><td><strong>Gesamtbetrag</strong></td><td><strong>${amountEur} €</strong></td></tr>
      </table>
    `
  }

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
  .print-btn { position: fixed; top: 20px; right: 20px; background: #0f172a; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; }
  @media print { .print-btn { display: none; } body { padding: 20px; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Drucken / PDF</button>

<div class="header">
  <div class="logo"><span>Oss</span>s</div>
  <div>
    <div class="invoice-title">Rechnung</div>
    <div class="invoice-meta">
      ${invoiceNumber ? `<div>Nr. <strong>${invoiceNumber}</strong></div>` : ''}
      <div>Datum: <strong>${formattedDate}</strong></div>
      <div>Status: <span class="status-badge">${pmt.status === 'paid' ? 'Bezahlt' : 'Ausstehend'}</span></div>
    </div>
  </div>
</div>

<div class="parties">
  <div class="party">
    <h3>Rechnungssteller</h3>
    <p class="name">${gymName}</p>
    <p>${gymAddress.replace(/\n/g, '<br>')}</p>
    ${gym.phone ? `<p>${gym.phone}</p>` : ''}
    ${gym.legal_email || gym.email ? `<p>${gym.legal_email || gym.email}</p>` : ''}
    ${gym.tax_number ? `<p>St.-Nr.: ${gym.tax_number}</p>` : ''}
    ${gym.ustid ? `<p>USt-IdNr.: ${gym.ustid}</p>` : ''}
  </div>
  <div class="party">
    <h3>Rechnungsempfänger</h3>
    <p class="name">${member.first_name} ${member.last_name}</p>
    ${member.email ? `<p>${member.email}</p>` : ''}
    ${member.address ? `<p>${member.address.replace(/\n/g, '<br>')}</p>` : ''}
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
    ${gym.bank_name ? `<div><div class="label">Bank</div><div>${gym.bank_name}</div></div>` : ''}
    <div><div class="label">IBAN</div><div>${gym.bank_iban}</div></div>
    ${gym.bank_bic ? `<div><div class="label">BIC</div><div>${gym.bank_bic}</div></div>` : ''}
  </div>
</div>` : ''}

<div class="footer">
  <p>Erstellt mit Osss – BJJ Gym Software</p>
</div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
