'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldAlert, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Cache the status for 5 minutes — don't hit the API on every dashboard load
let avvStatusCache: { ts: number; gymId: string; needsSignature: boolean } | null = null

const DISMISS_KEY = 'avv-banner-dismissed-until'

interface Props { gymId: string }

/**
 * Shown on the dashboard if the gym has not signed the current AVV version.
 * Dismissible for 7 days (localStorage). Resurfaces when signature is missing
 * after dismissal period.
 */
export function AVVBanner({ gymId }: Props) {
  const [needsSignature, setNeedsSignature] = useState<boolean>(false)
  const [hidden, setHidden] = useState<boolean>(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Check dismissal first
      try {
        const dismissedUntil = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10)
        if (dismissedUntil && Date.now() < dismissedUntil) return
      } catch { /* localStorage may be unavailable */ }

      // Cached?
      if (avvStatusCache && avvStatusCache.gymId === gymId && Date.now() - avvStatusCache.ts < 5 * 60_000) {
        if (!cancelled) {
          setNeedsSignature(avvStatusCache.needsSignature)
          setHidden(!avvStatusCache.needsSignature)
        }
        return
      }

      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const res = await fetch(`/api/avv/status?gym_id=${gymId}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const json = await res.json()
        const need = !json.signed
        avvStatusCache = { ts: Date.now(), gymId, needsSignature: need }
        if (!cancelled) {
          setNeedsSignature(need)
          setHidden(!need)
        }
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [gymId])

  function handleDismiss() {
    try {
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      localStorage.setItem(DISMISS_KEY, String(Date.now() + sevenDays))
    } catch { /* ignore */ }
    setHidden(true)
  }

  if (hidden || !needsSignature) return null

  return (
    <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
      <ShieldAlert className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900 text-sm">DSGVO: Auftragsverarbeitungsvertrag fehlt</p>
        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
          Pflicht nach Art. 28 DSGVO. Dauert 30 Sekunden — einmal lesen, akzeptieren, fertig.
        </p>
        <Link
          href="/dashboard/settings/avv"
          className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2"
        >
          Jetzt unterzeichnen →
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        title="Für 7 Tage ausblenden"
        className="flex-shrink-0 text-amber-500 hover:text-amber-700 p-1 rounded-lg transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  )
}
