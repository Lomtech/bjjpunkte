'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2, CreditCard, Save } from 'lucide-react'

export default function SettingsPage() {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('gyms').select('*').single().then(({ data }) => {
      if (data) {
        setName(data.name ?? '')
        setAddress(data.address ?? '')
        setPhone(data.phone ?? '')
        setEmail(data.email ?? '')
        setMonthlyFee(data.monthly_fee_cents ? ((data.monthly_fee_cents as number) / 100).toFixed(2) : '')
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const feeCents = monthlyFee ? Math.round(parseFloat(monthlyFee.replace(',', '.')) * 100) : 0
    await supabase.from('gyms').update({
      name,
      address: address || null,
      phone: phone || null,
      email: email || null,
      monthly_fee_cents: feeCents,
    }).eq('owner_id', user?.id ?? '')
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const stripeConfigured = !!process.env.NEXT_PUBLIC_STRIPE_CONFIGURED

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Einstellungen</h1>
        <p className="text-slate-500 text-sm mt-1">Gym-Profil und Zahlungseinstellungen</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Gym Profile */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Building2 size={12} />
            Gym-Profil
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gym-Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Musterstraße 1, 80331 München"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+49 89 123456"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kontakt E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="info@mygym.de"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={12} />
            Mitgliedsbeiträge
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monatlicher Beitrag (€)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">€</span>
              <input
                value={monthlyFee}
                onChange={e => setMonthlyFee(e.target.value)}
                placeholder="79,00"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">Wird als Standard für neue Zahlungslinks verwendet.</p>
          </div>

          <div className={`rounded-xl p-4 ${stripeConfigured ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <p className={`text-sm font-medium ${stripeConfigured ? 'text-green-800' : 'text-amber-800'}`}>
              {stripeConfigured ? '✓ Stripe verbunden' : 'Stripe-Integration einrichten'}
            </p>
            {!stripeConfigured && (
              <p className="text-amber-700 text-xs mt-1">
                Füge <code className="bg-amber-100 px-1 rounded">STRIPE_SECRET_KEY</code> und <code className="bg-amber-100 px-1 rounded">STRIPE_WEBHOOK_SECRET</code> zu deiner <code className="bg-amber-100 px-1 rounded">.env.local</code> Datei hinzu.
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {saved ? '✓ Gespeichert' : loading ? 'Wird gespeichert...' : 'Einstellungen speichern'}
        </button>
      </form>
    </div>
  )
}
