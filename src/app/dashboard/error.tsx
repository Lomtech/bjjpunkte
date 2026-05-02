'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-lg font-bold text-slate-900 mb-2">Fehler beim Laden</p>
      <p className="text-slate-500 text-sm mb-6 max-w-xs">
        Diese Seite konnte nicht geladen werden. Bitte erneut versuchen.
      </p>
      <div className="flex gap-3">
        <button onClick={reset}
          className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors">
          Erneut versuchen
        </button>
        <Link href="/dashboard"
          className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
          Dashboard
        </Link>
      </div>
    </div>
  )
}
