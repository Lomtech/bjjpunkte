'use client'

/**
 * Tournament-Tracking-Block im Member-Detail (Owner-View).
 *
 * - Owner sieht Liste der Tournaments des Members (newest first)
 * - „+ Tournament hinzufügen" öffnet Modal mit Quick-Entry-Form
 * - Inline-Edit + Delete pro Eintrag
 * - public_visible-Toggle bestimmt ob Eintrag auf Public-Gym-Page erscheint
 *
 * Bearer-Token-Auth (gleicher Pattern wie /api/avv/* und /api/gym/update).
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Award, Plus, Trash2, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react'
import {
  TOURNAMENT_DISCIPLINES,
  TOURNAMENT_RESULTS,
  disciplineLabel,
  resultLabel,
  isPodium,
  type MemberTournament,
} from '@/lib/tournaments'

interface Props {
  memberId: string
  memberName: string
}

async function withBearer(): Promise<Record<string, string>> {
  const { data: { session } } = await createClient().auth.getSession()
  return { Authorization: `Bearer ${session?.access_token ?? ''}` }
}

export function TournamentsSection({ memberId, memberName }: Props) {
  const [items, setItems]     = useState<MemberTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const headers = await withBearer()
        const res = await fetch(`/api/members/${memberId}/tournaments`, {
          headers,
          cache: 'no-store',
        })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error ?? `HTTP ${res.status}`)
        } else {
          setItems(json.tournaments as MemberTournament[])
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lesefehler')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [memberId])

  async function addTournament(payload: Record<string, unknown>) {
    const headers = { 'Content-Type': 'application/json', ...(await withBearer()) }
    const res = await fetch(`/api/members/${memberId}/tournaments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
    setItems(prev => [json.tournament as MemberTournament, ...prev])
  }

  async function togglePublic(t: MemberTournament) {
    const headers = { 'Content-Type': 'application/json', ...(await withBearer()) }
    const res = await fetch(`/api/tournaments/${t.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ public_visible: !t.public_visible }),
    })
    if (res.ok) {
      const json = await res.json()
      setItems(prev => prev.map(x => x.id === t.id ? json.tournament : x))
    }
  }

  async function deleteTournament(t: MemberTournament) {
    if (!confirm(`„${t.name}" wirklich löschen?`)) return
    const headers = await withBearer()
    const res = await fetch(`/api/tournaments/${t.id}`, { method: 'DELETE', headers })
    if (res.ok) setItems(prev => prev.filter(x => x.id !== t.id))
  }

  const podiumCount = items.filter(t => isPodium(t.result)).length
  const totalMatches = items.reduce((acc, t) => acc + (t.matches_won ?? 0) + (t.matches_lost ?? 0), 0)

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Award size={16} className="text-amber-500" />
          <h2 className="font-bold text-zinc-900">Turnier-Historie</h2>
          {!loading && (
            <span className="text-xs text-zinc-500 tabular-nums">
              {items.length} {items.length === 1 ? 'Eintrag' : 'Einträge'}
              {podiumCount > 0 && <span className="ml-2 text-amber-600">· {podiumCount} 🏅</span>}
              {totalMatches > 0 && <span className="ml-2">· {totalMatches} Matches</span>}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-colors"
        >
          <Plus size={13} /> Eintrag
        </button>
      </header>

      <div className="px-5 py-4">
        {loading && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Loader2 size={14} className="animate-spin" /> Lade …
          </div>
        )}
        {error && (
          <p className="text-rose-600 text-sm">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="text-zinc-500 text-sm">
            Noch keine Turnier-Einträge. Klick auf „+ Eintrag" um den ersten Wettkampf von {memberName} zu tracken.
          </p>
        )}
        {!loading && items.length > 0 && (
          <ul className="divide-y divide-zinc-100">
            {items.map(t => (
              <li key={t.id} className="py-3 flex items-start gap-3">
                <div className="text-2xl flex-shrink-0 leading-none pt-0.5">
                  {t.result === 'gold' && '🥇'}
                  {t.result === 'silver' && '🥈'}
                  {t.result === 'bronze' && '🥉'}
                  {!isPodium(t.result) && <Award size={20} className="text-zinc-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-zinc-900 truncate">{t.name}</p>
                    <span className="text-xs text-zinc-500 tabular-nums">{new Date(t.event_date).toLocaleDateString('de-DE')}</span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {disciplineLabel(t.discipline)}
                    {t.weight_class && <> · {t.weight_class}</>}
                    {t.age_division && <> · {t.age_division}</>}
                    {t.belt_at_event && <> · {t.belt_at_event}</>}
                    <> · <strong className={isPodium(t.result) ? 'text-amber-700' : 'text-zinc-700'}>{resultLabel(t.result)}</strong></>
                    {(t.matches_won != null || t.matches_lost != null) && (
                      <> · {t.matches_won ?? 0}W/{t.matches_lost ?? 0}L</>
                    )}
                  </p>
                  {t.notes && <p className="text-xs text-zinc-500 mt-1 italic">„{t.notes}"</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {t.smoothcomp_url && (
                    <a
                      href={t.smoothcomp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 hover:text-amber-600"
                      title="Smoothcomp-Profil öffnen"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => togglePublic(t)}
                    className={`p-1.5 rounded-lg hover:bg-zinc-100 ${t.public_visible ? 'text-emerald-600' : 'text-zinc-400'}`}
                    title={t.public_visible ? 'Öffentlich sichtbar — klick um zu verbergen' : 'Privat — klick um auf Gym-Seite zu zeigen'}
                  >
                    {t.public_visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    onClick={() => deleteTournament(t)}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600"
                    title="Löschen"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAdd && (
        <AddTournamentModal
          memberName={memberName}
          onClose={() => setShowAdd(false)}
          onSave={async (payload) => {
            await addTournament(payload)
            setShowAdd(false)
          }}
        />
      )}
    </section>
  )
}

// ─── Add-Modal ─────────────────────────────────────────────────────────────

function AddTournamentModal({
  memberName, onClose, onSave,
}: {
  memberName: string
  onClose: () => void
  onSave: (payload: Record<string, unknown>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState('')
  const [discipline, setDiscipline] = useState<string>('bjj-gi')
  const [weightClass, setWeightClass] = useState('')
  const [ageDivision, setAgeDivision] = useState('Adult')
  const [beltAtEvent, setBeltAtEvent] = useState('')
  const [result, setResult] = useState<string>('participation')
  const [matchesWon, setMatchesWon] = useState('')
  const [matchesLost, setMatchesLost] = useState('')
  const [notes, setNotes] = useState('')
  const [smoothcompUrl, setSmoothcompUrl] = useState('')
  const [publicVisible, setPublicVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none'
  const labelCls = 'block text-xs font-semibold text-zinc-700 mb-1'

  async function submit() {
    if (!name.trim()) { setError('Name fehlt'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        event_date: eventDate,
        location: location.trim() || undefined,
        discipline,
        weight_class: weightClass.trim() || undefined,
        age_division: ageDivision.trim() || undefined,
        belt_at_event: beltAtEvent.trim() || undefined,
        result,
        matches_won:  matchesWon  ? parseInt(matchesWon,  10) : undefined,
        matches_lost: matchesLost ? parseInt(matchesLost, 10) : undefined,
        notes: notes.trim() || undefined,
        smoothcomp_url: smoothcompUrl.trim() || undefined,
        public_visible: publicVisible,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full my-8 shadow-xl">
        <header className="px-5 py-4 border-b border-zinc-100">
          <h2 className="font-bold text-zinc-900 text-lg">Turnier hinzufügen</h2>
          <p className="text-xs text-zinc-500 mt-0.5">für {memberName}</p>
        </header>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={labelCls}>Turnier-Name *</label>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="z.B. BJJ Munich Open 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Datum *</label>
              <input type="date" className={inputCls} value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Ort</label>
              <input className={inputCls} value={location} onChange={e => setLocation(e.target.value)} placeholder="München" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Disziplin *</label>
            <select className={inputCls} value={discipline} onChange={e => setDiscipline(e.target.value)}>
              {TOURNAMENT_DISCIPLINES.map(d => (<option key={d.value} value={d.value}>{d.label}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Altersklasse</label>
              <input className={inputCls} value={ageDivision} onChange={e => setAgeDivision(e.target.value)} placeholder="Adult" />
            </div>
            <div>
              <label className={labelCls}>Gewicht</label>
              <input className={inputCls} value={weightClass} onChange={e => setWeightClass(e.target.value)} placeholder="-77 kg" />
            </div>
            <div>
              <label className={labelCls}>Belt damals</label>
              <input className={inputCls} value={beltAtEvent} onChange={e => setBeltAtEvent(e.target.value)} placeholder="Blau" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Ergebnis *</label>
            <select className={inputCls} value={result} onChange={e => setResult(e.target.value)}>
              {TOURNAMENT_RESULTS.map(r => (<option key={r.value} value={r.value}>{r.label}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Siege (Matches)</label>
              <input type="number" min="0" className={inputCls} value={matchesWon} onChange={e => setMatchesWon(e.target.value)} placeholder="3" />
            </div>
            <div>
              <label className={labelCls}>Niederlagen</label>
              <input type="number" min="0" className={inputCls} value={matchesLost} onChange={e => setMatchesLost(e.target.value)} placeholder="1" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Smoothcomp-Profil (optional)</label>
            <input className={inputCls} value={smoothcompUrl} onChange={e => setSmoothcompUrl(e.target.value)} placeholder="https://smoothcomp.com/..." />
          </div>
          <div>
            <label className={labelCls}>Notizen</label>
            <textarea className={inputCls + ' min-h-[60px]'} value={notes} onChange={e => setNotes(e.target.value)} placeholder='z.B. „Bestes Match gegen X im Halbfinale"' />
          </div>
          <label className="flex items-start gap-2 text-sm text-zinc-700 cursor-pointer">
            <input type="checkbox" checked={publicVisible} onChange={e => setPublicVisible(e.target.checked)} className="mt-1" />
            <span>
              <strong>Öffentlich auf Gym-Seite anzeigen.</strong> Erscheint auf <code>osss.pro/gym/[dein-slug]</code> als Roll of Honor.
              <br /><span className="text-xs text-zinc-500">DSGVO-Hinweis: Nur Vorname + Ergebnis sichtbar, keine Nachnamen oder Geburtsdaten.</span>
            </span>
          </label>
          {error && <p className="text-rose-600 text-sm">{error}</p>}
        </div>
        <footer className="px-5 py-3 border-t border-zinc-100 flex justify-end gap-2 bg-zinc-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 rounded-lg" disabled={saving}>
            Abbrechen
          </button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-bold bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5">
            {saving && <Loader2 size={13} className="animate-spin" />} Speichern
          </button>
        </footer>
      </div>
    </div>
  )
}
