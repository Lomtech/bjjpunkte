'use client'

import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { SectionHeader, sectionCls, sectionHeaderCls, saveBtnCls } from './SettingsUI'

export function ImportExportSection() {
  const { t, lang } = useLanguage()
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importStage, setImportStage] = useState('')
  const [importResult, setImportResult] = useState<string | null>(null)

  async function handleExport() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/gym/export', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const data = await res.json()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `osss-gym-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleImport() {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    setImportProgress(0)

    const STAGES = lang === 'en' ? [
      { pct: 5,  label: 'Checking file…' },
      { pct: 15, label: 'Gym settings…' },
      { pct: 30, label: 'Importing members…' },
      { pct: 50, label: 'Classes & bookings…' },
      { pct: 65, label: 'Attendance & belt promotions…' },
      { pct: 78, label: 'Uploading media & photos…' },
      { pct: 88, label: 'Plans & content…' },
      { pct: 93, label: 'Finishing up…' },
    ] : [
      { pct: 5,  label: 'Datei wird geprüft…' },
      { pct: 15, label: 'Gym-Einstellungen…' },
      { pct: 30, label: 'Mitglieder werden importiert…' },
      { pct: 50, label: 'Klassen & Buchungen…' },
      { pct: 65, label: 'Anwesenheit & Gürtelpromotionen…' },
      { pct: 78, label: 'Medien & Fotos werden hochgeladen…' },
      { pct: 88, label: 'Tarife & Inhalte…' },
      { pct: 93, label: 'Abschluss…' },
    ]
    let stageIdx = 0
    setImportStage(STAGES[0].label)
    setImportProgress(STAGES[0].pct)
    const ticker = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, STAGES.length - 1)
      setImportStage(STAGES[stageIdx].label)
      setImportProgress(STAGES[stageIdx].pct)
    }, 1800)

    try {
      const text = await importFile.text()
      const data = JSON.parse(text)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        clearInterval(ticker)
        setImportResult(lang === 'en' ? 'Not authorized' : 'Nicht autorisiert')
        setImporting(false)
        return
      }
      const res = await fetch('/api/gym/import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      clearInterval(ticker)
      setImportProgress(100)
      setImportStage(lang === 'en' ? 'Done!' : 'Fertig!')

      const result = await res.json()
      if (result.success) {
        const imp = result.imported
        const parts: string[] = []
        if (imp.members)         parts.push(`${imp.members} ${lang === 'en' ? 'members' : 'Mitglieder'}`)
        if (imp.classes)         parts.push(`${imp.classes} ${lang === 'en' ? 'classes' : 'Klassen'}`)
        if (imp.plans)           parts.push(`${imp.plans} ${lang === 'en' ? 'plans' : 'Tarife'}`)
        if (imp.attendance)      parts.push(`${imp.attendance} ${lang === 'en' ? 'check-ins' : 'Check-ins'}`)
        if (imp.belt_promotions) parts.push(`${imp.belt_promotions} ${lang === 'en' ? 'belt promotions' : 'Gürtelpromotionen'}`)
        if (imp.leads)           parts.push(`${imp.leads} ${lang === 'en' ? 'leads' : 'Interessenten'}`)
        if (imp.posts)           parts.push(`${imp.posts} ${lang === 'en' ? 'posts' : 'Posts'}`)
        const mediaCount = (imp.gallery_images ?? 0) + (imp.about_blocks ?? 0) +
          (imp.logo_uploaded ? 1 : 0) + (imp.hero_uploaded ? 1 : 0)
        if (mediaCount > 0)      parts.push(`${mediaCount} ${lang === 'en' ? 'media' : 'Medien'}`)
        setImportResult(`✓ ${lang === 'en' ? 'Import successful' : 'Import erfolgreich'}: ${parts.join(', ')}`)
        setImportFile(null)
      } else {
        setImportResult(`${lang === 'en' ? 'Error' : 'Fehler'}: ${result.error}`)
      }
    } catch {
      clearInterval(ticker)
      setImportResult(lang === 'en' ? 'Error: Invalid JSON file' : 'Fehler: Ungültige JSON-Datei')
    }
    setTimeout(() => { setImporting(false); setImportProgress(0); setImportStage('') }, 800)
  }

  return (
    <div className={sectionCls}>
      <div className={sectionHeaderCls}>
        <SectionHeader icon={<Download size={12} />} title={t('settings', 'exportImport')} />
      </div>
      <div className="p-5 space-y-5">
        <p className="text-xs text-zinc-500">
          {t('settings', 'exportImportDesc')}
        </p>
        <div>
          <p className="text-sm font-medium text-zinc-800 mb-2">{t('settings', 'exportSection')}</p>
          <button type="button" onClick={handleExport} className={saveBtnCls}>
            <Download size={14} /> {t('settings', 'exportBtn')}
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-800 mb-2">{t('settings', 'importSection')}</p>
          <p className="text-xs text-zinc-400 mb-3">{t('settings', 'importDesc')}</p>
          <label className={`flex items-center gap-2 cursor-pointer ${importing ? 'pointer-events-none opacity-50' : ''}`}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-sm font-medium transition-colors">
              <Upload size={14} />
              {importFile ? importFile.name : t('settings', 'selectJsonFile')}
            </div>
            <input type="file" accept=".json" className="hidden"
              onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null); setImportProgress(0) }} />
          </label>
          {importFile && !importing && (
            <button type="button" onClick={handleImport} className={`mt-2 ${saveBtnCls}`}>
              <Upload size={14} /> {t('settings', 'startImport')}
            </button>
          )}
          {importing && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{importStage}</span>
                <span className="tabular-nums font-semibold text-amber-600">{importProgress}%</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}
          {importResult && !importing && (
            <p className={`mt-2 text-xs rounded-lg px-3 py-2 ${importResult.startsWith('✓') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {importResult}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
