'use client'

/**
 * ConfirmModal — drei APIs in einer Datei:
 *
 *   1. Klassisches Props-API (legacy, weiterhin verwendet in
 *      dashboard/leads, dashboard/settings, dashboard/content,
 *      dashboard/members/[id], dashboard/members/[id]/BillingSection):
 *
 *        <ConfirmModal open={...} title="..." onConfirm={...} onCancel={...} />
 *
 *   2. Hook + Provider (neu, ersetzt native confirm()):
 *
 *        const confirm = useConfirm()
 *        if (await confirm({ title: '…', variant: 'danger' })) { … }
 *
 *      Provider wird einmal in src/app/layout.tsx eingehängt.
 *
 *   3. Sync-Hilfe (für Pop-up-Blocker-Szenarien):
 *
 *        const result = await confirm(...) — der Promise-Resolve passiert im
 *        Click-Handler des Confirm-Buttons (synchron mit dem User-Gesture),
 *        sodass danach ausgeführte window.open()-Calls vom Browser nicht
 *        blockiert werden, solange sie ohne await im selben Microtask folgen.
 *        WICHTIG: Nach `await confirm(...)` keinen weiteren `await` einfügen,
 *        bevor du window.open() aufrufst.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

// ─── Legacy Props-API ────────────────────────────────────────────────────────

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby={description ? 'confirm-modal-desc' : undefined}
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-150">
        {icon && (
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-2xl mb-1">
            {icon}
          </div>
        )}
        <h2 id="confirm-modal-title" className="text-lg font-bold text-zinc-900 leading-snug">{title}</h2>
        {description && (
          <p id="confirm-modal-desc" className="text-sm text-zinc-500 leading-relaxed">{description}</p>
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

// ─── Hook + Provider API ─────────────────────────────────────────────────────

export type ConfirmVariant = 'danger' | 'primary'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  /**
   * Optional Icon (React-Node). Wenn nicht gesetzt, zeigt 'danger' standardmäßig
   * ein AlertTriangle-Icon.
   */
  icon?: React.ReactNode
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  // Speichert das vor dem Öffnen aktive Element, um den Fokus
  // beim Schließen zurückzugeben (a11y).
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve })
    })
  }, [])

  const close = useCallback(
    (result: boolean) => {
      // resolve ist synchron — direkt im Click-Event-Loop, damit nach
      // `await confirm(...)` ein folgendes window.open() nicht vom
      // Pop-up-Blocker getötet wird.
      pending?.resolve(result)
      setPending(null)
    },
    [pending],
  )

  // Fokus-Management: Confirm-Button fokussieren beim Öffnen,
  // Fokus zurückgeben beim Schließen.
  useEffect(() => {
    if (pending) {
      previousFocusRef.current = (document.activeElement as HTMLElement) ?? null
      // setTimeout 0 = nach dem Mount, vor dem nächsten Paint
      const handle = setTimeout(() => confirmBtnRef.current?.focus(), 0)
      return () => clearTimeout(handle)
    } else if (previousFocusRef.current) {
      const el = previousFocusRef.current
      previousFocusRef.current = null
      // Nach dem Unmount fokussieren
      requestAnimationFrame(() => el.focus?.())
    }
  }, [pending])

  // Tastatur-Handling: Enter = Confirm, Escape = Cancel,
  // Tab/Shift+Tab = Focus-Trap zwischen den beiden Buttons.
  useEffect(() => {
    if (!pending) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(false)
        return
      }
      if (e.key === 'Enter') {
        // Nur abfangen wenn das Ziel kein Input/Textarea ist (irrelevant
        // hier, weil ConfirmModal kein Input enthält — defensive Guard).
        const tag = (e.target as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault()
          close(true)
        }
        return
      }
      if (e.key === 'Tab') {
        // Focus-Trap: zwischen Cancel und Confirm zyklen.
        const active = document.activeElement
        const cancel = cancelBtnRef.current
        const confirmBtn = confirmBtnRef.current
        if (!cancel || !confirmBtn) return
        if (e.shiftKey) {
          if (active === cancel) {
            e.preventDefault()
            confirmBtn.focus()
          }
        } else {
          if (active === confirmBtn) {
            e.preventDefault()
            cancel.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending, close])

  // Body-Scroll-Lock während Modal offen
  useEffect(() => {
    if (!pending) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [pending])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            key="confirm-modal"
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => close(false)}
              aria-hidden="true"
            />
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-hook-title"
              aria-describedby={pending.description ? 'confirm-hook-desc' : undefined}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.1 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-7 flex flex-col items-center text-center gap-4"
            >
              {(pending.icon || pending.variant === 'danger') && (
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  pending.variant === 'danger'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-zinc-100 text-zinc-700'
                }`}>
                  {pending.icon ?? <AlertTriangle size={26} strokeWidth={2.2} />}
                </div>
              )}
              <h2
                id="confirm-hook-title"
                className="text-lg font-bold text-zinc-900 leading-snug"
              >
                {pending.title}
              </h2>
              {pending.description && (
                <p
                  id="confirm-hook-desc"
                  className="text-sm text-zinc-500 leading-relaxed whitespace-pre-line"
                >
                  {pending.description}
                </p>
              )}
              <div className="flex gap-3 w-full mt-1">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={() => close(false)}
                  className="flex-1 py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-300"
                >
                  {pending.cancelLabel ?? 'Abbrechen'}
                </button>
                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={() => close(true)}
                  className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    pending.variant === 'danger'
                      ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400'
                      : 'bg-zinc-900 hover:bg-zinc-700 text-white focus:ring-zinc-500'
                  }`}
                >
                  {pending.confirmLabel ?? 'Bestätigen'}
                </button>
              </div>
              <p className="text-[10px] text-zinc-300">
                Enter ↵ Bestätigen · Esc Abbrechen
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}

/**
 * useConfirm — gibt eine Funktion zurück, die ein Modal öffnet und ein
 * Promise<boolean> zurückgibt (true = bestätigt, false = abgebrochen).
 *
 *   const confirm = useConfirm()
 *   if (await confirm({ title: 'Wirklich löschen?', variant: 'danger' })) {
 *     await deleteItem()
 *   }
 *
 * Außerhalb des Providers liefert der Hook einen Fallback, der `window.confirm`
 * benutzt — kein Crash. Sollte aber in Dev nie passieren.
 */
const memoNoopConfirm: ConfirmFn = (options) => {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (typeof window.confirm === 'function') {
    return Promise.resolve(window.confirm(options.title))
  }
  return Promise.resolve(false)
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    if (typeof window !== 'undefined') {
      console.warn('[Confirm] useConfirm() called outside <ConfirmProvider> — fallback to window.confirm.')
    }
    return memoNoopConfirm
  }
  return ctx
}

