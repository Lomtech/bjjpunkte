'use client'

import { useState, useId } from 'react'
import { X } from 'lucide-react'
import type { ClassType } from '@/types/database'
import { useLanguage } from '@/lib/i18n/LanguageContext'

const CLASS_TYPES: { value: ClassType; label: string }[] = [
  { value: 'gi',          label: 'Gi' },
  { value: 'no-gi',       label: 'No-Gi' },
  { value: 'open mat',    label: 'Open Mat' },
  { value: 'kids',        label: 'Kids' },
  { value: 'competition', label: 'Competition' },
]

type Scope = 'single' | 'future' | 'all'

interface ClassRow {
  id: string
  title: string
  class_type: string
  description: string | null
  instructor: string | null
  starts_at: string
  ends_at: string
  max_capacity: number | null
  is_cancelled: boolean
  recurrence_parent_id: string | null
  recurrence_type: string
}

interface Props {
  cls: ClassRow
  accessToken: string
  onClose: () => void
  onSaved: () => void
}

function toDateString(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toTimeString(iso: string) {
  // Parse directly — toLocaleTimeString injects invisible Unicode chars that break <input type="time">
  const t = new Date(iso)
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}

export function EditClassModal({ cls, accessToken, onClose, onSaved }: Props) {
  const { lang } = useLanguage()
  const titleId = useId()
  const idTitle = useId()
  const idDate = useId()
  const idStart = useId()
  const idEnd = useId()
  const idInstructor = useId()
  const idCapacity = useId()
  const idDescription = useId()
  const isRecurring = !!cls.recurrence_parent_id
  const [reactivating, setReactivating] = useState(false)

  const [classType, setClassType]     = useState<ClassType>(cls.class_type as ClassType)
  const [title, setTitle]             = useState(cls.title)
  const [date, setDate]               = useState(toDateString(cls.starts_at))
  const [startTime, setStartTime]     = useState(toTimeString(cls.starts_at))
  const [endTime, setEndTime]         = useState(toTimeString(cls.ends_at))
  const [instructor, setInstructor]   = useState(cls.instructor ?? '')
  const [maxCapacity, setMaxCapacity] = useState(cls.max_capacity?.toString() ?? '')
  const [description, setDescription] = useState(cls.description ?? '')
  const [scope, setScope]             = useState<Scope>('single')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    // Build timezone-aware ISO timestamps so Postgres stores the correct UTC value
    const tzMin  = new Date().getTimezoneOffset()          // e.g. -120 for UTC+2
    const sign   = tzMin <= 0 ? '+' : '-'
    const absMin = Math.abs(tzMin)
    const tz     = `${sign}${String(Math.floor(absMin / 60)).padStart(2, '0')}:${String(absMin % 60).padStart(2, '0')}`

    const res = await fetch(`/api/classes/${cls.id}?scope=${scope}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title,
        class_type: classType,
        description: description || null,
        instructor: instructor || null,
        starts_at: `${date}T${startTime}:00${tz}`,
        ends_at:   `${date}T${endTime}:00${tz}`,
        // also pass raw fields so the server can reconstruct per-date for recurring series
        start_time: startTime,
        end_time:   endTime,
        tz_offset_min: tzMin,
        max_capacity: maxCapacity ? parseInt(maxCapacity, 10) : null,
      }),
    })

    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? (lang === 'en' ? 'Error saving' : 'Fehler beim Speichern')); return }
    onSaved()
  }

  async function handleReactivate() {
    setReactivating(true)
    await fetch(`/api/classes/${cls.id}?scope=single`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ is_cancelled: false }),
    })
    setReactivating(false)
    onSaved()
  }

  const scopeLabel: Record<Scope, string> = lang === 'en' ? {
    single: 'Only this occurrence',
    future: 'This + all future',
    all:    'All occurrences in the series',
  } : {
    single: 'Nur dieser Termin',
    future: 'Dieser + alle zukünftigen',
    all:    'Alle Termine der Serie',
  }

  return (
    // TODO(a11y): Add focus trap (e.g. focus-trap-react / @headlessui/react Dialog) for full WCAG 2.1.2.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 id={titleId} className="font-semibold text-slate-900">{lang === 'en' ? 'Edit class' : 'Klasse bearbeiten'}</h2>
          <button onClick={onClose} aria-label={lang === 'en' ? 'Close dialog' : 'Dialog schließen'} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Scope selector for recurring classes */}
          {isRecurring && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-medium text-amber-800 mb-2">{lang === 'en' ? 'Recurring class – which occurrences to edit?' : 'Serientermin – welche Termine bearbeiten?'}</p>
              <div className="flex flex-col gap-1.5">
                {(['single', 'future', 'all'] as Scope[]).map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="scope"
                      value={s}
                      checked={scope === s}
                      onChange={() => setScope(s)}
                      className="accent-amber-500"
                    />
                    <span className="text-sm text-amber-900">{scopeLabel[s]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Class type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'Class type' : 'Trainingstyp'}</label>
            <div className="flex flex-wrap gap-2">
              {CLASS_TYPES.map(ct => (
                <button key={ct.value} type="button" onClick={() => setClassType(ct.value)}
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

          {/* Date — only for single edit */}
          {(!isRecurring || scope === 'single') && (
            <div>
              <label htmlFor={idDate} className="block text-sm font-medium text-slate-700 mb-1.5">{lang === 'en' ? 'Date' : 'Datum'}</label>
              <input id={idDate} type="date" required value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>
          )}

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

          {/* Reactivate cancelled class */}
          {cls.is_cancelled && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex items-center justify-between">
              <p className="text-sm text-zinc-600 font-medium">{lang === 'en' ? 'This class is cancelled.' : 'Diese Klasse ist abgesagt.'}</p>
              <button
                type="button"
                onClick={handleReactivate}
                disabled={reactivating}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {reactivating ? '…' : (lang === 'en' ? '✓ Reactivate' : '✓ Reaktivieren')}
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              {lang === 'en' ? 'Cancel' : 'Abbrechen'}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-60">
              {saving ? (lang === 'en' ? 'Saving…' : 'Wird gespeichert…') : (lang === 'en' ? 'Save' : 'Speichern')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
