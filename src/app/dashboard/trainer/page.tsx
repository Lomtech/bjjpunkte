'use client'

// Trainer-Dashboard (Feature #7, Sprint 2026-05-27).
// Tabs: Mitglieder | Beförderungen.
// Kalender + Anwesenheit-Capture folgt in eigenem UI-Sprint.

import { useState, useEffect } from 'react'
import { Users, Award, Check, X, Plus, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'

type TrainerMember = {
  id: string
  gym_id: string
  first_name: string
  last_name: string
  belt: string
  stripes: number | null
  is_active: boolean
  join_date: string | null
  date_of_birth: string | null
  parent_first_name: string | null
  parent_phone: string | null
  notes: string | null
  punch_units_remaining: number | null
  punch_units_total: number | null
}

type Promotion = {
  id: string
  member_id: string
  previous_belt: string
  previous_stripes: number
  new_belt: string
  new_stripes: number
  promoted_at: string
  notes: string | null
}

const BELTS = ['white', 'blue', 'purple', 'brown', 'black'] as const
const BELT_LABELS: Record<string, string> = {
  white:  'Weiß',
  blue:   'Blau',
  purple: 'Lila',
  brown:  'Braun',
  black:  'Schwarz',
}
const BELT_COLORS: Record<string, string> = {
  white:  'bg-zinc-50 text-zinc-700 border-zinc-200',
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  brown:  'bg-amber-100 text-amber-900 border-amber-200',
  black:  'bg-zinc-900 text-white border-zinc-900',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob), now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--
  return age
}

export default function TrainerDashboard() {
  const toast = useToast()
  const [tab, setTab] = useState<'members' | 'promotions'>('members')
  const [members, setMembers] = useState<TrainerMember[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gymId, setGymId] = useState<string | null>(null)

  // Beförderungs-Modal
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [promoMemberId, setPromoMemberId] = useState<string>('')
  const [promoBelt, setPromoBelt] = useState<typeof BELTS[number]>('white')
  const [promoStripes, setPromoStripes] = useState(0)
  const [promoNotes, setPromoNotes] = useState('')
  const [savingPromo, setSavingPromo] = useState(false)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { setError('Bitte einloggen'); setLoading(false); return }

      // Mitglieder über Trainer-API
      const mRes = await fetch('/api/trainer/members', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const mJson = await mRes.json()
      if (!mRes.ok) { setError(mJson.error ?? 'Fehler'); setLoading(false); return }
      setMembers(mJson.members ?? [])
      setGymId(mJson.gym_id ?? null)

      // Beförderungs-History direkt via Supabase (RLS gibt Trainer SELECT-Rechte)
      if (mJson.gym_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: promos } = await (sb.from('belt_promotions') as any)
          .select('*')
          .eq('gym_id', mJson.gym_id)
          .order('promoted_at', { ascending: false })
          .limit(200)
        setPromotions(promos ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  async function submitPromotion() {
    if (!promoMemberId) { toast.error('Bitte Mitglied auswählen'); return }
    if (!gymId) { toast.error('Gym-ID fehlt'); return }
    const member = members.find(m => m.id === promoMemberId)
    if (!member) { toast.error('Mitglied nicht gefunden'); return }

    setSavingPromo(true)
    const sb = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('belt_promotions') as any).insert({
      gym_id: gymId,
      member_id: promoMemberId,
      previous_belt: member.belt,
      previous_stripes: member.stripes ?? 0,
      new_belt: promoBelt,
      new_stripes: promoStripes,
      promoted_at: new Date().toISOString(),
      notes: promoNotes.trim() || null,
    }).select().single()

    if (error) {
      setSavingPromo(false)
      toast.error(`Fehler: ${error.message}`)
      return
    }

    // Member-Belt aktualisieren — geht nur via RPC oder owner, hier via direkter
    // RLS-Update wenn Trainer-Policy SELECT+UPDATE erlaubt. Aktuell hat Trainer
    // nur SELECT auf members. Wir loggen die Beförderung in belt_promotions
    // und der Owner muss member.belt manuell synchen.
    setPromotions(prev => [data, ...prev])
    setSavingPromo(false)
    setShowPromoModal(false)
    setPromoMemberId(''); setPromoNotes(''); setPromoStripes(0); setPromoBelt('white')
    toast.success(`Beförderung erfasst: ${member.first_name} ${member.last_name} → ${BELT_LABELS[promoBelt]} ${promoStripes}★`)
  }

  if (loading) return <div className="p-6 text-zinc-400 text-sm">Lade…</div>
  if (error) return <div className="p-6 text-rose-600 text-sm">{error}</div>

  return (
    <div className="p-4 md:p-6">
      <header className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={20} className="text-amber-500" />
          <h1 className="text-xl font-bold text-zinc-900">Trainer-Dashboard</h1>
        </div>
        <p className="text-zinc-500 text-xs">
          Eingeschränkte Sicht: nur Sport-Daten (kein IBAN, keine Adresse, keine Zahlungen).
        </p>
      </header>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-4 border-b border-zinc-200">
        <button onClick={() => setTab('members')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'members' ? 'border-amber-500 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}>
          <Users size={14} className="inline mr-1.5" />
          Mitglieder ({members.length})
        </button>
        <button onClick={() => setTab('promotions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'promotions' ? 'border-amber-500 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-900'
          }`}>
          <Award size={14} className="inline mr-1.5" />
          Beförderungen ({promotions.length})
        </button>
      </div>

      {tab === 'members' && (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Alter</th>
                <th className="text-left px-4 py-3 font-medium">Gurt / Stripes</th>
                <th className="text-left px-4 py-3 font-medium">Aktiv</th>
                <th className="text-left px-4 py-3 font-medium">Einheiten</th>
                <th className="text-left px-4 py-3 font-medium">Notiz</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => {
                const age = calcAge(m.date_of_birth)
                return (
                  <tr key={m.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {m.first_name} {m.last_name}
                      {age !== null && age < 18 && m.parent_first_name && (
                        <div className="text-xs text-amber-700 mt-0.5">
                          Erz. ber.: {m.parent_first_name} {m.parent_phone ? `(${m.parent_phone})` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {age !== null ? `${age} J.` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${BELT_COLORS[m.belt] ?? BELT_COLORS.white}`}>
                        {BELT_LABELS[m.belt] ?? m.belt}
                      </span>
                      <span className="text-xs text-zinc-500 ml-2">{m.stripes ?? 0}★</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block w-2 h-2 rounded-full ${m.is_active ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {m.punch_units_remaining !== null
                        ? `${m.punch_units_remaining}/${m.punch_units_total ?? '?'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs truncate">{m.notes ?? ''}</td>
                  </tr>
                )
              })}
              {members.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-400 text-sm">
                  Keine Mitglieder sichtbar.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'promotions' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowPromoModal(true)}
              className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm flex items-center gap-1.5">
              <Plus size={14} /> Beförderung erfassen
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Datum</th>
                  <th className="text-left px-4 py-3 font-medium">Mitglied</th>
                  <th className="text-left px-4 py-3 font-medium">Von</th>
                  <th className="text-left px-4 py-3 font-medium">Nach</th>
                  <th className="text-left px-4 py-3 font-medium">Notiz</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map(p => {
                  const m = members.find(x => x.id === p.member_id)
                  return (
                    <tr key={p.id} className="border-t border-zinc-100">
                      <td className="px-4 py-3 text-xs text-zinc-500">{fmtDate(p.promoted_at)}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {m ? `${m.first_name} ${m.last_name}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${BELT_COLORS[p.previous_belt]}`}>
                          {BELT_LABELS[p.previous_belt]}
                        </span>
                        <span className="text-xs text-zinc-500 ml-1">{p.previous_stripes}★</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${BELT_COLORS[p.new_belt]}`}>
                          {BELT_LABELS[p.new_belt]}
                        </span>
                        <span className="text-xs text-zinc-500 ml-1">{p.new_stripes}★</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs truncate">{p.notes ?? ''}</td>
                    </tr>
                  )
                })}
                {promotions.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-400 text-sm">
                    Noch keine Beförderungen erfasst.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Beförderungs-Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
             onClick={() => !savingPromo && setShowPromoModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6"
               onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900">Beförderung erfassen</h3>
              <button onClick={() => !savingPromo && setShowPromoModal(false)}
                className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </header>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs text-zinc-500 block mb-1">Mitglied</span>
                <select value={promoMemberId} onChange={e => setPromoMemberId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm">
                  <option value="">— wählen —</option>
                  {members.filter(m => m.is_active).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} (aktuell {BELT_LABELS[m.belt] ?? m.belt} {m.stripes ?? 0}★)
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-zinc-500 block mb-1">Neuer Gurt</span>
                  <select value={promoBelt} onChange={e => setPromoBelt(e.target.value as typeof BELTS[number])}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm">
                    {BELTS.map(b => <option key={b} value={b}>{BELT_LABELS[b]}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500 block mb-1">Neue Stripes</span>
                  <input type="number" min={0} max={4} value={promoStripes}
                    onChange={e => setPromoStripes(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-zinc-500 block mb-1">Notiz (optional)</span>
                <textarea value={promoNotes} onChange={e => setPromoNotes(e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm resize-y"
                  placeholder="z.B. 'Konsistente Leistung über 8 Monate, hervorragende Technik'" />
              </label>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                Beförderung wird im Audit-Log gespeichert. Der Owner muss die Belt-Spalte am
                Member-Datensatz selbst aktualisieren — Trainer haben keine Schreibrechte auf members.
              </div>
            </div>

            <footer className="flex justify-end gap-2 pt-5 mt-5 border-t border-zinc-100">
              <button onClick={() => setShowPromoModal(false)} disabled={savingPromo}
                className="px-4 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50">
                Abbrechen
              </button>
              <button onClick={submitPromotion} disabled={savingPromo || !promoMemberId}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50">
                <Check size={14} /> {savingPromo ? 'Speichere…' : 'Beförderung erfassen'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
