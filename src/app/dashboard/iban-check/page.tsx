'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, Check, X, Download, FileWarning } from 'lucide-react'
import { validateIBANs, type BulkIbanRow } from '@/lib/iban'

/**
 * IBAN-Check-Tool für Gym-Owner.
 *
 * Gym-Inhaber lädt eine CSV mit IBAN-Spalte hoch (z.B. aus Excel-Export
 * der bestehenden Mitgliederliste). Tool validiert offline (kein API-Call,
 * keine Speicherung) und gibt sofort Liste der ungültigen Zeilen zurück.
 *
 * Use-Case: VOR der Migration zu SEPA prüfen, welche IBANs Tippfehler haben.
 */

interface ParsedRow {
  index: number
  raw: string
  name?: string
}

export default function IbanCheckPage() {
  const [rows, setRows] = useState<BulkIbanRow[]>([])
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [csvHeader, setCsvHeader] = useState<string | null>(null)

  function handleFile(file: File) {
    setError(null)
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = String(e.target?.result ?? '')
        const lines = text.split(/\r?\n/).filter(l => l.trim())

        if (lines.length === 0) {
          setError('CSV ist leer')
          return
        }

        // Header-Detection: einfacher Split auf Komma oder Semikolon
        const sep = lines[0].includes(';') ? ';' : ','
        const header = lines[0].split(sep).map(s => s.trim().toLowerCase().replace(/^"|"$/g, ''))

        // IBAN-Spalte finden
        const ibanCol = header.findIndex(h => h.includes('iban'))
        if (ibanCol === -1) {
          setError(`Keine "iban"-Spalte in der CSV gefunden. Spalten: ${header.join(', ')}`)
          return
        }

        // Optional: Name-Spalte
        const nameCol = header.findIndex(h => h.includes('name') || h.includes('mitglied'))

        setCsvHeader(`${header.length} Spalten · IBAN-Spalte: "${header[ibanCol]}"${nameCol !== -1 ? ` · Name-Spalte: "${header[nameCol]}"` : ''}`)

        const parsed: ParsedRow[] = []
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(sep).map(s => s.trim().replace(/^"|"$/g, ''))
          const iban = cols[ibanCol] ?? ''
          if (!iban) continue
          parsed.push({
            index: i,
            raw: iban,
            name: nameCol !== -1 ? cols[nameCol] : undefined,
          })
        }

        setParsedRows(parsed)
        const validated = validateIBANs(parsed.map(r => ({ iban: r.raw, index: r.index })))
        setRows(validated)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Lesen der CSV')
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  function downloadResult() {
    if (rows.length === 0) return

    const sep = ';'
    const headerRow = ['Zeile', 'Mitglied', 'IBAN (original)', 'Status', 'Grund', 'IBAN (formatiert)']
    const csvRows = [
      headerRow.join(sep),
      ...rows.map(r => {
        const parsedMatch = parsedRows.find(p => p.index === r.index)
        const status = r.result.valid ? 'OK' : 'FEHLER'
        const reason = r.result.valid ? '' : r.result.reason
        const formatted = r.result.valid ? r.result.formatted : ''
        return [r.index, parsedMatch?.name ?? '', r.raw, status, reason, formatted]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(sep)
      }),
    ]
    const blob = new Blob(['﻿' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `iban-check-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function reset() {
    setRows([])
    setParsedRows([])
    setFileName(null)
    setError(null)
    setCsvHeader(null)
  }

  const validCount = rows.filter(r => r.result.valid).length
  const invalidCount = rows.length - validCount

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors mb-3">
        <ArrowLeft size={14} /> Einstellungen
      </Link>

      <h1 className="text-2xl font-black text-zinc-950 tracking-tight mb-1">IBAN-Check</h1>
      <p className="text-sm text-zinc-500 leading-relaxed mb-6 max-w-xl">
        Lade eine CSV mit deiner Mitgliederliste hoch. Wir prüfen offline jede IBAN auf
        Format und Prüfziffer (DE/AT/CH und alle EU-Länder). <strong>Keine Daten verlassen
        deinen Browser</strong> — alles läuft lokal.
      </p>

      {/* File Drop */}
      {rows.length === 0 && (
        <label className={`block bg-white border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer hover:border-amber-300 hover:bg-amber-50/30 transition-colors ${error ? 'border-rose-300' : 'border-zinc-200'}`}>
          <Upload className="mx-auto text-zinc-400 mb-3" size={28} />
          <p className="font-semibold text-zinc-700">CSV hier ablegen oder klicken</p>
          <p className="text-xs text-zinc-400 mt-1">UTF-8 · Komma oder Semikolon getrennt · IBAN-Spalte muss „iban" enthalten</p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </label>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mt-4 text-sm text-rose-900">
          <strong>Fehler:</strong> {error}
        </div>
      )}

      {/* Results */}
      {rows.length > 0 && (
        <>
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-zinc-500"><strong>{fileName}</strong></p>
              <button onClick={reset} className="text-xs text-zinc-400 hover:text-zinc-700">Neue Datei</button>
            </div>
            {csvHeader && <p className="text-xs text-zinc-400 mb-3">{csvHeader}</p>}

            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Geprüft" value={rows.length} tone="zinc" />
              <Stat label="Gültig" value={validCount} tone="emerald" />
              <Stat label="Fehlerhaft" value={invalidCount} tone="rose" highlight={invalidCount > 0} />
            </div>

            {invalidCount > 0 && (
              <button onClick={downloadResult}
                className="mt-4 inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
                <Download size={14} /> Ergebnis als CSV runterladen
              </button>
            )}
          </div>

          {/* Invalid rows first */}
          {invalidCount > 0 && (
            <div className="mb-4">
              <h2 className="font-bold text-rose-700 text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                <FileWarning size={14} /> Fehlerhafte IBANs ({invalidCount})
              </h2>
              <ul className="space-y-2">
                {rows.filter(r => !r.result.valid).map(r => {
                  const parsed = parsedRows.find(p => p.index === r.index)
                  return (
                    <li key={r.index} className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm">
                      <div className="flex items-start gap-3">
                        <X size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-rose-900">
                            Zeile {r.index} {parsed?.name && <span className="text-rose-700 font-normal">· {parsed.name}</span>}
                          </p>
                          <p className="font-mono text-xs text-rose-700 mt-0.5 break-all">{r.raw}</p>
                          <p className="text-xs text-rose-600 mt-1">{!r.result.valid ? r.result.reason : ''}</p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Valid rows summary */}
          {validCount > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-sm text-emerald-900">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-emerald-600" />
                <p><strong>{validCount} IBANs</strong> sind formal gültig (Format + Prüfziffer OK).</p>
              </div>
              <p className="text-xs text-emerald-700 mt-2 leading-relaxed">
                ⚠️ Wichtig: Format-OK heißt nicht „Konto existiert + ist gedeckt". Die echte
                Validität zeigt sich erst beim ersten SEPA-Einzug. Stripe meldet sich dann
                automatisch zurück, wenn ein Konto nicht existiert.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, tone, highlight }: { label: string; value: number; tone: 'zinc' | 'emerald' | 'rose'; highlight?: boolean }) {
  const colors = {
    zinc:    { bg: 'bg-zinc-50',    text: 'text-zinc-900',    label: 'text-zinc-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'text-emerald-700' },
    rose:    { bg: highlight ? 'bg-rose-100' : 'bg-rose-50', text: 'text-rose-700', label: 'text-rose-700' },
  }[tone]
  return (
    <div className={`${colors.bg} rounded-lg p-3`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${colors.label}`}>{label}</p>
      <p className={`text-2xl font-black tabular-nums mt-0.5 ${colors.text}`}>{value}</p>
    </div>
  )
}
