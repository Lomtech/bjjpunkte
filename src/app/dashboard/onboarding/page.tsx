'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SPORT_PRESETS, isBeltFreeSport, type SportType } from '@/lib/belt-system'
import { Check, Copy, ChevronRight, X, Plus, Zap } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type GymData = {
  id: string
  name: string | null
  address: string | null
  phone: string | null
  email: string | null
  monthly_fee_cents: number | null
  stripe_account_id: string | null
  signup_token: string | null
  sport_type: string | null
}

type MembershipPlan = {
  id: string // local only
  name: string
  price: string
  interval: 'monthly' | 'halfyearly' | 'yearly'
  contract_months: number
}

// ─── Sport options ─────────────────────────────────────────────────────────────

const SPORTS: { key: SportType; label: string; emoji: string }[] = [
  { key: 'bjj',       label: 'BJJ',       emoji: '🥋' },
  { key: 'judo',      label: 'Judo',      emoji: '🥇' },
  { key: 'karate',    label: 'Karate',    emoji: '🥊' },
  { key: 'taekwondo', label: 'Taekwondo', emoji: '🦵' },
  { key: 'mma',       label: 'MMA',       emoji: '🤼' },
  { key: 'muaythai',  label: 'Muay Thai', emoji: '🥊' },
  { key: 'boxing',    label: 'Boxen',     emoji: '🥊' },
  { key: 'wrestling', label: 'Ringen',    emoji: '🤼' },
]

const INTERVAL_LABELS: Record<MembershipPlan['interval'], string> = {
  monthly:     'Monatlich',
  halfyearly:  'Halbjährlich',
  yearly:      'Jährlich',
}

const DURATION_LABELS: Record<number, string> = {
  0:  'Monatlich kündbar',
  3:  '3 Monate',
  6:  '6 Monate',
  12: '12 Monate',
  24: '24 Monate',
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

const STEPS = ['Sport', 'Profil', 'Beiträge', 'Stripe', 'Fertig']

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between mb-2">
        {STEPS.map((label, i) => {
          const idx = i + 1
          const done = idx < step
          const active = idx === step
          return (
            <div key={label} className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1 transition-colors ${
                  done   ? 'bg-amber-500 text-white' :
                  active ? 'bg-amber-500 text-white ring-4 ring-amber-200' :
                           'bg-white border-2 border-gray-200 text-gray-400'
                }`}
              >
                {done ? <Check size={14} /> : idx}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-amber-600' : done ? 'text-gray-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="relative h-1 bg-gray-200 rounded-full">
        <div
          className="absolute left-0 top-0 h-1 bg-amber-500 rounded-full transition-all duration-500"
          style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [gym, setGym] = useState<GymData | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 – Sport
  const [activeSport, setActiveSport] = useState<SportType | null>(null)

  // Step 2 – Profile
  const [gymName, setGymName]     = useState('')
  const [address, setAddress]     = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')

  // Step 3 – Membership plans
  const [plans, setPlans]           = useState<MembershipPlan[]>([])
  const [planName, setPlanName]     = useState('')
  const [planPrice, setPlanPrice]   = useState('')
  const [planInterval, setPlanInterval] = useState<MembershipPlan['interval']>('monthly')
  const [planDuration, setPlanDuration] = useState<number>(0)

  // Step 4 – Stripe
  const [stripeLoading, setStripeLoading] = useState(false)

  // Step 5 – Done
  const [copied, setCopied] = useState(false)

  // ── Load gym on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('gyms')
        .select('id, name, address, phone, email, monthly_fee_cents, stripe_account_id, signup_token, sport_type')
        .eq('owner_id', user.id)
        .single()

      if (data) {
        const g = data as unknown as GymData
        setGym(g)
        setGymName(g.name ?? '')
        setAddress(g.address ?? '')
        setPhone(g.phone ?? '')
        setEmail(g.email ?? '')
        setMonthlyFee(g.monthly_fee_cents ? String(g.monthly_fee_cents / 100) : '')
        if (g.sport_type) setActiveSport(g.sport_type as SportType)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function clearError() { setError(null) }

  // ── Step 1: Save sport ───────────────────────────────────────────────────────
  async function saveStep1() {
    if (!activeSport || !gym) return
    setSaving(true)
    clearError()
    const beltFree = isBeltFreeSport(activeSport)
    const preset = beltFree ? null : (SPORT_PRESETS as Record<string, unknown>)[activeSport] ?? null
    const { error: err } = await (supabase
      .from('gyms') as any)
      .update({
        sport_type: activeSport,
        belt_system_enabled: !beltFree,
        belt_system: preset,
      })
      .eq('id', gym.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setStep(2)
  }

  // ── Step 2: Save profile ─────────────────────────────────────────────────────
  async function saveStep2() {
    if (!gym) return
    setSaving(true)
    clearError()
    const { error: err } = await supabase
      .from('gyms')
      .update({
        name: gymName,
        address,
        phone,
        email,
      })
      .eq('id', gym.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setStep(3)
  }

  // ── Step 3: Add plan to local list ───────────────────────────────────────────
  function addPlan() {
    if (!planName.trim() || !planPrice.trim()) return
    setPlans(prev => [...prev, {
      id: crypto.randomUUID(),
      name: planName.trim(),
      price: planPrice.trim(),
      interval: planInterval,
      contract_months: planDuration,
    }])
    setPlanName('')
    setPlanPrice('')
    setPlanInterval('monthly')
    setPlanDuration(0)
  }

  function removePlan(id: string) {
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  async function saveStep3() {
    if (!gym) return
    setSaving(true)
    clearError()
    if (plans.length > 0) {
      const rows = plans.map(p => ({
        gym_id: gym.id,
        name: p.name,
        price_cents: Math.round(parseFloat(p.price) * 100),
        billing_interval: p.interval,
        contract_months: p.contract_months,
      }))
      const { error: err } = await (supabase.from('membership_plans') as any).insert(rows)
      if (err) { setSaving(false); setError(err.message); return }
    }
    setSaving(false)
    setStep(4)
  }

  // ── Step 4: Stripe connect ───────────────────────────────────────────────────
  async function connectStripe() {
    setStripeLoading(true)
    clearError()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setStripeLoading(false); setError('Nicht eingeloggt'); return }
    const res = await fetch('/api/stripe/connect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const json = await res.json()
    setStripeLoading(false)
    if (json.url) {
      window.location.href = json.url
    } else {
      setError(json.error ?? 'Stripe-Fehler')
    }
  }

  // ── Step 5: Complete onboarding ──────────────────────────────────────────────
  async function completeOnboarding() {
    if (!gym) return
    setSaving(true)
    await (supabase
      .from('gyms') as any)
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', gym.id)
    setSaving(false)
    router.push('/dashboard')
  }

  function copySignupLink() {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bjjpunkte.vercel.app'
    const link = `${appUrl}/signup/${gym?.signup_token ?? ''}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center py-10 px-4">
      {/* Header */}
      <div className="w-full max-w-xl mb-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#0f172a] border border-amber-500/30 flex flex-col items-center justify-center gap-0.5 flex-shrink-0">
          <span className="text-[10px] font-black text-amber-400 italic leading-none tracking-tight">oss</span>
          <div className="flex gap-0.5">
            {[0, 1, 2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-amber-500 opacity-70" />)}
          </div>
        </div>
        <span className="font-black text-gray-800 text-lg italic tracking-tight">Osss</span>
        <span className="ml-auto text-sm text-gray-400">Einrichtung</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm p-6 md:p-8">
        <ProgressBar step={step} />

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
            <X size={14} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Step 1: Sport ── */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-1">Welchen Sport trainierst du?</h1>
            <p className="text-gray-500 text-sm mb-6">Wähle deinen Hauptsport — das bestimmt das Gürtelsystem.</p>

            <div className="grid grid-cols-4 gap-3 mb-8">
              {SPORTS.map(sport => {
                const beltFree = isBeltFreeSport(sport.key)
                const selected = activeSport === sport.key
                return (
                  <button
                    key={sport.key}
                    onClick={() => setActiveSport(sport.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      selected
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/40'
                    }`}
                  >
                    <span className="text-2xl">{sport.emoji}</span>
                    <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{sport.label}</span>
                    {beltFree && (
                      <span className="text-[9px] text-gray-400 bg-gray-100 rounded px-1 py-0.5 leading-none">
                        Kein Gürtel
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <button
              onClick={saveStep1}
              disabled={!activeSport || saving}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving ? 'Speichern…' : 'Weiter'} <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── Step 2: Profile ── */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-1">Stell dich vor</h1>
            <p className="text-gray-500 text-sm mb-6">Deine Gym-Informationen — sichtbar für Mitglieder.</p>

            <div className="space-y-4 mb-8">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Gym-Name</label>
                <input
                  type="text"
                  value={gymName}
                  onChange={e => setGymName(e.target.value)}
                  placeholder="Mein BJJ Gym"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Adresse</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Musterstraße 1, 12345 Stadt"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Telefon</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+49 123 456789"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="info@meingym.de"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setError(null); setStep(1) }}
                className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={saveStep2}
                disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? 'Speichern…' : 'Weiter'} <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Membership plans ── */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-1">Deine Mitgliedschafts-Optionen</h1>
            <p className="text-gray-500 text-sm mb-6">
              Definiere deine Preise. Du kannst sie jederzeit unter Einstellungen → Verträge ändern.
            </p>

            {/* Add plan form */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Name</label>
                  <input
                    type="text"
                    value={planName}
                    onChange={e => setPlanName(e.target.value)}
                    placeholder="z.B. Standard"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Preis (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={planPrice}
                    onChange={e => setPlanPrice(e.target.value)}
                    placeholder="49.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Intervall</label>
                  <select
                    value={planInterval}
                    onChange={e => setPlanInterval(e.target.value as MembershipPlan['interval'])}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  >
                    <option value="monthly">Monatlich</option>
                    <option value="halfyearly">Halbjährlich</option>
                    <option value="yearly">Jährlich</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Vertragslaufzeit</label>
                  <select
                    value={planDuration}
                    onChange={e => setPlanDuration(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  >
                    <option value={0}>Monatlich kündbar</option>
                    <option value={3}>3 Monate</option>
                    <option value={6}>6 Monate</option>
                    <option value={12}>12 Monate</option>
                    <option value={24}>24 Monate</option>
                  </select>
                </div>
              </div>
              <button
                onClick={addPlan}
                disabled={!planName.trim() || !planPrice.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
              >
                <Plus size={14} /> Tarif hinzufügen
              </button>
            </div>

            {/* Plan cards */}
            {plans.length > 0 && (
              <div className="space-y-2 mb-4">
                {plans.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {parseFloat(p.price).toFixed(2)} € · {INTERVAL_LABELS[p.interval]} · {DURATION_LABELS[p.contract_months]}
                      </p>
                    </div>
                    <button onClick={() => removePlan(p.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 items-center mt-6">
              <button
                onClick={() => { setError(null); setStep(2) }}
                className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={saveStep3}
                disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {saving ? 'Speichern…' : 'Weiter'} <ChevronRight size={16} />
              </button>
            </div>
            <div className="text-center mt-3">
              <button
                onClick={() => { setError(null); setStep(4) }}
                className="text-sm text-gray-400 hover:text-amber-500 transition-colors"
              >
                Überspringen →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Stripe ── */}
        {step === 4 && (
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-1">Zahlungen einrichten</h1>
            <p className="text-gray-500 text-sm mb-6">
              Mit Stripe kannst du Beiträge direkt einziehen und Rechnungen versenden. Du kannst diesen Schritt auch später in den Einstellungen nachholen.
            </p>

            {gym?.stripe_account_id ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-800">Stripe ist verbunden ✓</p>
                  <p className="text-xs text-green-600">Dein Stripe-Konto ist aktiv und bereit.</p>
                </div>
              </div>
            ) : (
              <button
                onClick={connectStripe}
                disabled={stripeLoading}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-[#635bff] hover:bg-[#5750e3] disabled:opacity-60 text-white font-bold text-base transition-colors mb-4"
              >
                <Zap size={18} />
                {stripeLoading ? 'Weiterleitung…' : 'Stripe verbinden'}
              </button>
            )}

            <div className="flex gap-3 items-center mt-4">
              <button
                onClick={() => { setError(null); setStep(3) }}
                className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Weiter <ChevronRight size={16} />
              </button>
            </div>
            <div className="text-center mt-3">
              <button
                onClick={() => setStep(5)}
                className="text-sm text-gray-400 hover:text-amber-500 transition-colors"
              >
                Später einrichten →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {step === 5 && (
          <div>
            <h1 className="text-2xl font-black text-gray-900 mb-1">Alles bereit! 🎉</h1>
            <p className="text-gray-500 text-sm mb-6">
              Teile diesen Link mit neuen Mitgliedern — sie können sich direkt anmelden.
            </p>

            {gym?.signup_token && (
              <div className="mb-6">
                <label className="text-sm font-semibold text-gray-700 block mb-2">Dein Anmelde-Link</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <span className="flex-1 text-sm text-gray-700 font-mono truncate">
                    {(process.env.NEXT_PUBLIC_APP_URL ?? 'https://bjjpunkte.vercel.app')}/signup/{gym.signup_token}
                  </span>
                  <button
                    onClick={copySignupLink}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-amber-600 transition-colors"
                  >
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Teile diesen Link per WhatsApp, E-Mail oder auf Instagram.</p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-amber-800 font-semibold mb-1">Du bist startklar 🚀</p>
              <p className="text-xs text-amber-700">
                Mitglieder, Trainingsplan, Gürtelprüfungen — alles wartet im Dashboard auf dich.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setError(null); setStep(4) }}
                className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={completeOnboarding}
                disabled={saving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {saving ? 'Moment…' : 'Zum Dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
