'use client'

import { useState, useId } from 'react'
import { X, Repeat } from 'lucide-react'
import type { ClassType } from '@/types/database'
import { useLanguage } from '@/lib/i18n/LanguageContext'

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
  const { lang } = useLanguage()
  const titleId = useId()
  const idTitle = useId()
  const idDate = useId()
  const idStart = useId()
  const idEnd = useId()
  const idUntil = useId()
  const idInstructor = useId()
  const idCapacity = useId()
  const idDescription = useId()
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

  const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
    { value: 'none',    label: lang === 'en' ? 'Once' : 'Einmalig' },
    { value: 'daily',   label: lang === 'en' ? 'Daily' : 'Täglich' },
    { value: 'weekly',  label: lang === 'en' ? 'Weekly' : 'Wöchentlich' },
    { value: 'monthly', label: lang === 'en' ? 'Monthly' : 'Monatlich' },
  ]

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
    if (!res.ok) { setError(data.error ?? (lang === 'en' ? 'Error saving' : 'Fehler beim Speichern')); return }
    onCreated()
  }

  return (
    // TODO(a11y): Add focus trap (e.g. focus-trap-react / @headlessui/react Dialog) for full WCAG 2.1.2.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 id={titleId} className="font-semibold text-slate-900">{lang === 'en' ? 'Create new class' : 'Neue Klasse erstellen'}</h2>
          <button onClick={onClose} aria-label={lang === 'en' ? 'Close dialog' : 'Dialog schließen'} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Class type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'Class type' : 'Trainingstyp'}</label>
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
            <label htmlFor={idTitle} className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'Title' : 'Titel'}</label>
            <input id={idTitle} type="text" required value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>

          {/* Date */}
          <div>
            <label htmlFor={idDate} className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'Date (first occurrence)' : 'Datum (erster Termin)'}</label>
            <input id={idDate} type="date" required value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={idStart} className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'Start time' : 'Startzeit'}</label>
              <input id={idStart} type="time" required value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>
            <div>
              <label htmlFor={idEnd} className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'End time' : 'Endzeit'}</label>
              <input id={idEnd} type="time" required value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Repeat size={13} className="text-slate-400" />
              {lang === 'en' ? 'Recurrence' : 'Wiederholung'}
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
                <label htmlFor={idUntil} className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'Repeat until' : 'Wiederholen bis'}</label>
                <input id={idUntil} type="date" required value={until} onChange={e => setUntil(e.target.value)}
                  min={date}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                <p className="text-xs text-slate-400 mt-1">
                  {recurrence === 'weekly'  && (lang === 'en' ? 'Every week on the same weekday' : 'Jede Woche am gleichen Wochentag')}
                  {recurrence === 'daily'   && (lang === 'en' ? 'Every day at the same time' : 'Jeden Tag zur gleichen Zeit')}
                  {recurrence === 'monthly' && (lang === 'en' ? 'Every month on the same day' : 'Jeden Monat am gleichen Tag')}
                </p>
              </div>
            )}
          </div>

          {/* Instructor */}
          <div>
            <label htmlFor={idInstructor} className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'Instructor (optional)' : 'Trainer (optional)'}</label>
            <input id={idInstructor} type="text" value={instructor} onChange={e => setInstructor(e.target.value)}
              placeholder={lang === 'en' ? 'e.g. John Smith' : 'z. B. Max Mustermann'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>

          {/* Max capacity */}
          <div>
            <label htmlFor={idCapacity} className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'Max. participants (optional)' : 'Max. Teilnehmer (optional)'}</label>
            <input id={idCapacity} type="number" min="1" value={maxCapacity} onChange={e => setMaxCapacity(e.target.value)}
              placeholder={lang === 'en' ? 'Unlimited' : 'Unbegrenzt'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
          </div>

          {/* Description */}
          <div>
            <label htmlFor={idDescription} className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'Description (optional)' : 'Beschreibung (optional)'}</label>
            <textarea id={idDescription} rows={2} value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none" />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              {lang === 'en' ? 'Cancel' : 'Abbrechen'}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-60">
              {saving
                ? (lang === 'en' ? 'Creating…' : 'Wird erstellt…')
                : recurrence !== 'none'
                  ? (lang === 'en' ? 'Create series' : 'Serie erstellen')
                  : (lang === 'en' ? 'Create' : 'Erstellen')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
