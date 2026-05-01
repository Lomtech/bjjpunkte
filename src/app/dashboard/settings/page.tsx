'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, CreditCard, Save, ExternalLink, CheckCircle2, AlertCircle, Unlink, Zap, Copy, Check, Shield, UserPlus, Link2 } from 'lucide-react'

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [name, setName]             = useState('')
  const [address, setAddress]       = useState('')
  const [phone, setPhone]           = useState('')
  const [email, setEmail]           = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [loading, setLoading]       = useState(false)
  const [saved, setSaved]           = useState(false)
  const [stripeConfigured, setStripeConfigured] = useState(false)
  const [webhookActive, setWebhookActive]       = useState(false)
  const [stripeAccountId, setStripeAccountId]   = useState<string | null>(null)
  const [connectLoading, setConnectLoading]     = useState(false)
  const [copied, setCopied]                     = useState(false)
  // Signup
  const [signupEnabled, setSignupEnabled]           = useState(false)
  const [signupToken, setSignupToken]               = useState<string | null>(null)
  const [contractTemplate, setContractTemplate]     = useState('')
  const [signupSaving, setSignupSaving]             = useState(false)
  const [signupSaved, setSignupSaved]               = useState(false)
  const [copiedSignup, setCopiedSignup]             = useState(false)

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/stripe/webhook`
    : '/api/stripe/webhook'

  const signupUrl = typeof window !== 'undefined' && signupToken
    ? `${window.location.origin}/signup/${signupToken}`
    : null

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
        setSignupEnabled(((data as unknown) as { signup_enabled: boolean }).signup_enabled ?? false)
        setSignupToken(((data as unknown) as { signup_token: string | null }).signup_token ?? null)
        setContractTemplate(((data as unknown) as { contract_template: string | null }).contract_template ?? '')
      }
    })
    fetch('/api/stripe/status').then(r => r.json()).then(d => {
      setStripeConfigured(d.configured)
      setWebhookActive(d.webhookActive)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const feeCents = monthlyFee ? Math.round(parseFloat(monthlyFee.replace(',', '.')) * 100) : 0
    await supabase.from('gyms').update({ name, address: address||null, phone: phone||null, email: email||null, monthly_fee_cents: feeCents })
      .eq('owner_id', user?.id ?? '')
    setLoading(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function handleConnect() {
    setConnectLoading(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch('/api/stripe/connect', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else if (data.error) alert(data.error)
    } catch { /* ignore */ }
    setConnectLoading(false)
  }

  async function copyWebhookUrl() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDisconnect() {
    if (!confirm('Stripe-Verbindung wirklich trennen?')) return
    const { data: { session } } = await createClient().auth.getSession()
    await fetch('/api/stripe/connect', { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
    setStripeAccountId(null)
  }

  async function handleSignupSave() {
    setSignupSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any)
      .update({ signup_enabled: signupEnabled, contract_template: contractTemplate })
      .eq('owner_id', user?.id ?? '')
    setSignupSaving(false); setSignupSaved(true); setTimeout(() => setSignupSaved(false), 2000)
  }

  async function copySignupUrl() {
    if (!signupUrl) return
    await navigator.clipboard.writeText(signupUrl)
    setCopiedSignup(true)
    setTimeout(() => setCopiedSignup(false), 2000)
  }

  return (
    <div className="p-4 md:p-6 max-w-lg">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Einstellungen</h1>
        <p className="text-slate-400 text-xs mt-0.5">Gym-Profil und Zahlungseinstellungen</p>
      </div>

      {stripeConnected && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-green-600 flex-shrink-0" />
          <p className="text-green-800 text-sm font-medium">Stripe erfolgreich verbunden!</p>
        </div>
      )}
      {stripeError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">Verbindung fehlgeschlagen: {stripeError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Gym Profile */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Building2 size={12} /> Gym-Profil
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Gym-Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Musterstraße 1, 80331 München"
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefon</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49 89 123456"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-Mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@gym.de"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <CreditCard size={12} /> Zahlungen
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Monatlicher Beitrag (€)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
              <input value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} placeholder="79,00"
                className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Standard für neue Zahlungslinks.</p>
          </div>

          <div className={`rounded-lg p-3 ${stripeConfigured ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <p className={`text-sm font-medium ${stripeConfigured ? 'text-green-800' : 'text-amber-800'}`}>
              {stripeConfigured ? '✓ Stripe API-Key aktiv' : 'Stripe API-Key fehlt'}
            </p>
          </div>

          {/* Stripe Connect */}
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Stripe Connect</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                stripeAccountId ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-slate-500 border border-gray-200'
              }`}>
                {stripeAccountId ? 'Verbunden' : 'Nicht verbunden'}
              </span>
            </div>
            <div className="p-4">
              {stripeAccountId ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                    Beiträge gehen direkt auf dein Stripe-Konto.
                  </div>
                  <p className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-slate-500 truncate">{stripeAccountId}</p>
                  <div className="flex gap-2">
                    <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-medium transition-colors">
                      <ExternalLink size={11} /> Stripe Dashboard
                    </a>
                    <button type="button" onClick={handleDisconnect}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors border border-red-200">
                      <Unlink size={11} /> Trennen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-600 text-sm">Verbinde dein Konto — Beiträge landen direkt bei dir. RollCall behält <strong>2%</strong> Plattformgebühr.</p>
                  <div className="text-xs text-slate-500 bg-gray-50 rounded-lg p-3 space-y-1">
                    <p>Beispiel 80 € Monatsbeitrag:</p>
                    <p>→ <strong className="text-slate-700">78,40 €</strong> auf dein Konto</p>
                    <p>→ <strong className="text-slate-700">1,60 €</strong> Plattformgebühr</p>
                    <p className="text-slate-400">+ Stripe-Gebühren (~1,4% + 0,25 €)</p>
                  </div>
                  <button type="button" onClick={handleConnect} disabled={connectLoading || !stripeConfigured}
                    className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                    <Zap size={14} />
                    {connectLoading ? 'Stripe öffnet…' : 'Mit Stripe verbinden'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold transition-colors flex items-center justify-center gap-2 text-sm">
          <Save size={15} />
          {saved ? 'Gespeichert' : loading ? 'Wird gespeichert…' : 'Einstellungen speichern'}
        </button>
      </form>

      {/* Mitglieder-Anmeldung */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <UserPlus size={12} /> Mitglieder-Anmeldung
          </p>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-slate-500">{signupEnabled ? 'Aktiv' : 'Inaktiv'}</span>
            <button type="button" onClick={() => setSignupEnabled(v => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${signupEnabled ? 'bg-amber-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${signupEnabled ? 'translate-x-4' : ''}`} />
            </button>
          </label>
        </div>

        <div className="p-5 space-y-4">
          {/* Signup link */}
          {signupToken && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Link2 size={11} /> Anmelde-Link
              </p>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-xs font-mono text-slate-600 flex-1 truncate min-w-0">{signupUrl}</code>
                <button type="button" onClick={copySignupUrl} className="flex-shrink-0 text-slate-400 hover:text-amber-600 transition-colors">
                  {copiedSignup ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                </button>
                {signupUrl && (
                  <a href={signupUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 text-slate-400 hover:text-amber-600 transition-colors">
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {signupEnabled
                  ? 'Dieser Link ist aktiv — teile ihn mit neuen Mitgliedern.'
                  : 'Aktiviere die Anmeldung oben, damit der Link funktioniert.'}
              </p>
            </div>
          )}

          {/* Contract template */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Vertragsvorlage</label>
            <textarea
              value={contractTemplate}
              onChange={e => setContractTemplate(e.target.value)}
              rows={10}
              placeholder="Mitgliedschaftsvertrag…"
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm font-mono placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-y"
            />
            <p className="text-xs text-slate-400 mt-1">Dieser Text wird dem Mitglied beim Anmelden zum Unterschreiben angezeigt.</p>
          </div>

          <button type="button" onClick={handleSignupSave} disabled={signupSaving}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <Save size={14} />
            {signupSaved ? 'Gespeichert ✓' : signupSaving ? 'Wird gespeichert…' : 'Anmeldung speichern'}
          </button>
        </div>
      </div>

      {/* Production Checklist */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Shield size={12} /> Produktiv-Checkliste
          </p>
        </div>
        <div className="divide-y divide-gray-100">

          {/* APP_URL */}
          <div className="px-5 py-3 flex items-start gap-3">
            <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
              !webhookUrl.includes('localhost') ? 'bg-green-100' : 'bg-amber-100'
            }`}>
              {!webhookUrl.includes('localhost')
                ? <Check size={10} className="text-green-600" />
                : <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">Produktions-URL</p>
              {webhookUrl.includes('localhost')
                ? <p className="text-xs text-amber-600 mt-0.5">Setze <code className="font-mono bg-amber-50 px-1 rounded">NEXT_PUBLIC_APP_URL</code> in Vercel auf deine Domain.</p>
                : <p className="text-xs text-slate-400 mt-0.5">{webhookUrl.replace('/api/stripe/webhook', '')}</p>
              }
            </div>
          </div>

          {/* Webhook */}
          <div className="px-5 py-3 flex items-start gap-3">
            <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${webhookActive ? 'bg-green-100' : 'bg-amber-100'}`}>
              {webhookActive
                ? <Check size={10} className="text-green-600" />
                : <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">Stripe Webhook</p>
              {webhookActive ? (
                <p className="text-xs text-slate-400 mt-0.5">Webhook aktiv – Zahlungsbestätigungen werden empfangen.</p>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5 mb-2">
                  Im <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">Stripe Dashboard</a> diese URL eintragen (Events: <code className="font-mono bg-gray-100 px-1 rounded text-xs">checkout.session.completed</code>, <code className="font-mono bg-gray-100 px-1 rounded text-xs">payment_intent.payment_failed</code>):
                </p>
              )}
              {!webhookActive && (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <code className="text-xs font-mono text-slate-600 flex-1 truncate">{webhookUrl}</code>
                  <button onClick={copyWebhookUrl} className="flex-shrink-0 text-slate-400 hover:text-amber-600 transition-colors">
                    {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stripe Connect */}
          <div className="px-5 py-3 flex items-start gap-3">
            <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
              stripeAccountId ? 'bg-green-100' : 'bg-amber-100'
            }`}>
              {stripeAccountId
                ? <Check size={10} className="text-green-600" />
                : <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block" />
              }
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Stripe Connect verbunden</p>
              {stripeAccountId
                ? <p className="text-xs text-slate-400 mt-0.5">Beiträge gehen direkt auf dein Konto.</p>
                : <p className="text-xs text-amber-600 mt-0.5">Verbinde dein Stripe-Konto oben.</p>
              }
            </div>
          </div>

          {/* DSGVO */}
          <div className="px-5 py-3 flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Datenschutz</p>
              <p className="text-xs text-slate-400 mt-0.5">
                <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline inline-flex items-center gap-1">
                  Datenschutzerklärung <ExternalLink size={10} />
                </a>
                {' '}— passe Namen und Kontakt an.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
