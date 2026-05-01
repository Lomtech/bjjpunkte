'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

const TYPE_COLORS: Record<string, string> = {
  gi: 'bg-blue-100 text-blue-700',
  'no-gi': 'bg-slate-100 text-slate-600',
  'open mat': 'bg-amber-100 text-amber-700',
  kids: 'bg-green-100 text-green-700',
  competition: 'bg-red-100 text-red-700',
}

interface ClassItem {
  id: string; title: string; class_type: string; instructor: string | null
  starts_at: string; ends_at: string; max_capacity: number | null
  confirmed_count: number; spots_left: number | null; is_cancelled: boolean
}

interface GymInfo { name: string; address: string | null; signup_enabled: boolean }

function groupByDay(classes: ClassItem[]) {
  const groups: Record<string, ClassItem[]> = {}
  for (const c of classes) {
    const day = new Date(c.starts_at).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups[day]) groups[day] = []
    groups[day].push(c)
  }
  return groups
}

function ScheduleContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const gymId = params.gymId as string
  const isEmbed = searchParams.get('embed') === '1'

  const [gym, setGym] = useState<GymInfo | null>(null)
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/public/schedule/${gymId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setGym(d.gym)
        setClasses(d.classes ?? [])
      })
      .catch(() => setError('Verbindungsfehler'))
      .finally(() => setLoading(false))
  }, [gymId])

  if (loading) return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-slate-400 text-sm">Lädt Stundenplan…</div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="text-slate-400 text-sm">{error}</div>
    </div>
  )

  const grouped = groupByDay(classes)
  const days = Object.keys(grouped)

  return (
    <div className={`${isEmbed ? 'p-0' : 'min-h-screen bg-slate-50'}`}>
      {!isEmbed && (
        <div className="bg-white border-b border-slate-200 px-5 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-6 h-6 rounded bg-amber-500 flex items-center justify-center">
                  <span className="text-[8px] font-black text-white italic">oss</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">Powered by Osss</span>
              </div>
              <h1 className="text-lg font-bold text-slate-900">{gym?.name}</h1>
              {gym?.address && <p className="text-xs text-slate-400">{gym.address}</p>}
            </div>
            {gym?.signup_enabled && (
              <a
                href={`/schedule/${gymId}#signup`}
                className="px-4 py-2 min-h-[44px] inline-flex items-center bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Mitglied werden
              </a>
            )}
          </div>
        </div>
      )}

      <div className={`${isEmbed ? 'px-4 py-4' : 'max-w-2xl mx-auto px-5 py-6'} space-y-6`}>
        {days.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">Keine Trainings in den nächsten 14 Tagen geplant.</div>
        ) : days.map(day => (
          <div key={day}>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{day}</h2>
            <div className="space-y-2">
              {grouped[day].map(cls => {
                const start = new Date(cls.starts_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                const end = new Date(cls.ends_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                const isFull = cls.spots_left !== null && cls.spots_left <= 0
                return (
                  <div key={cls.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                    <div className="flex-shrink-0 text-center w-14">
                      <div className="text-slate-900 font-bold text-sm">{start}</div>
                      <div className="text-slate-400 text-xs">{end}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${TYPE_COLORS[cls.class_type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {cls.class_type.charAt(0).toUpperCase() + cls.class_type.slice(1)}
                        </span>
                        {isFull && <span className="text-xs px-2 py-0.5 rounded-md bg-red-50 text-red-500 font-medium">Ausgebucht</span>}
                      </div>
                      <p className="text-slate-900 font-semibold text-sm">{cls.title}</p>
                      {cls.instructor && <p className="text-slate-400 text-xs">{cls.instructor}</p>}
                      {cls.spots_left !== null && (
                        <p className="text-slate-400 text-xs mt-0.5">
                          {isFull ? 'Warteliste möglich' : `${cls.spots_left} Plätze frei`}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {!isEmbed && gym?.signup_enabled && (
          <div id="signup" className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center mt-8">
            <h3 className="font-bold text-amber-900 text-lg mb-1">Interesse? Jetzt anmelden!</h3>
            <p className="text-amber-700 text-sm mb-4">Starte dein Probetraining — kostenlos und unverbindlich.</p>
            <a
              href={`/signup?schedule=${gymId}`}
              className="inline-block px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-xl transition-colors"
            >
              Kostenlos anmelden →
            </a>
          </div>
        )}

        <p className="text-center text-slate-300 text-xs pb-4">
          Powered by <span className="font-bold italic">Osss</span> – BJJ Gym Software
        </p>
      </div>
    </div>
  )
}

export default function PublicSchedulePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-slate-400 text-sm">Lädt…</div>
      </div>
    }>
      <ScheduleContent />
    </Suspense>
  )
}
