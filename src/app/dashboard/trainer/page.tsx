'use client'

// Stub-Dashboard für Trainer-Rolle (Feature #7, Sprint 2026-05-27).
//
// Aktueller Stand: minimaler Smoke-Test der RLS-Differenzierung.
// Member-Tabelle holt aus /api/trainer/members (members_trainer_view) —
// keine sensiblen Spalten sichtbar.
//
// TODO (eigene UI-Sprints):
// - Kalender-Tab mit klasses + Anwesenheits-Buttons
// - Belt-Beförderung-UI mit Trainer-Sign-Off-Workflow
// - Trainer-Notes (eigene Schreibrechte ohne Owner-Sicht)

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type TrainerMember = {
  id: string
  gym_id: string
  first_name: string
  last_name: string
  belt: string
  stripes: number | null
  is_active: boolean
  join_date: string | null
  date_of_birth: string | null
  parent_first_name: string | null
  parent_phone: string | null
  notes: string | null
  punch_units_remaining: number | null
  punch_units_total: number | null
}

export default function TrainerDashboard() {
  const [members, setMembers] = useState<TrainerMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Bitte einloggen')
        setLoading(false)
        return
      }
      const res = await fetch('/api/trainer/members', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Fehler')
      } else {
        setMembers(json.members ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="p-6 text-zinc-400 text-sm">Lade…</div>
  if (error) return <div className="p-6 text-rose-600 text-sm">{error}</div>

  return (
    <div className="p-4 md:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-zinc-900">Trainer-Dashboard</h1>
        <p className="text-zinc-500 text-xs mt-1">
          {members.length} Mitglieder · Eingeschränkte Sicht (keine Adressen, keine Finanzdaten)
        </p>
      </header>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-900">
        <strong>Hinweis:</strong> Dieses Dashboard zeigt nur Sport-relevante Daten.
        Für Mitgliedschafts-, Vertrags- oder Zahlungsdaten wende dich an den Gym-Inhaber.
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Gurt</th>
              <th className="text-left px-4 py-3 font-medium">Stripes</th>
              <th className="text-left px-4 py-3 font-medium">Aktiv</th>
              <th className="text-left px-4 py-3 font-medium">Einheiten</th>
              <th className="text-left px-4 py-3 font-medium">Notiz</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {m.first_name} {m.last_name}
                  {m.parent_first_name && (
                    <span className="text-xs text-amber-700 ml-2">
                      · Erz: {m.parent_first_name}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{m.belt}</td>
                <td className="px-4 py-3">{m.stripes ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block w-2 h-2 rounded-full ${m.is_active ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {m.punch_units_remaining !== null
                    ? `${m.punch_units_remaining}/${m.punch_units_total ?? '?'}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs truncate">{m.notes ?? ''}</td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-400 text-sm">
                Keine Mitglieder sichtbar. Bist du als Trainer freigeschaltet?
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
