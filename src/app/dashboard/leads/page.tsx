'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Trash2, MessageCircle, Phone, Mail, Pencil, Link2 } from 'lucide-react'
import Link from 'next/link'

import { toWaPhone } from '@/lib/phone'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { ConfirmModal } from '@/components/ConfirmModal'

type LeadStatus = 'new' | 'contacted' | 'trial_scheduled' | 'trial_done' | 'converted' | 'lost'
type LeadSource = 'walk-in' | 'referral' | 'instagram' | 'website' | 'other' | 'signup_link' | 'public_page'

const STATUS_COLORS: Record<LeadStatus, string> = {
  new:             'bg-zinc-100 text-zinc-600 border-zinc-200',
  contacted:       'bg-zinc-200 text-zinc-700 border-zinc-300',
  trial_scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
  trial_done:      'bg-amber-100 text-amber-800 border-amber-200',
  converted:       'bg-zinc-900 text-white border-zinc-900',
  lost:            'bg-zinc-100 text-zinc-400 border-zinc-200',
}

const SOURCE_COLORS: Partial<Record<LeadSource, string>> = {
  signup_link: 'bg-amber-50 text-amber-700 border-amber-200',
  public_page: 'bg-amber-50 text-amber-700 border-amber-200',
}

const STATUS_ORDER: LeadStatus[] = ['new', 'contacted', 'trial_scheduled', 'trial_done', 'converted', 'lost']

interface Lead {
  id: string
  gym_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  source: LeadSource
  status: LeadStatus
  notes: string | null
  trial_date: string | null
  referred_by: string | null
  created_at: string
  contacted_at: string | null
  converted_at: string | null
  lead_token: string | null
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function LeadsPage() {
  const { t, lang } = useLanguage()
  const locale = lang === 'en' ? 'en-GB' : 'de-DE'

  const STATUS_LABELS: Record<LeadStatus, string> = {
    new:             t('leads', 'statusNew'),
    contacted:       t('leads', 'statusContacted'),
    trial_scheduled: t('leads', 'statusTrialScheduled'),
    trial_done:      t('leads', 'statusTrialDone'),
    converted:       t('leads', 'statusConverted'),
    lost:            t('leads', 'statusLost'),
  }

  const SOURCE_LABELS: Record<LeadSource, string> = {
    'walk-in':    t('leads', 'sourceWalkin'),
    referral:     t('leads', 'sourceReferral'),
    instagram:    t('leads', 'sourceInstagram'),
    website:      t('leads', 'sourceWebsite'),
    other:        t('leads', 'sourceOther'),
    signup_link:  t('leads', 'sourceSignup'),
    public_page:  t('leads', 'sourcePublic'),
  }

  const [leads, setLeads]           = useState<Lead[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)

  // inline edit state
  const [editNotes, setEditNotes]   = useState<Record<string, string>>({})

  // edit modal state
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    source: 'walk-in' as LeadSource, trial_date: '', referred_by: '', notes: '',
  })
  const [editSaving, setEditSaving] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; danger?: boolean; icon?: React.ReactNode; onConfirm: () => void
  }>({ open: false, title: '', onConfirm: () => {} })
  function askConfirm(opts: { title: string; danger?: boolean; icon?: React.ReactNode; onConfirm: () => void }) {
    setConfirmState({ ...opts, open: true })
  }
  function closeConfirm() { setConfirmState(s => ({ ...s, open: false })) }

  // form state
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    source: 'walk-in' as LeadSource, trial_date: '', referred_by: '', notes: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: gym } = await supabase
        .from('gyms')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()
      if (!gym) { setLoading(false); return }
      const { data } = await supabase.from('leads')
        .select('*').eq('gym_id', gym.id).order('created_at', { ascending: false }).limit(500)
      if (data) {
        setLeads(data)
        const notes: Record<string, string> = {}
        for (const l of data) notes[l.id] = l.notes ?? ''
        setEditNotes(notes)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { data: gym } = await supabase
      .from('gyms')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()
    if (!gym) { setSaving(false); return }
    const body: Record<string, unknown> = { gym_id: gym.id }
    for (const [k, v] of Object.entries(form)) {
      if (v) body[k] = v
    }
    const { data: lead } = await supabase.from('leads').insert(body as never).select().single()
    if (lead) {
      setLeads(prev => [lead, ...prev])
      setEditNotes(prev => ({ ...prev, [lead.id]: lead.notes ?? '' }))
      setForm({ first_name: '', last_name: '', email: '', phone: '', source: 'walk-in', trial_date: '', referred_by: '', notes: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function updateStatus(lead: Lead, status: LeadStatus) {
    const sb = createClient()
    const extra: Record<string, string> = {}
    if (status === 'contacted' && !lead.contacted_at) extra.contacted_at = new Date().toISOString()
    if (status === 'converted' && !lead.converted_at) extra.converted_at = new Date().toISOString()
    const { data: updated } = await sb.from('leads').update({ status, ...extra } as never).eq('id', lead.id).select().single()
    if (updated) setLeads(prev => prev.map(l => l.id === lead.id ? updated : l))
  }

  async function saveNotes(lead: Lead) {
    const notes = editNotes[lead.id] ?? ''
    if (notes === (lead.notes ?? '')) return
    const sb = createClient()
    const { data: updated } = await sb.from('leads').update({ notes } as never).eq('id', lead.id).select().single()
    if (updated) setLeads(prev => prev.map(l => l.id === lead.id ? updated : l))
  }

  function openEdit(lead: Lead) {
    setEditingLead(lead)
    setEditForm({
      first_name:  lead.first_name,
      last_name:   lead.last_name,
      email:       lead.email ?? '',
      phone:       lead.phone ?? '',
      source:      lead.source,
      trial_date:  lead.trial_date ? lead.trial_date.slice(0, 10) : '',
      referred_by: lead.referred_by ?? '',
      notes:       lead.notes ?? '',
    })
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingLead) return
    setEditSaving(true)
    const sb = createClient()
    const body: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(editForm)) body[k] = v || null
    body.first_name = editForm.first_name
    body.last_name  = editForm.last_name
    const { data: updated } = await sb.from('leads').update(body as never).eq('id', editingLead.id).select().single()
    if (updated) {
      setLeads(prev => prev.map(l => l.id === editingLead.id ? updated : l))
      setEditNotes(prev => ({ ...prev, [updated.id]: updated.notes ?? '' }))
    }
    setEditSaving(false)
    setEditingLead(null)
  }

  function deleteLead(id: string) {
    askConfirm({
      title: t('leads', 'delete') + '?',
      danger: true,
      icon: '🗑️',
      onConfirm: async () => { closeConfirm(); await createClient().from('leads').delete().eq('id', id); setLeads(prev => prev.filter(l => l.id !== id)) },
    })
  }

  // KPI counts
  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length
    return acc
  }, {} as Record<LeadStatus, number>)

  // Sort leads: by status order, then by created_at desc
  const sorted = [...leads].sort((a, b) => {
    const si = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    if (si !== 0) return si
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  if (loading) return <div className="flex items-center justify-center h-full text-zinc-400 text-sm">{t('common', 'loading')}</div>

  return (
    <div className="p-4 md:p-6">
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        confirmLabel={lang === 'en' ? 'Delete' : 'Löschen'}
        cancelLabel={lang === 'en' ? 'Cancel' : 'Abbrechen'}
        danger={confirmState.danger}
        icon={confirmState.icon}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-amber-500 flex-shrink-0" />
            <h1 className="text-xl font-bold text-zinc-900">{t('leads', 'title')}</h1>
          </div>
          <p className="text-zinc-400 text-xs mt-0.5">{leads.length} {lang === 'en' ? 'total' : 'gesamt'} · {counts.new} {lang === 'en' ? 'new' : 'neu'} · {counts.converted} {lang === 'en' ? 'converted' : 'konvertiert'}</p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors flex-shrink-0">
          <UserPlus size={14} />
          {t('leads', 'addLead')}
        </button>
      </div>

      {/* KPI chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_ORDER.map(s => (
          <span key={s} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[s]}`}>
            {STATUS_LABELS[s]}
            <span className="font-bold">{counts[s]}</span>
          </span>
        ))}
      </div>

      {/* Probetraining-Conversion-Funnel —
          Misst, wie effektiv das Studio neue Leads in Mitglieder konvertiert.
          Aus CSC-FFB-Pain-Point-Liste: „kein Probetraining-Tracking & Auswertung". */}
      {leads.length > 0 && (() => {
        const totalLeads      = leads.length
        const trialScheduled  = counts.trial_scheduled + counts.trial_done + counts.converted
        const trialDone       = counts.trial_done + counts.converted
        const converted       = counts.converted
        const lost            = counts.lost

        const pct = (n: number, base: number) => base > 0 ? Math.round((n / base) * 100) : 0
        const showRate = pct(trialScheduled, totalLeads)
        const tDoneRate = pct(trialDone, trialScheduled)
        const convRate  = pct(converted, trialDone)
        const lostRate  = pct(lost, totalLeads)

        const FUNNEL = [
          { label: lang === 'en' ? 'All leads'         : 'Alle Leads',         value: totalLeads,     pct: 100,        tone: 'zinc' },
          { label: lang === 'en' ? 'Trial scheduled'   : 'Probetraining geplant', value: trialScheduled, pct: showRate,   tone: 'amber' },
          { label: lang === 'en' ? 'Trial done'        : 'Probetraining absolviert', value: trialDone,      pct: tDoneRate,  tone: 'amber' },
          { label: lang === 'en' ? 'Converted'         : 'Mitglied geworden', value: converted,      pct: convRate,   tone: 'emerald' },
        ]
        const TONE: Record<string, string> = {
          zinc:    'bg-zinc-100   text-zinc-700',
          amber:   'bg-amber-100  text-amber-800',
          emerald: 'bg-emerald-100 text-emerald-800',
        }
        return (
          <div className="mb-4 bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                {lang === 'en' ? 'Conversion funnel' : 'Conversion-Funnel'}
              </h2>
              <p className="text-[10px] text-zinc-400">
                {lang === 'en' ? 'How leads move toward membership' : 'Wie Leads zur Mitgliedschaft werden'}
              </p>
            </div>
            <div className="p-5 space-y-2.5">
              {FUNNEL.map((row, idx) => {
                const isFirst = idx === 0
                const stageRate = isFirst ? null : row.pct
                const widthPct = isFirst ? 100 : pct(row.value, totalLeads)
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span className="font-semibold text-zinc-700">{row.label}</span>
                      <span className="tabular-nums text-zinc-500">
                        <span className="font-black text-zinc-900">{row.value}</span>
                        {stageRate !== null && (
                          <span className="ml-2 text-[10px] text-zinc-400">
                            {stageRate}% {lang === 'en' ? 'conversion' : 'Übergang'}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${TONE[row.tone]}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              {/* Lost-Rate als Warnung */}
              {lost > 0 && (
                <div className="pt-3 mt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">{lang === 'en' ? 'Lost / churned' : 'Verloren / nicht angefangen'}</span>
                  <span className="font-mono text-rose-600">
                    {lost} ({lostRate}%)
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* New lead form */}
      {showForm && (
        <div className="mb-4 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <p className="font-semibold text-zinc-900 text-sm">{t('leads', 'addLead')}</p>
          </div>
          <form onSubmit={handleCreate} className="p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{lang === 'en' ? 'First name *' : 'Vorname *'}</label>
                <input
                  required value={form.first_name}
                  onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="Max"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{lang === 'en' ? 'Last name *' : 'Nachname *'}</label>
                <input
                  required value={form.last_name}
                  onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="Mustermann"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{t('leads', 'email')}</label>
                <input
                  type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="max@example.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{t('leads', 'phone')}</label>
                <input
                  type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+49 151 234567"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{t('leads', 'source')}</label>
                <select
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value as LeadSource }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100">
                  <option value="walk-in">{t('leads', 'sourceWalkin')}</option>
                  <option value="referral">{t('leads', 'sourceReferral')}</option>
                  <option value="instagram">{t('leads', 'sourceInstagram')}</option>
                  <option value="website">{t('leads', 'sourceWebsite')}</option>
                  <option value="other">{t('leads', 'sourceOther')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{lang === 'en' ? 'Trial date' : 'Probetraining-Datum'}</label>
                <input
                  type="date" value={form.trial_date}
                  onChange={e => setForm(f => ({ ...f, trial_date: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">{lang === 'en' ? 'Referred by' : 'Empfohlen von'}</label>
              <input
                value={form.referred_by}
                onChange={e => setForm(f => ({ ...f, referred_by: e.target.value }))}
                placeholder={lang === 'en' ? 'Member name' : 'Name des Mitglieds'}
                className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">{t('leads', 'notes')}</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder={lang === 'en' ? 'First impressions, goals, …' : 'Erste Eindrücke, Ziele, …'}
                className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
                {saving ? t('common', 'save') + '…' : t('common', 'save')}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 sm:flex-none px-4 py-2.5 min-h-[44px] rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium text-sm transition-colors">
                {t('common', 'cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lead cards */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-zinc-200 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <UserPlus size={20} className="text-amber-500" />
          </div>
          <p className="text-zinc-900 font-semibold text-sm mb-1">{t('leads', 'noLeads')}</p>
          <p className="text-zinc-400 text-xs mb-4">{lang === 'en' ? 'Add your first lead.' : 'Füge deinen ersten Interessenten hinzu.'}</p>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm">
            <UserPlus size={14} /> {t('leads', 'addLead')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(lead => (
            <div key={lead.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-5 py-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-amber-600">
                    {lead.first_name?.[0] ?? '?'}{lead.last_name?.[0] ?? ''}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-zinc-900 text-sm">{lead.first_name} {lead.last_name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${SOURCE_COLORS[lead.source] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </span>
                    <span className="text-xs text-zinc-400">{lang === 'en' ? `${daysSince(lead.created_at)}d ago` : `vor ${daysSince(lead.created_at)}d`}</span>
                  </div>

                  {/* Status + contacts row */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {/* Inline status dropdown */}
                    <select
                      value={lead.status}
                      onChange={e => updateStatus(lead, e.target.value as LeadStatus)}
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none ${STATUS_COLORS[lead.status]}`}
                      style={{ appearance: 'auto' }}>
                      {STATUS_ORDER.map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>

                    {lead.phone && (
                      <a href={`tel:${lead.phone}`}
                        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors">
                        <Phone size={11} />{lead.phone}
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`}
                        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors">
                        <Mail size={11} />{lead.email}
                      </a>
                    )}
                  </div>

                  {/* Trial date + referred by */}
                  {(lead.trial_date || lead.referred_by) && (
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {lead.trial_date && (
                        <span className="text-xs text-zinc-400">
                          {lang === 'en' ? 'Trial' : 'Probetraining'}: {new Date(lead.trial_date).toLocaleDateString(locale)}
                        </span>
                      )}
                      {lead.referred_by && (
                        <span className="text-xs text-zinc-400">
                          {lang === 'en' ? 'Referred by' : 'Empfohlen von'}: {lead.referred_by}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <textarea
                    value={editNotes[lead.id] ?? ''}
                    onChange={e => setEditNotes(prev => ({ ...prev, [lead.id]: e.target.value }))}
                    onBlur={() => saveNotes(lead)}
                    rows={1}
                    placeholder={lang === 'en' ? 'Add notes…' : 'Notizen hinzufügen…'}
                    className="mt-2 w-full px-2.5 py-1.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-xs text-zinc-700 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  {lead.lead_token && (
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/lead/${lead.lead_token}`
                        navigator.clipboard.writeText(url).catch(() => {})
                      }}
                      title={lang === 'en' ? 'Copy portal link' : 'Portal-Link kopieren'}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                      <Link2 size={14} />
                    </button>
                  )}
                  {lead.phone && (
                    <a
                      href={`https://wa.me/${toWaPhone(lead.phone)}?text=${encodeURIComponent(`Hallo ${lead.first_name}! 👋`)}`}
                      target="_blank" rel="noopener noreferrer"
                      title="WhatsApp"
                      className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-50 transition-colors">
                      <MessageCircle size={15} />
                    </a>
                  )}
                  {lead.status === 'converted' && (
                    <Link
                      href={`/dashboard/members/new?firstName=${encodeURIComponent(lead.first_name)}&lastName=${encodeURIComponent(lead.last_name)}&email=${encodeURIComponent(lead.email ?? '')}`}
                      className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-700 text-white text-[11px] font-semibold transition-colors whitespace-nowrap">
                      {t('leads', 'convert')}
                    </Link>
                  )}
                  <button
                    onClick={() => openEdit(lead)}
                    title={t('leads', 'editLead')}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteLead(lead.id)}
                    title={t('leads', 'delete')}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90dvh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <p className="font-semibold text-zinc-900 text-sm">{lang === 'en' ? 'Edit lead' : 'Interessent bearbeiten'}</p>
              <button onClick={() => setEditingLead(null)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors">
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">{lang === 'en' ? 'First name *' : 'Vorname *'}</label>
                  <input required value={editForm.first_name}
                    onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">{lang === 'en' ? 'Last name *' : 'Nachname *'}</label>
                  <input required value={editForm.last_name}
                    onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">{t('leads', 'email')}</label>
                  <input type="email" value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">{t('leads', 'phone')}</label>
                  <input type="tel" value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">{t('leads', 'source')}</label>
                  <select value={editForm.source}
                    onChange={e => setEditForm(f => ({ ...f, source: e.target.value as LeadSource }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100">
                    <option value="walk-in">{t('leads', 'sourceWalkin')}</option>
                    <option value="referral">{t('leads', 'sourceReferral')}</option>
                    <option value="instagram">{t('leads', 'sourceInstagram')}</option>
                    <option value="website">{t('leads', 'sourceWebsite')}</option>
                    <option value="other">{t('leads', 'sourceOther')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">{lang === 'en' ? 'Trial date' : 'Probetraining'}</label>
                  <input type="date" value={editForm.trial_date}
                    onChange={e => setEditForm(f => ({ ...f, trial_date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{lang === 'en' ? 'Referred by' : 'Empfohlen von'}</label>
                <input value={editForm.referred_by}
                  onChange={e => setEditForm(f => ({ ...f, referred_by: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">{t('leads', 'notes')}</label>
                <textarea value={editForm.notes} rows={2}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={editSaving}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
                  {editSaving ? t('common', 'save') + '…' : t('common', 'save')}
                </button>
                <button type="button" onClick={() => setEditingLead(null)}
                  className="flex-1 px-4 py-2.5 min-h-[44px] rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium text-sm transition-colors">
                  {t('common', 'cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
