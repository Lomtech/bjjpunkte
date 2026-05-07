'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 hover:text-amber-600 transition-colors"
      aria-label="Als PDF drucken / speichern"
    >
      <Printer size={15} /> <span className="hidden sm:inline">PDF / Drucken</span>
    </button>
  )
}
