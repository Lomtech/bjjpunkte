'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Upload, CheckCircle, XCircle } from 'lucide-react'
import type { Belt } from '@/types/database'

const VALID_BELTS = new Set<string>(['white', 'blue', 'purple', 'brown', 'black'])

interface CsvRow {
  first_name: string
  last_name: string
  email: string
  phone: string
  belt: Belt
  join_date: string
  valid: boolean
  error?: string
}

function parseBelt(raw: string): Belt {
  const normalized = raw.toLowerCase().trim()
  const map: Record<string, Belt> = {
    white: 'white', weiss: 'white', weiß: 'white',
    blue: 'blue', blau: 'blue',
    purple: 'purple', lila: 'purple',
    brown: 'brown', braun: 'brown',
    black: 'black', schwarz: 'black',
  }
  return (map[normalized] ?? (VALID_BELTS.has(normalized) ? normalized as Belt : 'white'))
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  // Skip header row if present
  const dataLines = lines[0]?.toLowerCase().includes('vorname') ? lines.slice(1) : lines

  return dataLines.map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const [first_name, last_name, email, phone, beltRaw, join_date_raw] = cols

    if (!first_name || !last_name) {
      return { first_name: first_name ?? '', last_name: last_name ?? '', email: '', phone: '', belt: 'white', join_date: '', valid: false, error: 'Vor- und Nachname erforderlich' }
    }

    const belt = parseBelt(beltRaw ?? '')
    const join_date = join_date_raw
      ? (() => {
          const d = new Date(join_date_raw)
          return isNaN(d.getTime()) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0]
        })()
      : new Date().toISOString().split('T')[0]

    return {
      first_name,
      last_name,
      email: email ?? '',
      phone: phone ?? '',
      belt,
      join_date,
      valid: true,
    }
  })
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<CsvRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null)
  const [error, setError] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setImportResult(null)
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setRows(parseCsv(text))
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.valid)
    if (validRows.length === 0) return

    setImporting(true)
    setError('')
    const supabase = createClient()
    const { data: gym } = await (supabase.from('gyms') as any).select('id, plan_member_limit').single()
    if (!gym) { setError('Kein Gym gefunden'); setImporting(false); return }

    const limit: number = (gym as any).plan_member_limit ?? 30
    const { count: activeCount } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gym.id)
      .eq('is_active', true)

    const available = limit - (activeCount ?? 0)
    if (available <= 0) {
      setError(`Plan-Limit erreicht (${limit} Mitglieder). Upgrade nötig.`)
      setImporting(false)
      return
    }

    const rowsToImport = validRows.slice(0, available)
    const skipped = validRows.length - rowsToImport.length
    if (skipped > 0) {
      setError(`Nur ${available} von ${validRows.length} Mitgliedern importiert — Plan-Limit (${limit}) erreicht.`)
    }

    let success = 0
    let failed = 0

    for (const row of rowsToImport) {
      const { error: insertError } = await supabase.from('members').insert({
        gym_id: gym.id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email || null,
        phone: row.phone || null,
        join_date: row.join_date,
        belt: row.belt,
        stripes: 0,
        is_active: true,
      })
      if (insertError) failed++
      else success++
    }

    setImportResult({ success, failed })
    setImporting(false)
    if (success > 0) setRows([])
  }

  const validCount = rows.filter(r => r.valid).length
  const invalidCount = rows.filter(r => !r.valid).length

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <Link href="/dashboard/members" className="text-slate-400 hover:text-slate-600 text-sm">← Mitglieder</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-3">CSV importieren</h1>
        <p className="text-slate-500 text-sm mt-1">Importiere Mitglieder aus einer CSV-Datei.</p>
      </div>

      {/* Format hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 text-sm text-amber-800">
        <p className="font-semibold mb-1">CSV-Format (eine Zeile pro Mitglied):</p>
        <code className="text-xs bg-amber-100 px-2 py-1 rounded font-mono">Vorname, Nachname, E-Mail, Telefon, Guertel, Beitrittsdatum</code>
        <p className="mt-2 text-amber-700">Guertel: white/weiss, blue/blau, purple/lila, brown/braun, black/schwarz. Datum: YYYY-MM-DD</p>
      </div>

      {/* File upload */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">CSV-Datei auswaehlen</label>
        <div
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-amber-300 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={24} className="text-slate-400 mx-auto mb-2" />
          <p className="text-slate-600 text-sm font-medium">Klicke zum Auswaehlen einer CSV-Datei</p>
          <p className="text-slate-400 text-xs mt-1">oder ziehe sie hierher</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      </div>

      {/* Import result */}
      {importResult && (
        <div className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 text-green-800 font-semibold">
            <CheckCircle size={16} />
            Import abgeschlossen
          </div>
          <p className="text-green-700 text-sm mt-1">{importResult.success} Mitglieder importiert{importResult.failed > 0 ? `, ${importResult.failed} fehlgeschlagen` : ''}.</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-slate-700">{rows.length} Zeilen gefunden</p>
              {validCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                  {validCount} gueltig
                </span>
              )}
              {invalidCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
                  {invalidCount} ungueltig (werden uebersprungen)
                </span>
              )}
            </div>
            {validCount > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                {importing ? 'Wird importiert...' : `${validCount} Mitglieder importieren`}
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">E-Mail</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Telefon</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Guertel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Beitrittsdatum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-slate-100 last:border-0 ${row.valid ? '' : 'opacity-50 bg-red-50'}`}>
                    <td className="px-4 py-3">
                      {row.valid
                        ? <CheckCircle size={14} className="text-green-500" />
                        : <span title={row.error}><XCircle size={14} className="text-red-500" /></span>
                      }
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.first_name} {row.last_name}</td>
                    <td className="px-4 py-3 text-slate-500">{row.email || '–'}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{row.phone || '–'}</td>
                    <td className="px-4 py-3 text-slate-700 capitalize">{row.belt}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{row.join_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
