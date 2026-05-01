'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Trash2, MessageCircle, Phone, Mail } from 'lucide-react'
import Link from 'next/link'

function toWaPhone(raw: string): string {
  let p = raw.replace(/[\s\-().]/g, '')
  if (p.startsWith('00')) p = '+' + p.slice(2)
  if (p.startsWith('0'))  p = '+49' + p.slice(1)
  return p.replace(/^\+/, '')
}

type LeadStatus = 'new' | 'contacted' | 'trial_scheduled' | 'trial_done' | 'converted' | 'lost'
type LeadSource = 'walk-in' | 'referral' | 'instagram' | 'website' | 'other'

const STATUS_COLORS: Record<LeadStatus, string> = {
  new:             'bg-blue-50 text-blue-700 border-blue-200',
  contacted:       'bg-amber-50 text-amber-700 border-amber-200',
  trial_scheduled: 'bg-purple-50 text-purple-700 border-purple-200',
  trial_done:      'bg-indigo-50 text-indigo-700 border-indigo-200',
  converted:       'bg-green-50 text-green-700 border-green-200',
  lost:            'bg-slate-100 text-slate-500 border-slate-200',
}

const STATUS_LABELS: Record<LeadStatus, string> = {
  new:             'Neu',
  contacted:       'Kontaktiert',
  trial_scheduled: 'Probetraining geplant',
  trial_done:      'Probetraining absolviert',
  converted:       'Mitglied geworden',
  lost:            'Verloren',
}

const SOURCE_LABELS: Record<LeadSource, string> = {
  'walk-in':  'Walk-in',
  referral:   'Empfehlung',
  instagram:  'Instagram',
  website:    'Website',
  other:      'Sonstiges',
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
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function LeadsPage() {
  const [leads, setLeads]           = useState<Lead[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [token, setToken]           = useState<string | null>(null)

  // inline edit state
  const [editNotes, setEditNotes]   = useState<Record<string, string>>({})

  // form state
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    source: 'walk-in' as LeadSource, trial_date: '', referred_by: '', notes: '',
  })

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      setToken(session.access_token)
      const res = await fetch('/api/leads', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
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
    if (!token) return
    setSaving(true)
    const body: Record<string, string> = {}
    for (const [k, v] of Object.entries(form)) {
      if (v) body[k] = v
    }
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const lead = await res.json()
      setLeads(prev => [lead, ...prev])
      setEditNotes(prev => ({ ...prev, [lead.id]: lead.notes ?? '' }))
      setForm({ first_name: '', last_name: '', email: '', phone: '', source: 'walk-in', trial_date: '', referred_by: '', notes: '' })
      setShowForm(false)
    }
    setSaving(false)
  }

  async function updateStatus(lead: Lead, status: LeadStatus) {
    if (!token) return
    const extra: Record<string, string> = {}
    if (status === 'contacted' && !lead.contacted_at) extra.contacted_at = new Date().toISOString()
    if (status === 'converted' && !lead.converted_at) extra.converted_at = new Date().toISOString()
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, ...extra }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l))
    }
  }

  async function saveNotes(lead: Lead) {
    if (!token) return
    const notes = editNotes[lead.id] ?? ''
    if (notes === (lead.notes ?? '')) return
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notes }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLeads(prev => prev.map(l => l.id === lead.id ? updated : l))
    }
  }

  async function deleteLead(id: string) {
    if (!token) return
    if (!confirm('Interessent wirklich löschen?')) return
    await fetch(`/api/leads/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setLeads(prev => prev.filter(l => l.id !== id))
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

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 text-sm">Lädt…</div>

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <UserPlus size={20} className="text-amber-500 flex-shrink-0" />
            <h1 className="text-xl font-bold text-slate-900">Interessenten</h1>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">{leads.length} gesamt · {counts.new} neu · {counts.converted} konvertiert</p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors flex-shrink-0">
          <UserPlus size={14} />
          Neuer Interessent
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

      {/* New lead form */}
      {showForm && (
        <div className="mb-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="font-semibold text-slate-900 text-sm">Neuer Interessent</p>
          </div>
          <form onSubmit={handleCreate} className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Vorname *</label>
                <input
                  required value={form.first_name}
                  onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="Max"
                  className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nachname *</label>
                <input
                  required value={form.last_name}
                  onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="Mustermann"
                  className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">E-Mail</label>
                <input
                  type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="max@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Telefon</label>
                <input
                  type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+49 151 234567"
                  className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Quelle</label>
                <select
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value as LeadSource }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100">
                  <option value="walk-in">Walk-in</option>
                  <option value="referral">Empfehlung</option>
                  <option value="instagram">Instagram</option>
                  <option value="website">Website</option>
                  <option value="other">Sonstiges</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Probetraining-Datum</label>
                <input
                  type="date" value={form.trial_date}
                  onChange={e => setForm(f => ({ ...f, trial_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Empfohlen von</label>
              <input
                value={form.referred_by}
                onChange={e => setForm(f => ({ ...f, referred_by: e.target.value }))}
                placeholder="Name des Mitglieds"
                className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notizen</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Erste Eindrücke, Ziele, …"
                className="w-full px-3 py-2 rounded-lg bg-[#F0F2F5] border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors">
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lead cards */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
            <UserPlus size={20} className="text-amber-500" />
          </div>
          <p className="text-slate-900 font-semibold text-sm mb-1">Noch keine Interessenten</p>
          <p className="text-slate-400 text-xs mb-4">Füge deinen ersten Interessenten hinzu.</p>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm">
            <UserPlus size={14} /> Neuer Interessent
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(lead => (
            <div key={lead.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-amber-600">
                    {lead.first_name[0]}{lead.last_name[0]}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Name row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{lead.first_name} {lead.last_name}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                      {SOURCE_LABELS[lead.source] ?? lead.source}
                    </span>
                    <span className="text-xs text-slate-400">vor {daysSince(lead.created_at)}d</span>
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
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                        <Phone size={11} />{lead.phone}
                      </a>
                    )}
                    {lead.email && (
                      <a href={`mailto:${lead.email}`}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                        <Mail size={11} />{lead.email}
                      </a>
                    )}
                  </div>

                  {/* Trial date + referred by */}
                  {(lead.trial_date || lead.referred_by) && (
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {lead.trial_date && (
                        <span className="text-xs text-slate-400">
                          Probetraining: {new Date(lead.trial_date).toLocaleDateString('de-DE')}
                        </span>
                      )}
                      {lead.referred_by && (
                        <span className="text-xs text-slate-400">
                          Empfohlen von: {lead.referred_by}
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
                    placeholder="Notizen hinzufügen…"
                    className="mt-2 w-full px-2.5 py-1.5 rounded-lg bg-[#F0F2F5] border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  {lead.phone && (
                    <a
                      href={`https://wa.me/${toWaPhone(lead.phone)}?text=${encodeURIComponent(`Hallo ${lead.first_name}! 👋`)}`}
                      target="_blank" rel="noopener noreferrer"
                      title="WhatsApp"
                      className="p-1.5 rounded-lg text-[#25D366] hover:bg-green-50 transition-colors">
                      <MessageCircle size={15} />
                    </a>
                  )}
                  {lead.status === 'converted' && (
                    <Link
                      href={`/dashboard/members/new?firstName=${encodeURIComponent(lead.first_name)}&lastName=${encodeURIComponent(lead.last_name)}&email=${encodeURIComponent(lead.email ?? '')}`}
                      className="px-2 py-1 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-[11px] font-semibold border border-green-200 transition-colors whitespace-nowrap">
                      Als Mitglied anlegen
                    </Link>
                  )}
                  <button
                    onClick={() => deleteLead(lead.id)}
                    title="Löschen"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
