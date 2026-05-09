'use client'

import { useState, useEffect } from 'react'
import { FileSpreadsheet, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { SectionHeader, sectionCls, sectionHeaderCls, inputCls, saveBtnCls } from './SettingsUI'

type DatevSectionProps = {
  initialBeraternummer: string | null | undefined
  initialMandantennummer: string | null | undefined
}

export function DatevSection({ initialBeraternummer, initialMandantennummer }: DatevSectionProps) {
  const { t } = useLanguage()
  const [beraternummer, setBeraternummer] = useState('')
  const [mandantennummer, setMandantennummer] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setBeraternummer(initialBeraternummer ?? '')
    setMandantennummer(initialMandantennummer ?? '')
  }, [initialBeraternummer, initialMandantennummer])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('gyms').update({
      datev_beraternummer: beraternummer || null,
      datev_mandantennummer: mandantennummer || null,
    }).eq('owner_id', user?.id ?? '')
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={sectionCls}>
      <div className={sectionHeaderCls}>
        <SectionHeader icon={<FileSpreadsheet size={12} />} title={t('settings', 'datevExport')} />
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-zinc-500">
          {t('settings', 'datevDesc')}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('settings', 'advisorNumber')}</label>
            <input value={beraternummer} onChange={e => setBeraternummer(e.target.value)}
              placeholder="z. B. 12345" className={inputCls} maxLength={7} />
            <p className="text-xs text-zinc-400 mt-1">{t('settings', 'advisorNumberDesc')}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('settings', 'clientNumber')}</label>
            <input value={mandantennummer} onChange={e => setMandantennummer(e.target.value)}
              placeholder="z. B. 1001" className={inputCls} maxLength={5} />
            <p className="text-xs text-zinc-400 mt-1">{t('settings', 'clientNumberDesc')}</p>
          </div>
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className={saveBtnCls}>
          <Save size={14} />
          {saved ? t('settings', 'saved') : saving ? t('settings', 'saving') : t('settings', 'saveDatev')}
        </button>
      </div>
    </div>
  )
}
