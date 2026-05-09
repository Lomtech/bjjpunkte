'use client'

/**
 * PromptModal — UI-konsistenter Ersatz für native window.prompt().
 *
 * Hook + Provider:
 *
 *   const prompt = usePrompt()
 *   const date = await prompt({
 *     title: 'Demo-Datum',
 *     type: 'date',
 *     placeholder: 'YYYY-MM-DD',
 *   })
 *   // date === string | null  (null = abgebrochen oder leer)
 *
 *   const reason = await prompt({
 *     title: 'Lost-Grund',
 *     type: 'textarea',
 *     label: 'Warum wurde der Lead verloren?',
 *   })
 *
 *   const name = await prompt({
 *     title: 'Neuer Eintrag',
 *     type: 'text',
 *     defaultValue: 'Vorlage',
 *     validate: (v) => v.length < 3 ? 'Mindestens 3 Zeichen' : null,
 *   })
 *
 * Provider wird einmal in src/app/layout.tsx eingehängt.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export type PromptInputType = 'text' | 'date' | 'textarea' | 'datetime-local' | 'number'

export interface PromptOptions {
  title: string
  description?: string
  /** Optional zusätzliches Label für das Input-Feld (über dem Input). */
  label?: string
  /** Eingabe-Typ. Default: 'text'. */
  type?: PromptInputType
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  /**
   * Validation-Funktion. Rückgabe:
   *   - null  → gültig
   *   - string → Fehlermeldung (Confirm bleibt deaktiviert / zeigt Fehler).
   */
  validate?: (value: string) => string | null
  /**
   * Required: leerer String wird abgelehnt. Default: false (leer = null zurück).
   */
  required?: boolean
  /** Minimalattribute für Number/Date-Inputs, optional durchgeschleust. */
  min?: string | number
  max?: string | number
  step?: string | number
}

type PromptFn = (options: PromptOptions) => Promise<string | null>

const PromptContext = createContext<PromptFn | null>(null)

interface PendingPrompt extends PromptOptions {
  resolve: (value: string | null) => void
}

export function PromptProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingPrompt | null>(null)
  const [value, setValue] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descId = useId()
  const labelId = useId()
  const errorId = useId()

  const prompt = useCallback<PromptFn>((options) => {
    return new Promise<string | null>((resolve) => {
      setValue(options.defaultValue ?? '')
      setError(null)
      setPending({ ...options, resolve })
    })
  }, [])

  const close = useCallback(
    (result: string | null) => {
      pending?.resolve(result)
      setPending(null)
      setValue('')
      setError(null)
    },
    [pending],
  )

  const submit = useCallback(() => {
    if (!pending) return
    const trimmed = value
    if (pending.required && trimmed.trim() === '') {
      setError('Bitte etwas eingeben')
      return
    }
    if (pending.validate) {
      const msg = pending.validate(trimmed)
      if (msg) {
        setError(msg)
        return
      }
    }
    // Leere optionale Eingaben → null (näher an window.prompt-Semantik
    // bei "OK" mit leerem Feld? Nein: window.prompt liefert "" zurück.
    // Wir liefern hier '' wenn nicht required, damit Konsumenten selbst
    // entscheiden können). → wir liefern den getrimmten Wert wie er ist.
    close(trimmed)
  }, [pending, value, close])

  // Fokus-Management
  useEffect(() => {
    if (pending) {
      previousFocusRef.current = (document.activeElement as HTMLElement) ?? null
      const handle = setTimeout(() => {
        inputRef.current?.focus()
        // Text auswählen damit User direkt überschreiben kann
        if (inputRef.current && 'select' in inputRef.current) {
          try {
            inputRef.current.select()
          } catch { /* ignore */ }
        }
      }, 0)
      return () => clearTimeout(handle)
    } else if (previousFocusRef.current) {
      const el = previousFocusRef.current
      previousFocusRef.current = null
      requestAnimationFrame(() => el.focus?.())
    }
  }, [pending])

  // Tastatur-Handling: Enter (außerhalb textarea) = Submit, Escape = Cancel,
  // Tab/Shift+Tab = Focus-Trap.
  useEffect(() => {
    if (!pending) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(null)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName
        // Bei Textarea soll Enter eine neue Zeile erzeugen — nicht abfangen.
        // Cmd/Ctrl+Enter könnte als Submit dienen, aber wir lassen das raus
        // → User klickt explizit auf "Bestätigen".
        if (pending?.type === 'textarea' && tag === 'TEXTAREA') return
        e.preventDefault()
        submit()
        return
      }
      if (e.key === 'Tab') {
        // Reihenfolge: Input → Cancel → Confirm → (zurück zu Input)
        const active = document.activeElement
        const input = inputRef.current
        const cancel = cancelBtnRef.current
        const confirmBtn = confirmBtnRef.current
        if (!input || !cancel || !confirmBtn) return
        const order: HTMLElement[] = [input, cancel, confirmBtn]
        const idx = order.findIndex((el) => el === active)
        if (idx === -1) return
        const next = e.shiftKey
          ? order[(idx - 1 + order.length) % order.length]
          : order[(idx + 1) % order.length]
        e.preventDefault()
        next.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [pending, submit, close])

  // Body-Scroll-Lock
  useEffect(() => {
    if (!pending) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [pending])

  // Bei Wertänderung Fehler zurücksetzen (sonst hängt der erste Fehler ewig).
  useEffect(() => {
    if (error) setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const inputType = pending?.type ?? 'text'
  const isTextarea = inputType === 'textarea'
  const htmlInputType =
    inputType === 'textarea' ? 'text' :
    inputType === 'datetime-local' ? 'datetime-local' :
    inputType === 'date' ? 'date' :
    inputType === 'number' ? 'number' :
    'text'

  return (
    <PromptContext.Provider value={prompt}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            key="prompt-modal"
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => close(null)}
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={pending.description ? descId : undefined}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.1 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-7 flex flex-col gap-4"
            >
              <div className="space-y-1.5">
                <h2 id={titleId} className="text-lg font-bold text-zinc-900 leading-snug">
                  {pending.title}
                </h2>
                {pending.description && (
                  <p id={descId} className="text-sm text-zinc-500 leading-relaxed whitespace-pre-line">
                    {pending.description}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                {pending.label && (
                  <label
                    id={labelId}
                    htmlFor={`${titleId}-input`}
                    className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider"
                  >
                    {pending.label}
                  </label>
                )}
                {isTextarea ? (
                  <textarea
                    id={`${titleId}-input`}
                    ref={(el) => { inputRef.current = el }}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={pending.placeholder}
                    rows={4}
                    aria-labelledby={pending.label ? labelId : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className={`w-full px-3.5 py-2.5 text-base sm:text-sm border rounded-xl bg-white resize-y leading-relaxed focus:outline-none focus:ring-2 transition-colors ${
                      error
                        ? 'border-red-300 focus:ring-red-300 focus:border-red-400'
                        : 'border-zinc-200 focus:ring-zinc-300 focus:border-zinc-400'
                    }`}
                  />
                ) : (
                  <input
                    id={`${titleId}-input`}
                    ref={(el) => { inputRef.current = el }}
                    type={htmlInputType}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={pending.placeholder}
                    min={pending.min}
                    max={pending.max}
                    step={pending.step}
                    aria-labelledby={pending.label ? labelId : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className={`w-full px-3.5 py-2.5 text-base sm:text-sm border rounded-xl bg-white focus:outline-none focus:ring-2 transition-colors ${
                      error
                        ? 'border-red-300 focus:ring-red-300 focus:border-red-400'
                        : 'border-zinc-200 focus:ring-zinc-300 focus:border-zinc-400'
                    }`}
                  />
                )}
                {error && (
                  <p id={errorId} className="text-xs text-red-600 mt-1" role="alert">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex gap-3 w-full mt-1">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={() => close(null)}
                  className="flex-1 py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-300"
                >
                  {pending.cancelLabel ?? 'Abbrechen'}
                </button>
                <button
                  ref={confirmBtnRef}
                  type="button"
                  onClick={submit}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm bg-zinc-900 hover:bg-zinc-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500"
                >
                  {pending.confirmLabel ?? 'Bestätigen'}
                </button>
              </div>
              <p className="text-[10px] text-zinc-300 text-center">
                {isTextarea
                  ? 'Esc Abbrechen'
                  : 'Enter ↵ Bestätigen · Esc Abbrechen'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PromptContext.Provider>
  )
}

const noopPrompt: PromptFn = (options) => {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (typeof window.prompt === 'function') {
    return Promise.resolve(window.prompt(options.title, options.defaultValue ?? ''))
  }
  return Promise.resolve(null)
}

export function usePrompt(): PromptFn {
  const ctx = useContext(PromptContext)
  if (!ctx) {
    if (typeof window !== 'undefined') {
      console.warn('[Prompt] usePrompt() called outside <PromptProvider> — fallback to window.prompt.')
    }
    return noopPrompt
  }
  return ctx
}
