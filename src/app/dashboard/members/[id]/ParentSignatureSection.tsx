'use client'

// Feature #1 UI (Sprint 2026-05-27): Eltern-Co-Sign für Minderjährige.
//
// Sichtbar im Member-Detail wenn date_of_birth zeigt is_minor=true.
// Banner-Warning wenn parent_signed_at IS NULL (Vertrag nicht co-signed).
// Modal: Form (parent_first/last_name, email, phone, relationship-Select,
// sole_custody-Checkbox, consent_text) + SignaturePad.
// POST /api/members/[id]/parent-signature.

import { useState, useRef, useEffect } from 'react'
import { ShieldAlert, Check, X, RotateCcw, Pen, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'

type ParentRel = 'mother' | 'father' | 'guardian' | 'other'

interface ParentData {
  parent_first_name: string | null
  parent_last_name: string | null
  parent_email: string | null
  parent_phone: string | null
  parent_relationship: string | null
  parent_signature_data: string | null
  parent_signed_at: string | null
  parent_consent_ip: string | null
  parent_consent_text: string | null
  sole_custody_declared: boolean
}

interface Props {
  memberId: string
  dateOfBirth: string | null
  firstName: string
  lastName: string
  onUpdate?: () => void
}

const REL_LABELS: Record<ParentRel, string> = {
  mother:   'Mutter',
  father:   'Vater',
  guardian: 'Vormund',
  other:    'Sonstige sorgeberechtigte Person',
}

function calcAgeYears(dob: string | null): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ── Canvas-Signature-Pad (adaptiert aus signup/[token]/page.tsx) ─── */
function SignaturePad({ onChange }: { onChange: (data: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasData, setHasData] = useState(false)

  function getPos(e: React.MouseEvent | React.TouchEvent, rect: DOMRect) {
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }
  function start(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')!, rect = c.getBoundingClientRect(), pos = getPos(e, rect)
    ctx.beginPath(); ctx.moveTo(pos.x * c.width / rect.width, pos.y * c.height / rect.height)
    drawing.current = true
  }
  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')!, rect = c.getBoundingClientRect(), pos = getPos(e, rect)
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f172a'
    ctx.lineTo(pos.x * c.width / rect.width, pos.y * c.height / rect.height); ctx.stroke()
    setHasData(true)
    onChange(c.toDataURL('image/png'))
  }
  function stop() { drawing.current = false }
  function clear() {
    const c = canvasRef.current; if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setHasData(false); onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600} height={160}
          className="w-full touch-none cursor-crosshair block"
          style={{ height: '160px' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
        />
        {!hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <Pen size={20} className="text-zinc-300 mb-1" />
            <p className="text-zinc-400 text-sm">Hier unterschreiben</p>
          </div>
        )}
      </div>
      {hasData && (
        <button type="button" onClick={clear}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900">
          <RotateCcw size={12} /> Unterschrift löschen
        </button>
      )}
    </div>
  )
}

export function ParentSignatureSection({ memberId, dateOfBirth, firstName, lastName, onUpdate }: Props) {
  const toast = useToast()
  const [parent, setParent] = useState<ParentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form-State
  const [pFirst, setPFirst] = useState('')
  const [pLast, setPLast] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [pPhone, setPPhone] = useState('')
  const [pRel, setPRel] = useState<ParentRel>('mother')
  const [pSoleCustody, setPSoleCustody] = useState(false)
  const [pSignature, setPSignature] = useState<string | null>(null)
  const [pConsentChecked, setPConsentChecked] = useState(false)

  const age = calcAgeYears(dateOfBirth)
  const isMinor = age !== null && age < 18
  const hasParentSig = parent !== null && parent.parent_signed_at !== null

  useEffect(() => {
    async function load() {
      const sb = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb.from('members') as any)
        .select('parent_first_name, parent_last_name, parent_email, parent_phone, parent_relationship, parent_signature_data, parent_signed_at, parent_consent_ip, parent_consent_text, sole_custody_declared')
        .eq('id', memberId)
        .maybeSingle()
      if (data) setParent(data as ParentData)
      setLoading(false)
    }
    load()
  }, [memberId])

  async function submit() {
    if (!pFirst.trim() || !pLast.trim()) {
      toast.error('Vor- und Nachname des/der Erziehungsberechtigten sind Pflicht.')
      return
    }
    if (!pSignature) {
      toast.error('Bitte zuerst unterschreiben.')
      return
    }
    if (!pConsentChecked) {
      toast.error('Bitte die Einwilligungs-Checkbox bestätigen.')
      return
    }
    setSaving(true)
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { setSaving(false); toast.error('Bitte erneut einloggen.'); return }

    const consentText = `Hiermit bestätige ich, dass ich erziehungsberechtigt für ${firstName} ${lastName} bin und der Mitgliedschaft im Studio zustimme. Ich versichere${pSoleCustody ? ', allein sorgeberechtigt zu sein' : ', dass auch der/die andere Sorgeberechtigte zustimmt'}.`
    const res = await fetch(`/api/members/${memberId}/parent-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        parent_first_name: pFirst.trim(),
        parent_last_name: pLast.trim(),
        parent_email: pEmail.trim() || null,
        parent_phone: pPhone.trim() || null,
        parent_relationship: pRel,
        parent_signature_data: pSignature,
        parent_consent_text: consentText,
        sole_custody_declared: pSoleCustody,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Fehler beim Speichern')
      return
    }
    const json = await res.json()
    setParent(json.member)
    setShowModal(false)
    toast.success('Eltern-Signatur gespeichert (eIDAS-Audit-Trail erstellt)')
    onUpdate?.()
  }

  async function deleteParentSig() {
    if (!confirm('Eltern-Unterschrift wirklich entfernen? Audit-Spur bleibt im audit_log.')) return
    const sb = createClient()
    const { data: { session } } = await sb.auth.getSession()
    if (!session) return
    const res = await fetch(`/api/members/${memberId}/parent-signature`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) {
      toast.error('Fehler beim Löschen')
      return
    }
    setParent(null)
    toast.success('Eltern-Signatur entfernt.')
    onUpdate?.()
  }

  // Nicht anzeigen, wenn DOB unbekannt oder Member volljährig
  if (loading) return null
  if (!isMinor && !hasParentSig) return null

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 mb-4">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-500" />
          <h2 className="text-base font-bold text-zinc-900">Eltern-Co-Sign</h2>
          {isMinor && (
            <span className="text-xs text-zinc-500">({age} J. — minderjährig)</span>
          )}
        </div>
      </header>

      {/* Banner: minderjährig ohne Sig */}
      {isMinor && !hasParentSig && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm text-amber-900">
          <strong>Achtung:</strong> {firstName} ist minderjährig. Der Mitgliedsvertrag braucht die Unterschrift einer
          sorgeberechtigten Person nach BGB §§ 1626/1629.
        </div>
      )}

      {/* Bestehende Signatur */}
      {hasParentSig && parent && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-zinc-500">Erziehungsberechtigte/r</div>
              <div className="font-medium text-zinc-900">
                {parent.parent_first_name} {parent.parent_last_name}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {parent.parent_relationship && REL_LABELS[parent.parent_relationship as ParentRel]}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Unterzeichnet am</div>
              <div className="font-medium text-zinc-900">{fmtDate(parent.parent_signed_at)}</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                IP: {parent.parent_consent_ip ?? '—'}
              </div>
            </div>
            {parent.parent_email && (
              <div>
                <div className="text-xs text-zinc-500">Kontakt</div>
                <div className="text-sm text-zinc-900">{parent.parent_email}</div>
                {parent.parent_phone && <div className="text-xs text-zinc-500">{parent.parent_phone}</div>}
              </div>
            )}
            <div>
              <div className="text-xs text-zinc-500">Sorge-Status</div>
              <div className="text-sm text-zinc-900">
                {parent.sole_custody_declared ? 'Alleinige Sorge erklärt' : 'Gemeinsame Sorge'}
              </div>
            </div>
          </div>

          {/* Signatur-Image */}
          {parent.parent_signature_data && (
            <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={parent.parent_signature_data} alt="Eltern-Signatur" className="max-h-24 mx-auto" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowModal(true)}
              className="text-xs px-3 py-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 text-zinc-700">
              Aktualisieren
            </button>
            <button onClick={deleteParentSig}
              className="text-xs px-3 py-1.5 rounded-md border border-rose-200 hover:bg-rose-50 text-rose-600 flex items-center gap-1">
              <Trash2 size={12} /> Entfernen
            </button>
          </div>
        </div>
      )}

      {/* Erfassen-Button wenn fehlt */}
      {!hasParentSig && (
        <button onClick={() => setShowModal(true)}
          className="w-full px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm">
          Eltern-Unterschrift erfassen
        </button>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
             onClick={() => !saving && setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6"
               onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900">Eltern-Unterschrift erfassen</h3>
              <button onClick={() => !saving && setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </header>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-zinc-500 block mb-1">Vorname *</span>
                  <input type="text" value={pFirst} onChange={e => setPFirst(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500 block mb-1">Nachname *</span>
                  <input type="text" value={pLast} onChange={e => setPLast(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500 block mb-1">E-Mail (optional)</span>
                  <input type="email" value={pEmail} onChange={e => setPEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-500 block mb-1">Telefon (optional)</span>
                  <input type="tel" value={pPhone} onChange={e => setPPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-zinc-500 block mb-1">Beziehung *</span>
                <select value={pRel} onChange={e => setPRel(e.target.value as ParentRel)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm">
                  {(Object.keys(REL_LABELS) as ParentRel[]).map(k => (
                    <option key={k} value={k}>{REL_LABELS[k]}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={pSoleCustody} onChange={e => setPSoleCustody(e.target.checked)}
                  className="mt-0.5" />
                <span className="text-xs text-zinc-700">
                  Ich erkläre, <strong>allein sorgeberechtigt</strong> zu sein (BGB §1626a/§1671). Wenn nicht: der/die andere Sorgeberechtigte stimmt der Mitgliedschaft ebenfalls zu.
                </span>
              </label>

              <div className="border-t border-zinc-100 pt-3">
                <div className="text-xs text-zinc-500 mb-2">
                  Bitte hier unterschreiben (Touch oder Maus):
                </div>
                <SignaturePad onChange={setPSignature} />
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={pConsentChecked} onChange={e => setPConsentChecked(e.target.checked)}
                  className="mt-0.5" />
                <span className="text-xs text-zinc-700">
                  Ich bestätige, dass ich erziehungsberechtigt für <strong>{firstName} {lastName}</strong> bin
                  und der Mitgliedschaft im Studio zustimme. Diese Unterschrift ist nach eIDAS Art. 25 rechtswirksam.
                </span>
              </label>
            </div>

            <footer className="flex justify-end gap-2 pt-5 border-t border-zinc-100 mt-5">
              <button onClick={() => setShowModal(false)} disabled={saving}
                className="px-4 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50">
                Abbrechen
              </button>
              <button onClick={submit} disabled={saving}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm flex items-center gap-1.5 disabled:opacity-50">
                <Check size={14} /> {saving ? 'Speichere…' : 'Unterschrift speichern'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}
