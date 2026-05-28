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
  const [debitor, setDebitor] = useState('10000')
  const [basisRate, setBasisRate] = useState('2.27')
  const [surcharge, setSurcharge] = useState('5.00')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setBeraternummer(initialBeraternummer ?? '')
    setMandantennummer(initialMandantennummer ?? '')
    // Lade Debitor + Verzugszinsen direkt
    ;(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('gyms') as any)
        .select('datev_debitor_account, dunning_interest_basisrate_pct, dunning_interest_surcharge_pct')
        .eq('owner_id', user.id).maybeSingle()
      if (data) {
        setDebitor(data.datev_debitor_account ?? '10000')
        setBasisRate(String(data.dunning_interest_basisrate_pct ?? '2.27'))
        setSurcharge(String(data.dunning_interest_surcharge_pct ?? '5.00'))
      }
    })()
  }, [initialBeraternummer, initialMandantennummer])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const basis = parseFloat(basisRate.replace(',', '.'))
    const sur = parseFloat(surcharge.replace(',', '.'))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('gyms') as any).update({
      datev_beraternummer: beraternummer || null,
      datev_mandantennummer: mandantennummer || null,
      datev_debitor_account: debitor.trim() || '10000',
      dunning_interest_basisrate_pct: isFinite(basis) ? basis : 2.27,
      dunning_interest_surcharge_pct: isFinite(sur) ? sur : 5.00,
    }).eq('owner_id', user.id)
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
              placeholder="z. B. 1234567" className={inputCls} maxLength={7} />
            <p className="text-xs text-zinc-400 mt-1">{t('settings', 'advisorNumberDesc')}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('settings', 'clientNumber')}</label>
            <input value={mandantennummer} onChange={e => setMandantennummer(e.target.value)}
              placeholder="z. B. 1001" className={inputCls} maxLength={5} />
            <p className="text-xs text-zinc-400 mt-1">{t('settings', 'clientNumberDesc')}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1.5">Debitorenkonto</label>
            <input value={debitor} onChange={e => setDebitor(e.target.value)}
              placeholder="10000" className={inputCls} maxLength={8} />
            <p className="text-xs text-zinc-400 mt-1">SKR03 Standard 10000. Steuerberater kann eigenes setzen.</p>
          </div>
          <div />
        </div>

        <div className="border-t border-zinc-100 pt-4 mt-2">
          <h4 className="text-sm font-semibold text-zinc-900 mb-2">Verzugszinsen-Sätze (§§ 247, 288 BGB)</h4>
          <p className="text-xs text-zinc-500 mb-3">
            Für PDF-Berechnung im Inkasso-Übergabe-Dossier. Basiszinssatz wird halbjährlich von der Bundesbank festgelegt (1.1. und 1.7.).
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Basiszinssatz (%)</label>
              <input value={basisRate} onChange={e => setBasisRate(e.target.value)}
                placeholder="2.27" className={inputCls} />
              <p className="text-xs text-zinc-400 mt-1">Stand 2025-07: 2,27 %</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Aufschlag (%)</label>
              <input value={surcharge} onChange={e => setSurcharge(e.target.value)}
                placeholder="5.00" className={inputCls} />
              <p className="text-xs text-zinc-400 mt-1">5 % Verbraucher / 9 % B2B</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1.5">Effektiv (errechnet)</label>
              <div className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-sm font-mono text-zinc-700">
                {(() => {
                  const b = parseFloat(basisRate.replace(',', '.'))
                  const s = parseFloat(surcharge.replace(',', '.'))
                  return isFinite(b) && isFinite(s) ? `${(b + s).toFixed(2)} %` : '—'
                })()}
              </div>
            </div>
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
