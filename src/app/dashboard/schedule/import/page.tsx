'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { Upload, Download, CheckCircle, AlertTriangle, ChevronLeft, Loader2, X } from 'lucide-react'
import Link from 'next/link'

// ── CSV format ────────────────────────────────────────────────────────────────
// tag,start,end,titel,typ,trainer,kapazitaet
//   tag:        Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag
//   start/end:  HH:MM (24h)
//   titel:      Kursname
//   typ:        Kurstyp (gi | no-gi | open mat | kids | competition | beliebiger Text)
//   trainer:    optional
//   kapazitaet: optional Zahl

const SAMPLE_CSV = `tag,start,end,titel,typ,trainer,kapazitaet
Montag,10:00,11:00,Muay Thai (Wellpass),muay-thai,,
Montag,11:00,12:00,Fitness (Wellpass),fitness,,
Montag,10:00,12:00,Freies Training,open mat,,
Montag,17:00,18:00,Kickboxen/K1 (ab 10 J.),kids,,
Montag,18:00,19:30,Muay Thai,muay-thai,,
Montag,19:30,20:30,Kickboxen,kickboxen,,
Montag,20:45,21:45,Pad-Work & Sparring,muay-thai,,
Dienstag,17:00,18:00,NoGi Grappling (BJJ) & MMA (Wellpass),no-gi,,
Dienstag,18:15,19:15,Kickboxen (Wellpass),kickboxen,,
Dienstag,19:30,20:30,Aerokickboxing (Wellpass),kickboxen,,
Dienstag,20:45,21:45,Boxen,kickboxen,,
Mittwoch,16:00,16:45,Bewegungstraining & Ballschule (3-5 J.),kids,,
Mittwoch,17:00,18:00,Kickboxen (ab 6 J.),kids,,
Mittwoch,18:15,19:15,Kickboxen,kickboxen,,
Mittwoch,19:30,20:30,Sparring,muay-thai,,
Mittwoch,20:45,21:45,Fitness Workout MAF (Wellpass),fitness,,
Donnerstag,16:00,17:00,BJJ Kinder- und Jugendtraining (ab 8 J.),kids,,
Donnerstag,17:00,18:00,No-Gi BJJ (Wellpass),no-gi,,
Donnerstag,18:15,19:15,Brazilian Jiu-Jitsu im Gi (Wellpass),gi,,
Donnerstag,19:30,20:30,Muay Thai (14-20 J.),muay-thai,,
Donnerstag,20:45,21:45,Muay Thai (ab 21 J.),muay-thai,,
Freitag,16:30,17:30,Muay Thai (ab 8 J.),kids,,
Freitag,17:30,18:30,Muay Thai (14-20 J.),muay-thai,,
Freitag,19:00,20:15,Yoga (Wellpass),yoga,,
Samstag,09:45,11:15,NoGi Grappling & MMA Wettkampf (Wellpass),no-gi,,
Samstag,11:30,12:30,Kinder- und Jugendtraining (ab 6 J.),kids,,
Samstag,12:30,13:30,Kickboxen/K1 (14-20 J.),kickboxen,,
Samstag,13:30,14:30,Muay Thai,muay-thai,,
Samstag,14:30,15:30,Kickboxen (Wellpass),kickboxen,,
Samstag,14:30,16:30,Freies Training,open mat,,
Sonntag,10:00,12:00,HEMA Schwertkampf,open mat,,
Sonntag,12:00,13:00,No-Gi BJJ (Wellpass),no-gi,,
Sonntag,13:00,14:00,Brazilian Jiu-Jitsu im Gi (Wellpass),gi,,`

const DAY_MAP: Record<string, number> = {
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4,
  freitag: 5, samstag: 6, sonntag: 0,
}

interface ParsedRow {
  line: number
  day: number        // JS weekday 0=So
  dayLabel: string
  start: string      // HH:MM
  end: string        // HH:MM
  title: string
  classType: string
  instructor: string
  capacity: number | null
  error?: string
}

function parseCSV(
  raw: string,
  dayLabels: Record<number, string>,
  err: { unknownDay: (tag: string) => string; invalidTime: string; noTitle: string },
): ParsedRow[] {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean)
  const rows: ParsedRow[] = []

  // Skip header line if present
  const start = lines[0]?.toLowerCase().startsWith('tag') ? 1 : 0

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const [tagRaw, startT, endT, title, typ, trainer, kap] = cols
    const lineNum = i + 1

    const dayKey = (tagRaw ?? '').toLowerCase()
    if (!(dayKey in DAY_MAP)) {
      rows.push({ line: lineNum, day: -1, dayLabel: tagRaw ?? '?', start: '', end: '', title: title ?? '', classType: '', instructor: '', capacity: null, error: err.unknownDay(tagRaw ?? '?') })
      continue
    }

    if (!startT?.match(/^\d{1,2}:\d{2}$/) || !endT?.match(/^\d{1,2}:\d{2}$/)) {
      rows.push({ line: lineNum, day: DAY_MAP[dayKey], dayLabel: dayLabels[DAY_MAP[dayKey]], start: startT ?? '', end: endT ?? '', title: title ?? '', classType: '', instructor: '', capacity: null, error: err.invalidTime })
      continue
    }

    if (!title) {
      rows.push({ line: lineNum, day: DAY_MAP[dayKey], dayLabel: dayLabels[DAY_MAP[dayKey]], start: startT, end: endT, title: '', classType: '', instructor: '', capacity: null, error: err.noTitle })
      continue
    }

    const cap = kap ? parseInt(kap) : null
    rows.push({
      line: lineNum,
      day: DAY_MAP[dayKey],
      dayLabel: dayLabels[DAY_MAP[dayKey]],
      start: startT.padStart(5, '0'),
      end:   endT.padStart(5, '0'),
      title: title.trim(),
      classType: (typ ?? 'gi').trim() || 'gi',
      instructor: (trainer ?? '').trim(),
      capacity: cap && !isNaN(cap) ? cap : null,
    })
  }

  return rows
}

/** Next occurrence of a weekday (0=Sun…6=Sat) on or after `from` */
function nextWeekday(from: Date, targetDay: number): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const diff = (targetDay - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return d
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

type ImportStatus = 'idle' | 'running' | 'done' | 'error'

export default function ScheduleImportPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const { lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'

  const DAY_LABELS: Record<number, string> = lang === 'en'
    ? { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 0: 'Sunday' }
    : { 1: 'Montag', 2: 'Dienstag', 3: 'Mittwoch', 4: 'Donnerstag', 5: 'Freitag', 6: 'Samstag', 0: 'Sonntag' }

  const parseErrors = lang === 'en'
    ? { unknownDay: (tag: string) => `Unknown day: "${tag}"`, invalidTime: 'Invalid time (format: HH:MM)', noTitle: 'No title given' }
    : { unknownDay: (tag: string) => `Unbekannter Tag: "${tag}"`, invalidTime: 'Ungültige Uhrzeit (Format: HH:MM)', noTitle: 'Kein Titel angegeben' }

  const [csvText, setCsvText]       = useState('')
  const [parsed, setParsed]         = useState<ParsedRow[] | null>(null)
  const [fromDate, setFromDate]     = useState<string>(() => {
    // Default: next Monday
    const d = new Date(); d.setHours(0,0,0,0)
    const diff = (1 - d.getDay() + 7) % 7 || 7
    d.setDate(d.getDate() + diff)
    return toDateStr(d)
  })
  const [untilDate, setUntilDate]   = useState<string>(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1)
    return toDateStr(d)
  })

  const [status, setStatus]         = useState<ImportStatus>('idle')
  const [progress, setProgress]     = useState<{ done: number; total: number; errors: string[] }>({ done: 0, total: 0, errors: [] })

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      setCsvText(text)
      setParsed(parseCSV(text, DAY_LABELS, parseErrors))
    }
    reader.readAsText(file, 'utf-8')
  }

  function handlePaste(text: string) {
    setCsvText(text)
    if (text.trim()) setParsed(parseCSV(text, DAY_LABELS, parseErrors))
    else setParsed(null)
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = 'kursplan-vorlage.csv'
    a.click(); URL.revokeObjectURL(url)
  }

  const validRows   = (parsed ?? []).filter(r => !r.error)
  const invalidRows = (parsed ?? []).filter(r => r.error)

  async function runImport() {
    if (!validRows.length) return
    setStatus('running')
    setProgress({ done: 0, total: validRows.length, errors: [] })

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''

    const from  = new Date(fromDate)
    const errors: string[] = []

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]
      const firstDate = nextWeekday(from, row.day)
      const body = {
        title:            row.title,
        class_type:       row.classType,
        instructor:       row.instructor || null,
        date:             toDateStr(firstDate),
        start_time:       row.start,
        end_time:         row.end,
        max_capacity:     row.capacity,
        recurrence_type:  'weekly',
        recurrence_until: untilDate,
      }

      try {
        const res = await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          errors.push(`${row.dayLabel} ${row.start} ${row.title}: ${json.error ?? res.statusText}`)
        }
      } catch (e) {
        errors.push(`${row.dayLabel} ${row.start} ${row.title}: ${lang === 'en' ? 'Network error' : 'Netzwerkfehler'}`)
      }

      setProgress({ done: i + 1, total: validRows.length, errors: [...errors] })
    }

    setStatus(errors.length === validRows.length ? 'error' : 'done')
  }

  const grouped = parsed
    ? [1, 2, 3, 4, 5, 6, 0].reduce<Record<number, ParsedRow[]>>((acc, d) => {
        acc[d] = parsed.filter(r => r.day === d)
        return acc
      }, {} as Record<number, ParsedRow[]>)
    : null

  return (
    <div className="p-4 md:p-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/schedule"
          className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-zinc-950 tracking-tight">{lang === 'en' ? 'Import Schedule' : 'Kursplan importieren'}</h1>
          <p className="text-zinc-400 text-xs mt-0.5">{lang === 'en' ? 'Upload or paste CSV → Check preview → Import' : 'CSV hochladen oder einfügen → Vorschau prüfen → Importieren'}</p>
        </div>
      </div>

      {/* Step 1: Upload / Paste */}
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-zinc-800">{lang === 'en' ? '1. CSV File' : '1. CSV-Datei'}</p>
          <button onClick={downloadSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 text-xs font-medium transition-colors">
            <Download size={13} /> {lang === 'en' ? 'Download template' : 'Vorlage herunterladen'}
          </button>
        </div>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-zinc-200 rounded-xl p-6 text-center mb-4 hover:border-amber-300 hover:bg-amber-50/30 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        >
          <Upload size={20} className="text-zinc-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-500 font-medium">{lang === 'en' ? 'Drop CSV file here or click' : 'CSV-Datei hier ablegen oder klicken'}</p>
          <p className="text-xs text-zinc-400 mt-1">{lang === 'en' ? 'UTF-8, comma-separated' : 'UTF-8, Komma-getrennt'}</p>
          <label htmlFor="schedule-import-file" className="sr-only">{lang === 'en' ? 'CSV file' : 'CSV-Datei'}</label>
          <input id="schedule-import-file" ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>

        {/* Or paste */}
        <p className="text-xs text-zinc-400 text-center mb-3">{lang === 'en' ? '— or paste directly —' : '— oder direkt einfügen —'}</p>
        <label htmlFor="schedule-import-paste" className="sr-only">{lang === 'en' ? 'Paste CSV content' : 'CSV-Inhalt einfügen'}</label>
        <textarea
          id="schedule-import-paste"
          value={csvText}
          onChange={e => handlePaste(e.target.value)}
          placeholder={'tag,start,end,titel,typ,trainer,kapazitaet\nMontag,18:00,19:30,Muay Thai,no-gi,,\n…'}
          rows={5}
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-800 font-mono placeholder-zinc-300 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-y"
        />

        {/* Format hint */}
        <div className="mt-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-xs text-zinc-500 space-y-1">
          <p className="font-semibold text-zinc-600">{lang === 'en' ? 'Column format:' : 'Spaltenformat:'}</p>
          <p><code className="bg-zinc-100 px-1 rounded">tag</code> — Montag · Dienstag · Mittwoch · Donnerstag · Freitag · Samstag · Sonntag</p>
          <p><code className="bg-zinc-100 px-1 rounded">start / end</code> — {lang === 'en' ? 'Time in format' : 'Uhrzeit im Format'} <code className="bg-zinc-100 px-1 rounded">HH:MM</code> (24h)</p>
          <p><code className="bg-zinc-100 px-1 rounded">typ</code> — {lang === 'en' ? 'e.g.' : 'z.B.'} gi · no-gi · open mat · kids · competition ({lang === 'en' ? 'or custom text' : 'oder eigener Text'})</p>
          <p><code className="bg-zinc-100 px-1 rounded">trainer / kapazitaet</code> — {lang === 'en' ? 'optional, leave blank if not needed' : 'optional, leer lassen falls nicht benötigt'}</p>
        </div>
      </div>

      {/* Step 2: Date range */}
      {parsed && parsed.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 mb-4">
          <p className="text-sm font-semibold text-zinc-800 mb-4">{lang === 'en' ? '2. Recurrence date range' : '2. Zeitraum für die Wiederholung'}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="schedule-import-from" className="text-xs font-medium text-zinc-500 block mb-1.5">{lang === 'en' ? 'First week from' : 'Erste Woche ab'}</label>
              <input id="schedule-import-from" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
              <p className="text-[11px] text-zinc-400 mt-1">{lang === 'en' ? 'First class = next matching weekday from this date' : 'Erste Stunde = nächster passender Wochentag ab diesem Datum'}</p>
            </div>
            <div>
              <label htmlFor="schedule-import-until" className="text-xs font-medium text-zinc-500 block mb-1.5">{lang === 'en' ? 'Repeat until' : 'Wiederholen bis'}</label>
              <input id="schedule-import-until" type="date" value={untilDate} onChange={e => setUntilDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
              <p className="text-[11px] text-zinc-400 mt-1">{lang === 'en' ? 'Each class is created as a weekly recurring series' : 'Jede Stunde wird als wöchentliche Serie angelegt'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {grouped && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden mb-4">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-800">{lang === 'en' ? '3. Preview' : '3. Vorschau'}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-green-600 font-semibold">{validRows.length} {lang === 'en' ? 'valid' : 'gültig'}</span>
              {invalidRows.length > 0 && (
                <span className="text-xs text-red-500 font-semibold">{invalidRows.length} {lang === 'en' ? 'errors' : 'Fehler'}</span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {[1, 2, 3, 4, 5, 6, 0].map(day => {
              const rows = grouped[day] ?? []
              if (!rows.length) return null
              return (
                <div key={day}>
                  <div className="px-5 py-2 bg-zinc-50 border-b border-zinc-100">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{DAY_LABELS[day]}</span>
                  </div>
                  {rows.map(row => (
                    <div key={row.line} className={`flex items-center gap-4 px-5 py-3 border-b border-zinc-50 last:border-0 ${row.error ? 'bg-red-50' : ''}`}>
                      <span className="text-xs tabular-nums text-zinc-400 w-24 flex-shrink-0 font-mono">{row.start} – {row.end}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-900 truncate">{row.title || <span className="text-zinc-300 italic">{lang === 'en' ? 'no title' : 'kein Titel'}</span>}</span>
                          {row.error && (
                            <span className="text-xs text-red-500 flex items-center gap-1 flex-shrink-0">
                              <AlertTriangle size={11} /> {row.error}
                            </span>
                          )}
                        </div>
                        {!row.error && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium">{row.classType}</span>
                            {row.instructor && <span className="text-xs text-zinc-400">{row.instructor}</span>}
                            {row.capacity && <span className="text-xs text-zinc-400">Max. {row.capacity}</span>}
                          </div>
                        )}
                      </div>
                      {!row.error && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Step 4: Import button */}
      {validRows.length > 0 && status === 'idle' && (
        <button
          onClick={runImport}
          disabled={!fromDate || !untilDate}
          className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold text-sm transition-colors shadow-sm"
        >
          {lang === 'en'
            ? `Import ${validRows.length} classes (weekly, until ${new Date(untilDate).toLocaleDateString(locale)})`
            : `${validRows.length} Kurse importieren (wöchentlich, bis ${new Date(untilDate).toLocaleDateString(locale)})`}
        </button>
      )}

      {/* Progress */}
      {status === 'running' && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6 text-center">
          <Loader2 size={24} className="text-amber-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-zinc-800">{progress.done} / {progress.total} {lang === 'en' ? 'imported…' : 'importiert…'}</p>
          <div className="mt-3 h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Done */}
      {status === 'done' && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle size={20} className="text-green-500" />
            </span>
            <div>
              <p className="font-bold text-zinc-900 text-sm">
                {lang === 'en'
                  ? `${progress.done - progress.errors.length} of ${progress.total} successfully imported`
                  : `${progress.done - progress.errors.length} von ${progress.total} erfolgreich importiert`}
              </p>
              {progress.errors.length > 0 && (
                <p className="text-xs text-red-500 mt-0.5">{progress.errors.length} {lang === 'en' ? 'errors' : 'Fehler'}</p>
              )}
            </div>
          </div>
          {progress.errors.length > 0 && (
            <div className="bg-red-50 rounded-xl p-3 mb-4 space-y-1">
              {progress.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}
          <button
            onClick={() => router.push('/dashboard/schedule')}
            className="w-full py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-semibold text-sm transition-colors"
          >
            {lang === 'en' ? 'Go to schedule →' : 'Zum Stundenplan →'}
          </button>
        </div>
      )}

      {/* Error (all failed) */}
      {status === 'error' && (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-3">
            <X size={20} className="text-red-500" />
            <p className="font-bold text-zinc-900 text-sm">{lang === 'en' ? 'Import failed' : 'Import fehlgeschlagen'}</p>
          </div>
          <div className="space-y-1 mb-4">
            {progress.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
          </div>
          <button onClick={() => setStatus('idle')}
            className="text-sm text-zinc-500 hover:text-zinc-800 underline">
            {lang === 'en' ? 'Try again' : 'Erneut versuchen'}
          </button>
        </div>
      )}
    </div>
  )
}
