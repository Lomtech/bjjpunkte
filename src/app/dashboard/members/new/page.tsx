'use client'

import { useState, useEffect, Suspense, useId } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Belt, MembershipSource } from '@/types/database'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { calculateAge, isMinor } from '@/lib/age'

const SOURCE_OPTIONS: { value: MembershipSource; label: string; hint?: string; adultOnly?: boolean }[] = [
  { value: 'direct',        label: 'Direktes Mitglied' },
  { value: 'wellpass',      label: 'Wellpass',       hint: 'Arbeitgeber zahlt · nur Erwachsene · kein SEPA',  adultOnly: true },
  { value: 'hansefit',      label: 'Hansefit',       hint: 'Arbeitgeber zahlt · nur Erwachsene · kein SEPA',  adultOnly: true },
  { value: 'egym',          label: 'EGYM Wellpass',  hint: 'Arbeitgeber zahlt · nur Erwachsene · kein SEPA',  adultOnly: true },
  { value: 'urban_sports',  label: 'Urban Sports Club', hint: 'Anbieter zahlt · kein SEPA' },
]

const BELTS: Belt[] = ['white', 'blue', 'purple', 'brown', 'black']
const BELT_CLASSES: Record<Belt, string> = {
  white:  'bg-slate-100 text-slate-700 border border-slate-300',
  blue:   'bg-blue-600 text-white',
  purple: 'bg-purple-600 text-white',
  brown:  'bg-amber-900 text-white',
  black:  'bg-slate-900 text-amber-400',
}

function NewMemberForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, lang } = useLanguage()

  const BELT_LABELS: Record<Belt, string> = {
    white:  lang === 'en' ? 'White'  : 'Weiss',
    blue:   lang === 'en' ? 'Blue'   : 'Blau',
    purple: lang === 'en' ? 'Purple' : 'Lila',
    brown:  lang === 'en' ? 'Brown'  : 'Braun',
    black:  lang === 'en' ? 'Black'  : 'Schwarz',
  }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parentMemberId, setParentMemberId] = useState('')
  const [allMembers, setAllMembers] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [beltEnabled, setBeltEnabled] = useState(true)
  const [stripesEnabled, setStripesEnabled] = useState(true)
  const [form, setForm] = useState({
    first_name: searchParams.get('firstName') ?? '',
    last_name: searchParams.get('lastName') ?? '',
    email: searchParams.get('email') ?? '',
    phone: '',
    date_of_birth: '', join_date: new Date().toISOString().split('T')[0],
    belt: 'white' as Belt, stripes: 0, notes: '',
    contract_end_date: '',
    membership_source: 'direct' as MembershipSource,
  })

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  useEffect(() => {
    async function loadMembers() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: gym } = await supabase
        .from('gyms')
        .select('id, plan_member_limit, belt_system_enabled, stripes_enabled')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (!gym) return
      const gymId = gym.id
      setBeltEnabled((gym as any)?.belt_system_enabled ?? true)
      setStripesEnabled((gym as any)?.stripes_enabled ?? true)
      const { data: membersData } = await supabase.from('members').select('id, first_name, last_name').eq('gym_id', gymId).eq('is_active', true).order('first_name')
      if (membersData) setAllMembers(membersData)
      // Check plan limit
      const limit = (gym as any)?.plan_member_limit ?? 30
      const { count: activeCount } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', gymId).eq('is_active', true)
      if ((activeCount ?? 0) >= limit) {
        setError(t('memberForm', 'planLimitReached', { limit: String(limit) }))
      }
    }
    loadMembers()
  }, [])

  // Hard-Check: Wellpass/Hansefit/EGYM = nur Erwachsene (Arbeitgeber-Tarif).
  // Eingaben fühlen sich falsch an, Konsequenzen sind real (Vertragsbruch).
  const sourceCfg = SOURCE_OPTIONS.find(o => o.value === form.membership_source)
  const ageBlocked = !!(sourceCfg?.adultOnly && form.date_of_birth && isMinor(form.date_of_birth))
  const memberAge = form.date_of_birth ? calculateAge(form.date_of_birth) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (ageBlocked) {
      setError(`${sourceCfg?.label} ist nur für Erwachsene zulässig — der Anbieter-Vertrag verbietet Minderjährige (Arbeitgeber-Tarif).`)
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ ...form, parent_member_id: parentMemberId || null }),
    })
    if (!res.ok) {
      const err = await res.json()
      if (err.error === 'PLAN_LIMIT_REACHED') setError(t('memberForm', 'planLimitShort', { limit: String(err.limit) }))
      else setError(err.error ?? t('memberForm', 'saving'))
      setLoading(false); return
    }
    router.push('/dashboard/members'); router.refresh()
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <Link href="/dashboard/members" className="text-slate-400 hover:text-slate-600 text-sm">{t('memberForm', 'back')}</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-3">{t('memberForm', 'newMember')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('memberForm', 'personalData')}</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('memberForm', 'firstNameReq')} value={form.first_name} onChange={v => set('first_name', v)} required placeholder="Max" />
            <Field label={t('memberForm', 'lastNameReq')} value={form.last_name} onChange={v => set('last_name', v)} required placeholder="Mustermann" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('memberForm', 'email')} value={form.email} onChange={v => set('email', v)} type="email" placeholder="max@gym.de" />
            <Field label={t('memberForm', 'phone')} value={form.phone} onChange={v => set('phone', v)} placeholder="+49 170 1234567" />
          </div>
          <div>
            <label htmlFor="member-parent-select" className="block text-sm font-medium text-slate-700 mb-1">{t('memberForm', 'parent')}</label>
            <select
              id="member-parent-select"
              value={parentMemberId}
              onChange={e => setParentMemberId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">{t('memberForm', 'noParent')}</option>
              {allMembers.map(m => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('memberForm', 'dateOfBirth')} value={form.date_of_birth} onChange={v => set('date_of_birth', v)} type="date" />
            <Field label={t('memberForm', 'joinDate')} value={form.join_date} onChange={v => set('join_date', v)} type="date" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('memberForm', 'contractEnd')} value={form.contract_end_date} onChange={v => set('contract_end_date', v)} type="date" />
          </div>
        </div>

        {/* Mitgliedschaftsart: direct / wellpass / hansefit / egym / urban_sports */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mitgliedschaftsart</p>
          <div>
            <label htmlFor="member-source-select" className="block text-sm font-medium text-slate-700 mb-1.5">Quelle</label>
            <select
              id="member-source-select"
              value={form.membership_source}
              onChange={e => set('membership_source', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            >
              {SOURCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {sourceCfg?.hint && (
              <p className="text-xs text-slate-500 mt-1.5">{sourceCfg.hint}</p>
            )}
          </div>
          {ageBlocked && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-800">
              <p className="font-bold">{sourceCfg?.label} blockiert: Mitglied ist {memberAge} Jahre.</p>
              <p className="text-xs mt-0.5 opacity-80">
                Anbieter-Verträge erlauben nur Erwachsene (Arbeitgeber-Tarif). Wähle „Direktes Mitglied&ldquo;
                oder lass den Erziehungsberechtigten den Vertrag direkt mit dem Studio abschließen.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('memberForm', 'beltStripes')}</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('memberForm', 'belt')}</label>
            <div className="flex flex-wrap gap-2">
              {BELTS.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => set('belt', b)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${BELT_CLASSES[b]} ${
                    form.belt === b ? 'ring-2 ring-amber-400 ring-offset-1 scale-105' : 'opacity-60 hover:opacity-90'
                  }`}
                >
                  {BELT_LABELS[b]}
                </button>
              ))}
            </div>
          </div>
          {stripesEnabled && (
            <div>
              <label htmlFor="member-stripes-range" className="block text-sm font-medium text-slate-700 mb-2">{t('memberForm', 'stripes')}: <span className="text-amber-600 font-bold">{form.stripes}</span></label>
              <input
                id="member-stripes-range"
                type="range" min={0} max={4} value={form.stripes}
                onChange={e => set('stripes', Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                {[0,1,2,3,4].map(n => <span key={n}>{n}</span>)}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <label htmlFor="member-notes-textarea" className="block text-sm font-medium text-slate-700 mb-2">{t('memberForm', 'notes')}</label>
          <textarea
            id="member-notes-textarea"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 resize-none"
            placeholder={t('memberForm', 'notesPlaceholder')}
          />
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm space-y-2">
            <p className="font-medium">{error}</p>
            <a
              href="/pricing"
              target="_blank"
              className="inline-block px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              {t('memberForm', 'viewPlans')}
            </a>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || ageBlocked}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors shadow-sm"
          >
            {loading ? t('memberForm', 'saving') : t('memberForm', 'saveMember')}
          </button>
          <Link
            href="/dashboard/members"
            className="px-6 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium transition-colors"
          >
            {t('memberForm', 'cancel')}
          </Link>
        </div>
      </form>
    </div>
  )
}

export default function NewMemberPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">…</div>}>
      <NewMemberForm />
    </Suspense>
  )
}

function Field({ label, value, onChange, type = 'text', required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; placeholder?: string
}) {
  const fieldId = useId()
  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        id={fieldId}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-sm"
      />
    </div>
  )
}
