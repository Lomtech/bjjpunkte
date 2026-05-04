'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  memberId: string
  isActive: boolean
  onToggled?: (newActive: boolean) => void
}

export function ToggleActiveButton({ memberId, isActive, onToggled }: Props) {
  const { t } = useLanguage()
  const [loading, setLoading]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [current, setCurrent]         = useState(isActive)
  const [feedback, setFeedback]       = useState(false)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)

  // Enter = confirm, Escape = cancel
  useEffect(() => {
    if (!showConfirm) return
    confirmBtnRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter')  { e.preventDefault(); toggle() }
      if (e.key === 'Escape') { e.preventDefault(); setShowConfirm(false) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showConfirm])

  async function toggle() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('members')
      .update({ is_active: !current })
      .eq('id', memberId)

    if (!error) {
      const next = !current
      setCurrent(next)
      onToggled?.(next)
      setFeedback(true)
      setTimeout(() => setFeedback(false), 2500)
    }
    setLoading(false)
    setShowConfirm(false)
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
          feedback
            ? 'bg-green-50 border-green-200 text-green-700'
            : current
            ? 'bg-white border-zinc-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-zinc-700'
            : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
        }`}
      >
        {feedback
          ? (current ? t('promotion', 'feedbackActive') : t('promotion', 'feedbackInactive'))
          : loading ? '…'
          : current ? t('promotion', 'deactivateBtn') : t('promotion', 'activateBtn')}
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false) }}
        >
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl ${
              current ? 'bg-red-50' : 'bg-green-50'
            }`}>
              {current ? '⏸' : '▶'}
            </div>
            <h3 className="font-bold text-zinc-900 text-lg mb-2 text-center">
              {current ? t('promotion', 'toggleDeactivateTitle') : t('promotion', 'toggleActivateTitle')}
            </h3>
            <p className="text-zinc-500 text-sm mb-6 text-center leading-relaxed">
              {current
                ? t('promotion', 'deactivateDesc')
                : t('promotion', 'activateDesc')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-medium transition-colors"
              >
                {t('promotion', 'cancel')}
              </button>
              <button
                ref={confirmBtnRef}
                onClick={toggle}
                disabled={loading}
                className={`flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  current ? 'bg-red-500 hover:bg-red-400 focus:ring-red-400' : 'bg-green-500 hover:bg-green-400 focus:ring-green-400'
                }`}
              >
                {loading ? t('promotion', 'toggleSaving') : current ? t('promotion', 'deactivateBtn') : t('promotion', 'activateBtn')}
              </button>
            </div>
            <p className="text-[10px] text-zinc-300 text-center mt-2">Enter ↵ zum Bestätigen · Esc zum Abbrechen</p>
          </div>
        </div>
      )}
    </>
  )
}
