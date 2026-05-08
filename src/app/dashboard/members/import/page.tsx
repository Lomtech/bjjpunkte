'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Upload, CheckCircle, XCircle, Download, Sparkles } from 'lucide-react'
import type { Belt } from '@/types/database'
import { useLanguage } from '@/lib/i18n/LanguageContext'

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

function parseCsv(text: string, nameRequiredError: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  // Skip header row if present
  const dataLines = lines[0]?.toLowerCase().includes('vorname') ? lines.slice(1) : lines

  return dataLines.map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const [first_name, last_name, email, phone, beltRaw, join_date_raw] = cols

    if (!first_name || !last_name) {
      return { first_name: first_name ?? '', last_name: last_name ?? '', email: '', phone: '', belt: 'white', join_date: '', valid: false, error: nameRequiredError }
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

// ─── Smart import (server-side parsing, auto-mapping) ──────────────────────
// Lightweight client-side preview: shows the FIRST 5 valid rows so the user
// can sanity-check before clicking "Import". The server re-parses the same
// file authoritatively — we don't trust the preview for the actual insert.
interface PreviewRow { first_name: string; last_name: string; email: string; phone: string; belt: string; join_date: string }

const HEADER_ALIASES: Record<string, string[]> = {
  first_name: ['vorname', 'firstname', 'first_name', 'forename', 'name'],
  last_name:  ['nachname', 'lastname', 'last_name', 'surname', 'familienname'],
  email:      ['email', 'e_mail', 'mail', 'emailadresse', 'e_mail_adresse'],
  phone:      ['telefon', 'phone', 'handy', 'mobil', 'mobile', 'tel', 'telefonnummer'],
  belt:       ['gurt', 'gürtel', 'guertel', 'belt'],
  join_date:  ['beitrittsdatum', 'joindate', 'join_date', 'mitglied_seit', 'eintrittsdatum', 'startdatum', 'start_date'],
}

function smartPreview(text: string): PreviewRow[] {
  const stripped = text.replace(/^﻿/, '')
  const firstLine = stripped.split(/\r?\n/).find(l => l.trim()) ?? ''
  const sep = firstLine.split(';').length > firstLine.split(',').length ? ';' : ','
  const lines = stripped.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const norm = (s: string) =>
    s.replace(/^﻿/, '').toLowerCase().trim().replace(/["']/g, '').replace(/[\s\-./]+/g, '_')
  const headers = lines[0].split(sep).map(h => norm(h.replace(/^"|"$/g, '')))
  const idxOf = (logical: string) =>
    headers.findIndex(h => HEADER_ALIASES[logical]?.includes(h))

  const cols = {
    first_name: idxOf('first_name'),
    last_name:  idxOf('last_name'),
    email:      idxOf('email'),
    phone:      idxOf('phone'),
    belt:       idxOf('belt'),
    join_date:  idxOf('join_date'),
  }

  return lines.slice(1, 6).map(line => {
    const cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    return {
      first_name: cols.first_name >= 0 ? cells[cols.first_name] ?? '' : '',
      last_name:  cols.last_name  >= 0 ? cells[cols.last_name]  ?? '' : '',
      email:      cols.email      >= 0 ? cells[cols.email]      ?? '' : '',
      phone:      cols.phone      >= 0 ? cells[cols.phone]      ?? '' : '',
      belt:       cols.belt       >= 0 ? cells[cols.belt]       ?? '' : '',
      join_date:  cols.join_date  >= 0 ? cells[cols.join_date]  ?? '' : '',
    }
  })
}

const TEMPLATE_CSV =
  'vorname,nachname,email,telefon,geburtsdatum,strasse,plz,ort,gurt,streifen,beitrittsdatum,monatsbeitrag,notizen\n' +
  'Max,Müller,max.mueller@example.com,+49 170 1234567,1990-04-15,Hauptstraße 12,10115,Berlin,blue,2,2023-09-01,89.00,Stammkunde\n' +
  'Lena,Schäfer,lena.schaefer@example.com,+49 151 2233445,1995-11-23,Lindenweg 7,80331,München,white,3,2024-02-14,79.50,Probetraining bestanden\n'

export default function ImportPage() {
  const { t, lang } = useLanguage()
  const fileRef = useRef<HTMLInputElement>(null)
  const smartFileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<CsvRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null)
  const [error, setError] = useState('')

  // Smart-import state
  const [smartFile, setSmartFile] = useState<File | null>(null)
  const [smartPreviewRows, setSmartPreviewRows] = useState<PreviewRow[]>([])
  const [smartImporting, setSmartImporting] = useState(false)
  const [smartResult, setSmartResult] = useState<{
    imported: number
    skipped: number
    errors: { row: number; error: string }[]
  } | null>(null)
  const [smartError, setSmartError] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setImportResult(null)
    setError('')
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const nameRequiredError = lang === 'en' ? 'First and last name required' : 'Vor- und Nachname erforderlich'
      setRows(parseCsv(text, nameRequiredError))
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleSmartFile(e: React.ChangeEvent<HTMLInputElement>) {
    setSmartResult(null)
    setSmartError('')
    setSmartPreviewRows([])
    const file = e.target.files?.[0]
    if (!file) { setSmartFile(null); return }
    setSmartFile(file)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      try {
        setSmartPreviewRows(smartPreview(text))
      } catch {
        setSmartPreviewRows([])
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleSmartImport() {
    if (!smartFile) return
    setSmartImporting(true)
    setSmartError('')
    setSmartResult(null)

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setSmartError(lang === 'en' ? 'Not authenticated' : 'Nicht angemeldet')
      setSmartImporting(false)
      return
    }

    const formData = new FormData()
    formData.append('file', smartFile)

    try {
      const res = await fetch('/api/gym/excel-import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) {
        setSmartError(json.error ?? (lang === 'en' ? 'Import failed' : 'Import fehlgeschlagen'))
      } else {
        setSmartResult({
          imported: json.imported ?? 0,
          skipped: json.skipped ?? 0,
          errors: json.errors ?? [],
        })
        setSmartFile(null)
        setSmartPreviewRows([])
        if (smartFileRef.current) smartFileRef.current.value = ''
      }
    } catch (err) {
      setSmartError((err as Error).message)
    } finally {
      setSmartImporting(false)
    }
  }

  function downloadTemplate() {
    // Prepend BOM so Excel detects UTF-8 encoding for umlauts
    const blob = new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mitglieder-vorlage.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    const validRows = rows.filter(r => r.valid)
    if (validRows.length === 0) return

    setImporting(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError(t('memberImport', 'noGym')); setImporting(false); return }
    const { data: gym } = await (supabase.from('gyms') as any)
      .select('id, plan_member_limit')
      .eq('owner_id', user.id)
      .maybeSingle()
    if (!gym) { setError(t('memberImport', 'noGym')); setImporting(false); return }

    const limit: number = (gym as any).plan_member_limit ?? 30
    const { count: activeCount } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('gym_id', gym.id)
      .eq('is_active', true)

    const available = limit - (activeCount ?? 0)
    if (available <= 0) {
      setError(t('memberImport', 'planLimit', { limit: String(limit) }))
      setImporting(false)
      return
    }

    const rowsToImport = validRows.slice(0, available)
    const skipped = validRows.length - rowsToImport.length
    if (skipped > 0) {
      setError(t('memberImport', 'partialImport', { available: String(available), total: String(validRows.length), limit: String(limit) }))
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
        <Link href="/dashboard/members" className="text-slate-400 hover:text-slate-600 text-sm">{t('memberImport', 'backToList')}</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-3">{t('memberImport', 'title')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('memberImport', 'subtitle')}</p>
      </div>

      {/* ── Smart import (Excel/CSV with auto-mapping) ──────────────────── */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 shadow-sm p-6 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-100">
            <Sparkles size={18} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900">
              {lang === 'en' ? 'Import from Excel/CSV' : 'Aus Excel/CSV importieren'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {lang === 'en'
                ? 'Column names need NOT match exactly — Vorname/firstname/Name are detected automatically. German + English headers supported.'
                : 'Spaltennamen müssen NICHT exakt passen — Vorname/firstname/Name werden automatisch erkannt. Deutsch + Englisch werden unterstützt.'}
            </p>
          </div>
        </div>

        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800 mb-4"
        >
          <Download size={14} />
          {lang === 'en' ? 'Download CSV template' : 'CSV-Vorlage herunterladen'}
        </button>

        <div className="bg-white rounded-xl border border-amber-200 p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {lang === 'en' ? 'Choose file (.csv)' : 'Datei wählen (.csv)'}
          </label>
          <input
            ref={smartFileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            onChange={handleSmartFile}
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 cursor-pointer"
          />
          <p className="text-xs text-slate-500 mt-2">
            {lang === 'en'
              ? 'Supported: CSV. For Excel: "Save As" → "CSV (Comma delimited) (.csv)".'
              : 'Unterstützt: CSV. Für Excel: "Speichern unter" → "CSV (Trennzeichen-getrennt) (.csv)".'}
          </p>
        </div>

        {smartFile && smartPreviewRows.length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-amber-200 overflow-hidden">
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs font-semibold text-amber-800 uppercase tracking-wider">
              {lang === 'en' ? 'Preview (first 5 rows)' : 'Vorschau (erste 5 Zeilen)'}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{t('memberImport', 'colName')}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{t('memberImport', 'colEmail')}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{t('memberImport', 'colPhone')}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{t('memberImport', 'colBelt')}</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{t('memberImport', 'colJoinDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {smartPreviewRows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2 text-slate-900 font-medium">{r.first_name} {r.last_name}</td>
                      <td className="px-3 py-2 text-slate-500">{r.email || '–'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.phone || '–'}</td>
                      <td className="px-3 py-2 text-slate-700 capitalize">{r.belt || '–'}</td>
                      <td className="px-3 py-2 text-slate-500">{r.join_date || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {smartFile && (
          <button
            onClick={handleSmartImport}
            disabled={smartImporting}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            {smartImporting
              ? (lang === 'en' ? 'Importing…' : 'Wird importiert…')
              : (lang === 'en' ? 'Start import' : 'Import starten')}
          </button>
        )}

        {smartError && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {smartError}
          </div>
        )}

        {smartResult && (
          <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 text-green-800 font-semibold">
              <CheckCircle size={16} />
              {lang === 'en'
                ? `${smartResult.imported} members imported, ${smartResult.skipped} skipped`
                : `${smartResult.imported} Mitglieder importiert, ${smartResult.skipped} übersprungen`}
            </div>
            {smartResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-green-700 cursor-pointer hover:text-green-800">
                  {lang === 'en'
                    ? `${smartResult.errors.length} row(s) had issues`
                    : `${smartResult.errors.length} Zeile(n) mit Problemen`}
                </summary>
                <ul className="mt-2 text-xs text-slate-700 space-y-0.5 max-h-32 overflow-y-auto">
                  {smartResult.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>
                      <span className="font-mono">Z.{e.row}:</span> {e.error}
                    </li>
                  ))}
                  {smartResult.errors.length > 50 && (
                    <li className="text-slate-400">
                      … {smartResult.errors.length - 50} {lang === 'en' ? 'more' : 'weitere'}
                    </li>
                  )}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* ── Legacy minimal-CSV import (keep for backwards compat) ───────── */}
      <div className="mb-3 text-xs uppercase tracking-wider text-slate-400 font-semibold">
        {lang === 'en' ? 'Or use the minimal 6-column format' : 'Oder das minimale 6-Spalten-Format'}
      </div>

      {/* Format hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 text-sm text-amber-800">
        <p className="font-semibold mb-1">{t('memberImport', 'formatHint')}</p>
        <code className="text-xs bg-amber-100 px-2 py-1 rounded font-mono">Vorname, Nachname, E-Mail, Telefon, Guertel, Beitrittsdatum</code>
        <p className="mt-2 text-amber-700">{t('memberImport', 'formatDesc')}</p>
      </div>

      {/* File upload */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-3">{t('memberImport', 'selectFile')}</label>
        <div
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-amber-300 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={24} className="text-slate-400 mx-auto mb-2" />
          <p className="text-slate-600 text-sm font-medium">{t('memberImport', 'clickToSelect')}</p>
          <p className="text-slate-400 text-xs mt-1">{t('memberImport', 'dragHere')}</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      </div>

      {/* Import result */}
      {importResult && (
        <div className="mb-6 p-4 rounded-2xl bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 text-green-800 font-semibold">
            <CheckCircle size={16} />
            {t('memberImport', 'importDone')}
          </div>
          <p className="text-green-700 text-sm mt-1">
            {importResult.failed > 0
              ? t('memberImport', 'importedFailed', { n: String(importResult.success), f: String(importResult.failed) })
              : t('memberImport', 'importedOnly', { n: String(importResult.success) })
            }
          </p>
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
              <p className="text-sm font-semibold text-slate-700">{t('memberImport', 'rowsFound', { n: String(rows.length) })}</p>
              {validCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
                  {t('memberImport', 'valid', { n: String(validCount) })}
                </span>
              )}
              {invalidCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
                  {t('memberImport', 'invalid', { n: String(invalidCount) })}
                </span>
              )}
            </div>
            {validCount > 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                {importing ? t('memberImport', 'importing') : t('memberImport', 'importBtn', { n: String(validCount) })}
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('memberImport', 'colName')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('memberImport', 'colEmail')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t('memberImport', 'colPhone')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('memberImport', 'colBelt')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">{t('memberImport', 'colJoinDate')}</th>
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
