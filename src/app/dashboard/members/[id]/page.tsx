'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'
import { PromoteButton } from './PromoteButton'
import { ToggleActiveButton } from './ToggleActiveButton'
import { BillingSection } from './BillingSection'

interface Member {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  belt: string
  stripes: number
  join_date: string
  is_active: boolean
  subscription_status: string | null
  stripe_customer_id: string | null
  notes: string | null
}

interface Promotion {
  id: string
  previous_belt: string
  previous_stripes: number
  new_belt: string
  new_stripes: number
  promoted_at: string
}

interface Attendance {
  id: string
  checked_in_at: string
  class_type: string
}

interface Payment {
  id: string
  amount_cents: number
  status: string
  paid_at: string | null
  created_at: string
}

export default function MemberDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [member, setMember] = useState<Member | null>(null)
  const [gymId, setGymId] = useState<string>('')
  const [monthlyFeeCents, setMonthlyFeeCents] = useState(0)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [totalSessions, setTotalSessions] = useState(0)
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: gym } = await supabase.from('gyms').select('id, monthly_fee_cents').single()
      if (!gym) { setLoading(false); return }

      setGymId(gym.id)
      setMonthlyFeeCents(gym.monthly_fee_cents ?? 0)

      const { data: memberData } = await supabase
        .from('members').select('*').eq('id', id).eq('gym_id', gym.id).single()

      if (!memberData) { setNotFound(true); setLoading(false); return }
      setMember(memberData as Member)

      const [
        { data: promotionsData },
        { data: attendanceData },
        { count },
        { data: paymentsData },
      ] = await Promise.all([
        supabase.from('belt_promotions').select('*').eq('member_id', id).order('promoted_at', { ascending: false }),
        supabase.from('attendance').select('*').eq('member_id', id).order('checked_in_at', { ascending: false }).limit(10),
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('member_id', id),
        supabase.from('payments').select('*').eq('member_id', id).order('created_at', { ascending: false }).limit(6),
      ])

      setPromotions((promotionsData as Promotion[]) ?? [])
      setAttendance((attendanceData as Attendance[]) ?? [])
      setTotalSessions(count ?? 0)
      setPayments((paymentsData as Payment[]) ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Lädt...</div>
      </div>
    )
  }

  if (notFound || !member) {
    return (
      <div className="p-8">
        <Link href="/dashboard/members" className="text-slate-400 hover:text-slate-600 text-sm">← Mitglieder</Link>
        <p className="mt-6 text-slate-500">Mitglied nicht gefunden.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <Link href="/dashboard/members" className="text-slate-400 hover:text-slate-600 text-sm">← Mitglieder</Link>
        <div className="flex items-start justify-between mt-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{member.first_name} {member.last_name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <BeltBadge belt={member.belt as Belt} stripes={member.stripes} />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                member.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-400 border-slate-200'
              }`}>
                {member.is_active ? 'Aktiv' : 'Inaktiv'}
              </span>
              {member.subscription_status && member.subscription_status !== 'none' && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                  member.subscription_status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                  member.subscription_status === 'past_due' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  Beitrag: {member.subscription_status === 'active' ? 'Bezahlt' : member.subscription_status === 'past_due' ? 'Überfällig' : member.subscription_status}
                </span>
              )}
            </div>
          </div>
          <ToggleActiveButton memberId={member.id} isActive={member.is_active} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <InfoCard label="Mitglied seit" value={new Date(member.join_date).toLocaleDateString('de-DE')} />
        <InfoCard label="Trainings gesamt" value={String(totalSessions)} />
        <InfoCard label="Kontakt" value={member.email ?? member.phone ?? '—'} />
      </div>

      {member.notes && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notizen</p>
          <p className="text-slate-600 text-sm">{member.notes}</p>
        </div>
      )}

      {/* Belt Promotion */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-5">
        <h2 className="font-semibold text-slate-900 mb-4">Belt-Promotion</h2>
        <PromoteButton
          memberId={member.id} gymId={gymId}
          currentBelt={member.belt as Belt} currentStripes={member.stripes}
        />
      </div>

      {/* Billing */}
      <BillingSection
        memberId={member.id}
        gymId={gymId}
        memberEmail={member.email}
        memberName={`${member.first_name} ${member.last_name}`}
        subscriptionStatus={member.subscription_status ?? 'none'}
        stripeCustomerId={member.stripe_customer_id}
        monthlyFeeCents={monthlyFeeCents}
        payments={payments}
      />

      {/* Promotion history */}
      {promotions.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-5">
          <h2 className="font-semibold text-slate-900 mb-4">Promotion-Verlauf</h2>
          <div className="space-y-3">
            {promotions.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <BeltBadge belt={p.previous_belt as Belt} stripes={p.previous_stripes} />
                  <span className="text-slate-400">→</span>
                  <BeltBadge belt={p.new_belt as Belt} stripes={p.new_stripes} />
                </div>
                <span className="text-slate-400 text-sm">{new Date(p.promoted_at).toLocaleDateString('de-DE')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent attendance */}
      {attendance.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Letzte Trainings</h2>
          <div className="space-y-2">
            {attendance.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-slate-700 text-sm capitalize font-medium">{a.class_type}</span>
                <span className="text-slate-400 text-sm">
                  {new Date(a.checked_in_at).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  {' · '}
                  {new Date(a.checked_in_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-slate-900 font-semibold text-sm">{value}</p>
    </div>
  )
}
