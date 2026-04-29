'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, CreditCard, Save, ExternalLink, CheckCircle2, AlertCircle, Unlink } from 'lucide-react'

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [name, setName]             = useState('')
  const [address, setAddress]       = useState('')
  const [phone, setPhone]           = useState('')
  const [email, setEmail]           = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [loading, setLoading]       = useState(false)
  const [saved, setSaved]           = useState(false)

  // Stripe state
  const [stripeConfigured, setStripeConfigured]   = useState(false)
  const [stripeAccountId, setStripeAccountId]     = useState<string | null>(null)
  const [connectLoading, setConnectLoading]       = useState(false)

  // URL feedback from OAuth callback
  const stripeConnected = searchParams.get('stripe_connected') === '1'
  const stripeError     = searchParams.get('stripe_error')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('gyms').select('*').single().then(({ data }) => {
      if (data) {
        setName(data.name ?? '')
        setAddress(data.address ?? '')
        setPhone(data.phone ?? '')
        setEmail(data.email ?? '')
        setMonthlyFee(data.monthly_fee_cents ? ((data.monthly_fee_cents as number) / 100).toFixed(2) : '')
        setStripeAccountId((data as { stripe_account_id: string | null }).stripe_account_id)
      }
    })
    fetch('/api/stripe/status').then(r => r.json()).then(d => {
      setStripeConfigured(d.configured)
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
      phone:   phone || null,
      email:   email || null,
      monthly_fee_cents: feeCents,
    }).eq('owner_id', user?.id ?? '')
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleConnect() {
    setConnectLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else if (data.error) alert(data.error)
    } catch {
      // ignore
    }
    setConnectLoading(false)
  }

  async function handleDisconnect() {
    if (!confirm('Stripe-Verbindung wirklich trennen? Zahlungen gehen dann auf dein Platform-Konto.')) return
    const { data: { session } } = await createClient().auth.getSession()
    await fetch('/api/stripe/connect', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    setStripeAccountId(null)
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Einstellungen</h1>
        <p className="text-slate-500 text-sm mt-1">Gym-Profil und Zahlungseinstellungen</p>
      </div>

      {/* OAuth feedback banners */}
      {stripeConnected && (
        <div className="mb-5 p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
          <p className="text-green-800 text-sm font-medium">Stripe erfolgreich verbunden! Zahlungen gehen ab sofort direkt auf dein Gym-Konto.</p>
        </div>
      )}
      {stripeError && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">Stripe-Verbindung fehlgeschlagen: {stripeError}</p>
        </div>
      )}

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
            Mitgliedsbeiträge & Zahlungen
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

          {/* Stripe API key status */}
          <div className={`rounded-xl p-4 ${stripeConfigured ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <p className={`text-sm font-medium ${stripeConfigured ? 'text-green-800' : 'text-amber-800'}`}>
              {stripeConfigured ? '✓ Stripe API-Key aktiv' : 'Stripe-API-Key fehlt'}
            </p>
            {!stripeConfigured && (
              <p className="text-amber-700 text-xs mt-1">
                Füge <code className="bg-amber-100 px-1 rounded">STRIPE_SECRET_KEY</code> in Vercel ein.
              </p>
            )}
          </div>

          {/* Stripe Connect */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Stripe Connect</p>
                <p className="text-xs text-slate-500 mt-0.5">Zahlungen gehen direkt auf dein Gym-Konto</p>
              </div>
              {stripeAccountId ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium border border-green-200">
                  Verbunden
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium border border-slate-200">
                  Nicht verbunden
                </span>
              )}
            </div>
            <div className="p-4">
              {stripeAccountId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
                    <span>Mitgliedsbeiträge werden direkt auf dein Stripe-Konto überwiesen.</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs truncate">{stripeAccountId}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <a
                      href="https://dashboard.stripe.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                    >
                      <ExternalLink size={12} />
                      Stripe Dashboard
                    </a>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors border border-red-200"
                    >
                      <Unlink size={12} />
                      Trennen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-600 text-sm">
                    Verbinde dein Stripe-Konto — Mitgliedsbeiträge landen dann direkt bei dir.
                    RollCall behält eine Plattformgebühr von <strong>2%</strong>.
                  </p>
                  <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 space-y-1">
                    <p>Beispiel bei 80 € Monatsbeitrag:</p>
                    <p>→ <strong className="text-slate-700">78,40 €</strong> gehen auf dein Konto</p>
                    <p>→ <strong className="text-slate-700">1,60 €</strong> Plattformgebühr</p>
                    <p className="text-slate-400">+ Stripe-Transaktionsgebühren (~1,4% + 0,25€)</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connectLoading || !stripeConfigured}
                    className="w-full py-2.5 rounded-xl bg-[#635BFF] hover:bg-[#7a73ff] disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {connectLoading ? 'Stripe öffnet...' : '⚡ Mit Stripe verbinden'}
                  </button>
                </div>
              )}
            </div>
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
