'use client'

import { useState, useEffect } from 'react'
import { FileText, ExternalLink, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { sectionCls, sectionHeaderCls, inputCls, saveBtnCls } from './SettingsUI'

type LegalSectionProps = {
  initialLegalName: string | null | undefined
  initialLegalAddress: string | null | undefined
  initialLegalEmail: string | null | undefined
  onLegalNameChange?: (name: string) => void
}

export function LegalSection({
  initialLegalName,
  initialLegalAddress,
  initialLegalEmail,
  onLegalNameChange,
}: LegalSectionProps) {
  const { t } = useLanguage()
  const [legalName, setLegalName] = useState('')
  const [legalAddress, setLegalAddress] = useState('')
  const [legalEmail, setLegalEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLegalName(initialLegalName ?? '')
    setLegalAddress(initialLegalAddress ?? '')
    setLegalEmail(initialLegalEmail ?? '')
  }, [initialLegalName, initialLegalAddress, initialLegalEmail])

  // Notify parent when legalName changes (used by Produktiv-Checkliste).
  useEffect(() => {
    onLegalNameChange?.(legalName)
  }, [legalName, onLegalNameChange])

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('gyms').update({
      legal_name: legalName || null,
      legal_address: legalAddress || null,
      legal_email: legalEmail || null,
    }).eq('owner_id', user?.id ?? '')
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={sectionCls}>
      <div className={`${sectionHeaderCls} flex items-center justify-between`}>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <FileText size={12} /> {t('settings', 'privacyImprint')}
        </p>
        <a href="/datenschutz" target="_blank" rel="noopener noreferrer"
          className="text-xs text-amber-600 hover:text-amber-500 flex items-center gap-1">
          {t('settings', 'preview')} <ExternalLink size={11} />
        </a>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-xs text-zinc-500">{t('settings', 'privacyDesc')}</p>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('settings', 'nameFirm')}</label>
          <input value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Max Mustermann / BJJ Gym GmbH" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('settings', 'address')}</label>
          <input value={legalAddress} onChange={e => setLegalAddress(e.target.value)} placeholder="Musterstraße 1, 80331 München" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1.5">{t('settings', 'emailPrivacy')}</label>
          <input type="email" value={legalEmail} onChange={e => setLegalEmail(e.target.value)} placeholder="datenschutz@gym.de" className={inputCls} />
        </div>
        <button type="button" onClick={handleSave} disabled={saving} className={saveBtnCls}>
          <Save size={14} />
          {saved ? t('settings', 'saved') : saving ? t('settings', 'saving') : t('settings', 'savePrivacy')}
        </button>
      </div>
    </div>
  )
}
