'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, UserPlus, AlertCircle } from 'lucide-react'

export type Audience = 'members' | 'leads' | 'both'
export type Filter = 'active' | 'all' | 'recent'

export interface MailDispatch {
  enabled: boolean
  audience: Audience
  filter: Filter
}

interface RecipientPreview {
  audience: Audience
  filter: Filter
  member_count: number
  lead_count: number
  total: number
  gym_name: string
}

/**
 * Empfänger-Box für Mail-Versand bei Beitrag/Ankündigung.
 * Wird im PostEditor + AnnouncementForm verwendet.
 *
 * Liefert via onChange({ enabled, audience, filter }) den aktuellen Zustand.
 * Beim Save kann der Caller die Werte abrufen und parallel an /gym-mail/send
 * schicken — falls enabled=true.
 */
export function MailRecipientsBox({
  value,
  onChange,
}: {
  value: MailDispatch
  onChange: (next: MailDispatch) => void
}) {
  const [preview, setPreview] = useState<RecipientPreview | null>(null)

  useEffect(() => {
    if (!value.enabled) { setPreview(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch(
          `/api/gym-mail/recipients?audience=${value.audience}&filter=${value.filter}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        )
        if (!res.ok) return
        const data = await res.json() as RecipientPreview
        if (!cancelled) setPreview(data)
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [value.enabled, value.audience, value.filter])

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3">
      {/* Master toggle */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={e => onChange({ ...value, enabled: e.target.checked })}
          className="mt-0.5 w-4 h-4 rounded accent-amber-500 flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-900">Auch per E-Mail versenden</p>
          <p className="text-xs text-zinc-500 leading-snug mt-0.5">
            Schicke diesen Inhalt zusätzlich als Mail an ausgewählte Empfänger. DSGVO-konform mit
            1-Klick-Unsubscribe pro Empfänger.
          </p>
        </div>
      </label>

      {value.enabled && (
        <div className="pl-7 space-y-3">
          {/* Audience picker — analog Communication-Page */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Empfänger</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...value, audience: 'members' })}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-xs font-semibold transition-colors ${
                  value.audience === 'members' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}
              >
                <Users size={12} /> Mitglieder
                {value.audience === 'members' && preview && <span className="text-[10px] font-mono">({preview.member_count})</span>}
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, audience: 'leads' })}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-xs font-semibold transition-colors ${
                  value.audience === 'leads' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}
              >
                <UserPlus size={12} /> Leads
                {value.audience === 'leads' && preview && <span className="text-[10px] font-mono">({preview.lead_count})</span>}
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...value, audience: 'both' })}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-xs font-semibold transition-colors ${
                  value.audience === 'both' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'
                }`}
              >
                Beide
                {value.audience === 'both' && preview && <span className="text-[10px] font-mono">({preview.total})</span>}
              </button>
            </div>
          </div>

          {/* Filter */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Filter</p>
            <div className="flex flex-wrap gap-3 text-xs">
              {value.audience !== 'leads' && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={value.filter === 'active'}
                    onChange={() => onChange({ ...value, filter: 'active' })}
                    className="accent-amber-500" />
                  <span className="text-zinc-700">Nur aktive Mitglieder</span>
                </label>
              )}
              {value.audience !== 'leads' && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={value.filter === 'all'}
                    onChange={() => onChange({ ...value, filter: 'all' })}
                    className="accent-amber-500" />
                  <span className="text-zinc-700">Alle (auch inaktive)</span>
                </label>
              )}
              {value.audience !== 'members' && (
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={value.filter === 'recent'}
                    onChange={() => onChange({ ...value, filter: 'recent' })}
                    className="accent-amber-500" />
                  <span className="text-zinc-700">Leads: letzte 6 Monate</span>
                </label>
              )}
            </div>
          </div>

          {/* Preview-Counter + DSGVO-Hint */}
          <div className="flex items-start gap-2 text-[11px] text-zinc-500 leading-relaxed bg-zinc-50 rounded-lg px-3 py-2">
            <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
            <span>
              {preview
                ? <>Wird an <strong className="text-zinc-700">{preview.total} Empfänger</strong> gesendet (
                    {preview.member_count} Mitglieder + {preview.lead_count} Leads mit Marketing-Consent
                  ).</>
                : <>Empfänger werden geladen…</>}
              <br />
              Variable <code className="bg-white px-1 rounded">{'{{first_name}}'}</code> wird pro Empfänger ersetzt.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
