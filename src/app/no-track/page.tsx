'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Public Opt-Out-Page für Geräte/Browser auf denen kein Login möglich ist.
 *
 * Setzt:
 *  - Cookie `osss-internal=1` (1 Jahr) — server-side check im Track-Endpoint
 *  - localStorage `osss-no-track` (Fallback wenn Cookies blockiert)
 *
 * Nutzbar auf jedem Gerät — einfach einmal /no-track aufrufen.
 *
 * Use-Case: Owner hat 5 Geräte (Laptop, Desktop, iPhone, iPad, Privat-Phone) und
 * will alle vom Tracking ausschließen ohne sich überall einloggen zu müssen.
 */
export default function NoTrackPage() {
  const [done, setDone] = useState<'opt_out' | 'opt_in' | null>(null)
  const [hasCookie, setHasCookie] = useState(false)

  useEffect(() => {
    try {
      const ck = /(?:^|;\s*)osss-internal=1/.test(document.cookie ?? '')
      setHasCookie(ck)
    } catch { /* ignore */ }
  }, [])

  function optOut() {
    try {
      document.cookie = 'osss-internal=1; max-age=31536000; path=/; samesite=lax'
      localStorage.setItem('osss-no-track', '1')
      setDone('opt_out')
      setHasCookie(true)
    } catch { /* ignore */ }
  }

  function optIn() {
    try {
      document.cookie = 'osss-internal=; max-age=0; path=/; samesite=lax'
      localStorage.removeItem('osss-no-track')
      setDone('opt_in')
      setHasCookie(false)
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm max-w-md w-full p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <span className="text-xl">👤</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-500">Owner-Tools</p>
            <h1 className="font-black text-zinc-950 text-lg">Tracking auf diesem Gerät</h1>
          </div>
        </div>

        <div className={`rounded-xl border p-4 mb-5 ${hasCookie ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <p className="font-bold text-sm">
            Status: {hasCookie ? (
              <span className="text-emerald-700">Tracking ist DEAKTIVIERT ✓</span>
            ) : (
              <span className="text-rose-700">Tracking ist AKTIV — du wirst gezählt!</span>
            )}
          </p>
          <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">
            {hasCookie
              ? 'Deine Visits dieses Browsers/Gerätes erscheinen NICHT in der Statistik unter /admin/analytics.'
              : 'Klicke unten, um dich auszuschließen. Setzt einen langlebigen Cookie (1 Jahr) auf diesem Browser.'}
          </p>
        </div>

        {done === 'opt_out' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-sm text-emerald-800">
            ✓ Cookie gesetzt. Du wirst auf diesem Browser nicht mehr getrackt.
          </div>
        )}
        {done === 'opt_in' && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 mb-4 text-sm text-zinc-700">
            Cookie entfernt. Deine Visits zählen wieder zur Statistik.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {!hasCookie ? (
            <button
              onClick={optOut}
              className="flex-1 py-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-bold text-sm transition-colors"
            >
              🚫 Mich auf diesem Gerät NICHT tracken
            </button>
          ) : (
            <button
              onClick={optIn}
              className="flex-1 py-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-semibold text-sm transition-colors"
            >
              🔁 Tracking wieder aktivieren
            </button>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-100">
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            <strong>Wann brauche ich das?</strong><br/>
            Wenn du dein eigenes Studio testest und deine eigenen Visits nicht in der Statistik haben willst.
            Funktioniert pro Browser/Gerät — auf einem neuen Gerät einfach erneut hier vorbeischauen.
          </p>
          <p className="text-[11px] text-zinc-400 mt-2">
            DSGVO-Hinweis: Cookie ist <strong>technisch notwendig</strong> für den Opt-Out (TTDSG § 25 Abs. 2 Nr. 2 — User-explizit gewünschte Funktion). Kein Tracking-Cookie.
          </p>
          <Link href="/admin/analytics" className="inline-block mt-3 text-xs text-amber-600 hover:underline font-semibold">
            → Zur Analytics-Übersicht
          </Link>
        </div>
      </div>
    </div>
  )
}
