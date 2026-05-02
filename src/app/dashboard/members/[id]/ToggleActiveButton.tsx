'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  memberId: string
  isActive: boolean
  onToggled?: (newActive: boolean) => void
}

export function ToggleActiveButton({ memberId, isActive, onToggled }: Props) {
  const [loading, setLoading]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [current, setCurrent]         = useState(isActive)
  const [feedback, setFeedback]       = useState(false)

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
        {feedback ? `✓ ${current ? 'Aktiv' : 'Inaktiv'}` : loading ? '…' : current ? 'Deaktivieren' : 'Aktivieren'}
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
              {current ? 'Mitglied deaktivieren?' : 'Mitglied aktivieren?'}
            </h3>
            <p className="text-zinc-500 text-sm mb-6 text-center leading-relaxed">
              {current
                ? 'Das Mitglied wird als inaktiv markiert und taucht nicht mehr in der aktiven Liste auf.'
                : 'Das Mitglied wird reaktiviert und erscheint wieder in der aktiven Mitgliederliste.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-medium transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={toggle}
                disabled={loading}
                className={`flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-50 ${
                  current ? 'bg-red-500 hover:bg-red-400' : 'bg-green-500 hover:bg-green-400'
                }`}
              >
                {loading ? 'Speichert…' : current ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
