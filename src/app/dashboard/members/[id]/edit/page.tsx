'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Save } from 'lucide-react'
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

export default function EditMemberPage() {
  const params = useParams()
  const router = useRouter()
  const { t, lang } = useLanguage()
  const id = params.id as string

  const BELT_LABELS: Record<Belt, string> = {
    white:  lang === 'en' ? 'White'  : 'Weiss',
    blue:   lang === 'en' ? 'Blue'   : 'Blau',
    purple: lang === 'en' ? 'Purple' : 'Lila',
    brown:  lang === 'en' ? 'Brown'  : 'Braun',
    black:  lang === 'en' ? 'Black'  : 'Schwarz',
  }

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [parentMemberId, setParentMemberId] = useState('')
  const [allMembers, setAllMembers] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    date_of_birth: '', join_date: '', belt: 'white' as Belt, stripes: 0,
    notes: '', contract_end_date: '',
    address: '', emergency_contact_name: '', emergency_contact_phone: '',
    monthly_fee_override_cents: '',
    membership_source: 'direct' as MembershipSource,
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from('members').select('*').eq('id', id).single()
      if (data) {
        const d = data as Record<string, unknown>
        setForm({
          first_name:                String(d.first_name ?? ''),
          last_name:                 String(d.last_name ?? ''),
          email:                     String(d.email ?? ''),
          phone:                     String(d.phone ?? ''),
          date_of_birth:             String(d.date_of_birth ?? ''),
          join_date:                 String(d.join_date ?? ''),
          belt:                      (d.belt as Belt) ?? 'white',
          stripes:                   Number(d.stripes ?? 0),
          notes:                     String(d.notes ?? ''),
          contract_end_date:         String(d.contract_end_date ?? ''),
          address:                   String(d.address ?? ''),
          emergency_contact_name:    String(d.emergency_contact_name ?? ''),
          emergency_contact_phone:   String(d.emergency_contact_phone ?? ''),
          monthly_fee_override_cents: d.monthly_fee_override_cents
            ? String(Number(d.monthly_fee_override_cents) / 100)
            : '',
          membership_source: ((d.membership_source as MembershipSource) ?? 'direct') as MembershipSource,
        })
        setParentMemberId(String(d.parent_member_id ?? ''))
      }

      // Load all active members for parent dropdown
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: gymData } = await supabase
          .from('gyms')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle()
        if (gymData) {
          const { data: membersData } = await supabase.from('members').select('id, first_name, last_name').eq('gym_id', gymData.id).eq('is_active', true).order('first_name')
          if (membersData) setAllMembers(membersData)
        }
      }

      setLoading(false)
    }
    load()
  }, [id])

  function set(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Wellpass/Hansefit/EGYM = nur Erwachsene
  const sourceCfg = SOURCE_OPTIONS.find(o => o.value === form.membership_source)
  const ageBlocked = !!(sourceCfg?.adultOnly && form.date_of_birth && isMinor(form.date_of_birth))
  const memberAge = form.date_of_birth ? calculateAge(form.date_of_birth) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (ageBlocked) {
      setError(`${sourceCfg?.label} ist nur für Erwachsene zulässig — Anbieter-Vertrag verbietet Minderjährige.`)
      return
    }
    setSaving(true); setError('')
    const supabase = createClient()

    const overrideCents = form.monthly_fee_override_cents
      ? Math.round(parseFloat(form.monthly_fee_override_cents.replace(',', '.')) * 100)
      : null

    const { error: err } = await (supabase.from('members') as any).update({
      first_name:                form.first_name.trim(),
      last_name:                 form.last_name.trim(),
      email:                     form.email.trim().toLowerCase() || null,
      phone:                     form.phone.trim() || null,
      date_of_birth:             form.date_of_birth || null,
      join_date:                 form.join_date,
      belt:                      form.belt,
      stripes:                   form.stripes,
      notes:                     form.notes.trim() || null,
      contract_end_date:         form.contract_end_date || null,
      address:                   form.address.trim() || null,
      emergency_contact_name:    form.emergency_contact_name.trim() || null,
      emergency_contact_phone:   form.emergency_contact_phone.trim() || null,
      monthly_fee_override_cents: overrideCents,
      parent_member_id: parentMemberId || null,
      membership_source:         form.membership_source,
    }).eq('id', id)

    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/dashboard/members/${id}`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">{t('memberForm', 'loading')}</div>
  )

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="mb-6">
        <Link href={`/dashboard/members/${id}`} className="text-slate-400 hover:text-slate-600 text-sm">{t('memberForm', 'back')}</Link>
        <h1 className="text-xl font-bold text-slate-900 mt-3">{t('memberForm', 'editMember')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Personal data */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('memberForm', 'personalData')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('memberForm', 'firstNameReq')} value={form.first_name} onChange={v => set('first_name', v)} required />
            <Field label={t('memberForm', 'lastNameReq')} value={form.last_name} onChange={v => set('last_name', v)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('memberForm', 'email')} type="email" value={form.email} onChange={v => set('email', v)} placeholder="max@gym.de" />
            <Field label={t('memberForm', 'phone')} value={form.phone} onChange={v => set('phone', v)} placeholder="+49 170 1234567" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('memberForm', 'dateOfBirth')} type="date" value={form.date_of_birth} onChange={v => set('date_of_birth', v)} />
            <Field label={t('memberForm', 'joinDateReq')} type="date" value={form.join_date} onChange={v => set('join_date', v)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('memberForm', 'parent')}</label>
            <select
              value={parentMemberId}
              onChange={e => setParentMemberId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">{t('memberForm', 'noParent')}</option>
              {allMembers.filter(m => m.id !== id).map(m => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
              ))}
            </select>
          </div>
          <Field label={t('memberForm', 'address')} value={form.address} onChange={v => set('address', v)} placeholder="Musterstraße 1, 80331 München" />
        </div>

        {/* Emergency contact */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('memberForm', 'emergency')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('memberForm', 'emergencyName')} value={form.emergency_contact_name} onChange={v => set('emergency_contact_name', v)} placeholder="Anna Mustermann" />
            <Field label={t('memberForm', 'emergencyPhone')} value={form.emergency_contact_phone} onChange={v => set('emergency_contact_phone', v)} placeholder="+49 170 9876543" />
          </div>
        </div>

        {/* Belt */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('memberForm', 'beltStripes')}</p>
          <div className="flex flex-wrap gap-2">
            {BELTS.map(b => (
              <button key={b} type="button" onClick={() => set('belt', b)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${BELT_CLASSES[b]} ${
                  form.belt === b ? 'ring-2 ring-amber-400 ring-offset-1 scale-105' : 'opacity-60 hover:opacity-100'
                }`}>
                {BELT_LABELS[b]}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('memberForm', 'stripes')}: <span className="text-amber-600 font-bold">{form.stripes}</span>
            </label>
            <input type="range" min={0} max={4} value={form.stripes}
              onChange={e => set('stripes', Number(e.target.value))}
              className="w-full accent-amber-500" />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              {[0,1,2,3,4].map(n => <span key={n}>{n}</span>)}
            </div>
          </div>
        </div>

        {/* Contract & billing */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('memberForm', 'contractBilling')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('memberForm', 'contractEnd')} type="date" value={form.contract_end_date} onChange={v => set('contract_end_date', v)} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('memberForm', 'individualFee')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                <input
                  type="text"
                  value={form.monthly_fee_override_cents}
                  onChange={e => set('monthly_fee_override_cents', e.target.value)}
                  placeholder={t('memberForm', 'standard')}
                  className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{t('memberForm', 'feeDefault')}</p>
            </div>
          </div>
        </div>

        {/* Mitgliedschaftsart */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mitgliedschaftsart</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quelle</label>
            <select
              value={form.membership_source}
              onChange={e => set('membership_source', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
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
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-800">
              <p className="font-bold">{sourceCfg?.label} blockiert: Mitglied ist {memberAge} Jahre.</p>
              <p className="text-xs mt-0.5 opacity-80">
                Anbieter-Verträge erlauben nur Erwachsene (Arbeitgeber-Tarif).
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <label className="block text-sm font-medium text-slate-700 mb-2">{t('memberForm', 'notes')}</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder={t('memberForm', 'notesPlaceholder')}
            className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 resize-none"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving || ageBlocked}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-2 text-sm">
            <Save size={15} />
            {saving ? t('memberForm', 'saving') : t('memberForm', 'saveChanges')}
          </button>
          <Link href={`/dashboard/members/${id}`}
            className="px-5 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors">
            {t('memberForm', 'cancel')}
          </Link>
        </div>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-sm"
      />
    </div>
  )
}
