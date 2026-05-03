'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import {
  Building2, CreditCard, Save, ExternalLink, CheckCircle2, AlertCircle,
  Unlink, Zap, Copy, Check, Shield, UserPlus, Link2, FileText, Trash2,
  Users, ReceiptEuro, Tag, Award, Globe, Plus, Minus, ImagePlus, X,
  Package, Megaphone, Pin, Edit2, FileSpreadsheet,
} from 'lucide-react'
import { DEFAULT_BELT_SYSTEM, SPORT_PRESETS, resolveBeltSystem, isBeltFreeSport, type BeltSystem, type SportType } from '@/lib/belt-system'

type Tab = 'allgemein' | 'zahlungen' | 'training' | 'zugaenge' | 'vertraege'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'allgemein',  label: 'Allgemein',  icon: <Building2 size={14} /> },
  { id: 'zahlungen',  label: 'Zahlungen',  icon: <CreditCard size={14} /> },
  { id: 'training',   label: 'Training',   icon: <Award size={14} /> },
  { id: 'zugaenge',   label: 'Zugänge',    icon: <Globe size={14} /> },
  { id: 'vertraege',  label: 'Verträge',   icon: <Package size={14} /> },
]

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('allgemein')

  // Gym profile
  const [name, setName]             = useState('')
  const [address, setAddress]       = useState('')
  const [phone, setPhone]           = useState('')
  const [email, setEmail]           = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [loading, setLoading]       = useState(false)
  const [saved, setSaved]           = useState(false)

  // Logo
  const [logoUrl, setLogoUrl]         = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoInputRef                  = useRef<HTMLInputElement>(null)

  // Stripe
  const [stripeConfigured, setStripeConfigured] = useState(false)
  const [webhookActive, setWebhookActive]       = useState(false)
  const [stripeAccountId, setStripeAccountId]   = useState<string | null>(null)
  const [connectLoading, setConnectLoading]     = useState(false)
  const [copiedWebhook, setCopiedWebhook]       = useState(false)
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState<boolean | null>(null)

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
  const [staffEmailSent, setStaffEmailSent] = useState(false)
  const [copiedStaff, setCopiedStaff]       = useState(false)

  // Gym ID & public links
  const [gymId, setGymId]                     = useState<string | null>(null)
  const [gymSlug, setGymSlug]                 = useState('')
  const [slugSaving, setSlugSaving]           = useState(false)
  const [slugSaved, setSlugSaved]             = useState(false)
  const [copiedGymPage, setCopiedGymPage]     = useState(false)
  const [copiedScheduleLink, setCopiedScheduleLink] = useState(false)
  const [copiedEmbedCode, setCopiedEmbedCode]       = useState(false)

  // Signup
  const [signupEnabled, setSignupEnabled]       = useState(false)
  const [signupToken, setSignupToken]           = useState<string | null>(null)
  const [contractTemplate, setContractTemplate] = useState('')
  const [signupSaving, setSignupSaving]         = useState(false)
  const [signupSaved, setSignupSaved]           = useState(false)
  const [copiedSignup, setCopiedSignup]         = useState(false)

  // WhatsApp notifications (CallMeBot)
  const [callmebotKey, setCallmebotKey]         = useState('')
  const [callmebotSaving, setCallmebotSaving]   = useState(false)
  const [callmebotSaved, setCallmebotSaved]     = useState(false)

  // Class Types
  const [classTypesInput, setClassTypesInput]   = useState('gi, no-gi, open mat, kids, competition')
  const [classTypesSaving, setClassTypesSaving] = useState(false)
  const [classTypesSaved, setClassTypesSaved]   = useState(false)

  // Belt System
  const [beltSlots, setBeltSlots]         = useState<BeltSystem>(DEFAULT_BELT_SYSTEM)
  const [beltSaving, setBeltSaving]       = useState(false)
  const [beltSaved, setBeltSaved]         = useState(false)
  const [sportType, setSportType]         = useState<SportType>('bjj')
  const [beltEnabled, setBeltEnabled]     = useState(true)

  // Membership plans
  type Plan = { id: string; name: string; description: string | null; price_cents: number; billing_interval: string; contract_months: number; is_active: boolean; sort_order: number }
  const [plans, setPlans]               = useState<Plan[]>([])
  const [planForm, setPlanForm]         = useState({ name: '', description: '', price: '', billingInterval: 'monthly', contractMonths: '0' })
  const [planFormOpen, setPlanFormOpen] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [planSaving, setPlanSaving]     = useState(false)

  // Announcements
  type Announcement = { id: string; title: string; body: string | null; is_pinned: boolean; expires_at: string | null; created_at: string }
  const [announcements, setAnnouncements]         = useState<Announcement[]>([])
  const [annoForm, setAnnoForm]                   = useState({ title: '', body: '', isPinned: false, expiresAt: '' })
  const [annoFormOpen, setAnnoFormOpen]           = useState(false)
  const [annoSaving, setAnnoSaving]               = useState(false)

  // Invoice & Tax
  const [taxNumber, setTaxNumber]                   = useState('')
  const [ustid, setUstid]                           = useState('')
  const [isKleinunternehmer, setIsKleinunternehmer] = useState(true)
  const [invoicePrefix, setInvoicePrefix]           = useState('RE')
  const [bankIban, setBankIban]                     = useState('')
  const [bankBic, setBankBic]                       = useState('')
  const [bankName, setBankName]                     = useState('')
  const [invoiceSaving, setInvoiceSaving]           = useState(false)
  const [invoiceSaved, setInvoiceSaved]             = useState(false)

  // DATEV
  const [datevBeraternummer, setDatevBeraternummer]     = useState('')
  const [datevMandantennummer, setDatevMandantennummer] = useState('')
  const [datevSaving, setDatevSaving]                   = useState(false)
  const [datevSaved, setDatevSaved]                     = useState(false)

  // Plan
  const [gymPlan, setGymPlan]           = useState<string>('free')
  const [memberCount, setMemberCount]   = useState(0)
  const [planLimit, setPlanLimit]       = useState(30)
  const [loadingPlan, setLoadingPlan]   = useState<string | null>(null)
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
    if (searchParams.get('stripe_connected') === '1' || searchParams.get('stripe_error')) {
      setActiveTab('zahlungen')
    }
  }, [searchParams])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('gyms').select('*').single().then(async ({ data }) => {
      if (data) {
        setGymId(data.id ?? null)
        setGymSlug((data as any).slug ?? '')
        setName(data.name ?? '')
        setAddress(data.address ?? '')
        setPhone(data.phone ?? '')
        setEmail(data.email ?? '')
        setLogoUrl(data.logo_url ?? null)
        setMonthlyFee(data.monthly_fee_cents ? ((data.monthly_fee_cents as number) / 100).toFixed(2) : '')
        setStripeAccountId((data as any).stripe_account_id)
        if ((data as any).stripe_account_id && (data as any).stripe_charges_enabled !== undefined) {
          setStripeChargesEnabled((data as any).stripe_charges_enabled ?? null)
        }
        setSignupEnabled((data as any).signup_enabled ?? false)
        setSignupToken((data as any).signup_token ?? null)
        setContractTemplate((data as any).contract_template ?? '')
        setCallmebotKey((data as any).callmebot_api_key ?? '')
        setLegalName((data as any).legal_name ?? '')
        setLegalAddress((data as any).legal_address ?? '')
        setLegalEmail((data as any).legal_email ?? '')
        setTaxNumber((data as any).tax_number ?? '')
        setUstid((data as any).ustid ?? '')
        setIsKleinunternehmer((data as any).is_kleinunternehmer ?? true)
        setInvoicePrefix((data as any).invoice_prefix ?? 'RE')
        setBankIban((data as any).bank_iban ?? '')
        setBankBic((data as any).bank_bic ?? '')
        setBankName((data as any).bank_name ?? '')
        setDatevBeraternummer((data as any).datev_beraternummer ?? '')
        setDatevMandantennummer((data as any).datev_mandantennummer ?? '')
        const rawClassTypes = (data as any)?.class_types
        if (Array.isArray(rawClassTypes)) setClassTypesInput(rawClassTypes.join(', '))
        const savedSport = (data as any)?.sport_type as SportType | undefined
        if (savedSport) setSportType(savedSport)
        setBeltEnabled((data as any)?.belt_system_enabled ?? true)
        setBeltSlots(resolveBeltSystem((data as any)?.belt_system))
        setGymPlan((data as any)?.plan ?? 'free')
        setPlanLimit((data as any)?.plan_member_limit ?? 30)
        const { count } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('gym_id', data.id).eq('is_active', true)
        setMemberCount(count ?? 0)
        // Load plans + announcements
        const [{ data: plansData }, { data: annoData }] = await Promise.all([
          (supabase.from('membership_plans') as any).select('*').eq('gym_id', data.id).order('sort_order'),
          (supabase.from('gym_announcements') as any).select('*').eq('gym_id', data.id).order('created_at', { ascending: false }),
        ])
        if (plansData) setPlans(plansData)
        if (annoData)  setAnnouncements(annoData)
      }
    })
    fetch('/api/stripe/status').then(r => r.json()).then(d => {
      setStripeConfigured(d.configured)
      setWebhookActive(d.webhookActive)
    })
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const res = await fetch('/api/staff', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (res.ok) setStaffList(await res.json())
      // Check Stripe Connect account completion status
      const statusRes = await fetch('/api/stripe/connect', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        if (statusData.connected) setStripeChargesEnabled(statusData.charges_enabled ?? false)
        else setStripeChargesEnabled(null)
      }
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

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith('image/')) return
    setLogoUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLogoUploading(false); return }
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/logo-${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('gym-logos')
      .upload(path, file, { contentType: file.type })
    if (uploadErr) { alert('Upload fehlgeschlagen: ' + uploadErr.message); setLogoUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('gym-logos').getPublicUrl(path)
    await supabase.from('gyms').update({ logo_url: publicUrl }).eq('owner_id', user.id)
    setLogoUrl(publicUrl)
    window.dispatchEvent(new CustomEvent('gym-logo-updated', { detail: { url: publicUrl } }))
    setLogoUploading(false)
  }

  async function handleLogoRemove() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('gyms').update({ logo_url: null }).eq('owner_id', user.id)
    setLogoUrl(null)
    window.dispatchEvent(new CustomEvent('gym-logo-updated', { detail: { url: null } }))
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
    const res = await fetch('/api/stripe/owner-portal', { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setPortalLoading(false)
  }

  async function handleSlugSave() {
    if (!gymSlug.trim()) return
    setSlugSaving(true)
    const clean = gymSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    setGymSlug(clean)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any).update({ slug: clean }).eq('owner_id', user?.id ?? '')
    setSlugSaving(false); setSlugSaved(true); setTimeout(() => setSlugSaved(false), 2000)
  }

  async function handleSignupSave() {
    setSignupSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any).update({ signup_enabled: signupEnabled, contract_template: contractTemplate }).eq('owner_id', user?.id ?? '')
    setSignupSaving(false); setSignupSaved(true); setTimeout(() => setSignupSaved(false), 2000)
  }

  async function handleCallmebotSave() {
    setCallmebotSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any).update({ callmebot_api_key: callmebotKey.trim() || null }).eq('owner_id', user?.id ?? '')
    setCallmebotSaving(false); setCallmebotSaved(true); setTimeout(() => setCallmebotSaved(false), 2000)
  }

  async function handleLegalSave() {
    setLegalSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any).update({ legal_name: legalName||null, legal_address: legalAddress||null, legal_email: legalEmail||null }).eq('owner_id', user?.id ?? '')
    setLegalSaving(false); setLegalSaved(true); setTimeout(() => setLegalSaved(false), 2000)
  }

  async function handleInvoiceSave() {
    setInvoiceSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any).update({
      tax_number: taxNumber||null, ustid: ustid||null, is_kleinunternehmer: isKleinunternehmer,
      invoice_prefix: invoicePrefix||'RE', bank_iban: bankIban||null, bank_bic: bankBic||null, bank_name: bankName||null,
    }).eq('owner_id', user?.id ?? '')
    setInvoiceSaving(false); setInvoiceSaved(true); setTimeout(() => setInvoiceSaved(false), 2000)
  }

  async function handleDatevSave() {
    setDatevSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any).update({
      datev_beraternummer: datevBeraternummer || null,
      datev_mandantennummer: datevMandantennummer || null,
    }).eq('owner_id', user?.id ?? '')
    setDatevSaving(false); setDatevSaved(true); setTimeout(() => setDatevSaved(false), 2000)
  }

  async function handleClassTypesSave() {
    setClassTypesSaving(true)
    const types = classTypesInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any).update({ class_types: types }).eq('owner_id', user?.id ?? '')
    setClassTypesSaving(false); setClassTypesSaved(true); setTimeout(() => setClassTypesSaved(false), 2000)
  }

  async function handleBeltSave() {
    setBeltSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await (supabase.from('gyms') as any).update({ belt_system: beltSlots, sport_type: sportType, belt_system_enabled: beltEnabled }).eq('owner_id', user?.id ?? '')
    setBeltSaving(false); setBeltSaved(true); setTimeout(() => setBeltSaved(false), 2000)
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
      setStaffInviteUrl(`${window.location.origin}/staff/accept?token=${newStaff.invite_token}`)
      setStaffEmailSent(newStaff.emailSent === true)
      setStaffEmail('')
      setStaffName('')
    }
    setStaffInviting(false)
  }

  async function handleStaffDelete(id: string) {
    if (!confirm('Trainer wirklich entfernen?')) return
    const { data: { session } } = await createClient().auth.getSession()
    await fetch(`/api/staff/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
    setStaffList(prev => prev.filter(s => s.id !== id))
  }

  async function handlePlanSave() {
    if (!planForm.name || !planForm.price) return
    setPlanSaving(true)
    const priceCents = Math.round(parseFloat(planForm.price.replace(',', '.')) * 100)
    const { data: { session } } = await createClient().auth.getSession()
    const token = session?.access_token ?? ''

    if (editingPlanId) {
      // For edits, just update DB directly (Stripe price can't be changed, would need new price)
      const payload = {
        name: planForm.name, description: planForm.description || null,
        price_cents: priceCents, billing_interval: planForm.billingInterval,
        contract_months: parseInt(planForm.contractMonths) || 0,
      }
      const supabase = createClient()
      const { data } = await (supabase.from('membership_plans') as any).update(payload).eq('id', editingPlanId).select().single()
      if (data) setPlans(ps => ps.map(p => p.id === editingPlanId ? { ...p, ...payload } : p))
      setEditingPlanId(null)
    } else {
      // New plan — call API to also create Stripe product+price
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: planForm.name,
          description: planForm.description || null,
          price_cents: priceCents,
          billing_interval: planForm.billingInterval,
          contract_months: parseInt(planForm.contractMonths) || 0,
        }),
      })
      const json = await res.json()
      if (res.ok && json.plan) setPlans(ps => [...ps, json.plan])
    }
    setPlanFormOpen(false)
    setPlanForm({ name: '', description: '', price: '', billingInterval: 'monthly', contractMonths: '0' })
    setPlanSaving(false)
  }

  async function handlePlanDelete(planId: string) {
    if (!confirm('Tarif wirklich löschen?')) return
    const { data: { session } } = await createClient().auth.getSession()
    const res = await fetch(`/api/plans/${planId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    if (res.ok) setPlans(ps => ps.filter(p => p.id !== planId))
  }

  function handlePlanEdit(plan: Plan) {
    setPlanForm({
      name: plan.name, description: plan.description ?? '',
      price: (plan.price_cents / 100).toFixed(2).replace('.', ','),
      billingInterval: plan.billing_interval,
      contractMonths: String(plan.contract_months),
    })
    setEditingPlanId(plan.id); setPlanFormOpen(true)
  }

  async function handleAnnoSave() {
    if (!annoForm.title) return
    setAnnoSaving(true)
    const supabase = createClient()
    const payload = {
      gym_id: gymId, title: annoForm.title, body: annoForm.body || null,
      is_pinned: annoForm.isPinned,
      expires_at: annoForm.expiresAt ? new Date(annoForm.expiresAt).toISOString() : null,
    }
    const { data } = await (supabase.from('gym_announcements') as any).insert(payload).select().single()
    if (data) setAnnouncements(prev => [data, ...prev])
    setAnnoForm({ title: '', body: '', isPinned: false, expiresAt: '' })
    setAnnoFormOpen(false); setAnnoSaving(false)
  }

  async function handleAnnoDelete(id: string) {
    const supabase = createClient()
    await (supabase.from('gym_announcements') as any).delete().eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  function copyWithFeedback(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
  const saveBtnCls = 'w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2'
  const sectionCls = 'bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden'
  const sectionHeaderCls = 'px-5 py-3 border-b border-zinc-100 bg-zinc-50'

  function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
      <div className={sectionHeaderCls}>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          {icon} {title}
        </p>
      </div>
    )
  }

  function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
    return (
      <div>
        {label && <p className="text-xs font-medium text-zinc-500 mb-1.5">{label}</p>}
        <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
          <code className="text-xs font-mono text-zinc-600 flex-1 truncate min-w-0">{value}</code>
          <button type="button" onClick={onCopy} className="flex-shrink-0 flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-600 transition-colors">
            {copied ? <><Check size={13} className="text-green-500" /><span className="text-green-600 font-medium">Kopiert!</span></> : <><Copy size={13} /><span>Kopieren</span></>}
          </button>
        </div>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-lg">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">Einstellungen</h1>
        <p className="text-zinc-400 text-xs mt-0.5">Gym konfigurieren</p>
      </div>

      {/* Banners */}
      {upgradedBanner && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-zinc-500 flex-shrink-0" />
          <p className="text-zinc-800 text-sm font-medium">✓ Plan erfolgreich aktualisiert!</p>
        </div>
      )}
      {stripeConnected && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-zinc-500 flex-shrink-0" />
          <p className="text-zinc-800 text-sm font-medium">Stripe erfolgreich verbunden!</p>
        </div>
      )}
      {stripeError && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200 flex items-center gap-2">
          <AlertCircle size={15} className="text-zinc-500 flex-shrink-0" />
          <p className="text-zinc-700 text-sm">Verbindung fehlgeschlagen: {stripeError}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: ALLGEMEIN ─────────────────────────────────────────────────── */}
      {activeTab === 'allgemein' && (
        <div className="space-y-4">
          {/* Plan */}
          <div className={`rounded-2xl p-5 border ${
            gymPlan === 'pro' ? 'bg-zinc-900 border-slate-700' :
            gymPlan === 'grow' ? 'bg-amber-50 border-amber-200' :
            gymPlan === 'starter' ? 'bg-zinc-50 border-zinc-200' : 'bg-white border-zinc-200'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    gymPlan === 'pro' ? 'bg-amber-500 text-white' :
                    gymPlan === 'grow' ? 'bg-amber-500 text-white' :
                    gymPlan === 'starter' ? 'bg-zinc-700 text-white' : 'bg-zinc-200 text-zinc-600'
                  }`}>{gymPlan.toUpperCase()}</span>
                  <span className={`text-sm font-semibold ${gymPlan === 'pro' ? 'text-white' : 'text-zinc-900'}`}>Aktueller Plan</span>
                </div>
                <p className={`text-sm ${gymPlan === 'pro' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {memberCount} / {gymPlan === 'pro' ? '∞' : planLimit} aktive Mitglieder
                </p>
                {gymPlan !== 'pro' && memberCount >= planLimit * 0.9 && (
                  <p className="text-amber-600 text-xs mt-1 font-medium">Fast am Limit — upgrade für mehr Mitglieder</p>
                )}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                {gymPlan === 'free' ? (
                  <button onClick={() => handleUpgrade('starter')} disabled={loadingPlan !== null}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors">
                    {loadingPlan ? 'Wird geladen…' : 'Upgraden →'}
                  </button>
                ) : gymPlan === 'pro' ? (
                  <button onClick={handlePortal} disabled={portalLoading}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-50 transition-colors">
                    {portalLoading ? 'Wird geladen…' : 'Abo verwalten'}
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleUpgrade(gymPlan === 'starter' ? 'grow' : 'pro')} disabled={loadingPlan !== null}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors">
                      {loadingPlan ? 'Wird geladen…' : 'Plan ändern →'}
                    </button>
                    <button onClick={handlePortal} disabled={portalLoading}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors">
                      {portalLoading ? 'Wird geladen…' : 'Abo verwalten'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Gym Profile */}
          <div className={sectionCls}>
            <SectionHeader icon={<Building2 size={12} />} title="Gym-Profil" />
            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Logo upload */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Gym-Logo</label>
                <div className="flex items-center gap-4">
                  {/* Preview */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                    {logoUrl ? (
                      <Image src={logoUrl} alt="Logo" width={64} height={64} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full bg-[#111827]">
                        <span className="text-[11px] font-black text-amber-400 italic leading-none">oss</span>
                        <div className="flex gap-0.5">
                          {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-amber-500 opacity-70" />)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                    >
                      <ImagePlus size={13} />
                      {logoUploading ? 'Wird hochgeladen…' : logoUrl ? 'Logo ändern' : 'Logo hochladen'}
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-red-500 hover:border-red-200 text-xs font-medium transition-colors"
                      >
                        <X size={12} /> Entfernen
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-400 mt-2">Erscheint im Menü und auf Mitglieder-Portalen. PNG oder JPG, min. 100×100 px.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Gym-Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Adresse</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Musterstraße 1, 80331 München" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Telefon</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49 89 123456" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">E-Mail</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@gym.de" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Monatlicher Beitrag (€)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">€</span>
                  <input value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} placeholder="79,00"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                </div>
                <p className="text-xs text-zinc-400 mt-1">Standard für neue Zahlungslinks.</p>
              </div>
              <button type="submit" disabled={loading} className={saveBtnCls}>
                <Save size={15} />
                {saved ? 'Gespeichert ✓' : loading ? 'Wird gespeichert…' : 'Profil speichern'}
              </button>
            </form>
          </div>

          {/* Produktiv-Checkliste */}
          <div className={sectionCls}>
            <SectionHeader icon={<Shield size={12} />} title="Produktiv-Checkliste" />
            <div className="divide-y divide-gray-100">
              {[
                {
                  ok: !webhookUrl.includes('localhost'),
                  title: 'Produktions-URL',
                  desc: webhookUrl.includes('localhost')
                    ? <span className="text-amber-600">Setze <code className="font-mono bg-amber-50 px-1 rounded">NEXT_PUBLIC_APP_URL</code> in Vercel auf deine Domain.</span>
                    : <span className="text-zinc-400">{webhookUrl.replace('/api/stripe/webhook', '')}</span>,
                },
                {
                  ok: webhookActive,
                  title: 'Stripe Webhook',
                  desc: webhookActive
                    ? <span className="text-zinc-400">Webhook aktiv – Zahlungsbestätigungen werden empfangen.</span>
                    : <span className="text-zinc-400">Im <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">Stripe Dashboard</a> Webhook-URL eintragen (Tab Zahlungen).</span>,
                },
                {
                  ok: !!stripeAccountId,
                  title: 'Stripe Connect verbunden',
                  desc: stripeAccountId
                    ? <span className="text-zinc-400">Beiträge gehen direkt auf dein Konto.</span>
                    : <span className="text-amber-600">Verbinde dein Stripe-Konto im Tab Zahlungen.</span>,
                },
                {
                  ok: !!legalName,
                  title: 'Datenschutz',
                  desc: legalName
                    ? <span className="text-zinc-400">Verantwortlicher: <strong className="text-zinc-600">{legalName}</strong> · <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline inline-flex items-center gap-1">Vorschau <ExternalLink size={10} /></a></span>
                    : <span className="text-amber-600">Name als Verantwortlichen im Tab Zahlungen eintragen.</span>,
                },
              ].map(item => (
                <div key={item.title} className="px-5 py-3 flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${item.ok ? 'bg-zinc-200' : 'bg-amber-100'}`}>
                    {item.ok ? <Check size={10} className="text-zinc-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-amber-500 block" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800">{item.title}</p>
                    <p className="text-xs mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: ZAHLUNGEN ────────────────────────────────────────────────── */}
      {activeTab === 'zahlungen' && (
        <div className="space-y-4">

          {/* Stripe */}
          <div className={sectionCls}>
            <SectionHeader icon={<CreditCard size={12} />} title="Stripe" />
            <div className="p-5 space-y-4">
              <div className={`rounded-lg p-3 ${stripeConfigured ? 'bg-zinc-100 border border-zinc-200' : 'bg-amber-50 border border-amber-200'}`}>
                <p className={`text-sm font-medium ${stripeConfigured ? 'text-zinc-800' : 'text-amber-800'}`}>
                  {stripeConfigured ? '✓ Stripe API-Key aktiv' : 'Stripe API-Key fehlt'}
                </p>
              </div>

              {/* Connect */}
              <div className="rounded-lg border border-zinc-200 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-800">Stripe Connect</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stripeAccountId ? 'bg-zinc-200 text-zinc-700 border border-zinc-300' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'}`}>
                    {stripeAccountId ? 'Verbunden' : 'Nicht verbunden'}
                  </span>
                </div>
                <div className="p-4">
                  {stripeAccountId ? (
                    <div className="space-y-3">
                      {stripeChargesEnabled === false && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-amber-800">Onboarding unvollständig</p>
                            <p className="text-xs text-amber-700 mt-0.5">Dein Stripe-Konto kann noch keine Zahlungen empfangen. Klicke auf &quot;Einrichtung fortsetzen&quot; um das Onboarding abzuschließen.</p>
                          </div>
                        </div>
                      )}
                      {stripeChargesEnabled === true && (
                        <div className="flex items-center gap-2 text-zinc-600 text-sm">
                          <CheckCircle2 size={14} className="text-zinc-400 flex-shrink-0" />
                          Beiträge gehen direkt auf dein Stripe-Konto.
                        </div>
                      )}
                      {stripeChargesEnabled === null && (
                        <div className="flex items-center gap-2 text-zinc-600 text-sm">
                          <CheckCircle2 size={14} className="text-zinc-400 flex-shrink-0" />
                          Beiträge gehen direkt auf dein Stripe-Konto.
                        </div>
                      )}
                      <p className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded text-zinc-500 truncate">{stripeAccountId}</p>
                      <div className="flex gap-2 flex-wrap">
                        {stripeChargesEnabled === false ? (
                          <button type="button" onClick={handleConnect} disabled={connectLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-xs font-semibold transition-colors">
                            <Zap size={11} /> {connectLoading ? 'Stripe öffnet…' : 'Einrichtung fortsetzen'}
                          </button>
                        ) : (
                          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium transition-colors">
                            <ExternalLink size={11} /> Stripe Dashboard
                          </a>
                        )}
                        <button type="button" onClick={handleDisconnect}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition-colors border border-red-200">
                          <Unlink size={11} /> Trennen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-zinc-600 text-sm">Verbinde dein Konto — Beiträge landen direkt bei dir. Osss behält <strong>2%</strong> Plattformgebühr.</p>
                      <div className="text-xs text-zinc-500 bg-zinc-50 rounded-lg p-3 space-y-1">
                        <p>Beispiel 80 € Monatsbeitrag:</p>
                        <p>→ <strong className="text-zinc-700">78,40 €</strong> auf dein Konto</p>
                        <p>→ <strong className="text-zinc-700">1,60 €</strong> Plattformgebühr + Stripe-Gebühren</p>
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

              {/* Webhook URL */}
              {!webhookActive && (
                <div>
                  <p className="text-xs font-medium text-zinc-600 mb-1.5">
                    Webhook-URL — im <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">Stripe Dashboard</a> eintragen:
                  </p>
                  <CopyRow label="" value={webhookUrl} copied={copiedWebhook} onCopy={() => copyWithFeedback(webhookUrl, setCopiedWebhook)} />
                </div>
              )}
            </div>
          </div>

          {/* Rechnungen & Steuer */}
          <div className={sectionCls}>
            <SectionHeader icon={<ReceiptEuro size={12} />} title="Rechnungen & Steuer" />
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-700">Kleinunternehmer (§19 UStG)</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Keine Umsatzsteuer auf Rechnungen</p>
                </div>
                <button type="button" onClick={() => setIsKleinunternehmer(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isKleinunternehmer ? 'bg-amber-500' : 'bg-zinc-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isKleinunternehmer ? 'translate-x-4' : ''}`} />
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Steuernummer</label>
                <input value={taxNumber} onChange={e => setTaxNumber(e.target.value)} placeholder="12/345/67890" className={inputCls} />
              </div>
              {!isKleinunternehmer && (
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">USt-IdNr.</label>
                  <input value={ustid} onChange={e => setUstid(e.target.value)} placeholder="DE123456789" className={inputCls} />
                  <p className="text-xs text-zinc-400 mt-1">Auf Rechnungen wird 19% USt. ausgewiesen.</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Rechnungspräfix</label>
                <input value={invoicePrefix} onChange={e => setInvoicePrefix(e.target.value)} placeholder="RE" className={inputCls} />
                <p className="text-xs text-zinc-400 mt-1">Beispiel: RE → RE-2025-0001</p>
              </div>
              <div className="pt-2 border-t border-zinc-100">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Bankverbindung</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">Bank</label>
                    <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Sparkasse München" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">IBAN</label>
                    <input value={bankIban} onChange={e => setBankIban(e.target.value)} placeholder="DE89 3704 0044 0532 0130 00" className={`${inputCls} font-mono`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1.5">BIC</label>
                    <input value={bankBic} onChange={e => setBankBic(e.target.value)} placeholder="COBADEFFXXX" className={`${inputCls} font-mono`} />
                  </div>
                </div>
              </div>
              <button type="button" onClick={handleInvoiceSave} disabled={invoiceSaving} className={saveBtnCls}>
                <Save size={14} />
                {invoiceSaved ? 'Gespeichert ✓' : invoiceSaving ? 'Wird gespeichert…' : 'Rechnungseinstellungen speichern'}
              </button>
            </div>
          </div>

          {/* DATEV */}
          <div className={sectionCls}>
            <div className={sectionHeaderCls}>
              <SectionHeader icon={<FileSpreadsheet size={12} />} title="DATEV-Export" />
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-500">
                Diese Nummern bekommst du von deinem Steuerberater. Sie werden in den DATEV Buchungsstapel-Export eingebettet, damit dein Steuerberater die Datei direkt importieren kann.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Beraternummer</label>
                  <input value={datevBeraternummer} onChange={e => setDatevBeraternummer(e.target.value)}
                    placeholder="z. B. 12345" className={inputCls} maxLength={7} />
                  <p className="text-xs text-zinc-400 mt-1">5–7-stellig, vom Steuerberater</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1.5">Mandantennummer</label>
                  <input value={datevMandantennummer} onChange={e => setDatevMandantennummer(e.target.value)}
                    placeholder="z. B. 1001" className={inputCls} maxLength={5} />
                  <p className="text-xs text-zinc-400 mt-1">1–5-stellig, vom Steuerberater</p>
                </div>
              </div>
              <button type="button" onClick={handleDatevSave} disabled={datevSaving} className={saveBtnCls}>
                <Save size={14} />
                {datevSaved ? 'Gespeichert ✓' : datevSaving ? 'Wird gespeichert…' : 'DATEV-Einstellungen speichern'}
              </button>
            </div>
          </div>

          {/* Datenschutz / Impressum */}
          <div className={sectionCls}>
            <div className={`${sectionHeaderCls} flex items-center justify-between`}>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <FileText size={12} /> Datenschutz / Impressum
              </p>
              <a href="/datenschutz" target="_blank" rel="noopener noreferrer"
                className="text-xs text-amber-600 hover:text-amber-500 flex items-center gap-1">
                Vorschau <ExternalLink size={11} />
              </a>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-500">Diese Angaben erscheinen in der Datenschutzerklärung als Verantwortlicher.</p>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Name / Firma *</label>
                <input value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="Max Mustermann / BJJ Gym GmbH" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Adresse</label>
                <input value={legalAddress} onChange={e => setLegalAddress(e.target.value)} placeholder="Musterstraße 1, 80331 München" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">E-Mail (Datenschutzanfragen)</label>
                <input type="email" value={legalEmail} onChange={e => setLegalEmail(e.target.value)} placeholder="datenschutz@gym.de" className={inputCls} />
              </div>
              <button type="button" onClick={handleLegalSave} disabled={legalSaving} className={saveBtnCls}>
                <Save size={14} />
                {legalSaved ? 'Gespeichert ✓' : legalSaving ? 'Wird gespeichert…' : 'Datenschutz speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: TRAINING ─────────────────────────────────────────────────── */}
      {activeTab === 'training' && (
        <div className="space-y-4">

          {/* Trainings-Typen */}
          <div className={sectionCls}>
            <SectionHeader icon={<Tag size={12} />} title="Trainings-Typen" />
            <div className="p-5 space-y-4">
              <p className="text-zinc-500 text-sm">
                Kommagetrennte Liste der Klassen-Typen. Standard: gi, no-gi, open mat, kids, competition
              </p>
              <input
                type="text"
                value={classTypesInput}
                onChange={e => setClassTypesInput(e.target.value)}
                placeholder="gi, no-gi, open mat, kids, competition"
                className={inputCls}
              />
              <div className="flex flex-wrap gap-2">
                {classTypesInput.split(',').map(s => s.trim()).filter(Boolean).map((t, i) => (
                  <span key={i} className="px-2 py-1 rounded-full bg-zinc-100 text-zinc-700 text-xs font-medium">{t}</span>
                ))}
              </div>
              <button onClick={handleClassTypesSave} disabled={classTypesSaving} className={saveBtnCls}>
                <Save size={14} />
                {classTypesSaved ? 'Gespeichert ✓' : classTypesSaving ? 'Wird gespeichert…' : 'Speichern'}
              </button>
            </div>
          </div>

          {/* Belt System */}
          <div className={sectionCls}>
            <SectionHeader icon={<Award size={12} />} title="Gürtelsystem" />
            <div className="p-5 space-y-4">
              {/* Sport type selector */}
              <div>
                <p className="text-xs font-medium text-zinc-600 mb-2">Sportart</p>
                <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                  {([
                    { id: 'bjj',       label: 'BJJ',       belt: true  },
                    { id: 'judo',      label: 'Judo',      belt: true  },
                    { id: 'karate',    label: 'Karate',    belt: true  },
                    { id: 'taekwondo', label: 'Taekwondo', belt: true  },
                    { id: 'mma',       label: 'MMA',       belt: false },
                    { id: 'muaythai',  label: 'Muay Thai', belt: false },
                    { id: 'boxing',    label: 'Boxen',     belt: false },
                    { id: 'wrestling', label: 'Ringen',    belt: false },
                    { id: 'custom',    label: 'Eigene',    belt: null  },
                  ] as { id: SportType; label: string; belt: boolean | null }[]).map(sport => (
                    <button
                      key={sport.id}
                      type="button"
                      onClick={() => {
                        setSportType(sport.id)
                        if (sport.belt === false) {
                          setBeltEnabled(false)
                        } else if (sport.belt === true) {
                          setBeltEnabled(true)
                          if (sport.id !== 'custom' && sport.id in SPORT_PRESETS) {
                            setBeltSlots(SPORT_PRESETS[sport.id as keyof typeof SPORT_PRESETS])
                          }
                        }
                      }}
                      className={`py-2 rounded-lg text-xs font-semibold transition-all border ${
                        sportType === sport.id
                          ? 'bg-zinc-900 text-white border-slate-900'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:border-slate-300'
                      }`}
                    >
                      {sport.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  {isBeltFreeSport(sportType)
                    ? 'Ohne Gürtelsystem — Belt-Tracking im Dashboard deaktiviert.'
                    : sportType === 'custom'
                      ? 'Eigene Stufen frei definierbar — füge Stufen hinzu oder entferne sie.'
                      : 'Vorkonfiguriertes System — Bezeichnungen und Farben noch anpassbar.'}
                </p>
              </div>

              {/* Belt enabled toggle */}
              <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                <div>
                  <p className="text-sm font-medium text-zinc-700">Gürtelsystem aktiv</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {beltEnabled ? 'Gürtel & Promotions werden im Dashboard angezeigt.' : 'Belt-Tracking deaktiviert — nur Mitglieder & Anwesenheit.'}
                  </p>
                </div>
                <button type="button" onClick={() => setBeltEnabled(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${beltEnabled ? 'bg-amber-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${beltEnabled ? 'translate-x-4' : ''}`} />
                </button>
              </div>

              {/* Belt slot rows — only when enabled */}
              {!beltEnabled && (
                <div className="text-center py-6 text-zinc-400 text-sm">
                  Gürtelsystem deaktiviert. Schalte es oben ein um Stufen zu konfigurieren.
                </div>
              )}
              <div className={`space-y-2 ${!beltEnabled ? 'opacity-30 pointer-events-none' : ''}`}>
                {beltSlots.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 w-4 text-right flex-shrink-0">{i + 1}.</span>
                    <input
                      type="text"
                      value={slot.label}
                      maxLength={20}
                      onChange={e => setBeltSlots(prev => prev.map((s, j) => j === i ? { ...s, label: e.target.value } : s))}
                      className="flex-1 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-0"
                      placeholder="z.B. Gelb"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input type="color" value={slot.bg} title="Hintergrundfarbe"
                        onChange={e => setBeltSlots(prev => prev.map((s, j) => j === i ? { ...s, bg: e.target.value } : s))}
                        className="w-7 h-7 rounded cursor-pointer border border-zinc-200" />
                      <input type="color" value={slot.text} title="Textfarbe"
                        onChange={e => setBeltSlots(prev => prev.map((s, j) => j === i ? { ...s, text: e.target.value } : s))}
                        className="w-7 h-7 rounded cursor-pointer border border-zinc-200" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold w-16 text-center flex-shrink-0"
                      style={{ backgroundColor: slot.bg, color: slot.text }}>
                      {slot.label || '…'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBeltSlots(prev => prev.filter((_, j) => j !== i))}
                      disabled={beltSlots.length <= 1}
                      className="flex-shrink-0 text-zinc-300 hover:text-red-400 disabled:opacity-20 transition-colors"
                      title="Stufe entfernen"
                    >
                      <Minus size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setBeltSlots(prev => [...prev, { key: `slot_${prev.length + 1}`, label: '', bg: '#e2e8f0', text: '#1e293b' }])}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-amber-600 transition-colors"
              >
                <Plus size={13} /> Stufe hinzufügen
              </button>

              <button onClick={handleBeltSave} disabled={beltSaving} className={saveBtnCls}>
                <Save size={14} />
                {beltSaved ? 'Gespeichert ✓' : beltSaving ? 'Wird gespeichert…' : 'Gürtelsystem speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: ZUGÄNGE ──────────────────────────────────────────────────── */}
      {activeTab === 'zugaenge' && (
        <div className="space-y-4">

          {/* Mitglieder-Anmeldung */}
          <div className={sectionCls}>
            <div className={`${sectionHeaderCls} flex items-center justify-between`}>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <UserPlus size={12} /> Mitglieder-Anmeldung
              </p>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs text-zinc-500">{signupEnabled ? 'Aktiv' : 'Inaktiv'}</span>
                <button type="button" onClick={() => setSignupEnabled(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${signupEnabled ? 'bg-amber-500' : 'bg-zinc-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${signupEnabled ? 'translate-x-4' : ''}`} />
                </button>
              </label>
            </div>
            <div className="p-5 space-y-4">
              {signupToken && (
                <div>
                  <CopyRow
                    label="Anmelde-Link"
                    value={signupUrl ?? ''}
                    copied={copiedSignup}
                    onCopy={() => copyWithFeedback(signupUrl ?? '', setCopiedSignup)}
                  />
                  {signupUrl && (
                    <a href={signupUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline mt-1">
                      <ExternalLink size={11} /> Vorschau
                    </a>
                  )}
                  <p className="text-xs text-zinc-400 mt-1">
                    {signupEnabled ? 'Aktiv — teile diesen Link mit neuen Mitgliedern.' : 'Aktiviere die Anmeldung oben, damit der Link funktioniert.'}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Vertragsvorlage</label>
                <textarea
                  value={contractTemplate}
                  onChange={e => setContractTemplate(e.target.value)}
                  rows={8}
                  placeholder="Mitgliedschaftsvertrag…"
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm font-mono placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-y"
                />
                <p className="text-xs text-zinc-400 mt-1">Wird dem Mitglied beim Anmelden angezeigt.</p>
              </div>
              <button type="button" onClick={handleSignupSave} disabled={signupSaving} className={saveBtnCls}>
                <Save size={14} />
                {signupSaved ? 'Gespeichert ✓' : signupSaving ? 'Wird gespeichert…' : 'Anmeldung speichern'}
              </button>
            </div>
          </div>

          {/* WhatsApp Benachrichtigungen */}
          <div className={sectionCls}>
            <SectionHeader icon={<Megaphone size={12} />} title="Benachrichtigungen" />
            <div className="p-5 space-y-4">
              <p className="text-zinc-500 text-sm leading-relaxed">
                Erhalte eine <strong>E-Mail</strong> (automatisch an deine Gym-E-Mail) und eine <strong>WhatsApp-Nachricht</strong>, sobald sich jemand über den Anmeldelink oder deine Gym-Seite anmeldet.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 leading-relaxed space-y-1">
                <p className="font-semibold">WhatsApp einrichten (einmalig, kostenlos):</p>
                <p>1. Sende auf WhatsApp an <strong>+34 644 59 98 05</strong> die Nachricht:<br /><code className="bg-amber-100 px-1 rounded">I allow callmebot to send me messages</code></p>
                <p>2. Du bekommst direkt deinen persönlichen API-Key zurück.</p>
                <p>3. Trage den Key hier ein — fertig.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">CallMeBot API-Key</label>
                <input
                  value={callmebotKey}
                  onChange={e => setCallmebotKey(e.target.value)}
                  placeholder="z.B. 1234567"
                  className={inputCls}
                />
                <p className="text-xs text-zinc-400 mt-1">
                  Deine WhatsApp-Nummer hinterlegst du unter <em>Allgemein → Telefon</em>.
                </p>
              </div>
              <button type="button" onClick={handleCallmebotSave} disabled={callmebotSaving} className={saveBtnCls}>
                <Save size={14} />
                {callmebotSaved ? 'Gespeichert ✓' : callmebotSaving ? 'Wird gespeichert…' : 'Benachrichtigungen speichern'}
              </button>
            </div>
          </div>

          {/* Öffentliche Gym-Seite */}
          <div className={sectionCls}>
            <SectionHeader icon={<Globe size={12} />} title="Öffentliche Gym-Seite" />
            <div className="p-5 space-y-4">
              <p className="text-zinc-500 text-sm">
                Deine öffentliche Seite mit Stundenplan, Tarifen und Anmeldeformular.
                Neue Interessenten landen direkt in deiner Lead-Pipeline.
              </p>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1.5">Gym-Slug (URL-Kürzel)</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 shrink-0">osss.pro/gym/</span>
                  <input
                    value={gymSlug}
                    onChange={e => setGymSlug(e.target.value)}
                    placeholder="mein-gym"
                    className={inputCls + ' flex-1'}
                  />
                </div>
                <p className="text-xs text-zinc-400 mt-1">Nur Kleinbuchstaben, Zahlen und Bindestriche.</p>
              </div>
              {gymSlug && (
                <CopyRow
                  label="Gym-Seite"
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/gym/${gymSlug}`}
                  copied={copiedGymPage}
                  onCopy={() => copyWithFeedback(`${window.location.origin}/gym/${gymSlug}`, setCopiedGymPage)}
                />
              )}
              {gymSlug && (
                <a href={`/gym/${gymSlug}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline">
                  <ExternalLink size={11} /> Vorschau öffnen
                </a>
              )}
              <button type="button" onClick={handleSlugSave} disabled={slugSaving || !gymSlug.trim()} className={saveBtnCls}>
                <Save size={14} />
                {slugSaved ? 'Gespeichert ✓' : slugSaving ? 'Wird gespeichert…' : 'URL speichern'}
              </button>
            </div>
          </div>

          {/* Öffentlicher Stundenplan */}
          {gymId && (
            <div className={sectionCls}>
              <SectionHeader icon={<Globe size={12} />} title="Öffentlicher Stundenplan" />
              <div className="p-5 space-y-4">
                <p className="text-zinc-500 text-sm">Bette den Stundenplan auf deiner Website ein — kein Login nötig.</p>
                <CopyRow
                  label="Direktlink"
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/schedule/${gymId}`}
                  copied={copiedScheduleLink}
                  onCopy={() => copyWithFeedback(`${window.location.origin}/schedule/${gymId}`, setCopiedScheduleLink)}
                />
                {(gymPlan === 'grow' || gymPlan === 'pro') ? (
                  <CopyRow
                    label="iFrame Embed-Code"
                    value={`<iframe src="${typeof window !== 'undefined' ? window.location.origin : ''}/schedule/${gymId}?embed=1" width="100%" height="600" frameborder="0" style="border-radius:12px"></iframe>`}
                    copied={copiedEmbedCode}
                    onCopy={() => copyWithFeedback(`<iframe src="${window.location.origin}/schedule/${gymId}?embed=1" width="100%" height="600" frameborder="0" style="border-radius:12px"></iframe>`, setCopiedEmbedCode)}
                  />
                ) : (
                  <UpgradeGate plan="grow" onUpgrade={handleUpgrade} feature="Website-Embed" />
                )}
              </div>
            </div>
          )}

          {/* Trainer & Personal */}
          <div className={sectionCls}>
            <SectionHeader icon={<Users size={12} />} title="Trainer & Personal" />
            <div className="p-5 space-y-4">
              <form onSubmit={handleStaffInvite} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Name</label>
                    <input value={staffName} onChange={e => setStaffName(e.target.value)} required placeholder="Max Mustermann" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Email</label>
                    <input type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} required placeholder="trainer@gym.de" className={inputCls} />
                  </div>
                </div>
                <button type="submit" disabled={staffInviting} className={saveBtnCls}>
                  <UserPlus size={14} />
                  {staffInviting ? 'Einladung wird erstellt…' : 'Trainer einladen'}
                </button>
              </form>

              {staffInviteUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                    <Link2 size={11} /> Einladungs-Link (jetzt kopieren)
                  </p>
                  <CopyRow label="" value={staffInviteUrl} copied={copiedStaff} onCopy={() => copyWithFeedback(staffInviteUrl, setCopiedStaff)} />
                  {staffEmailSent
                    ? <p className="text-xs text-zinc-500">✓ Einladungs-E-Mail wurde gesendet.</p>
                    : <p className="text-xs text-amber-700">Kein Resend konfiguriert — Link manuell senden.</p>
                  }
                </div>
              )}

              {staffList.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-zinc-500">Aktuelles Personal ({staffList.length})</p>
                  <div className="divide-y divide-gray-100 rounded-lg border border-zinc-200 overflow-hidden">
                    {staffList.map(s => {
                      const inviteLink = s.invite_token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/staff/accept?token=${s.invite_token}` : null
                      return (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-800 truncate">{s.name}</p>
                            <p className="text-xs text-zinc-400 truncate">{s.email}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.accepted_at ? 'bg-zinc-200 text-zinc-700 border border-zinc-300' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                              {s.accepted_at ? 'Aktiv' : 'Eingeladen'}
                            </span>
                            {!s.accepted_at && inviteLink && (
                              <button type="button"
                                onClick={() => copyWithFeedback(inviteLink, setCopiedStaff)}
                                className="text-zinc-300 hover:text-amber-500 transition-colors" title="Link kopieren">
                                <Copy size={13} />
                              </button>
                            )}
                            <button type="button" onClick={() => handleStaffDelete(s.id)} className="text-zinc-300 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: VERTRÄGE ─────────────────────────────────────────────────── */}
      {activeTab === 'vertraege' && (
        <div className="space-y-4">

          {/* Membership plans */}
          <div className={sectionCls}>
            <div className={`${sectionHeaderCls} flex items-center justify-between`}>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <Package size={12} /> Mitgliedschafts-Tarife
              </p>
              {!planFormOpen && (
                <button type="button" onClick={() => { setPlanFormOpen(true); setEditingPlanId(null); setPlanForm({ name: '', description: '', price: '', billingInterval: 'monthly', contractMonths: '0' }) }}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-500 font-medium">
                  <Plus size={12} /> Tarif hinzufügen
                </button>
              )}
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-500">
                Definiere Tarife mit Preis, Laufzeit und Abrechnungsintervall. Mitglieder können über ihr Portal einen Wechsel anfordern.
              </p>

              {/* Plan form */}
              {planFormOpen && (
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                    {editingPlanId ? 'Tarif bearbeiten' : 'Neuer Tarif'}
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Name *</label>
                    <input value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="z.B. Jahresvertrag" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Beschreibung</label>
                    <input value={planForm.description} onChange={e => setPlanForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="z.B. Günstigster Preis, volle Flexibilität" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Preis (€) *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">€</span>
                        <input value={planForm.price} onChange={e => setPlanForm(p => ({ ...p, price: e.target.value }))}
                          placeholder="89,00" className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-white border border-zinc-200 text-zinc-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Abrechnungsintervall</label>
                      <select value={planForm.billingInterval} onChange={e => setPlanForm(p => ({ ...p, billingInterval: e.target.value }))} className={inputCls}>
                        <option value="monthly">Monatlich</option>
                        <option value="biannual">Halbjährlich</option>
                        <option value="annual">Jährlich</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Mindestlaufzeit</label>
                    <select value={planForm.contractMonths} onChange={e => setPlanForm(p => ({ ...p, contractMonths: e.target.value }))} className={inputCls}>
                      <option value="0">Jederzeit kündbar</option>
                      <option value="3">3 Monate</option>
                      <option value="6">6 Monate</option>
                      <option value="12">12 Monate</option>
                      <option value="24">24 Monate</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setPlanFormOpen(false); setEditingPlanId(null) }}
                      className="flex-1 py-2.5 rounded-lg border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-white transition-colors">
                      Abbrechen
                    </button>
                    <button type="button" onClick={handlePlanSave} disabled={planSaving || !planForm.name || !planForm.price}
                      className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
                      {planSaving ? 'Wird gespeichert…' : editingPlanId ? 'Speichern' : 'Tarif anlegen'}
                    </button>
                  </div>
                </div>
              )}

              {/* Plans list */}
              {plans.length === 0 && !planFormOpen ? (
                <div className="text-center py-6 text-zinc-400 text-sm">
                  Noch keine Tarife angelegt. Klicke auf „Tarif hinzufügen".
                </div>
              ) : (
                <div className="space-y-2">
                  {plans.map(plan => {
                    const months = plan.billing_interval === 'annual' ? 12 : plan.billing_interval === 'biannual' ? 6 : 1
                    const perMonth = months > 1 ? ` (≈ €${(plan.price_cents / 100 / months).toFixed(2).replace('.', ',')}/Mo)` : ''
                    return (
                      <div key={plan.id} className="flex items-start gap-3 p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-zinc-800">{plan.name}</p>
                            {!plan.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-zinc-500">Inaktiv</span>}
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            €{(plan.price_cents / 100).toFixed(2).replace('.', ',')}
                            {plan.billing_interval === 'monthly' ? '/Monat' : plan.billing_interval === 'biannual' ? '/6 Monate' : '/Jahr'}
                            {perMonth}
                            {' · '}
                            {plan.contract_months === 0 ? 'Jederzeit kündbar' : `${plan.contract_months} Mo. Laufzeit`}
                          </p>
                          {plan.description && <p className="text-xs text-zinc-400 mt-0.5">{plan.description}</p>}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button type="button" onClick={() => handlePlanEdit(plan)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button type="button" onClick={() => handlePlanDelete(plan.id)}
                            className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Announcements */}
          <div className={sectionCls}>
            <div className={`${sectionHeaderCls} flex items-center justify-between`}>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <Megaphone size={12} /> Ankündigungen
              </p>
              {!annoFormOpen && (gymPlan === 'grow' || gymPlan === 'pro') && (
                <button type="button" onClick={() => setAnnoFormOpen(true)}
                  className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-500 font-medium">
                  <Plus size={12} /> Neue Ankündigung
                </button>
              )}
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-500">
                Ankündigungen werden im Mitglieder-Portal angezeigt. Gepinnte Beiträge erscheinen immer oben.
              </p>

              {(gymPlan !== 'grow' && gymPlan !== 'pro') ? (
                <UpgradeGate plan="grow" onUpgrade={handleUpgrade} feature="Ankündigungen & Pinnwand" />
              ) : annoFormOpen && (
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Neue Ankündigung</p>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Titel *</label>
                    <input value={annoForm.title} onChange={e => setAnnoForm(a => ({ ...a, title: e.target.value }))}
                      placeholder="z.B. Neue Öffnungszeiten ab März" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Text</label>
                    <textarea value={annoForm.body} onChange={e => setAnnoForm(a => ({ ...a, body: e.target.value }))}
                      rows={3} placeholder="Detailliertere Informationen…"
                      className="w-full px-3 py-2.5 rounded-lg bg-white border border-zinc-200 text-zinc-900 text-sm placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-y" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Läuft ab am</label>
                      <input type="date" value={annoForm.expiresAt} onChange={e => setAnnoForm(a => ({ ...a, expiresAt: e.target.value }))}
                        className={inputCls} />
                    </div>
                    <div className="flex items-center justify-between pt-5">
                      <div>
                        <p className="text-xs font-medium text-zinc-600">Gepinnt</p>
                        <p className="text-[10px] text-zinc-400">Immer oben anzeigen</p>
                      </div>
                      <button type="button" onClick={() => setAnnoForm(a => ({ ...a, isPinned: !a.isPinned }))}
                        className={`relative w-9 h-5 rounded-full transition-colors ${annoForm.isPinned ? 'bg-amber-500' : 'bg-zinc-200'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${annoForm.isPinned ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setAnnoFormOpen(false)}
                      className="flex-1 py-2.5 rounded-lg border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-white transition-colors">
                      Abbrechen
                    </button>
                    <button type="button" onClick={handleAnnoSave} disabled={annoSaving || !annoForm.title}
                      className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors">
                      {annoSaving ? 'Wird gespeichert…' : 'Veröffentlichen'}
                    </button>
                  </div>
                </div>
              )}

              {announcements.length === 0 && !annoFormOpen ? (
                <div className="text-center py-6 text-zinc-400 text-sm">
                  Noch keine Ankündigungen. Klicke auf „Neue Ankündigung".
                </div>
              ) : (
                <div className="space-y-2">
                  {announcements.map(a => (
                    <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border ${a.is_pinned ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-zinc-50'}`}>
                      <div className="flex-shrink-0 mt-0.5">
                        {a.is_pinned ? <Pin size={12} className="text-amber-500" /> : <Megaphone size={12} className="text-zinc-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800">{a.title}</p>
                        {a.body && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{a.body}</p>}
                        <p className="text-[10px] text-zinc-400 mt-1">
                          {new Date(a.created_at).toLocaleDateString('de-DE')}
                          {a.expires_at && ` · läuft ab ${new Date(a.expires_at).toLocaleDateString('de-DE')}`}
                        </p>
                      </div>
                      <button type="button" onClick={() => handleAnnoDelete(a.id)}
                        className="flex-shrink-0 p-1.5 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── UpgradeGate ────────────────────────────────────────────────────────── */
function UpgradeGate({ plan, feature, onUpgrade }: {
  plan: string
  feature: string
  onUpgrade: (plan: string) => void
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/60 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
        <Zap size={16} className="text-amber-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-zinc-900">{feature} — {plan.charAt(0).toUpperCase() + plan.slice(1)} oder höher</p>
        <p className="text-xs text-zinc-500 mt-0.5">Upgrade um diese Funktion freizuschalten.</p>
      </div>
      <button
        type="button"
        onClick={() => onUpgrade(plan)}
        className="flex-shrink-0 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
      >
        <Zap size={12} /> Upgrade auf {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </button>
    </div>
  )
}
