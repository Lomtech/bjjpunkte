'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Mail, Send, Users, UserPlus, AlertCircle, Check, Loader2, Clock, Megaphone, FileText, Image as ImageIcon } from 'lucide-react'
import { CommunicationTabs } from '@/app/dashboard/_components/CommunicationTabs'

/**
 * Communication-Dashboard für Owner.
 *
 * Bulk-Mail an Mitglieder + Leads. DSGVO:
 *  - Mitglieder: Art. 6(1)(f) berechtigtes Interesse (Bestandskunden)
 *  - Leads: Nur mit explizitem marketing_email_consent
 *
 * Audit-Log automatisch in gym_bulk_mails (nicht UI-sichtbar in MVP).
 */

type Audience = 'members' | 'leads' | 'both'
type Filter = 'active' | 'all' | 'recent'
type MailKind = 'announcement' | 'post'

interface RecipientPreview {
  audience: Audience
  filter: Filter
  member_count: number
  lead_count: number
  total: number
  gym_name: string
}

export default function CommunicationPage() {
  const [audience, setAudience] = useState<Audience>('members')
  const [filter, setFilter] = useState<Filter>('active')
  const [kind, setKind] = useState<MailKind>('announcement')
  const [coverUrl, setCoverUrl] = useState('')
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [preview, setPreview] = useState<RecipientPreview | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number; recipients: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // Lade Empfänger-Preview
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch(`/api/gym-mail/recipients?audience=${audience}&filter=${filter}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) return
        const data = await res.json() as RecipientPreview
        if (!cancelled) setPreview(data)
      } catch { /* silent */ }
    })()
    return () => { cancelled = true }
  }, [audience, filter])

  async function handleSend() {
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Nicht eingeloggt')
      const res = await fetch('/api/gym-mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ audience, filter, subject, html, kind, cover_url: coverUrl.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Versand fehlgeschlagen')
      setResult({ sent: data.sent, failed: data.failed, recipients: data.recipients })
      setSubject('')
      setHtml('')
      setCoverUrl('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setSending(false)
      setShowConfirm(false)
    }
  }

  const minBody = kind === 'post' ? 50 : 10
  const canSend = subject.trim().length > 0 && html.trim().length >= minBody && (preview?.total ?? 0) > 0

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      {/* Geteilte Sub-Tabs „Mail | Inhalte" — siehe CommunicationTabs */}
      <CommunicationTabs />
      <div className="mb-6">
        <p className="text-sm text-zinc-500 leading-relaxed max-w-2xl">
          Verschicke <strong>Ank&uuml;ndigungen</strong> (kurz, Trainings­info, Hinweis) und{' '}
          <strong>Beiträge</strong> (länger, Turnier-Bericht, Newsletter mit Cover-Bild) an
          Mitglieder, Probetraining-Leads oder beide. DSGVO-konform: Mitglieder ({'§'}§6(1)(f)),
          Leads nur mit Marketing-Consent. Jede Mail hat 1-Klick-Unsubscribe.
        </p>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <Check className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-emerald-900">Mail verschickt</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                {result.sent} von {result.recipients} Empfängern erfolgreich.
                {result.failed > 0 && <> {result.failed} fehlgeschlagen (Email ungültig oder geblockt).</>}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4 text-sm text-rose-900">
          <strong>Fehler:</strong> {error}
        </div>
      )}

      {/* Type-Picker — Ankündigung vs. Beitrag */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-3 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2 px-1">Art der Nachricht</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind('announcement')}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
              kind === 'announcement' ? 'bg-amber-50 border-amber-300' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${kind === 'announcement' ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
              <Megaphone size={16} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-zinc-900 text-sm">📢 Ankündigung</p>
              <p className="text-xs text-zinc-500 leading-snug mt-0.5">Kurze Info — Trainings­änderung, Hinweis, Erinnerung. Schlanker Mail-Look.</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setKind('post')}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
              kind === 'post' ? 'bg-amber-50 border-amber-300' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${kind === 'post' ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-zinc-900 text-sm">📝 Beitrag</p>
              <p className="text-xs text-zinc-500 leading-snug mt-0.5">Längerer Inhalt — Turnier-Bericht, Newsletter, Story. Mit optionalem Cover-Bild.</p>
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recipient-Picker */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
            <Users size={14} /> Empfänger
          </h2>

          <div className="space-y-3">
            <button onClick={() => setAudience('members')}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-colors ${audience === 'members' ? 'bg-amber-50 border-amber-300' : 'border-zinc-200 hover:border-zinc-300'}`}>
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900"><Users size={14} /> Mitglieder</span>
              {preview && audience === 'members' && <span className="text-xs font-mono text-amber-700">{preview.member_count}</span>}
            </button>

            <button onClick={() => setAudience('leads')}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-colors ${audience === 'leads' ? 'bg-amber-50 border-amber-300' : 'border-zinc-200 hover:border-zinc-300'}`}>
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900"><UserPlus size={14} /> Probetraining-Leads</span>
              {preview && audience === 'leads' && <span className="text-xs font-mono text-amber-700">{preview.lead_count}</span>}
            </button>

            <button onClick={() => setAudience('both')}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-colors ${audience === 'both' ? 'bg-amber-50 border-amber-300' : 'border-zinc-200 hover:border-zinc-300'}`}>
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">Beide</span>
              {preview && audience === 'both' && <span className="text-xs font-mono text-amber-700">{preview.total}</span>}
            </button>
          </div>

          {/* Filter */}
          <div className="mt-5 pt-5 border-t border-zinc-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Filter</p>
            {audience !== 'leads' && (
              <label className="flex items-center gap-2 mb-2 text-sm cursor-pointer">
                <input type="radio" name="filter" checked={filter === 'active'} onChange={() => setFilter('active')} className="accent-amber-500" />
                <span className="text-zinc-700">Nur aktive Mitglieder</span>
              </label>
            )}
            {audience !== 'leads' && (
              <label className="flex items-center gap-2 mb-2 text-sm cursor-pointer">
                <input type="radio" name="filter" checked={filter === 'all'} onChange={() => setFilter('all')} className="accent-amber-500" />
                <span className="text-zinc-700">Alle (auch inaktive)</span>
              </label>
            )}
            {audience !== 'members' && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="filter" checked={filter === 'recent'} onChange={() => setFilter('recent')} className="accent-amber-500" />
                <span className="text-zinc-700">Letzte 6 Monate</span>
              </label>
            )}
          </div>

          {/* DSGVO-Info */}
          <div className="mt-5 pt-5 border-t border-zinc-100">
            <p className="text-[10px] text-zinc-400 leading-relaxed flex items-start gap-2">
              <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
              <span>
                Mitglieder: Art. 6(1)(f) DSGVO (berechtigtes Interesse).<br/>
                Leads: nur mit Marketing-Consent beim Probetraining-Formular.<br/>
                Alle Empfänger bekommen 1-Klick-Unsubscribe-Link.
              </span>
            </p>
          </div>
        </div>

        {/* Editor */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 lg:col-span-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
            {kind === 'post' ? <><FileText size={14} /> Beitrag verfassen</> : <><Megaphone size={14} /> Ankündigung verfassen</>}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                {kind === 'post' ? 'Titel *' : 'Betreff *'}
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value.slice(0, 200))}
                placeholder={kind === 'post'
                  ? 'z.B. Erfolg beim Bayern-Cup — 3 Gold, 2 Silber'
                  : 'z.B. Trainingsausfall am Freitag wegen Feiertag'}
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
              />
              <p className="text-[10px] text-zinc-400 mt-1">{subject.length}/200 Zeichen</p>
            </div>

            {/* Cover-Bild — nur bei Beitrag */}
            {kind === 'post' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5 flex items-center gap-1.5">
                  <ImageIcon size={11} /> Cover-Bild URL <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={coverUrl}
                  onChange={e => setCoverUrl(e.target.value.slice(0, 1024))}
                  placeholder="https://… z.B. ein Foto vom Turnier oder Event"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none"
                />
                <p className="text-[10px] text-zinc-400 mt-1">
                  Wird oben im Beitrag als Banner angezeigt. https:// erforderlich. Leer lassen = kein Banner.
                </p>
                {coverUrl && /^https?:\/\//i.test(coverUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="" className="mt-2 max-h-32 rounded-lg border border-zinc-200 object-cover w-full"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                {kind === 'post' ? 'Inhalt' : 'Nachricht'} * <span className="text-zinc-400 font-normal">(HTML erlaubt — &lt;b&gt;, &lt;a href=&quot;…&quot;&gt;, &lt;br&gt;)</span>
              </label>
              <textarea
                value={html}
                onChange={e => setHtml(e.target.value.slice(0, 50000))}
                placeholder={kind === 'post'
                  ? `Hallo {{first_name}},\n\nam Wochenende war unser Team beim Bayern-Cup in Augsburg.\nMit dabei waren: Anna, Max, Tom und Lisa — alle haben großartig gekämpft.\n\nErgebnisse:\n• Anna: Gold (Damen –63 kg)\n• Max: Silber (Herren –83 kg)\n• …\n\nNächstes Highlight: Vereinsmeisterschaft am 15. Mai. Anmeldung läuft.\n\nOss,\nDein Coach-Team`
                  : `Hallo {{first_name}},\n\nam Freitag fällt das Abendtraining wegen Feiertag aus. Samstag normal um 10:00 Uhr.\n\nViele Grüße,\nDein Coach-Team`}
                rows={kind === 'post' ? 18 : 8}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-mono focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none resize-y"
              />
              <p className="text-[10px] text-zinc-400 mt-1">
                {html.length}/50.000 Zeichen · min {minBody} · Variable <code className="bg-zinc-100 px-1 rounded">{'{{first_name}}'}</code> wird pro Empfänger ersetzt
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 pt-3 border-t border-zinc-100">
              <div className="text-sm text-zinc-600">
                {preview ? (
                  <span>
                    Wird an <strong>{preview.total} Empfänger</strong> verschickt
                    {audience === 'members' && <> (nur Mitglieder)</>}
                    {audience === 'leads' && <> (nur Leads mit Consent)</>}
                  </span>
                ) : <span className="text-zinc-400">Empfänger wird geladen...</span>}
              </div>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!canSend || sending}
                className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? 'Versende…' : 'Senden'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm-Modal */}
      {showConfirm && preview && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-5"
          onClick={() => !sending && setShowConfirm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl"
            onClick={e => e.stopPropagation()}>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2">⚠️ Bestätigung</p>
            <h3 className="text-xl font-black text-zinc-900 mb-3">
              {kind === 'post' ? 'Beitrag' : 'Ankündigung'} an <span className="text-amber-600 tabular-nums">{preview.total}</span> Empfänger senden?
            </h3>
            <div className="bg-zinc-50 rounded-lg p-3 mb-4 text-xs text-zinc-600 leading-relaxed">
              <p><strong>{kind === 'post' ? 'Titel' : 'Betreff'}:</strong> {subject}</p>
              <p className="mt-1"><strong>Empfänger:</strong> {preview.member_count} Mitglieder + {preview.lead_count} Leads</p>
              {kind === 'post' && coverUrl && /^https?:\/\//i.test(coverUrl) && (
                <p className="mt-1"><strong>Cover:</strong> <span className="break-all">{coverUrl.length > 60 ? coverUrl.slice(0, 60) + '…' : coverUrl}</span></p>
              )}
            </div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              <Clock size={11} className="inline mr-1" />
              Versand dauert ~{Math.ceil(preview.total / 5)} Sekunden. Du kannst die Seite verlassen — Versand läuft im Hintergrund.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
                Abbrechen
              </button>
              <button onClick={handleSend} disabled={sending}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-400 text-white text-sm font-bold px-4 py-2.5 rounded-xl">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {sending ? 'Versende…' : 'Bestätigen & Senden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer-Link */}
      <div className="mt-8 text-xs text-zinc-400">
        <Link href="/dashboard" className="hover:text-zinc-700">← Zurück zum Dashboard</Link>
      </div>
    </div>
  )
}
