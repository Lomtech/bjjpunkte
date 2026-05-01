'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_CLASS_TYPES: { value: string; label: string }[] = [
  { value: 'gi', label: 'Gi' },
  { value: 'no-gi', label: 'No-Gi' },
  { value: 'open mat', label: 'Open Mat' },
  { value: 'kids', label: 'Kids' },
  { value: 'competition', label: 'Competition' },
]

interface Member { id: string; first_name: string; last_name: string }

export function CheckInForm({ gymId, members, checkedInIds, classTypes = DEFAULT_CLASS_TYPES, onCheckedIn }: {
  gymId: string; members: Member[]; checkedInIds: string[]; classTypes?: { value: string; label: string }[]; onCheckedIn?: () => void
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [classType, setClassType] = useState<string>(classTypes[0]?.value ?? 'gi')
  const [loading, setLoading] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set(checkedInIds))

  const filtered = members.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  async function checkIn(memberId: string) {
    setLoading(memberId)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('attendance') as any).insert({ member_id: memberId, gym_id: gymId, class_type: classType })
    setChecked(prev => new Set([...prev, memberId]))
    setLoading(null)
    if (onCheckedIn) onCheckedIn()
    else router.refresh()
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Klasse</label>
        <div className="flex flex-wrap gap-1.5">
          {classTypes.map(ct => (
            <button
              key={ct.value}
              onClick={() => setClassType(ct.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                classType === ct.value
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Mitglied suchen..."
        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-sm"
      />

      <div className="space-y-0.5 max-h-80 overflow-auto">
        {filtered.map(m => {
          const isIn = checked.has(m.id)
          return (
            <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isIn ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-600'
                }`}>
                  {m.first_name[0]}{m.last_name[0]}
                </div>
                <span className={`text-sm font-medium ${isIn ? 'text-green-700' : 'text-slate-800'}`}>
                  {m.first_name} {m.last_name}
                </span>
              </div>
              <button
                onClick={() => !isIn && checkIn(m.id)}
                disabled={isIn || loading === m.id}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  isIn
                    ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                    : 'bg-amber-500 hover:bg-amber-400 text-white shadow-sm'
                }`}
              >
                {loading === m.id ? '...' : isIn ? '✓ Eingecheckt' : 'Einchecken'}
              </button>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-slate-400 text-sm py-4 text-center">Keine Mitglieder gefunden.</p>
        )}
      </div>
    </div>
  )
}
