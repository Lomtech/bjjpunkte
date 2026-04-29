'use client'

import { useState } from 'react'
import { X, Repeat } from 'lucide-react'
import type { ClassType } from '@/types/database'

const CLASS_TYPES: { value: ClassType; label: string }[] = [
  { value: 'gi', label: 'Gi' },
  { value: 'no-gi', label: 'No-Gi' },
  { value: 'open mat', label: 'Open Mat' },
  { value: 'kids', label: 'Kids' },
  { value: 'competition', label: 'Competition' },
]

const DEFAULT_TITLES: Record<ClassType, string> = {
  gi: 'Gi Training',
  'no-gi': 'No-Gi Training',
  'open mat': 'Open Mat',
  kids: 'Kids Training',
  competition: 'Competition Training',
}

type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly'

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'none',    label: 'Einmalig' },
  { value: 'daily',   label: 'Täglich' },
  { value: 'weekly',  label: 'Wöchentlich' },
  { value: 'monthly', label: 'Monatlich' },
]

// Default recurrence_until: 3 months from today
function defaultUntil() {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return d.toISOString().split('T')[0]
}

interface Props {
  defaultDate: string
  onClose: () => void
  onCreated: () => void
  accessToken: string
}

export function NewClassModal({ defaultDate, onClose, onCreated, accessToken }: Props) {
  const [classType, setClassType]       = useState<ClassType>('gi')
  const [title, setTitle]               = useState(DEFAULT_TITLES['gi'])
  const [date, setDate]                 = useState(defaultDate)
  const [startTime, setStartTime]       = useState('18:00')
  const [endTime, setEndTime]           = useState('19:30')
  const [instructor, setInstructor]     = useState('')
  const [maxCapacity, setMaxCapacity]   = useState('')
  const [description, setDescription]   = useState('')
  const [recurrence, setRecurrence]     = useState<RecurrenceType>('none')
  const [until, setUntil]               = useState(defaultUntil())
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  function handleTypeChange(t: ClassType) {
    setClassType(t)
    setTitle(DEFAULT_TITLES[t])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        title,
        class_type: classType,
        description: description || null,
        instructor: instructor || null,
        date,
        start_time: startTime,
        end_time: endTime,
        max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
        recurrence_type: recurrence,
        recurrence_until: recurrence !== 'none' ? until : null,
      }),
    })

    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Fehler beim Speichern'); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Neue Klasse erstellen</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Class type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Trainingstyp</label>
            <div className="flex flex-wrap gap-2">
              {CLASS_TYPES.map(ct => (
                <button key={ct.value} type="button" onClick={() => handleTypeChange(ct.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    classType === ct.value
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                  }`}>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Titel</label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Datum (erster Termin)</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Startzeit</label>
              <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Endzeit</label>
              <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Repeat size={13} className="text-slate-400" />
              Wiederholung
            </label>
            <div className="flex gap-2 flex-wrap">
              {RECURRENCE_OPTIONS.map(r => (
                <button key={r.value} type="button" onClick={() => setRecurrence(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    recurrence === r.value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>

            {recurrence !== 'none' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Wiederholen bis</label>
                <input type="date" required value={until} onChange={e => setUntil(e.target.value)}
                  min={date}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                <p className="text-xs text-slate-400 mt-1">
                  {recurrence === 'weekly'  && 'Jede Woche am gleichen Wochentag'}
                  {recurrence === 'daily'   && 'Jeden Tag zur gleichen Zeit'}
                  {recurrence === 'monthly' && 'Jeden Monat am gleichen Tag'}
                </p>
              </div>
            )}
          </div>

          {/* Instructor */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Trainer (optional)</label>
            <input type="text" value={instructor} onChange={e => setInstructor(e.target.value)}
              placeholder="z. B. Max Mustermann"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>

          {/* Max capacity */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Max. Teilnehmer (optional)</label>
            <input type="number" min="1" value={maxCapacity} onChange={e => setMaxCapacity(e.target.value)}
              placeholder="Unbegrenzt"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Beschreibung (optional)</label>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-60">
              {saving ? 'Wird erstellt…' : recurrence !== 'none' ? 'Serie erstellen' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
