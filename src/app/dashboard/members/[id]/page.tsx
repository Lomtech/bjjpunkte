'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'
import { PromoteButton } from './PromoteButton'
import { DemoteButton } from './DemoteButton'
import { ToggleActiveButton } from './ToggleActiveButton'
import { BillingSection } from './BillingSection'
import { ExternalLink, Copy, Check, Undo2, Phone, Mail, MessageCircle, Pencil } from 'lucide-react'

/** Normalize German phone to wa.me format (no +, no spaces) */
function toWaPhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('0'))  p = '+49' + p.slice(1)
  return p.replace(/^\+/, '')
}

const WA_TEMPLATES = [
  { id: 'greeting', label: 'Allgemeine Begrüßung',       text: (n: string) => `Hallo ${n}! 👋 Kurze Nachricht von uns aus dem Gym.` },
  { id: 'payment',  label: 'Beitragserinnerung',         text: (n: string) => `Hallo ${n}, dein monatlicher Mitgliedsbeitrag ist fällig. Kannst du ihn diese Woche überweisen? Danke! 🙏` },
  { id: 'promo',    label: 'Gratulation Gürtelpromotion', text: (n: string) => `Herzlichen Glückwunsch ${n}! 🥋🎉 Du hast dich heute eine Stufe hochgekämpft – verdient! Oss!` },
  { id: 'miss',     label: 'Vermisst – komm zurück',     text: (n: string) => `Hey ${n}, wir vermissen dich auf der Matte! 💪 Alles gut bei dir? Wir freuen uns wenn du wieder vorbeikommst. Oss!` },
  { id: 'event',    label: 'Training-Erinnerung',        text: (n: string) => `Hi ${n}! Erinnerung: Heute Abend Training – wir sehen uns auf der Matte! Oss 🥋` },
]

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
  contract_end_date: string | null
  date_of_birth: string | null
  portal_token: string | null
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
  const [deletingPromoId, setDeletingPromoId] = useState<string | null>(null)

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

  async function deletePromotion(promoId: string, isLatest: boolean) {
    if (!confirm(isLatest
      ? 'Graduierung rückgängig machen? Der Gürtel wird auf den vorherigen Stand zurückgesetzt.'
      : 'Eintrag aus dem Verlauf löschen? (Gürtel bleibt unverändert.)'
    )) return

    // Capture promo data BEFORE any state update
    const promoSnapshot = promotions.find(p => p.id === promoId)

    setDeletingPromoId(promoId)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''

    const res = await fetch(`/api/promotions/${promoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.ok) {
      const json = await res.json()
      // Remove from list
      setPromotions(ps => ps.filter(p => p.id !== promoId))
      // Revert member belt if this was the latest promotion
      if (json.reverted && member && promoSnapshot) {
        setMember(m => m ? {
          ...m,
          belt: promoSnapshot.previous_belt,
          stripes: promoSnapshot.previous_stripes,
        } : m)
      }
    }
    setDeletingPromoId(null)
  }

  function handlePromoted(belt: Belt, stripes: number) {
    setMember(m => m ? { ...m, belt: belt as string, stripes } : m)
  }

  function handleDemoted(belt: Belt, stripes: number) {
    setMember(m => m ? { ...m, belt: belt as string, stripes } : m)
    // Reload promotions to show new demotion entry
    const supabase = createClient()
    supabase.from('belt_promotions').select('*').eq('member_id', id)
      .order('promoted_at', { ascending: false })
      .then(({ data }) => { if (data) setPromotions(data as Promotion[]) })
  }

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
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="mb-8">
        <Link href="/dashboard/members" className="text-slate-400 hover:text-slate-600 text-sm">← Mitglieder</Link>
        <div className="flex items-start justify-between mt-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{member.first_name} {member.last_name}</h1>
              <Link href={`/dashboard/members/${member.id}/edit`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-slate-600 text-xs font-medium transition-colors flex-shrink-0">
                <Pencil size={12} /> Bearbeiten
              </Link>
            </div>
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
          <ToggleActiveButton
            memberId={member.id}
            isActive={member.is_active}
            onToggled={active => setMember(m => m ? { ...m, is_active: active } : m)}
          />
        </div>
      </div>

      {/* Contact action bar */}
      {(member.phone || member.email) && (
        <ContactBar
          firstName={member.first_name}
          phone={member.phone}
          email={member.email}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <InfoCard label="Mitglied seit" value={new Date(member.join_date).toLocaleDateString('de-DE')} />
        <InfoCard label="Trainings gesamt" value={String(totalSessions)} />
        {member.phone && <InfoCard label="Telefon" value={member.phone} />}
        {!member.phone && member.email && <InfoCard label="E-Mail" value={member.email} />}
      </div>

      <ContractSection
        memberId={member.id}
        contractEndDate={member.contract_end_date}
        onUpdated={(newDate) => setMember(m => m ? { ...m, contract_end_date: newDate } : m)}
      />

      {member.notes && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notizen</p>
          <p className="text-slate-600 text-sm">{member.notes}</p>
        </div>
      )}

      {/* Belt Promotion */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Belt-Promotion</h2>
          <DemoteButton
            memberId={member.id} gymId={gymId}
            currentBelt={member.belt as Belt} currentStripes={member.stripes}
            onDemoted={handleDemoted}
          />
        </div>
        <PromoteButton
          memberId={member.id} gymId={gymId}
          currentBelt={member.belt as Belt} currentStripes={member.stripes}
          onPromoted={handlePromoted}
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
        stripeSubscriptionId={(member as any).stripe_subscription_id ?? null}
        monthlyFeeCents={monthlyFeeCents}
        payments={payments}
      />

      {/* Member portal link */}
      {member.portal_token && (
        <PortalLinkSection token={member.portal_token} />
      )}

      {/* Promotion history */}
      {promotions.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-5">
          <h2 className="font-semibold text-slate-900 mb-4">Promotion-Verlauf</h2>
          <div className="space-y-0">
            {promotions.map((p, i) => {
              const isLatest = i === 0
              return (
                <div key={p.id} className="group flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <BeltBadge belt={p.previous_belt as Belt} stripes={p.previous_stripes} />
                    <span className="text-slate-400">→</span>
                    <BeltBadge belt={p.new_belt as Belt} stripes={p.new_stripes} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm">{new Date(p.promoted_at).toLocaleDateString('de-DE')}</span>
                    <button
                      onClick={() => deletePromotion(p.id, isLatest)}
                      disabled={deletingPromoId === p.id}
                      title={isLatest ? 'Graduierung rückgängig machen' : 'Eintrag löschen'}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-all disabled:opacity-30"
                    >
                      <Undo2 size={13} />
                      {isLatest ? 'Rückgängig' : 'Löschen'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent attendance */}
      {attendance.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="font-semibold text-slate-900 mb-4">Letzte Trainings</h2>
          <div className="space-y-2">
            {attendance.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className="text-slate-700 text-sm capitalize font-medium flex-1 min-w-0 truncate">{a.class_type}</span>
                <span className="text-slate-400 text-xs flex-shrink-0 whitespace-nowrap">
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
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm min-w-0 overflow-hidden">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 truncate">{label}</p>
      <p className="text-slate-900 font-semibold text-sm truncate">{value}</p>
    </div>
  )
}

function ContactBar({ firstName, phone, email }: { firstName: string; phone: string | null; email: string | null }) {
  const [showWa, setShowWa] = useState(false)
  return (
    <>
      <div className="flex gap-2 mb-5 flex-wrap">
        {phone && (
          <>
            <a href={`tel:${phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 font-medium text-sm transition-colors">
              <Phone size={14} /> Anrufen
            </a>
            <button onClick={() => setShowWa(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe57] text-white font-semibold text-sm transition-colors">
              <MessageCircle size={14} /> WhatsApp
            </button>
          </>
        )}
        {email && (
          <a href={`mailto:${email}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 font-medium text-sm transition-colors">
            <Mail size={14} /> E-Mail
          </a>
        )}
      </div>
      {showWa && phone && (
        <WhatsAppCompose firstName={firstName} phone={phone} onClose={() => setShowWa(false)} />
      )}
    </>
  )
}

function WhatsAppCompose({ firstName, phone, onClose }: { firstName: string; phone: string; onClose: () => void }) {
  const [selected, setSelected] = useState(WA_TEMPLATES[0].id)
  const [customText, setCustomText] = useState('')
  const template = WA_TEMPLATES.find(t => t.id === selected)!
  const message  = customText || template.text(firstName)
  const waPhone  = toWaPhone(phone)
  const waUrl    = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-[#25D366]">
          <div className="flex items-center gap-2 text-white">
            <MessageCircle size={18} />
            <span className="font-bold">WhatsApp an {firstName}</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Vorlage</p>
            <div className="grid grid-cols-1 gap-1.5">
              {WA_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => { setSelected(t.id); setCustomText('') }}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selected === t.id ? 'bg-[#25D366]/10 text-[#128C7E] font-semibold border border-[#25D366]/30' : 'bg-gray-50 text-slate-700 hover:bg-gray-100'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nachricht bearbeiten</p>
            <textarea
              value={customText || template.text(firstName)}
              onChange={e => setCustomText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-800 text-sm focus:outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 resize-none"
            />
          </div>
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold text-sm transition-colors">
            <MessageCircle size={16} /> In WhatsApp öffnen
          </a>
        </div>
      </div>
    </div>
  )
}

function PortalLinkSection({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const portalUrl = `${appUrl}/portal/${token}`

  function copy() {
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mitgliederbereich</p>
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-600 hover:text-amber-500 font-medium flex items-center gap-1"
        >
          <ExternalLink size={12} /> Öffnen
        </a>
      </div>
      <p className="text-slate-500 text-xs mb-3">
        Diesen Link an das Mitglied schicken — dort sieht es Trainings, Zahlungen und Statistiken.
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={portalUrl}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-mono focus:outline-none truncate"
        />
        <button
          onClick={copy}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
            copied ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-white'
          }`}
        >
          {copied ? <><Check size={12} /> Kopiert</> : <><Copy size={12} /> Kopieren</>}
        </button>
      </div>
    </div>
  )
}

function ContractSection({
  memberId,
  contractEndDate,
  onUpdated,
}: {
  memberId: string
  contractEndDate: string | null
  onUpdated: (newDate: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(contractEndDate ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('members').update({ contract_end_date: value || null }).eq('id', memberId)
    onUpdated(value || null)
    setSaving(false)
    setEditing(false)
  }

  const now = new Date()
  const diffDays = contractEndDate
    ? (new Date(contractEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    : null

  const isExpired = diffDays !== null && diffDays < 0
  const isExpiring = diffDays !== null && diffDays >= 0 && diffDays <= 30

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vertragsende</p>
        <button
          onClick={() => { setEditing(e => !e); setValue(contractEndDate ?? '') }}
          className="text-xs text-amber-600 hover:text-amber-500 font-medium"
        >
          {editing ? 'Abbrechen' : 'Bearbeiten'}
        </button>
      </div>

      {editing ? (
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      ) : (
        <div>
          <p className="text-slate-900 font-semibold text-sm">
            {contractEndDate ? new Date(contractEndDate).toLocaleDateString('de-DE') : '—'}
          </p>
          {isExpired && (
            <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              Vertrag ist abgelaufen ({Math.abs(Math.floor(diffDays!))} Tage überfällig)
            </div>
          )}
          {isExpiring && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
              Vertrag läuft in {Math.floor(diffDays!)} Tagen ab
            </div>
          )}
        </div>
      )}
    </div>
  )
}
