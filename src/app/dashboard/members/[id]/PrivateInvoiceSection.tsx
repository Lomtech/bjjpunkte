'use client'

// Sprint 2026-05-27: Privattraining + Ad-Hoc-Rechnungen + Gutschrift.
// Section im Member-Detail: zeigt one_off + credit_note Rechnungen,
// "Neue Rechnung"-Button mit Multi-Position-Modal.

import { useState, useEffect } from 'react'
import { Receipt, Plus, X, FileDown, Trash2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'

interface Invoice {
  id: string
  amount_cents: number
  status: string
  paid_at: string | null
  issued_at: string | null
  due_date: string | null
  invoice_number: string | null
  description: string | null
  kind: string
  credits_payment_id: string | null
}

interface LineItem {
  description: string
  qty: string
  unit_price_eur: string
  tax_rate_pct: string
}

interface Props {
  memberId: string
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtEur(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800',
  paid:      'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-zinc-100 text-zinc-500 line-through',
}
const KIND_LABELS: Record<string, string> = {
  one_off:     'Privattraining',
  credit_note: 'Gutschrift',
}

const EMPTY_ITEM: LineItem = { description: '', qty: '1', unit_price_eur: '', tax_rate_pct: '19' }

export function PrivateInvoiceSection({ memberId }: Props) {
  const toast = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form-State: Multi-Position
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }])
  const [paid, setPaid] = useState(false)
  const [dueOffsetDays, setDueOffsetDays] = useState('14')

  async function load() {
    const sb = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb.from('payments') as any)
      .select('id, amount_cents, status, paid_at, issued_at, due_date, invoice_number, description, kind, credits_payment_id')
      .eq('member_id', memberId)
      .in('kind', ['one_off', 'credit_note'])
      .order('issued_at', { ascending: false })
      .limit(50)
    setInvoices(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [memberId]) // eslint-disable-line react-hooks/exhaustive-deps

  function addItem() { setItems(prev => [...prev, { ...EMPTY_ITEM }]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function updateItem(idx: number, key: keyof LineItem, val: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  }

  function computeTotals() {
    let net = 0, tax = 0
    for (const it of items) {
      const q = parseFloat(it.qty.replace(',', '.')) || 0
      const p = Math.round((parseFloat(it.unit_price_eur.replace(',', '.')) || 0) * 100)
      const r = parseFloat(it.tax_rate_pct.replace(',', '.')) || 0
      net += Math.round(q * p)
      tax += Math.round(q * p * r / 100)
    }
    return { net, tax, gross: net + tax }
  }

  async function submit() {
    const validItems = items.filter(i => i.description.trim() && parseFloat(i.unit_price_eur.replace(',', '.')) > 0)
    if (validItems.length === 0) {
      toast.error('Mindestens eine gültige Position erforderlich (Beschreibung + Preis > 0)')
      return
    }
    setSaving(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setSaving(false); toast.error('Nicht angemeldet'); return }

    const offset = parseInt(dueOffsetDays, 10) || 14
    const dueDate = new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const res = await fetch(`/api/members/${memberId}/manual-invoice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        paid,
        due_date: dueDate,
        items: validItems.map(it => ({
          description: it.description.trim(),
          qty: parseFloat(it.qty.replace(',', '.')) || 1,
          unit_price_cents: Math.round((parseFloat(it.unit_price_eur.replace(',', '.')) || 0) * 100),
          tax_rate_pct: parseFloat(it.tax_rate_pct.replace(',', '.')) || 19,
        })),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Rechnung fehlgeschlagen')
      return
    }
    const json = await res.json()
    toast.success(`Rechnung ${json.payment.invoice_number} ausgestellt`)
    setShowModal(false)
    setItems([{ ...EMPTY_ITEM }])
    setPaid(false)
    await load()
  }

  async function createCredit(invoice: Invoice) {
    if (!confirm(`Gutschrift zu ${invoice.invoice_number} (${fmtEur(invoice.amount_cents)}) ausstellen?`)) return
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    const res = await fetch(`/api/payments/${invoice.id}/credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Gutschrift fehlgeschlagen')
      return
    }
    const json = await res.json()
    toast.success(`Gutschrift ${json.credit_note.invoice_number} ausgestellt`)
    await load()
  }

  const totals = computeTotals()

  if (loading) return null

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 mb-4">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Receipt size={18} className="text-emerald-500" />
          <h2 className="text-base font-bold text-zinc-900">Privattraining + Sonstige Rechnungen</h2>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5">
          <Plus size={12} /> Neue Rechnung
        </button>
      </header>

      {invoices.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-6">
          Noch keine Ad-Hoc-Rechnungen für dieses Mitglied.
        </p>
      ) : (
        <div className="space-y-1.5">
          {invoices.map(inv => (
            <div key={inv.id} className="border border-zinc-100 rounded-lg p-3 bg-zinc-50 text-sm">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-zinc-700">{inv.invoice_number}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status] ?? STATUS_COLORS.pending}`}>
                      {inv.status}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700">
                      {KIND_LABELS[inv.kind] ?? inv.kind}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">{inv.description ?? '—'}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">
                    Ausgestellt {fmtDate(inv.issued_at)}
                    {inv.due_date && ` · Fällig ${fmtDate(inv.due_date)}`}
                    {inv.paid_at && ` · Bezahlt ${fmtDate(inv.paid_at)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm ${inv.amount_cents < 0 ? 'text-rose-600' : 'text-zinc-900'}`}>
                    {fmtEur(inv.amount_cents)}
                  </span>
                  <a href={`/api/invoices/${inv.id}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded border border-zinc-200 hover:bg-white text-zinc-700 flex items-center gap-1">
                    <FileDown size={11} /> PDF
                  </a>
                  {inv.kind === 'one_off' && !inv.credits_payment_id && (
                    <button onClick={() => createCredit(inv)}
                      className="text-xs px-2 py-1 rounded border border-rose-200 hover:bg-rose-50 text-rose-600 flex items-center gap-1"
                      title="Gutschrift ausstellen">
                      <Trash2 size={11} /> Stornieren
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Neue Rechnung mit Multi-Position */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
             onClick={() => !saving && setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
               onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900">Neue Rechnung erstellen</h3>
              <button onClick={() => !saving && setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </header>

            <div className="space-y-4">
              <p className="text-xs text-zinc-500">
                Multi-Position möglich (z.B. Privattraining + Material). Unterschiedliche USt-Sätze pro Position erlaubt.
              </p>

              {items.map((item, idx) => (
                <div key={idx} className="border border-zinc-200 rounded-lg p-3 bg-zinc-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-500 font-medium">Position {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)}
                        className="text-xs text-rose-500 hover:text-rose-700">
                        Entfernen
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateItem(idx, 'description', e.target.value)}
                      placeholder="Beschreibung (z.B. Privattraining 60min am 2026-06-15)"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm" />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Menge</label>
                        <input
                          type="text"
                          value={item.qty}
                          onChange={e => updateItem(idx, 'qty', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Einzelpreis netto (EUR)</label>
                        <input
                          type="text"
                          value={item.unit_price_eur}
                          onChange={e => updateItem(idx, 'unit_price_eur', e.target.value)}
                          placeholder="50.00"
                          className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">USt (%)</label>
                        <select
                          value={item.tax_rate_pct}
                          onChange={e => updateItem(idx, 'tax_rate_pct', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm">
                          <option value="0">0 %</option>
                          <option value="7">7 %</option>
                          <option value="19">19 %</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addItem}
                className="text-xs px-3 py-1.5 rounded-md border border-dashed border-zinc-300 hover:bg-zinc-50 text-zinc-700 w-full">
                + weitere Position
              </button>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Zahlungsziel (Tage)</label>
                  <input type="text" value={dueOffsetDays} onChange={e => setDueOffsetDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} />
                    <span className="text-sm text-zinc-700">Bereits bezahlt (bar/EC)</span>
                  </label>
                </div>
              </div>

              {/* Totals-Übersicht */}
              <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-200">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-zinc-500">Netto</div>
                    <div className="font-mono">{fmtEur(totals.net)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">USt</div>
                    <div className="font-mono">{fmtEur(totals.tax)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Brutto</div>
                    <div className="font-mono font-bold">{fmtEur(totals.gross)}</div>
                  </div>
                </div>
              </div>
            </div>

            <footer className="flex justify-end gap-2 pt-5 mt-5 border-t border-zinc-100">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="px-4 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50">
                Abbrechen
              </button>
              <button onClick={submit} disabled={saving || totals.gross === 0}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50">
                <Check size={14} /> {saving ? 'Erstelle…' : `Rechnung über ${fmtEur(totals.gross)} ausstellen`}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}
