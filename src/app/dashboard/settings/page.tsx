'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, CreditCard, Save, ExternalLink, CheckCircle2, AlertCircle, Unlink, Zap, Copy, Check, Shield, UserPlus, Link2, FileText, Trash2, Users, ReceiptEuro, Tag } from 'lucide-react'

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
  // Legal
  const [legalName, setLegalName]       = useState('')
  const [legalAddress, setLegalAddress] = useState('')
  const [legalEmail, setLegalEmail]     = useState('')
  const [legalSaving, setLegalSaving]   = useState(false)
  const [legalSaved, setLegalSaved]     = useState(false)
  // Staff
  type StaffMember = { id: string; name: string; email: string; role: string; accepted_at: string | null; invite_token: string }
  const [staffList, setStaffList]           = useState<StaffMember[]>([])
  const [staffEmail, setStaffEmail]         = useState('')
  const [staffName, setStaffName]           = useState('')
  const [staffInviting, setStaffInviting]   = useState(false)
  const [staffInviteUrl, setStaffInviteUrl] = useState<string | null>(null)
  const [copiedStaff, setCopiedStaff]       = useState(false)
  // Gym ID (for public schedule link)
  const [gymId, setGymId]                           = useState<string | null>(null)
  // Signup
  const [signupEnabled, setSignupEnabled]           = useState(false)
  const [signupToken, setSignupToken]               = useState<string | null>(null)
  const [contractTemplate, setContractTemplate]     = useState('')
  const [signupSaving, setSignupSaving]             = useState(false)
  const [signupSaved, setSignupSaved]               = useState(false)
  const [copiedSignup, setCopiedSignup]             = useState(false)
  // Class Types
  const [classTypesInput, setClassTypesInput]   = useState('gi, no-gi, open mat, kids, competition')
  const [classTypesSaving, setClassTypesSaving] = useState(false)
  const [classTypesSaved, setClassTypesSaved]   = useState(false)
  // Invoice & Tax
  const [taxNumber, setTaxNumber]               = useState('')
  const [ustid, setUstid]                       = useState('')
  const [isKleinunternehmer, setIsKleinunternehmer] = useState(true)
  const [invoicePrefix, setInvoicePrefix]       = useState('RE')
  const [bankIban, setBankIban]                 = useState('')
  const [bankBic, setBankBic]                   = useState('')
  const [bankName, setBankName]                 = useState('')
  const [invoiceSaving, setInvoiceSaving]       = useState(false)
  const [invoiceSaved, setInvoiceSaved]         = useState(false)
  // Plan
  const [gymPlan, setGymPlan]       = useState<string>('free')
  const [memberCount, setMemberCount] = useState(0)
  const [planLimit, setPlanLimit]   = useState(30)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [upgradedBanner, setUpgradedBanner] = useState(false)

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/stripe/webhook`
    : '/api/stripe/webhook'

  const signupUrl = typeof window !== 'undefined' && signupToken
    ? `${window.location.origin}/signup/${signupToken}`
    : null

  const stripeConnected = searchParams.get('stripe_connected') === '1'
  const stripeError     = searchParams.get('stripe_error')

  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      setUpgradedBanner(true)
      const t = setTimeout(() => setUpgradedBanner(false), 5000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('gyms').select('*').single().then(async ({ data }) => {
      if (data) {
        setGymId(data.id ?? null)
        setName(data.name ?? '')
        setAddress(data.address ?? '')
        setPhone(data.phone ?? '')
        setEmail(data.email ?? '')
        setMonthlyFee(data.monthly_fee_cents ? ((data.monthly_fee_cents as number) / 100).toFixed(2) : '')
        setStripeAccountId((data as { stripe_account_id: string | null }).stripe_account_id)
        setSignupEnabled(((data as unknown) as { signup_enabled: boolean }).signup_enabled ?? false)
        setSignupToken(((data as unknown) as { signup_token: string | null }).signup_token ?? null)
        setContractTemplate(((data as unknown) as { contract_template: string | null }).contract_template ?? '')
        setLegalName(((data as unknown) as { legal_name: string | null }).legal_name ?? '')
        setLegalAddress(((data as unknown) as { legal_address: string | null }).legal_address ?? '')
        setLegalEmail(((data as unknown) as { legal_email: string | null }).legal_email ?? '')
        setTaxNumber(((data as unknown) as { tax_number: string | null }).tax_number ?? '')
        setUstid(((data as unknown) as { ustid: string | null }).ustid ?? '')
        setIsKleinunternehmer(((data as unknown) as { is_kleinunternehmer: boolean }).is_kleinunternehmer ?? true)
        setInvoicePrefix(((data as unknown) as { invoice_prefix: string | null }).invoice_prefix ?? 'RE')
        setBankIban(((data as unknown) as { bank_iban: string | null }).bank_iban ?? '')
        setBankBic(((data as unknown) as { bank_bic: string | null }).bank_bic ?? '')
        setBankName(((data as unknown) as { bank_name: string | null }).bank_name ?? '')
        const rawClassTypes = (data as any)?.class_types
        if (Array.isArray(rawClassTypes)) setClassTypesInput(rawClassTypes.join(', '))
        // Plan
        const gymPlanData = data as any
        setGymPlan(gymPlanData?.plan ?? 'free')
        setPlanLimit(gymPlanData?.plan_member_limit ?? 30)
        // Active member count
        const { count } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', data.id).eq('is_active', true)
        setMemberCount(count ?? 0)
      }
    })
    fetch('/api/stripe/status').then(r => r.json()).then(d => {
      setStripeConfigured(d.configured)
      setWebhookActive(d.webhookActive)
    })

    // Load staff
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const res = await fetch('/api/staff', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) setStaffList(await res.json())
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

  async function handleUpgrade(plan: string) {
    setLoadingPlan(plan)
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) { window.location.href = `/register?plan=${plan}`; return }
    const res = await fetch('/api/stripe/owner-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setLoadingPlan(null)
  }

  async function handlePortal() {
    setPortalLoading(true)
    const { data: { session } } = await createClient().auth.getSession()
    const res = await fetch('/api/stripe/owner-portal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setPortalLoading(false)
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

  async function handleLegalSave() {
    setLegalSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any)
      .update({ legal_name: legalName || null, legal_address: legalAddress || null, legal_email: legalEmail || null })
      .eq('owner_id', user?.id ?? '')
    setLegalSaving(false); setLegalSaved(true); setTimeout(() => setLegalSaved(false), 2000)
  }

  async function handleInvoiceSave() {
    setInvoiceSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any).update({
      tax_number: taxNumber || null,
      ustid: ustid || null,
      is_kleinunternehmer: isKleinunternehmer,
      invoice_prefix: invoicePrefix || 'RE',
      bank_iban: bankIban || null,
      bank_bic: bankBic || null,
      bank_name: bankName || null,
    }).eq('owner_id', user?.id ?? '')
    setInvoiceSaving(false); setInvoiceSaved(true); setTimeout(() => setInvoiceSaved(false), 2000)
  }

  async function handleClassTypesSave() {
    setClassTypesSaving(true)
    const types = classTypesInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any).update({ class_types: types }).eq('owner_id', user?.id ?? '')
    setClassTypesSaving(false); setClassTypesSaved(true); setTimeout(() => setClassTypesSaved(false), 2000)
  }

  async function handleStaffInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!staffEmail || !staffName) return
    setStaffInviting(true)
    const { data: { session } } = await createClient().auth.getSession()
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ email: staffEmail, name: staffName, role: 'trainer' }),
    })
    if (res.ok) {
      const newStaff = await res.json()
      setStaffList(prev => [newStaff, ...prev])
      const appUrl = window.location.origin
      const url = `${appUrl}/staff/accept?token=${newStaff.invite_token}`
      setStaffInviteUrl(url)
      setStaffEmail('')
      setStaffName('')
    }
    setStaffInviting(false)
  }

  async function handleStaffDelete(id: string) {
    if (!confirm('Trainer wirklich entfernen?')) return
    const { data: { session } } = await createClient().auth.getSession()
    await fetch(`/api/staff/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    setStaffList(prev => prev.filter(s => s.id !== id))
  }

  async function copyStaffUrl() {
    if (!staffInviteUrl) return
    await navigator.clipboard.writeText(staffInviteUrl)
    setCopiedStaff(true)
    setTimeout(() => setCopiedStaff(false), 2000)
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

      {/* Upgrade success banner */}
      {upgradedBanner && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-green-600 flex-shrink-0" />
          <p className="text-green-800 text-sm font-medium">✓ Plan erfolgreich aktualisiert!</p>
        </div>
      )}

      {/* Plan Status Banner */}
      <div className={`rounded-2xl p-5 border mb-5 ${
        gymPlan === 'pro' ? 'bg-slate-900 border-slate-700' :
        gymPlan === 'grow' ? 'bg-amber-50 border-amber-200' :
        gymPlan === 'starter' ? 'bg-blue-50 border-blue-200' :
        'bg-white border-slate-200'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                gymPlan === 'pro' ? 'bg-amber-500 text-white' :
                gymPlan === 'grow' ? 'bg-amber-500 text-white' :
                gymPlan === 'starter' ? 'bg-blue-600 text-white' :
                'bg-slate-200 text-slate-600'
              }`}>
                {gymPlan.toUpperCase()}
              </span>
              <span className={`text-sm font-semibold ${gymPlan === 'pro' ? 'text-white' : 'text-slate-900'}`}>
                Aktueller Plan
              </span>
            </div>
            <p className={`text-sm ${gymPlan === 'pro' ? 'text-slate-300' : 'text-slate-500'}`}>
              {memberCount} / {gymPlan === 'pro' ? '∞' : planLimit} aktive Mitglieder
            </p>
            {gymPlan !== 'pro' && memberCount >= planLimit * 0.9 && (
              <p className="text-amber-600 text-xs mt-1 font-medium">
                Fast am Limit — upgrade für mehr Mitglieder
              </p>
            )}
          </div>
          {gymPlan === 'free' ? (
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => handleUpgrade('starter')}
                disabled={loadingPlan !== null}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loadingPlan ? 'Wird geladen…' : 'Upgraden →'}
              </button>
            </div>
          ) : gymPlan === 'pro' ? (
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-50"
              >
                {portalLoading ? 'Wird geladen…' : 'Abo verwalten'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={() => handleUpgrade(gymPlan === 'starter' ? 'grow' : 'pro')}
                disabled={loadingPlan !== null}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {loadingPlan ? 'Wird geladen…' : 'Plan ändern →'}
              </button>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {portalLoading ? 'Wird geladen…' : 'Abo verwalten'}
              </button>
            </div>
          )}
        </div>
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

          {gymId && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Öffentlicher Stundenplan
              </p>
              <p className="text-slate-500 text-sm mb-3">
                Bette deinen Stundenplan auf deiner Website ein — kein Login nötig.
              </p>
              <div className="space-y-2">
                {/* Direct link */}
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/schedule/${gymId}`}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/schedule/${gymId}`)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Kopieren
                  </button>
                </div>
                {/* iFrame embed code */}
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/schedule/${gymId}?embed=1" width="100%" height="600" frameborder="0" style="border-radius:12px"></iframe>`}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(`<iframe src="${window.location.origin}/schedule/${gymId}?embed=1" width="100%" height="600" frameborder="0" style="border-radius:12px"></iframe>`)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Kopieren
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Datenschutz / Impressum */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <FileText size={12} /> Datenschutz / Impressum
          </p>
          <a href="/datenschutz" target="_blank" rel="noopener noreferrer"
            className="text-xs text-amber-600 hover:text-amber-500 flex items-center gap-1">
            Vorschau <ExternalLink size={11} />
          </a>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">Diese Angaben erscheinen in der Datenschutzerklärung als Verantwortlicher.</p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Name / Firma *</label>
            <input value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Max Mustermann / BJJ Gym GmbH"
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Adresse</label>
            <input value={legalAddress} onChange={e => setLegalAddress(e.target.value)} placeholder="Musterstraße 1, 80331 München"
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">E-Mail (Datenschutzanfragen)</label>
            <input type="email" value={legalEmail} onChange={e => setLegalEmail(e.target.value)} placeholder="datenschutz@gym.de"
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
          </div>
          <button type="button" onClick={handleLegalSave} disabled={legalSaving}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <Save size={14} />
            {legalSaved ? 'Gespeichert ✓' : legalSaving ? 'Wird gespeichert…' : 'Datenschutz speichern'}
          </button>
        </div>
      </div>

      {/* Rechnungen & Steuer */}
      <div className="mt-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <ReceiptEuro size={12} /> Rechnungen &amp; Steuer
          </p>
        </div>
        <div className="p-5 space-y-4">
          {/* Kleinunternehmer toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Kleinunternehmer (§19 UStG)</p>
              <p className="text-xs text-slate-400 mt-0.5">Keine Umsatzsteuer auf Rechnungen</p>
            </div>
            <button type="button" onClick={() => setIsKleinunternehmer(v => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isKleinunternehmer ? 'bg-amber-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isKleinunternehmer ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          {/* Tax fields */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Steuernummer</label>
            <input value={taxNumber} onChange={e => setTaxNumber(e.target.value)} placeholder="12/345/67890"
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
          </div>
          {!isKleinunternehmer && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">USt-IdNr.</label>
              <input value={ustid} onChange={e => setUstid(e.target.value)} placeholder="DE123456789"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
              <p className="text-xs text-slate-400 mt-1">Auf Rechnungen wird 19% USt. ausgewiesen.</p>
            </div>
          )}

          {/* Invoice prefix */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Rechnungspräfix</label>
            <input value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)} placeholder="RE"
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
            <p className="text-xs text-slate-400 mt-1">Beispiel: RE → RE-2025-0001</p>
          </div>

          {/* Bank details */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Bankverbindung</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Bank</label>
                <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Sparkasse München"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">IBAN</label>
                <input value={bankIban} onChange={e => setBankIban(e.target.value)} placeholder="DE89 3704 0044 0532 0130 00"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">BIC</label>
                <input value={bankBic} onChange={e => setBankBic(e.target.value)} placeholder="COBADEFFXXX"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 font-mono" />
              </div>
            </div>
          </div>

          <button type="button" onClick={handleInvoiceSave} disabled={invoiceSaving}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
            <Save size={14} />
            {invoiceSaved ? 'Gespeichert ✓' : invoiceSaving ? 'Wird gespeichert…' : 'Rechnungseinstellungen speichern'}
          </button>
        </div>
      </div>

      {/* Trainings-Typen */}
      <div className="mt-4 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Tag size={15} className="text-slate-400" />
          Trainings-Typen
        </h2>
        <p className="text-slate-500 text-sm mb-4">
          Definiere die Klassen-Typen deines Gyms (kommagetrennt). Standard: gi, no-gi, open mat, kids, competition
        </p>
        <input
          type="text"
          value={classTypesInput}
          onChange={e => setClassTypesInput(e.target.value)}
          placeholder="gi, no-gi, open mat, kids, competition"
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {classTypesInput.split(',').map(s => s.trim()).filter(Boolean).map((t, i) => (
            <span key={i} className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
              {t}
            </span>
          ))}
        </div>
        <button onClick={handleClassTypesSave} disabled={classTypesSaving}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
          {classTypesSaved ? 'Gespeichert ✓' : classTypesSaving ? 'Wird gespeichert…' : 'Speichern'}
        </button>
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
            <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${legalName ? 'bg-green-100' : 'bg-amber-100'}`}>
              {legalName
                ? <Check size={10} className="text-green-600" />
                : <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">Datenschutz</p>
              {legalName ? (
                <p className="text-xs text-slate-400 mt-0.5">
                  Verantwortlicher: <strong className="text-slate-600">{legalName}</strong> ·{' '}
                  <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline inline-flex items-center gap-1">
                    Vorschau <ExternalLink size={10} />
                  </a>
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-0.5">
                  Trage deinen Namen als Verantwortlichen im Abschnitt „Datenschutz / Impressum" oben ein.
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Staff / Trainer */}
      <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Users size={12} /> Trainer &amp; Personal
          </p>
        </div>
        <div className="p-5 space-y-4">
          <form onSubmit={handleStaffInvite} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <input value={staffName} onChange={e => setStaffName(e.target.value)} required placeholder="Max Mustermann"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                <input type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} required placeholder="trainer@gym.de"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400" />
              </div>
            </div>
            <button type="submit" disabled={staffInviting}
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2">
              <UserPlus size={14} />
              {staffInviting ? 'Einladung wird erstellt…' : 'Trainer einladen'}
            </button>
          </form>

          {staffInviteUrl && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                <Link2 size={11} /> Einladungs-Link (jetzt kopieren)
              </p>
              <div className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-2">
                <code className="text-xs font-mono text-slate-600 flex-1 truncate min-w-0">{staffInviteUrl}</code>
                <button type="button" onClick={copyStaffUrl} className="flex-shrink-0 text-slate-400 hover:text-amber-600 transition-colors">
                  {copiedStaff ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                </button>
              </div>
              <p className="text-xs text-amber-700">Kein Resend konfiguriert — schicke diesen Link manuell an den Trainer.</p>
            </div>
          )}

          {staffList.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Aktuelles Personal ({staffList.length})</p>
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                {staffList.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                      <p className="text-xs text-slate-400 truncate">{s.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      s.accepted_at
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                      {s.accepted_at ? 'Aktiv' : 'Eingeladen'}
                    </span>
                    <button type="button" onClick={() => handleStaffDelete(s.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
