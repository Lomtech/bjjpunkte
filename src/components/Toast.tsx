'use client'

/**
 * Toast-System — ersetzt native alert()/prompt()/confirm() durch ein
 * eigenes UI-konsistentes Notification-System.
 *
 * Usage:
 *   const toast = useToast()
 *   toast.success('Gespeichert')
 *   toast.error('Fehler beim Speichern', { retry: () => save() })
 *   toast.info('Sync gestartet')
 *   toast.warning('Daten werden überschrieben')
 *
 * Provider-Setup: <ToastProvider> in src/app/layout.tsx, im body, vor children.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, XCircle, Info, X, RotateCcw } from 'lucide-react'

type ToastKind = 'success' | 'error' | 'info' | 'warning'

interface ToastOptions {
  /** Optional retry-Callback bei error-Toasts: zeigt Retry-Button */
  retry?: () => void
  /** Auto-dismiss in ms (default 5000). 0 = kein Auto-dismiss */
  duration?: number
}

interface ToastEntry {
  id: number
  kind: ToastKind
  message: string
  retry?: () => void
  duration: number
}

interface ToastApi {
  success: (message: string, options?: ToastOptions) => void
  error: (message: string, options?: ToastOptions) => void
  info: (message: string, options?: ToastOptions) => void
  warning: (message: string, options?: ToastOptions) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let nextId = 1

const KIND_STYLES: Record<
  ToastKind,
  { ring: string; icon: React.ReactNode; iconBg: string }
> = {
  success: {
    ring: 'ring-emerald-200 bg-white',
    iconBg: 'bg-emerald-50 text-emerald-600',
    icon: <CheckCircle2 size={18} strokeWidth={2.4} />,
  },
  error: {
    ring: 'ring-rose-200 bg-white',
    iconBg: 'bg-rose-50 text-rose-600',
    icon: <XCircle size={18} strokeWidth={2.4} />,
  },
  info: {
    ring: 'ring-sky-200 bg-white',
    iconBg: 'bg-sky-50 text-sky-600',
    icon: <Info size={18} strokeWidth={2.4} />,
  },
  warning: {
    ring: 'ring-amber-200 bg-white',
    iconBg: 'bg-amber-50 text-amber-600',
    icon: <AlertTriangle size={18} strokeWidth={2.4} />,
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string, options?: ToastOptions) => {
      const id = nextId++
      const duration = options?.duration ?? 5000
      const entry: ToastEntry = {
        id,
        kind,
        message,
        retry: options?.retry,
        duration,
      }
      setToasts((prev) => [...prev, entry])
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration)
        timersRef.current.set(id, timer)
      }
    },
    [dismiss],
  )

  // Cleanup pending timers on unmount
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      info: (m, o) => push('info', m, o),
      warning: (m, o) => push('warning', m, o),
      dismiss,
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastEntry[]
  onDismiss: (id: number) => void
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-stretch gap-2 p-3 sm:inset-auto sm:bottom-4 sm:right-4 sm:max-w-sm sm:items-end sm:p-0"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, y: 0, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={`pointer-events-auto w-full rounded-2xl shadow-lg ring-1 ${KIND_STYLES[t.kind].ring} sm:w-96`}
            role={t.kind === 'error' ? 'alert' : 'status'}
          >
            <div className="flex items-start gap-3 p-3.5">
              <div
                className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${KIND_STYLES[t.kind].iconBg}`}
              >
                {KIND_STYLES[t.kind].icon}
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <p className="whitespace-pre-line text-sm font-medium leading-snug text-zinc-900">
                  {t.message}
                </p>
                {t.retry && (
                  <button
                    type="button"
                    onClick={() => {
                      t.retry?.()
                      onDismiss(t.id)
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-zinc-700"
                  >
                    <RotateCcw size={12} strokeWidth={2.6} />
                    Erneut versuchen
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="flex-none rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Benachrichtigung schließen"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fallback: liefert No-Op + console.warn, damit ein verlorener Provider
    // niemals einen Crash verursacht. Sollte in Dev nie passieren.
    if (typeof window !== 'undefined') {
      console.warn('[Toast] useToast() called outside <ToastProvider> — fallback no-op active.')
    }
    return {
      success: (m) => console.log('[toast.success]', m),
      error: (m) => console.error('[toast.error]', m),
      info: (m) => console.log('[toast.info]', m),
      warning: (m) => console.warn('[toast.warning]', m),
      dismiss: () => {},
    }
  }
  return ctx
}
