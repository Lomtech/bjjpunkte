'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, ShieldCheck, AlertTriangle, Printer, Check, FileSignature, Loader2 } from 'lucide-react'
import { AVVDocument, AVV_VERSION } from '@/lib/legal/avv-content'

interface Acceptance {
  id: string
  signed_name: string
  signed_role: string | null
  signed_email: string
  avv_version: string
  accepted_at: string
  withdrawn_at: string | null
}

interface GymInfo {
  id: string
  name: string | null
  legal_name: string | null
  legal_address: string | null
  address: string | null
  owner_id: string
}

export default function AVVSettingsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [gym, setGym]                 = useState<GymInfo | null>(null)
  const [acceptance, setAcceptance]   = useState<Acceptance | null>(null)
  const [signedName, setSignedName]   = useState('')
  const [signedRole, setSignedRole]   = useState('Inhaber:in')
  const [accepted, setAccepted]       = useState(false)
  const [confirmed, setConfirmed]     = useState(false)
  const [printing, setPrinting]       = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        // Find user's gym (user is owner)
        const { data: g } = await supabase
          .from('gyms')
          .select('id, name, legal_name, legal_address, address, owner_id')
          .eq('owner_id', user.id)
          .maybeSingle()

        if (!g) {
          if (!cancelled) {
            setError('Kein Gym gefunden, das du besitzt.')
            setLoading(false)
          }
          return
        }

        if (cancelled) return
        setGym(g as GymInfo)
        setSignedName(user.user_metadata?.full_name || user.email?.split('@')[0] || '')

        // Status laden — Bearer-Token-Auth, weil supabase/client localStorage
        // statt Cookie-Session nutzt (Audit 2026-05-11). Andere Dashboard-Pages
        // folgen demselben Pattern (siehe dashboard/settings/page.tsx).
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token ?? ''
        const res = await fetch(`/api/avv/status?gym_id=${g.id}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (!cancelled) setAcceptance(json.acceptance)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [router, supabase])

  async function handleSign() {
    if (!gym) return
    if (!signedName.trim() || signedName.trim().length < 3) {
      setError('Bitte gib deinen vollständigen Namen ein.')
      return
    }
    if (!accepted || !confirmed) {
      setError('Bitte bestätige beide Häkchen.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      // Bearer-Token-Auth (siehe Status-fetch oben für Begründung).
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''
      const res = await fetch('/api/avv/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          gym_id: gym.id,
          signed_name: signedName.trim(),
          signed_role: signedRole.trim() || null,
          accept: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fehler beim Speichern')
      setAcceptance(json.acceptance as Acceptance)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setTimeout(() => setPrinting(false), 500)
    }, 100)
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={28} />
      </div>
    )
  }

  if (!gym) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-zinc-500">{error || 'Kein Gym gefunden.'}</p>
      </div>
    )
  }

  const isSigned = !!acceptance && !acceptance.withdrawn_at
  const isOldVersion = !!acceptance && acceptance.avv_version !== AVV_VERSION

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">

      {/* Print-only header — visible only when printing */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold mb-1">Auftragsverarbeitungsvertrag</h1>
        <p className="text-sm text-zinc-500">Version {AVV_VERSION} &middot; Druck {new Date().toLocaleDateString('de-DE')}</p>
      </div>

      {/* Back nav (hidden on print) */}
      <div className="print:hidden mb-4">
        <Link href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          <ChevronLeft size={16} /> Einstellungen
        </Link>
      </div>

      {/* Status banner (hidden on print) */}
      <div className="print:hidden mb-6">
        {isSigned && !isOldVersion && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-emerald-600 flex-shrink-0 mt-0.5" size={22} />
              <div className="flex-1">
                <p className="font-semibold text-emerald-900">AVV ist unterzeichnet</p>
                <p className="text-sm text-emerald-700 mt-0.5">
                  Unterzeichnet von <strong>{acceptance!.signed_name}</strong>
                  {acceptance!.signed_role ? ` (${acceptance!.signed_role})` : ''} am{' '}
                  {new Date(acceptance!.accepted_at).toLocaleString('de-DE')} &middot; Version {acceptance!.avv_version}
                </p>
                <button
                  onClick={handlePrint}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
                >
                  <Printer size={13} /> Als PDF speichern / drucken
                </button>
              </div>
            </div>
          </div>
        )}

        {isOldVersion && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={22} />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Neue AVV-Version verfügbar</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Du hast Version {acceptance!.avv_version} unterzeichnet. Aktuelle Version: {AVV_VERSION}.
                  Bitte erneut zustimmen.
                </p>
              </div>
            </div>
          </div>
        )}

        {!isSigned && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={22} />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">AVV noch nicht unterzeichnet</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Pflicht nach Art. 28 DSGVO. Lies den Vertrag durch und akzeptiere ihn unten.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AVV Document */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 md:p-10 mb-6 print:border-none print:shadow-none print:p-0">
        <AVVDocument
          gymName={gym.name || '—'}
          gymAddress={gym.legal_address || gym.address}
          gymLegalName={gym.legal_name}
        />

        {isSigned && (
          <div className="not-prose mt-8 pt-6 border-t border-zinc-200">
            <p className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">Elektronische Unterschriften</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Auftragsverarbeiter (Osss)</p>
                <p className="text-sm text-zinc-600">Lom-Ali Imadaev</p>
                <p className="text-xs text-zinc-400 mt-1">Per Veröffentlichung des AVV-Templates akzeptiert</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900">Verantwortlicher (Gym)</p>
                <p className="text-sm text-zinc-600">
                  {acceptance!.signed_name}
                  {acceptance!.signed_role ? <span className="text-zinc-400"> ({acceptance!.signed_role})</span> : null}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {new Date(acceptance!.accepted_at).toLocaleString('de-DE')}
                  <br />
                  {acceptance!.signed_email}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Signature form (hidden on print, hidden if signed) */}
      {!isSigned && (
        <div className="print:hidden bg-white border border-zinc-200 rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-lg text-zinc-900 mb-1 flex items-center gap-2">
            <FileSignature size={18} className="text-amber-500" />
            Elektronisch unterzeichnen
          </h2>
          <p className="text-sm text-zinc-500 mb-5">
            Nach eIDAS Art. 25(1) rechtsverbindlich. Audit-Trail (Name, Zeitstempel, IP, User-Agent) wird
            zur Beweissicherung gespeichert.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Vollständiger Name *</label>
              <input
                type="text"
                value={signedName}
                onChange={e => setSignedName(e.target.value)}
                placeholder="z.B. Max Mustermann"
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">Funktion / Rolle (optional)</label>
              <input
                type="text"
                value={signedRole}
                onChange={e => setSignedRole(e.target.value)}
                placeholder="z.B. Inhaber:in, Geschäftsführer:in"
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-zinc-50 transition-colors">
              <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-amber-500" />
              <span className="text-sm text-zinc-700">
                Ich habe den Auftragsverarbeitungsvertrag (Version {AVV_VERSION}) gelesen und stimme ihm in
                vollem Umfang zu.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-zinc-50 transition-colors">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-amber-500" />
              <span className="text-sm text-zinc-700">
                Ich bestätige, dass ich zur rechtsverbindlichen Vertretung des oben genannten Verantwortlichen
                berechtigt bin.
              </span>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              onClick={handleSign}
              disabled={saving || !signedName.trim() || !accepted || !confirmed}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-semibold px-5 py-3 transition-colors"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              {saving ? 'Wird unterzeichnet...' : 'AVV elektronisch unterzeichnen'}
            </button>

            <p className="text-xs text-zinc-400 text-center">
              Mit dem Klick erfolgt die Unterzeichnung. Der Vertrag ist sofort wirksam.
            </p>
          </div>
        </div>
      )}

      {printing && (
        <div className="print:hidden fixed bottom-4 right-4 bg-zinc-900 text-white text-xs px-3 py-2 rounded-lg">
          Druckdialog wird vorbereitet...
        </div>
      )}
    </div>
  )
}
