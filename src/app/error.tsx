'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-2xl font-black text-slate-900 mb-2">Etwas ist schiefgelaufen</p>
      <p className="text-slate-500 text-sm mb-8 max-w-sm">
        Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut oder kontaktiere den Support.
      </p>
      <button onClick={reset}
        className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 transition-colors">
        Erneut versuchen
      </button>
    </div>
  )
}
