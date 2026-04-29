'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'
import { Calendar, CreditCard, Dumbbell, TrendingUp } from 'lucide-react'

interface MemberData {
  member: {
    id: string; first_name: string; last_name: string; email: string | null
    belt: string; stripes: number; join_date: string; is_active: boolean
    subscription_status: string; date_of_birth: string | null
  }
  gym: { name: string } | null
  attendance: { id: string; checked_in_at: string; class_type: string }[]
  totalSessions: number
  payments: { id: string; amount_cents: number; status: string; paid_at: string | null; created_at: string }[]
  totalPaidCents: number
}

const CLASS_LABELS: Record<string, string> = {
  gi: 'Gi', 'no-gi': 'No-Gi', 'open mat': 'Open Mat', kids: 'Kids', competition: 'Competition',
}

const STATUS_COLORS: Record<string, string> = {
  paid:     'bg-green-50 text-green-700 border-green-200',
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  failed:   'bg-red-50 text-red-700 border-red-200',
  refunded: 'bg-slate-100 text-slate-500 border-slate-200',
}
const STATUS_LABELS: Record<string, string> = {
  paid: 'Bezahlt', pending: 'Ausstehend', failed: 'Fehlgeschlagen', refunded: 'Erstattet',
}

export default function MemberPortalPage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/portal/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Verbindungsfehler'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Lädt...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 text-sm">{error || 'Nicht gefunden'}</p>
          <p className="text-slate-400 text-xs mt-2">Bitte kontaktiere dein Gym.</p>
        </div>
      </div>
    )
  }

  const { member, gym, attendance, totalSessions, payments, totalPaidCents } = data

  const beltColor: Record<string, string> = {
    white: '#e2e8f0', blue: '#3b82f6', purple: '#a855f7', brown: '#92400e', black: '#1e293b',
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <span className="text-xs font-black text-white">RC</span>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">RollCall</p>
              {gym && <p className="text-xs text-slate-400">{gym.name}</p>}
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
            member.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-400 border-slate-200'
          }`}>
            {member.is_active ? 'Aktiv' : 'Inaktiv'}
          </span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 py-6 space-y-4">
        {/* Profile card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0"
              style={{ backgroundColor: beltColor[member.belt] ?? '#64748b' }}
            >
              {member.first_name[0]}{member.last_name[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{member.first_name} {member.last_name}</h1>
              <div className="mt-1">
                <BeltBadge belt={member.belt as Belt} stripes={member.stripes} />
              </div>
            </div>
          </div>
          {member.email && (
            <p className="text-slate-500 text-sm mt-4 pt-4 border-t border-slate-100">{member.email}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Calendar size={15} />}
            label="Mitglied seit"
            value={new Date(member.join_date).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
          />
          <StatCard
            icon={<Dumbbell size={15} />}
            label="Trainings"
            value={String(totalSessions ?? 0)}
          />
          <StatCard
            icon={<TrendingUp size={15} />}
            label="Bezahlt"
            value={`${(totalPaidCents / 100).toFixed(0)} €`}
          />
        </div>

        {/* Payments */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard size={15} className="text-slate-400" />
            Zahlungshistorie
          </h2>
          {payments && payments.length > 0 ? (
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[p.status] ?? STATUS_COLORS.pending}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                    <span className="text-slate-700 text-sm font-medium">
                      {(p.amount_cents / 100).toFixed(2).replace('.', ',')} €
                    </span>
                  </div>
                  <span className="text-slate-400 text-xs">
                    {new Date(p.paid_at ?? p.created_at).toLocaleDateString('de-DE')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Keine Zahlungen vorhanden.</p>
          )}
        </div>

        {/* Attendance history */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Dumbbell size={15} className="text-slate-400" />
            Trainingsverlauf
            <span className="text-sm font-normal text-slate-400">({totalSessions ?? 0} gesamt)</span>
          </h2>
          {attendance && attendance.length > 0 ? (
            <div className="space-y-0">
              {attendance.slice(0, 20).map(a => (
                <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-700 text-sm font-medium">{CLASS_LABELS[a.class_type] ?? a.class_type}</span>
                  <span className="text-slate-400 text-xs">
                    {new Date(a.checked_in_at).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}
                    {' · '}
                    {new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {(totalSessions ?? 0) > 20 && (
                <p className="text-slate-400 text-xs pt-3 text-center">
                  + {(totalSessions ?? 0) - 20} weitere Einträge
                </p>
              )}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">Noch keine Trainings aufgezeichnet.</p>
          )}
        </div>

        <p className="text-center text-slate-300 text-xs pb-4">Powered by RollCall</p>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm text-center">
      <div className="flex justify-center text-slate-400 mb-1">{icon}</div>
      <p className="text-slate-900 font-bold text-base">{value}</p>
      <p className="text-slate-400 text-xs mt-0.5">{label}</p>
    </div>
  )
}
