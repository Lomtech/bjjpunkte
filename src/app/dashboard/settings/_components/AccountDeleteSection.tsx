'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'

type AccountDeleteSectionProps = {
  userAuthEmail: string
}

export function AccountDeleteSection({ userAuthEmail }: AccountDeleteSectionProps) {
  const { t, lang } = useLanguage()
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null)

  async function handleDeleteAccount() {
    setDeletingAccount(true)
    setDeleteAccountError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setDeleteAccountError(lang === 'en' ? 'Not logged in' : 'Nicht eingeloggt'); setDeletingAccount(false); return }
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (json.success) {
        await supabase.auth.signOut()
        window.location.href = '/'
      } else {
        setDeleteAccountError(json.error ?? (lang === 'en' ? 'Unknown error' : 'Unbekannter Fehler'))
        setDeletingAccount(false)
      }
    } catch {
      setDeleteAccountError(lang === 'en' ? 'Network error — please try again' : 'Netzwerkfehler — bitte erneut versuchen')
      setDeletingAccount(false)
    }
  }

  return (
    <div className="rounded-2xl border border-red-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
        <Trash2 size={12} className="text-red-500" />
        <span className="text-xs font-bold text-red-700 uppercase tracking-wider">{t('settings', 'deleteAccount')}</span>
      </div>
      <div className="p-5">
        <p className="text-sm text-zinc-600 mb-4">
          {t('settings', 'deleteAccountDesc')}
        </p>
        {!showDeleteAccount ? (
          <button
            type="button"
            onClick={() => setShowDeleteAccount(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> {t('settings', 'deleteAccount')}…
          </button>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {t('settings', 'deleteAccountConfirm')}<span className="font-mono">{userAuthEmail}</span>
            </div>
            <input
              type="email"
              value={deleteConfirmEmail}
              onChange={e => setDeleteConfirmEmail(e.target.value)}
              placeholder={userAuthEmail || 'deine@email.de'}
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-red-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all text-sm"
            />
            {deleteAccountError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteAccountError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowDeleteAccount(false); setDeleteConfirmEmail(''); setDeleteAccountError(null) }}
                className="px-4 py-2 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-semibold hover:bg-zinc-50 transition-colors"
              >
                {t('settings', 'cancelBtn')}
              </button>
              <button
                type="button"
                disabled={deleteConfirmEmail !== userAuthEmail || deletingAccount}
                onClick={handleDeleteAccount}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-bold transition-colors"
              >
                <Trash2 size={14} />
                {deletingAccount ? t('settings', 'deleting') : t('settings', 'deleteForever')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
