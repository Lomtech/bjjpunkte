'use client'

import { useEffect, useRef } from 'react'

interface ConfirmModalProps {
  open: boolean
  icon?: React.ReactNode
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  icon,
  title,
  description,
  confirmLabel = 'OK',
  cancelLabel = 'Abbrechen',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Focus confirm button & handle keyboard
  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') { e.preventDefault(); onConfirm() }
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-150">
        {icon && (
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-2xl mb-1">
            {icon}
          </div>
        )}
        <h2 className="text-lg font-bold text-zinc-900 leading-snug">{title}</h2>
        {description && (
          <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
        )}
        <div className="flex gap-3 w-full mt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-sm transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              danger
                ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400'
                : 'bg-zinc-900 hover:bg-zinc-700 text-white focus:ring-zinc-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
        <p className="text-[10px] text-zinc-300">Enter ↵ zum Bestätigen · Esc zum Abbrechen</p>
      </div>
    </div>
  )
}
