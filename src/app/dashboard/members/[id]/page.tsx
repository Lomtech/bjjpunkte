'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { BeltBadge } from '@/components/BeltBadge'
import type { Belt } from '@/types/database'
import { type BeltSystem, resolveBeltSystem } from '@/lib/belt-system'
import { PromoteButton } from './PromoteButton'
import { DemoteButton } from './DemoteButton'
import { ToggleActiveButton } from './ToggleActiveButton'
import { BillingSection } from './BillingSection'
import { ExternalLink, Copy, Check, Undo2, Phone, Mail, MessageCircle, Pencil, Trash2, Users, Award, CreditCard, History, CalendarDays, StickyNote, Link2, UserCheck, FileText } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useToast } from '@/components/Toast'

import { toWaPhone } from '@/lib/phone'

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
  parent_member_id: string | null
  cancellation_requested_at: string | null
  cancellation_note: string | null
  requested_plan_id: string | null
  monthly_fee_override_cents: number | null
  plan_id: string | null
  stripe_subscription_id: string | null
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
  const router = useRouter()
  const { t, lang } = useLanguage()
  const toast = useToast()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'
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
  const [deletingMember, setDeletingMember]   = useState(false)
  const [parentInfo, setParentInfo] = useState<{ id: string; first_name: string; last_name: string } | null>(null)
  const [children, setChildren] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [beltSystem, setBeltSystem]       = useState<BeltSystem | undefined>(undefined)
  const [beltEnabled, setBeltEnabled]     = useState(true)
  const [stripesEnabled, setStripesEnabled] = useState(true)
  const [checkingIn, setCheckingIn]       = useState(false)
  const [checkedInNow, setCheckedInNow]   = useState(false)
  const [gpsError, setGpsError]           = useState<string | null>(null)
  const [confirmState, setConfirmState]   = useState<{
    open: boolean; title: string; description?: string
    confirmLabel?: string; danger?: boolean; icon?: React.ReactNode; onConfirm: () => void
  }>({ open: false, title: '', onConfirm: () => {} })

  function askConfirm(opts: { title: string; description?: string; confirmLabel?: string; danger?: boolean; icon?: React.ReactNode; onConfirm: () => void }) {
    setConfirmState({ ...opts, open: true })
  }
  function closeConfirm() { setConfirmState(s => ({ ...s, open: false })) }
  const cachedGps = useRef<{ lat: number; lng: number; ts: number } | null>(null)
  const GPS_CACHE_MS = 5 * 60 * 1000

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: gym } = await supabase
        .from('gyms')
        .select('id, monthly_fee_cents, belt_system, belt_system_enabled, stripes_enabled')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (!gym) { setLoading(false); return }

      setGymId(gym.id)
      setBeltSystem(resolveBeltSystem((gym as any)?.belt_system))
      setBeltEnabled((gym as any)?.belt_system_enabled ?? true)
      setStripesEnabled((gym as any)?.stripes_enabled ?? true)

      const { data: memberData } = await supabase
        .from('members').select('*').eq('id', id).eq('gym_id', gym.id).single()

      if (!memberData) { setNotFound(true); setLoading(false); return }
      const m = memberData as unknown as Member
      setMember(m)

      // Prefer: member override → assigned plan price → 0 (never fall back to gym default)
      if (m.monthly_fee_override_cents != null) {
        setMonthlyFeeCents(m.monthly_fee_override_cents)
      } else if (m.plan_id) {
        const { data: plan } = await supabase.from('membership_plans')
          .select('price_cents').eq('id', m.plan_id).single()
        setMonthlyFeeCents((plan as any)?.price_cents ?? 0)
      } else {
        setMonthlyFeeCents(0)
      }

      // Load parent and children for family section
      const familyQueries: Promise<void>[] = []
      if (m.parent_member_id) {
        familyQueries.push(
          Promise.resolve(
            supabase.from('members').select('id, first_name, last_name').eq('id', m.parent_member_id).single()
          ).then(({ data }) => { if (data) setParentInfo(data as { id: string; first_name: string; last_name: string }) })
        )
      }
      familyQueries.push(
        Promise.resolve(
           
          supabase.from('members').select('id, first_name, last_name').eq('parent_member_id', id)
        ).then(({ data }: { data: { id: string; first_name: string; last_name: string }[] | null }) => {
          if (data) setChildren(data)
        })
      )

      try {
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
      } catch (err) {
        console.error('Failed to load member data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function deletePromotion(promoId: string, isLatest: boolean) {
    askConfirm({
      title: isLatest ? t('memberDetailExtra', 'confirmDeletePromoLatest') : t('memberDetailExtra', 'confirmDeletePromoOld'),
      confirmLabel: lang === 'en' ? 'Delete' : 'Löschen',
      danger: true,
      icon: '🗑️',
      onConfirm: () => { closeConfirm(); doDeletePromotion(promoId) },
    })
  }

  async function doDeletePromotion(promoId: string) {
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

  function handlePromoted(belt: string, stripes: number) {
    setMember(m => m ? { ...m, belt: belt as string, stripes } : m)
  }

  function handleDeleteMember() {
    askConfirm({
      title: t('memberDetailExtra', 'confirmDeleteMember', { name: `${member?.first_name} ${member?.last_name}` }),
      description: lang === 'en' ? 'All data will be permanently deleted.' : 'Alle Daten werden dauerhaft gelöscht.',
      confirmLabel: lang === 'en' ? 'Delete' : 'Löschen',
      danger: true,
      icon: '🗑️',
      onConfirm: () => { closeConfirm(); doDeleteMember() },
    })
  }

  async function doDeleteMember() {
    setDeletingMember(true)
    const { data: { session } } = await createClient().auth.getSession()
    const res = await fetch(`/api/members/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    if (res.ok) { router.push('/dashboard/members') }
    else { const d = await res.json(); toast.error(d.error ?? (lang === 'en' ? 'Could not delete member.' : 'Konnte Mitglied nicht löschen.')); setDeletingMember(false) }
  }

  function handleDemoted(belt: string, stripes: number) {
    setMember(m => m ? { ...m, belt: belt as string, stripes } : m)
    // Reload promotions to show new demotion entry
    const supabase = createClient()
    supabase.from('belt_promotions').select('*').eq('member_id', id)
      .order('promoted_at', { ascending: false })
      .then(({ data }) => { if (data) setPromotions(data as Promotion[]) })
  }

  function handleClearCancellation() {
    askConfirm({
      title: t('memberDetailExtra', 'confirmCancellation'),
      confirmLabel: lang === 'en' ? 'Confirm' : 'Bestätigen',
      danger: true,
      icon: '⚠️',
      onConfirm: () => { closeConfirm(); doClearCancellation() },
    })
  }

  async function doClearCancellation() {
    const supabase = createClient()
    await supabase.from('members').update({
      cancellation_requested_at: null,
      cancellation_note: null,
      is_active: false,
    }).eq('id', id)
    setMember(m => m ? { ...m, cancellation_requested_at: null, cancellation_note: null, is_active: false } : m)
  }

  function handleClearPlanRequest() {
    askConfirm({
      title: t('memberDetailExtra', 'confirmPlanRequest'),
      confirmLabel: lang === 'en' ? 'Confirm' : 'Bestätigen',
      icon: '📋',
      onConfirm: () => { closeConfirm(); doClearPlanRequest() },
    })
  }

  async function doClearPlanRequest() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/members/${id}/confirm-plan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    const json = await res.json()
    if (res.ok) {
      setMember(m => m ? { ...m, requested_plan_id: null } : m)
      if (json.checkout_url) {
        toast.success(t('memberDetailExtra', 'planAssigned', { url: json.checkout_url }))
      }
    }
  }

  async function handleCheckIn() {
    if (checkingIn) return
    setCheckingIn(true)
    setGpsError(null)

    // Get GPS (cached or fresh)
    let lat: number, lng: number
    try {
      const cached = cachedGps.current
      if (cached && Date.now() - cached.ts < GPS_CACHE_MS) {
        lat = cached.lat; lng = cached.lng
      } else if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000 })
        )
        cachedGps.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() }
        lat = pos.coords.latitude; lng = pos.coords.longitude
      } else {
        throw new Error(t('memberDetailExtra', 'gpsNotAvailable'))
      }
    } catch (e: unknown) {
      setCheckingIn(false)
      const msg = e instanceof GeolocationPositionError
        ? (e.code === 1 ? t('memberDetailExtra', 'gpsDenied') : t('memberDetailExtra', 'gpsLocationError'))
        : (e instanceof Error ? e.message : 'GPS-Fehler')
      setGpsError(msg)
      return
    }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/attendance/gps', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: id, class_type: 'gi', class_id: null, lat, lng }),
    })
    setCheckingIn(false)

    if (res.ok) {
      const { entry } = await res.json()
      setAttendance(prev => [entry, ...prev])
      setTotalSessions(n => n + 1)
      setCheckedInNow(true)
      setTimeout(() => setCheckedInNow(false), 3000)
    } else {
      const json = await res.json().catch(() => ({}))
      setGpsError(json.error ?? t('memberDetailExtra', 'checkinFailed'))
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-zinc-400 text-sm">{t('common', 'loading')}</div>
      </div>
    )
  }

  if (notFound || !member) {
    return (
      <div className="p-8">
        <Link href="/dashboard/members" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors">
          {t('memberDetail', 'backToList')}
        </Link>
        <p className="mt-6 text-zinc-500">{t('memberDetailExtra', 'notFound')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Abbrechen'}
        danger={confirmState.danger}
        icon={confirmState.icon}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
      {/* Sticky check-in bar — always visible at top */}
      <div className="sticky top-0 z-20 bg-slate-50 border-b border-zinc-100 px-4 md:px-6 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard/members" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors flex-shrink-0">
            {t('memberDetail', 'backToList')}
          </Link>
          <button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-sm flex-shrink-0 ${
              checkedInNow
                ? 'bg-green-500 text-white'
                : 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
            } disabled:opacity-60`}
          >
            {checkedInNow
              ? <><Check size={14} /> {t('memberDetailExtra', 'checkedIn')}</>
              : checkingIn
                ? 'GPS…'
                : <><UserCheck size={14} /> {t('memberDetail', 'checkin')}</>
            }
          </button>
        </div>
        {gpsError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            <span className="flex-1">{gpsError}</span>
            <button onClick={() => setGpsError(null)} className="text-red-300 hover:text-red-500">✕</button>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight mb-2">
          {member.first_name} {member.last_name}
        </h1>

        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {beltEnabled && <BeltBadge belt={member.belt as Belt} stripes={stripesEnabled ? member.stripes : 0} beltSystem={beltSystem} />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
            member.is_active ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-zinc-100 text-zinc-400 border-zinc-200'
          }`}>
            {member.is_active ? t('common', 'active') : t('common', 'inactive')}
          </span>
          {(() => {
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            const paidThisMonth = payments.some(p =>
              p.status === 'paid' && new Date(p.paid_at ?? p.created_at) >= monthStart
            )
            const hasPendingThisMonth = payments.some(p =>
              p.status === 'pending' && new Date(p.created_at) >= monthStart
            )
            if (paidThisMonth) return (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-zinc-100 text-zinc-600 border-zinc-200">
                {t('memberDetailExtra', 'feePaid')}
              </span>
            )
            if (hasPendingThisMonth) return (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium border bg-amber-50 text-amber-700 border-amber-200">
                {t('memberDetailExtra', 'feePending')}
              </span>
            )
            return null
          })()}
          {(member as any).stripe_subscription_id && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
              member.subscription_status === 'past_due' ? 'bg-zinc-100 text-zinc-500 border-zinc-200' :
              'bg-zinc-100 text-zinc-600 border-zinc-200'
            }`}>
              {member.subscription_status === 'past_due' ? t('memberDetailExtra', 'subOverdue') : t('memberDetailExtra', 'subActive')}
            </span>
          )}
        </div>

        {/* Action buttons — same row, same height */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Link
            href={`/dashboard/members/${member.id}/edit`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-sm font-medium transition-colors shadow-sm"
          >
            <Pencil size={13} /> {t('memberDetail', 'editMember')}
          </Link>
          <ToggleActiveButton
            memberId={member.id}
            isActive={member.is_active}
            onToggled={active => setMember(m => m ? { ...m, is_active: active } : m)}
          />
          {/* PDF-Vertrag — kind richtet sich nach membership_source.
              Wir verwenden fetch+Bearer (statt <a target="_blank">), weil
              das robuster ist als der Cookie-Auth-Pfad und keine Cross-Tab-
              Cookie-Probleme hat. Der PDF-Blob wird dann via window.open()
              in neuem Tab geöffnet. */}
          <ContractDownloadButton
            memberId={member.id}
            kind={
              (['wellpass', 'hansefit', 'egym', 'urban_sports']
                .includes((member as { membership_source?: string }).membership_source ?? ''))
                ? 'wellpass'
                : 'membership'
            }
          />
        </div>
      </div>

      {/* Contact action bar */}
      {(member.phone || member.email) && (
        <ContactBar
          memberId={member.id}
          firstName={member.first_name}
          phone={member.phone}
          email={member.email}
        />
      )}

      {/* Pending member requests */}
      {member.cancellation_requested_at && (
        <div className="mb-4 bg-zinc-50 rounded-xl border border-zinc-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-800">{t('memberDetailExtra', 'cancellationNote')}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {new Date(member.cancellation_requested_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              {member.cancellation_note && (
                <p className="text-sm text-zinc-600 mt-2 bg-white rounded-lg px-3 py-2 border border-zinc-200">"{member.cancellation_note}"</p>
              )}
            </div>
            <button
              onClick={handleClearCancellation}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold transition-colors">
              {t('memberDetailExtra', 'done')}
            </button>
          </div>
        </div>
      )}

      {member.requested_plan_id && (
        <div className="mb-4 bg-amber-50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-800">{t('memberDetailExtra', 'planChangeNote')}</p>
              <p className="text-xs text-amber-600 mt-0.5">{t('memberDetailExtra', 'planChangeSub')}</p>
            </div>
            <button
              onClick={handleClearPlanRequest}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-white border border-amber-200 hover:bg-amber-50 text-amber-700 text-xs font-semibold transition-colors">
              {t('memberDetailExtra', 'done')}
            </button>
          </div>
        </div>
      )}

      {/* Family links */}
      {(parentInfo || children.length > 0) && (
        <div className="flex flex-wrap gap-4 mb-4">
          {parentInfo && (
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <Users size={14} className="text-zinc-400" />
              <span>{t('memberDetailExtra', 'childOf')} </span>
              <Link href={`/dashboard/members/${parentInfo.id}`} className="text-amber-600 hover:underline font-medium">
                {parentInfo.first_name} {parentInfo.last_name}
              </Link>
            </div>
          )}
          {children.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-zinc-600 flex-wrap">
              <Users size={14} className="text-zinc-400" />
              <span>{t('memberDetailExtra', 'children')}: </span>
              {children.map(child => (
                <Link key={child.id} href={`/dashboard/members/${child.id}`} className="text-amber-600 hover:underline font-medium">
                  {child.first_name} {child.last_name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <InfoCard label={t('memberDetail', 'memberSince')} value={new Date(member.join_date).toLocaleDateString(locale)} />
        <InfoCard label={t('memberDetailExtra', 'totalSessions')} value={String(totalSessions)} />
        {member.phone && <InfoCard label={t('memberDetailExtra', 'phone')} value={member.phone} />}
        {!member.phone && member.email && <InfoCard label={t('memberDetailExtra', 'email')} value={member.email} />}
      </div>

      <ContractSection
        memberId={member.id}
        contractEndDate={member.contract_end_date}
        onUpdated={(newDate) => setMember(m => m ? { ...m, contract_end_date: newDate } : m)}
      />

      {member.notes && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <StickyNote size={13} className="text-amber-600" />
            </span>
            <p className="text-sm font-semibold text-zinc-800">{t('memberDetail', 'notes')}</p>
          </div>
          <p className="text-zinc-600 text-sm">{member.notes}</p>
        </div>
      )}

      {/* Belt Promotion — hidden when belt system disabled */}
      {beltEnabled && (
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Award size={13} className="text-amber-600" />
              </span>
              <h2 className="text-sm font-semibold text-zinc-800">{t('memberDetailExtra', 'beltPromotion')}</h2>
            </div>
            <DemoteButton
              memberId={member.id} gymId={gymId}
              currentBelt={member.belt as Belt} currentStripes={member.stripes}
              onDemoted={handleDemoted} beltSystem={beltSystem} stripesEnabled={stripesEnabled}
            />
          </div>
          <PromoteButton
            memberId={member.id} gymId={gymId}
            currentBelt={member.belt as Belt} currentStripes={member.stripes}
            onPromoted={handlePromoted} beltSystem={beltSystem} stripesEnabled={stripesEnabled}
          />
        </div>
      )}

      {/* Billing */}
      <BillingSection
        memberId={member.id}
        gymId={gymId}
        memberEmail={member.email}
        memberPhone={member.phone}
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
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <History size={13} className="text-amber-600" />
            </span>
            <h2 className="text-sm font-semibold text-zinc-800">{t('memberDetailExtra', 'promotionHistory')}</h2>
          </div>
          <div className="space-y-0">
            {promotions.map((p, i) => {
              const isLatest = i === 0
              return (
                <div key={p.id} className="group flex items-center justify-between py-2.5 border-b border-zinc-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <BeltBadge belt={p.previous_belt as Belt} stripes={p.previous_stripes} beltSystem={beltSystem} />
                    <span className="text-zinc-400">→</span>
                    <BeltBadge belt={p.new_belt as Belt} stripes={p.new_stripes} beltSystem={beltSystem} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-400 text-sm">{new Date(p.promoted_at).toLocaleDateString(locale)}</span>
                    <button
                      onClick={() => deletePromotion(p.id, isLatest)}
                      disabled={deletingPromoId === p.id}
                      title={isLatest ? t('memberDetailExtra', 'confirmDeletePromoLatest') : t('memberDetailExtra', 'confirmDeletePromoOld')}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500 transition-all disabled:opacity-30"
                    >
                      <Undo2 size={13} />
                      {isLatest ? t('memberDetailExtra', 'undo') : t('memberDetailExtra', 'delete')}
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
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <CalendarDays size={13} className="text-amber-600" />
            </span>
            <h2 className="text-sm font-semibold text-zinc-800">{t('memberDetailExtra', 'recentSessions')}</h2>
          </div>
          <div className="space-y-2">
            {attendance.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-zinc-100 last:border-0">
                <span className="text-zinc-700 text-sm capitalize font-medium flex-1 min-w-0 truncate">{a.class_type}</span>
                <span className="text-zinc-400 text-xs flex-shrink-0 whitespace-nowrap">
                  {new Date(a.checked_in_at).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  {' · '}
                  {new Date(a.checked_in_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete — only for inactive members */}
      {!member.is_active && (
        <div className="mt-6 pt-5 border-t border-red-100">
          <button onClick={handleDeleteMember} disabled={deletingMember}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold transition-colors disabled:opacity-50">
            <Trash2 size={14} />
            {deletingMember ? t('memberDetailExtra', 'deletingMember') : t('memberDetailExtra', 'deleteMember')}
          </button>
          <p className="text-xs text-zinc-400 mt-2">{t('memberDetailExtra', 'deleteWarning')}</p>
        </div>
      )}
      </div>{/* /p-4 md:p-6 */}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm min-w-0 overflow-hidden">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1 truncate">{label}</p>
      <p className="text-zinc-950 font-black text-base tracking-tight truncate">{value}</p>
    </div>
  )
}

/**
 * Lädt den Vertrag per fetch (mit Bearer-Token aus der Supabase-Session)
 * und öffnet ihn als Blob-URL in einem neuen Tab. Dual-Auth-tauglich,
 * vermeidet Cookie-Probleme bei direkten <a target="_blank">-Aufrufen.
 */
function ContractDownloadButton({ memberId, kind }: { memberId: string; kind: 'membership' | 'wellpass' }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState<string | null>(null)

  async function open() {
    setBusy(true); setErr(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setErr('Nicht eingeloggt'); return }

      const res = await fetch(`/api/members/${memberId}/contract?kind=${kind}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setErr(j.error ?? `Fehler ${res.status}`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      // PDF wird vom Browser geladen → Blob-URL nach 60s freigeben
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        title="Unterschriebenen Vertrag als PDF öffnen"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 text-zinc-700 text-sm font-medium transition-colors shadow-sm"
      >
        <FileText size={13} /> {busy ? 'Wird geladen…' : 'Vertrag (PDF)'}
      </button>
      {err && (
        <span className="text-xs text-red-600 ml-2 self-center">{err}</span>
      )}
    </>
  )
}

function ContactBar({ memberId, firstName, phone, email }: { memberId: string; firstName: string; phone: string | null; email: string | null }) {
  const { t } = useLanguage()
  const [showWa, setShowWa] = useState(false)
  const [showMail, setShowMail] = useState(false)
  return (
    <>
      <div className="flex gap-2 mb-5 flex-wrap">
        {phone && (
          <>
            <a href={`tel:${phone}`}
              className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium text-sm transition-colors shadow-sm">
              <Phone size={14} /> {t('memberDetailExtra', 'call')}
            </a>
            <button onClick={() => setShowWa(true)}
              className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-semibold text-sm transition-colors shadow-sm">
              <MessageCircle size={14} /> WhatsApp
            </button>
          </>
        )}
        {email && (
          <button onClick={() => setShowMail(true)}
            className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium text-sm transition-colors shadow-sm">
            <Mail size={14} /> {t('memberDetailExtra', 'email')}
          </button>
        )}
      </div>
      {showWa && phone && (
        <WhatsAppCompose firstName={firstName} phone={phone} onClose={() => setShowWa(false)} />
      )}
      {showMail && email && (
        <MemberMailCompose memberId={memberId} firstName={firstName} email={email} onClose={() => setShowMail(false)} />
      )}
    </>
  )
}

/**
 * In-App Mail-Composer für eine 1-zu-1-Mitteilung an ein einzelnes Mitglied.
 * Smartphone-optimiert (Modal mit safe-area-padding). Kein mailto:-Sprung
 * mehr — Owner bleibt im Dashboard.
 */
function MemberMailCompose({ memberId, firstName, email, onClose }: { memberId: string; firstName: string; email: string; onClose: () => void }) {
  const [subject, setSubject] = useState('')
  const [body, setBody]       = useState(`Hallo ${firstName},\n\n`)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [done, setDone]       = useState(false)

  async function send() {
    if (!subject.trim() || body.trim().length < 5) {
      setError('Betreff und Nachricht (min. 5 Zeichen) sind erforderlich.')
      return
    }
    setBusy(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Nicht eingeloggt')
      const res = await fetch(`/api/members/${memberId}/mail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDone(true)
      setTimeout(() => onClose(), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Versand fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
         onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="min-w-0">
            <p className="font-bold text-zinc-900 text-sm">E-Mail an {firstName}</p>
            <p className="text-xs text-zinc-400 truncate">{email}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 disabled:opacity-50">✕</button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Check size={26} className="text-emerald-600" />
            </div>
            <p className="font-bold text-zinc-900">Mail verschickt</p>
            <p className="text-xs text-zinc-500 mt-1">Empfänger: {email}</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Betreff *</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value.slice(0, 200))}
                placeholder="z.B. Wichtige Info zum Training"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Nachricht *</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value.slice(0, 20000))}
                rows={8}
                placeholder="Deine Nachricht…"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-y"
              />
              <p className="text-[10px] text-zinc-400 mt-1">{body.length}/20.000 Zeichen</p>
            </div>
            {error && (
              <div className="text-xs p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{error}</div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={onClose} disabled={busy}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50">
                Abbrechen
              </button>
              <button onClick={send} disabled={busy || !subject.trim() || body.trim().length < 5}
                className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white font-bold text-sm flex items-center justify-center gap-2">
                {busy ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Mail size={14} />}
                {busy ? 'Versende…' : 'Senden'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WhatsAppCompose({ firstName, phone, onClose }: { firstName: string; phone: string; onClose: () => void }) {
  const { t: tl } = useLanguage()
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-[#25D366]">
          <div className="flex items-center gap-2 text-white">
            <MessageCircle size={18} />
            <span className="font-bold">{tl('memberDetailExtra', 'waTo')} {firstName}</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{tl('memberDetailExtra', 'waTemplate')}</p>
            <div className="grid grid-cols-1 gap-1.5">
              {WA_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => { setSelected(t.id); setCustomText('') }}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selected === t.id ? 'bg-[#25D366]/10 text-[#128C7E] font-semibold border border-[#25D366]/30' : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{tl('memberDetailExtra', 'waEditMessage')}</p>
            <textarea
              value={customText || template.text(firstName)}
              onChange={e => setCustomText(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm focus:outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 resize-none"
            />
          </div>
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold text-sm transition-colors">
            <MessageCircle size={16} /> {tl('memberDetailExtra', 'waOpenButton')}
          </a>
        </div>
      </div>
    </div>
  )
}

function PortalLinkSection({ token }: { token: string }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const portalUrl = `${appUrl}/portal/${token}`

  function copy() {
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Link2 size={13} className="text-amber-600" />
          </span>
          <p className="text-sm font-semibold text-zinc-800">{t('memberDetailExtra', 'memberArea')}</p>
        </div>
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-amber-600 hover:text-amber-500 font-medium flex items-center gap-1"
        >
          <ExternalLink size={12} /> {t('memberDetailExtra', 'open')}
        </a>
      </div>
      <p className="text-zinc-500 text-xs mb-3">
        {t('memberDetailExtra', 'portalLinkDesc')}
      </p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={portalUrl}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-600 text-xs font-mono focus:outline-none truncate"
        />
        <button
          onClick={copy}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
            copied ? 'bg-green-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-white'
          }`}
        >
          {copied ? <><Check size={12} /> {t('memberDetailExtra', 'copied')}</> : <><Copy size={12} /> {t('memberDetailExtra', 'copy')}</>}
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
  const { t, lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'
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
    <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <CalendarDays size={13} className="text-amber-600" />
          </span>
          <p className="text-sm font-semibold text-zinc-800">{t('memberDetail', 'contractEnd')}</p>
        </div>
        <button
          onClick={() => { setEditing(e => !e); setValue(contractEndDate ?? '') }}
          className="text-xs text-amber-600 hover:text-amber-500 font-medium"
        >
          {editing ? t('memberDetailExtra', 'cancel') : t('memberDetailExtra', 'edit')}
        </button>
      </div>

      {editing ? (
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {saving ? t('memberDetailExtra', 'saving') : t('memberDetailExtra', 'save')}
          </button>
        </div>
      ) : (
        <div>
          <p className="text-zinc-900 font-semibold text-sm">
            {contractEndDate ? new Date(contractEndDate).toLocaleDateString(locale) : '—'}
          </p>
          {isExpired && (
            <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {t('memberDetailExtra', 'contractExpiredDays', { n: String(Math.abs(Math.floor(diffDays!))) })}
            </div>
          )}
          {isExpiring && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
              {t('memberDetailExtra', 'contractExpiresDays', { n: String(Math.floor(diffDays!)) })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
